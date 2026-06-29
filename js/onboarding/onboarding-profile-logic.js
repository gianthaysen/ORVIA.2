/* ============================================================
   ORVIA · onboarding-profile-logic — REINE Basisprofil-Logik (kein DOM/Store/Supabase).
   Validierung, Normalisierung, Altersberechnung, Einheiten-Konvertierung.
   Über window.ORVIA.onboardingProfileLogic + module.exports.
   ============================================================ */
(function (root) {
  var SEX = ['male', 'female', 'diverse', 'prefer_not_to_say'];
  var LEVELS = ['beginner', 'intermediate', 'advanced', 'competitive'];
  var LB_PER_KG = 2.2046226218, CM_PER_IN = 2.54;

  // Strikte Zahlenerkennung: '175abc'/'70kg'/'1e3' werden abgelehnt; deutsches Komma kontrolliert.
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    var s = v.trim().replace(',', '.');
    if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;     // keine Exponenten/Zusatzzeichen
    var n = Number(s);
    return isFinite(n) ? n : null;
  }
  function intStrict(v) { var n = num(v); return (n != null && Math.floor(n) === n) ? n : null; }
  // Strukturierte ft/in-Validierung (statt nur Gesamtgröße).
  function parseFeetInches(feet, inches) {
    var fEmpty = (feet == null || String(feet).trim() === ''), iEmpty = (inches == null || String(inches).trim() === '');
    if (fEmpty && iEmpty) return { valid: true, cm: null };               // keine Eingabe
    var f = intStrict(feet), i = intStrict(inches);
    if (f == null || i == null) return { valid: false, cm: null, error: 'Bitte ganze Zahlen für Fuß und Zoll angeben.' };
    if (f < 0 || i < 0) return { valid: false, cm: null, error: 'Negative Werte sind nicht möglich.' };
    if (i > 11) return { valid: false, cm: null, error: 'Zoll muss zwischen 0 und 11 liegen.' };
    return { valid: true, cm: (f * 12 + i) * CM_PER_IN };
  }
  // Echtes Kalenderdatum 'YYYY-MM-DD' — lehnt z. B. 2020-02-30 ab.
  function parseDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-'), y = +p[0], m = +p[1], d = +p[2];
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
  }
  function calculateAge(birthDate, today) {
    var b = parseDate(birthDate); if (!b) return null;
    var t = (today instanceof Date) ? today : (parseDate(today) || new Date());
    var age = t.getFullYear() - b.getFullYear();
    var m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
    return age;
  }

  function normalizeProfile(raw) {
    raw = raw || {};
    var h = num(raw.heightCm), w = num(raw.weightKg);
    return {
      displayName: (typeof raw.displayName === 'string') ? raw.displayName.trim() : '',
      birthDate: (typeof raw.birthDate === 'string' && parseDate(raw.birthDate)) ? raw.birthDate : '',
      sex: SEX.indexOf(raw.sex) >= 0 ? raw.sex : '',
      heightCm: (h != null && h > 0) ? h : null,                 // NaN/Infinity/≤0 → null
      weightKg: (w != null && w > 0) ? w : null,
      unitSystem: raw.unitSystem === 'imperial' ? 'imperial' : 'metric',
      experienceLevel: LEVELS.indexOf(raw.experienceLevel) >= 0 ? raw.experienceLevel : ''
    };
  }

  // Nur technische Plausibilität — KEINE rechtliche Altersfreigabe, keine medizinische Bewertung.
  function validateProfile(profile, today) {
    var p = profile || {}, errors = {};
    var name = (typeof p.displayName === 'string') ? p.displayName.trim() : '';
    if (name.length < 2 || name.length > 50) errors.displayName = 'Bitte einen Namen mit 2–50 Zeichen angeben.';
    var bd = parseDate(p.birthDate), t = (today instanceof Date) ? today : new Date();
    if (!bd) errors.birthDate = 'Bitte ein gültiges Geburtsdatum auswählen.';
    else if (bd.getTime() > t.getTime()) errors.birthDate = 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
    else { var age = calculateAge(p.birthDate, t); if (age == null || age < 13 || age > 100) errors.birthDate = 'Bitte ein plausibles Alter (13–100 Jahre).'; }
    if (SEX.indexOf(p.sex) < 0) errors.sex = 'Bitte eine Auswahl treffen.';
    var h = num(p.heightCm); if (h == null || h < 100 || h > 250) errors.heightCm = 'Bitte eine Größe zwischen 100 und 250 cm angeben.';
    var w = num(p.weightKg); if (w == null || w < 30 || w > 300) errors.weightKg = 'Bitte ein Gewicht zwischen 30 und 300 kg angeben.';
    if (LEVELS.indexOf(p.experienceLevel) < 0) errors.experienceLevel = 'Bitte ein Niveau wählen.';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }
  function profileComplete(profile, today) { return validateProfile(profile, today).valid; }

  function cmToFeetInches(cm) { cm = num(cm); if (cm == null) return null; var ti = cm / CM_PER_IN; var feet = Math.floor(ti / 12); var inches = Math.round(ti - feet * 12); if (inches === 12) { feet++; inches = 0; } return { feet: feet, inches: inches }; }
  function feetInchesToCm(feet, inches) { feet = num(feet) || 0; inches = num(inches) || 0; return (feet * 12 + inches) * CM_PER_IN; }
  function kgToLb(kg) { kg = num(kg); if (kg == null) return null; return kg * LB_PER_KG; }
  function lbToKg(lb) { lb = num(lb); if (lb == null) return null; return lb / LB_PER_KG; }

  // Kontrollierte Übernahme aus bestehendem Profil (O.profile). Verwirft Unbekanntes, rät Gender nicht.
  function profileSeedFromExisting(src) {
    src = src || {};
    var sex = (SEX.indexOf(src.sex) >= 0) ? src.sex : (SEX.indexOf(src.gender) >= 0 ? src.gender : '');
    return normalizeProfile({
      displayName: (typeof src.name === 'string') ? src.name : (typeof src.displayName === 'string' ? src.displayName : ''),
      birthDate: (typeof src.birthDate === 'string') ? src.birthDate : '',
      sex: sex,
      heightCm: src.heightCm != null ? src.heightCm : (src.height != null ? src.height : null),
      weightKg: src.weightKg != null ? src.weightKg : (src.weight != null ? src.weight : null),
      unitSystem: src.unitSystem,
      experienceLevel: src.experienceLevel
    });
  }

  var api = {
    SEX: SEX, LEVELS: LEVELS, normalizeProfile: normalizeProfile, validateProfile: validateProfile,
    profileComplete: profileComplete, calculateAge: calculateAge, parseDate: parseDate,
    cmToFeetInches: cmToFeetInches, feetInchesToCm: feetInchesToCm, kgToLb: kgToLb, lbToKg: lbToKg,
    parseFeetInches: parseFeetInches, profileSeedFromExisting: profileSeedFromExisting, _num: num, _intStrict: intStrict
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.onboardingProfileLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
