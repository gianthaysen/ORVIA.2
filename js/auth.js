/* ============================================================
   ORVIA · Supabase Auth + Closed Beta Gate
   - Login: Supabase Auth E-Mail + Passwort.
   - Registrierung: nur via Edge Function register-with-invite.
   - App-Zugriff: gültige Session + aktives Profil.
   ============================================================ */
(function () {
  const CFG = window.ORVIA_CFG || {};
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;

  // VOR jedem möglichen failClosedAuth()-Aufruf deklarieren (sonst Temporal Dead Zone in buildGate).
  let mode = 'login';
  let gateEl = null;
  let activeUserId = null;
  let recoveryReady = false;
  let recoveryTimer = null;

  const SAFE_MESSAGES = {
    invite_only: 'Registrierung ist nur mit gültigem Beta-Code möglich.',
    invalid_invite: 'Beta-Code ungültig.',
    invite_used: 'Beta-Code wurde zu oft verwendet.',
    invite_expired: 'Beta-Code abgelaufen.',
    // #16.7: bewusst neutraler Server-Wortlaut (keine Account-Enumeration verschärfen),
    // aber NICHT mehr als „Beta-Code ungültig" maskiert (Diagnose-Verschleierung, Issue #14).
    email_taken: 'Diese E-Mail kann nicht verwendet werden.',
    email_failed: 'E-Mail konnte nicht bestätigt werden.',
    password_mismatch: 'Die Passwörter stimmen nicht überein.',
    weak_password: 'Das Passwort muss mindestens 8 Zeichen lang sein.'
  };

  // Reine Auth-Entscheidungen aus auth-logic.js (Single Source of Truth). KEIN stiller Fallback.
  const AL = window.ORVIA && window.ORVIA.authLogic;

  function pwRulesHTML(c) {
    function row(ok, t) { return '<span class="pwrule ' + (ok ? 'ok' : '') + '">' + (ok ? '✓' : '○') + ' ' + t + '</span>'; }
    return row(c.len, 'min. 8 Zeichen') + row(c.upper, 'Großbuchstabe') + row(c.lower, 'Kleinbuchstabe') + row(c.digit, 'Zahl');
  }
  // Zweckgebundene Redirect-URL: action bleibt als ?auth_action erhalten, damit der Client den
  // PKCE-Callback nach dem Code-Austausch korrekt routen kann (recovery/signup/email_change).
  // auth_action ist kein Geheimnis — nur Client-Routensteuerung.
  function authRedirectUrl(action) {
    var url = new URL(location.origin + location.pathname);
    if (action) url.searchParams.set('auth_action', action);
    return url.toString();
  }
  // NUR bekannte Auth-Parameter aus Query+Hash entfernen (fachliche App-Parameter bleiben). Quelle: auth-logic.
  function cleanAuthUrl() { try { history.replaceState({}, document.title, AL.stripAuthParams(location.href)); } catch (e) {} }

  // Fail-closed: App gesperrt, Login/Registrierung deaktiviert, kein Session/Sync/Onboarding.
  function failClosedAuth(msg) {
    document.documentElement.classList.add('orvia-gated');
    try {
      buildGate();
      showGate('login');
      err(msg);
      var _s = document.getElementById('ogSubmit'); if (_s) { _s.disabled = true; _s.style.opacity = '.6'; }
    } catch (e) { try { console.error('[ORVIA auth] Fail-closed-Gate-Aufbau fehlgeschlagen.', e); } catch (_) {} }
    if (window.orviaSetSyncState) window.orviaSetSyncState('local');
    if (window.renderAccountCard) window.renderAccountCard();
  }

  // Fehlende/unvollständige Auth-Logik → fail-closed (NICHT still als 'normal' degradieren).
  if (!AL || typeof AL.detectAuthFlow !== 'function' || typeof AL.acceptRegistration !== 'function'
    || typeof AL.pwValid !== 'function' || typeof AL.stripAuthParams !== 'function') {
    failClosedAuth('Anmeldung wird gerade vorbereitet. Bitte später erneut versuchen.');
    return;
  }

  if (!CFG.configured) {
    failClosedAuth('Zugang wird gerade vorbereitet. Bitte später erneut versuchen.');
    return;
  }

  let sb;
  try {
    // PRODUKTIVE Flow-Strategie: PKCE konsequent (E-Mail-Aktionen liefern ?code + ?auth_action).
    // Implicit (type= im Hash) wird nur als Kompatibilitäts-Fallback noch behandelt.
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
    });
  } catch (e) {
    console.error('[ORVIA auth] Supabase-Init fehlgeschlagen.', e);
    failClosedAuth('Anmeldung aktuell nicht verfügbar. Bitte später erneut versuchen.');
    return;
  }

  O.sb = sb;

  buildGate();

  // Auth-Flow aus der vollständigen URL VOR der normalen Freigabe bestimmen. Bei Recovery/Fehler/
  // Callback NIEMALS parallel die App über den Normalpfad öffnen.
  // FLOW-ART: Supabase-JS Standard ist Implicit (Token im Hash, type=recovery/signup). PKCE-Links
  // (?code) werden zusätzlich via exchangeCodeForSession unterstützt — beide Pfade abgedeckt.
  var authFlow = AL.detectAuthFlow(location.href);

  if (authFlow === 'pkce_recovery') {
    handlePkce('recovery');
  } else if (authFlow === 'pkce_signup' || authFlow === 'pkce_email_change') {
    handlePkce('signup');
  } else if (authFlow === 'pkce_unknown') {
    // ?code ohne gültige auth_action → NIEMALS automatisch die App öffnen.
    cleanAuthUrl();
    authFlow = 'normal';
    showGate('login');
    err('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.');
  } else if (authFlow === 'implicit_recovery') {
    // Kompatibilitäts-Fallback. Recovery-Screen im Status „checking"; Freigabe erst bei PASSWORD_RECOVERY.
    showRecovery();
  } else if (authFlow === 'implicit_signup') {
    handleSignupConfirmation();
  } else if (authFlow === 'error') {
    cleanAuthUrl();
    showGate('login');
    err('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.');
  } else {
    sb.auth.getSession()
      .then(({ data }) => {
        if (data && data.session) return onAuthed(data.session);
        showGate('login');
      })
      .catch(() => showGate('login'));
  }

  // PKCE-Callback: Code gegen Session tauschen, dann ZWECKABHÄNGIG routen. Ein Recovery-Code
  // öffnet NIE direkt die App, sondern führt zum „Neues Passwort"-Screen.
  async function handlePkce(action) {
    // Recovery vor dem Austausch sperren, damit ein paralleles SIGNED_IN die App nicht öffnet.
    if (action === 'recovery') authFlow = 'recovery';
    var code = null; try { code = new URL(location.href).searchParams.get('code'); } catch (e) {}
    if (!code) { cleanAuthUrl(); authFlow = 'normal'; showGate('login'); return; }
    var res;
    try { res = await sb.auth.exchangeCodeForSession(code); }
    catch (e) { res = { error: e }; }
    if (!res || res.error || !(res.data && res.data.session)) {
      cleanAuthUrl();
      authFlow = 'normal';
      showGate('login');
      err('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.');
      return;
    }
    if (action === 'recovery') {
      cleanAuthUrl();
      authFlow = 'recovery';
      recoveryReady = true;
      showRecovery();
      enableRecoveryForm();
      return;
    }
    // signup / email_change → App öffnen
    cleanAuthUrl();
    authFlow = 'normal';
    await onAuthed(res.data.session);
  }

  // Signup-Bestätigungs-Callback: Session prüfen, Auth-Parameter bereinigen, bei gültigem Profil
  // App öffnen, sonst kontrolliert zum Login mit neutraler Erfolgsmeldung.
  async function handleSignupConfirmation() {
    var session = null;
    try { var r = await sb.auth.getSession(); session = r && r.data && r.data.session; } catch (e) {}
    cleanAuthUrl();
    authFlow = 'normal';
    if (session) { onAuthed(session); return; }
    showGate('login');
    err('E-Mail bestätigt. Bitte melde dich an.');
  }

  sb.auth.onAuthStateChange((evt, session) => {
    // Recovery-Deep-Link (Passwort-Reset): Supabase feuert PASSWORD_RECOVERY mit temporärer Session.
    // NICHT die App entsperren — Screen zeigen und das Formular erst JETZT freischalten.
    if (evt === 'PASSWORD_RECOVERY') { recoveryReady = true; showRecovery(); enableRecoveryForm(); return; }
    if (evt === 'SIGNED_OUT') {
      // SIGNED_OUT kann auch OHNE safeSignOut() kommen (abgelaufene Session, Logout in
      // anderem Tab, serverseitige Abmeldung, Token-Entzug). Deshalb IMMER defensiv den
      // lokalen nutzerspezifischen Zustand bereinigen — VOR dem Nullen von O.user, falls
      // der Cleanup noch Infos zum vorherigen Nutzer benötigt. orviaClearLocal() ist idempotent
      // und löscht NICHT die (user-gescopte) Offline-Queue.
      try { if (window.orviaClearLocal) window.orviaClearLocal(); }
      catch (e) { console.error('[ORVIA auth] Lokaler Logout-Cleanup fehlgeschlagen.', e); }
      activeUserId = null;
      O.user = null;
      O.profile = null;
      if (window.orviaSetSyncState) window.orviaSetSyncState('local');
      showGate('login');
      return;
    }
    if (session && (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED')) {
      onAuthed(session);
    }
  });

  async function onAuthed(session) {
    if (authFlow === 'recovery' || authFlow === 'error') return;   // App während Recovery/Fehler-Link nicht öffnen
    if (!session || !session.user) {
      showGate('login');
      return;
    }

    if (activeUserId === session.user.id && gateEl && gateEl.style.display === 'none') return;

    const profileResult = await loadAccessProfile(session.user.id);
    if (!profileResult.ok) {
      await safeSignOut();
      activeUserId = null;
      O.user = null;
      O.profile = null;
      showGate('login');
      err(profileResult.message);
      return;
    }

    activeUserId = session.user.id;
    O.user = session.user;
    O.profile = profileResult.profile;

    try { if (window.orviaApplyUserScope) window.orviaApplyUserScope(O.user.id); } catch (e) {}

    hideGate();
    document.documentElement.classList.remove('orvia-gated');
    if (window.renderAccountCard) window.renderAccountCard();
    if (window.orviaSyncStart) {
      try { await window.orviaSyncStart(); } catch (e) {}
    }

    // Datenfundament: zuerst offene Offline-Schreibvorgänge des AKTUELLEN Nutzers flushen,
    // dann idempotente Blob→Tabellen-Migration, danach Profil aus user_profiles hydrieren
    // (Tabelle gewinnt über Blob für die Profil-Mapped-Felder).
    // E7 (2B-①): Flush wird AWAITED, damit die anschließende Hydration eigene frische
    // Schreibvorgänge sieht — aber mit Timeout-Fallback: der Login darf nie hängen.
    try {
      if (O.offlineQueue && O.offlineQueue.flush) {
        await Promise.race([
          Promise.resolve(O.offlineQueue.flush()).catch(function (e) {
            console.warn('[ORVIA auth] Offline-Flush fehlgeschlagen — Login läuft weiter.', e && e.message);
          }),
          new Promise(function (resolve) { setTimeout(function () { resolve({ flush_timeout: true }); }, 4000); })
        ]);
      }
    } catch (e) { console.warn('[ORVIA auth] Offline-Flush übersprungen.', e && e.message); }
    try {
      if (O.blobMigration) await O.blobMigration.run();
      if (O.profileStore) await O.profileStore.hydrate();
      // 2B-①: sports-Sektion aus user_sports hydrieren (K1-LWW; Erstmigration bei leerer Cloud).
      if (O.profileStore && O.profileStore.hydrateSports) await O.profileStore.hydrateSports();
      // P9: weitere Sektions-Zyklen (gleiche K1/K2/K3-Regeln; jeder fail-soft).
      if (O.profileStore && O.profileStore.hydrateAvailability) await O.profileStore.hydrateAvailability();
      if (O.profileStore && O.profileStore.hydrateGoals) await O.profileStore.hydrateGoals();
      if (O.profileStore && O.profileStore.hydrateConstraints) await O.profileStore.hydrateConstraints();
      if (O.checkinStore) await O.checkinStore.hydrateRecentTypes(35, ['morning', 'live', 'pre', 'post', 'evening']);
      if (O.readinessStore) await O.readinessStore.hydrateRecentScores(60);
      if (O.workoutUI && O.workoutUI.tryRestore) await O.workoutUI.tryRestore();
    } catch (e) {}

    try {
      // Onboarding nur bei pending öffnen. Dispatcher (onboarding-ui) öffnet AUSSCHLIESSLICH v2 (kein Legacy).
      // Pending-Key ERST nach erfolgreichem Öffnen entfernen (bei Fehler/fehlendem v2 behalten).
      if (localStorage.getItem('orvia_onboard_pending')) {
        setTimeout(function () {
          try { if (window.openPendingOnboarding && window.openPendingOnboarding()) localStorage.removeItem('orvia_onboard_pending'); } catch (e) {}
        }, 400);
      }
    } catch (e) {}
  }

  async function loadAccessProfile(userId) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('user_id,email,role,is_active,name')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[ORVIA auth] Profilprüfung fehlgeschlagen.', error);
        return { ok: false, message: SAFE_MESSAGES.invite_only };
      }
      if (!data) {
        return { ok: false, message: 'Es wurde kein gültiges Profil gefunden.' };
      }
      if (data.is_active !== true) {
        return { ok: false, message: 'Dein Zugang ist nicht aktiv.' };
      }
      if (data.role !== 'owner' && data.role !== 'tester') {
        return { ok: false, message: 'Dein Zugang ist nicht aktiv.' };
      }
      return { ok: true, profile: data };
    } catch (e) {
      console.error('[ORVIA auth] Profilprüfung fehlgeschlagen.', e);
      return { ok: false, message: SAFE_MESSAGES.invite_only };
    }
  }

  function buildGate() {
    gateEl = document.createElement('div');
    gateEl.className = 'orvia-gate';
    gateEl.style.display = 'none';
    gateEl.innerHTML =
      '<div class="og-card">' +
        '<svg class="og-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#orvia-mark"/></svg>' +
        '<div class="og-wm">ORVIA</div>' +
        '<div class="og-claim">Know your state. Move with precision.</div>' +
        '<div class="og-tabs">' +
          '<button type="button" data-m="login">Anmelden</button>' +
          '<button type="button" data-m="register">Registrieren</button>' +
        '</div>' +
        '<form class="og-form" autocomplete="on">' +
          '<div class="og-field og-invite"><label>Beta-Code</label>' +
            '<input type="text" id="ogCode" autocapitalize="characters" autocomplete="one-time-code" placeholder="ORVIA-BETA-..."></div>' +
          '<div class="og-field"><label>E-Mail</label>' +
            '<input type="email" id="ogEmail" autocomplete="email" placeholder="du@mail.de"></div>' +
          '<div class="og-field"><label>Passwort</label>' +
            '<input type="password" id="ogPw" autocomplete="current-password" placeholder="mind. 8 Zeichen"></div>' +
          '<div class="og-pwrules og-pw-confirm" id="ogPwRules"></div>' +
          '<div class="og-field og-pw-confirm"><label>Passwort bestätigen</label>' +
            '<input type="password" id="ogPw2" autocomplete="new-password" placeholder="noch einmal eingeben"></div>' +
          '<label class="og-show"><input type="checkbox" id="ogShow"> Passwort anzeigen</label>' +
          '<div class="og-err" id="ogErr"></div>' +
          '<button type="submit" class="btn" id="ogSubmit">Anmelden</button>' +
        '</form>' +
        '<button type="button" class="og-link" id="ogForgot">Passwort vergessen?</button>' +
        '<div class="og-note">Geschlossene Beta. Registrierung nur mit gültigem Beta-Code und bestätigter E-Mail möglich.</div>' +
      '</div>';
    document.body.appendChild(gateEl);

    gateEl.querySelectorAll('.og-tabs button').forEach(b =>
      b.onclick = () => setMode(b.dataset.m));
    gateEl.querySelector('.og-form').addEventListener('submit', onSubmit);
    gateEl.querySelector('#ogForgot').onclick = onForgot;
    // Live-Passwortregeln (nur im Registrieren-Modus sichtbar, s. setMode).
    var pwEl = gateEl.querySelector('#ogPw'), rules = gateEl.querySelector('#ogPwRules');
    pwEl.addEventListener('input', function () { if (mode === 'register') rules.innerHTML = pwRulesHTML(AL.pwChecks(pwEl.value)); });
    // Show/Hide für beide Passwortfelder.
    gateEl.querySelector('#ogShow').addEventListener('change', function () {
      var t = this.checked ? 'text' : 'password';
      gateEl.querySelector('#ogPw').type = t; gateEl.querySelector('#ogPw2').type = t;
    });
  }

  function setMode(m) {
    mode = m;
    var reg = (m === 'register');
    gateEl.querySelectorAll('.og-tabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    gateEl.querySelector('.og-invite').style.display = reg ? '' : 'none';
    gateEl.querySelectorAll('.og-pw-confirm').forEach(el => { el.style.display = reg ? '' : 'none'; });
    gateEl.querySelector('.og-show').style.display = reg ? '' : 'none';
    gateEl.querySelector('#ogSubmit').textContent = reg ? 'Account erstellen' : 'Anmelden';
    gateEl.querySelector('#ogPw').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
    gateEl.querySelector('#ogForgot').style.display = reg ? 'none' : 'block';
    if (reg) gateEl.querySelector('#ogPwRules').innerHTML = pwRulesHTML(AL.pwChecks(gateEl.querySelector('#ogPw').value));
    err('');
  }

  function showGate(m) {
    if (!gateEl) return;
    gateEl.style.display = 'flex';
    document.documentElement.classList.add('orvia-gated');
    setMode(m || 'login');
  }

  function hideGate() {
    if (gateEl) gateEl.style.display = 'none';
  }

  function err(msg) {
    const e = gateEl && gateEl.querySelector('#ogErr');
    if (e) {
      e.textContent = msg || '';
      e.style.display = msg ? 'block' : 'none';
    }
  }

  function busy(on) {
    const b = gateEl.querySelector('#ogSubmit');
    b.disabled = on;
    b.style.opacity = on ? '.6' : '1';
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    err('');
    if (!sb) { err('Anmeldung aktuell nicht verfügbar.'); return; }
    const email = val('ogEmail').trim().toLowerCase();
    const pw = val('ogPw');

    if (!email || !pw) {
      err('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    busy(true);
    try {
      if (mode === 'register') {
        const code = val('ogCode').trim();
        const pw2 = val('ogPw2');
        if (!code) {
          err(SAFE_MESSAGES.invalid_invite);
          busy(false);
          return;
        }
        if (!AL.pwValid(pw)) {
          err('Passwort: min. 8 Zeichen, Groß- und Kleinbuchstabe sowie Zahl.');
          busy(false);
          return;
        }
        if (pw !== pw2) {
          err(SAFE_MESSAGES.password_mismatch);
          busy(false);
          return;
        }

        const reg = await registerWithInvite(email, code, pw);
        if (!reg.ok) {
          err(reg.message);
          busy(false);
          return;
        }

        // FAIL-CLOSED: nur ein ausdrücklich versionierter Bestätigungs-Vertrag gilt als gültige
        // Registrierung. KEIN stiller Fallback auf einen vorbestätigten Account.
        if (!AL.acceptRegistration(reg.data)) {
          err('Registrierung wurde serverseitig nicht korrekt bestätigt. Bitte später erneut versuchen.');
          busy(false);
          return;
        }
        localStorage.setItem('orvia_onboard_pending', '1');
        showConfirmPending(email, reg.data);
        busy(false);
        return;
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error || !data || !data.session) {
          // #16 (2026-07-02): unbestätigte E-Mail NICHT als „Passwort falsch" maskieren —
          // stattdessen Bestätigungs-Screen mit Resend-Pfad zeigen (GoTrue: "Email not confirmed").
          const em = String((error && error.message) || '').toLowerCase();
          if (em.includes('not confirmed') || em.includes('nicht bestätigt')) {
            showConfirmPending(email);
            busy(false);
            return;
          }
          err('E-Mail oder Passwort ist falsch.');
          busy(false);
          return;
        }
        await onAuthed(data.session);
      }
    } catch (e) {
      console.error(e);
      err('Unerwarteter Fehler. Bitte erneut versuchen.');
    }
    busy(false);
  }

  async function registerWithInvite(email, betaCode, password) {
    try {
      const { data, error } = await sb.functions.invoke('register-with-invite', {
        // redirectTo: zweckgebundene Signup-Callback-URL (?auth_action=signup).
        // GoTrue validiert sie gegen die Redirect-Allowlist (kein Open Redirect).
        body: { email, betaCode, inviteCode: betaCode, password, redirectTo: authRedirectUrl('signup') }
      });
      if (error) return { ok: false, message: await functionErrorMessage(error) };
      // Rohdaten durchreichen; der versionierte Vertrag (flowVersion/status) wird im Aufrufer geprüft.
      return { ok: true, data: data || null };
    } catch (e) {
      console.error('[ORVIA auth] register-with-invite fehlgeschlagen.', e);
      return { ok: false, message: SAFE_MESSAGES.invite_only };
    }
  }

  async function functionErrorMessage(error) {
    // supabase-js: error.context ist die Response. Body robust auslesen (json ODER text).
    try {
      var ctx = error && error.context;
      if (ctx && typeof ctx.clone === 'function') {
        var body = await ctx.clone().json().catch(function () { return null; });
        if (!body && typeof ctx.text === 'function') {
          var t = await ctx.text().catch(function () { return ''; });
          if (t) { try { body = JSON.parse(t); } catch (e) { body = { message: t }; } }
        }
        if (body) return safeMessage(body.code || body.message, body.message);
      }
    } catch (e) {}
    return safeMessage(error && error.message);
  }

  function safeMessage(raw, serverMsg) {
    const m = String(raw || '').toLowerCase();
    if (raw && Object.values(SAFE_MESSAGES).includes(String(raw))) return String(raw);
    // #16.7: bekannte sichere Server-Message gewinnt über den Code (z. B. email_taken teilt
    // sich den Code invalid_invite mit der echten Code-Prüfung — Message differenziert).
    if (serverMsg && Object.values(SAFE_MESSAGES).includes(String(serverMsg))) return String(serverMsg);
    // #16.7: generischer Serverfehler (invite_only, 500) NICHT als „Beta-Code ungültig" tarnen.
    if (m.includes('invite_only')) return SAFE_MESSAGES.invite_only;
    if (m.includes('invite_used') || m.includes('zu oft') || m.includes('bereits verwendet')) return SAFE_MESSAGES.invite_used;
    if (m.includes('invite_expired') || m.includes('abgelaufen')) return SAFE_MESSAGES.invite_expired;
    if (m.includes('weak_password') || m.includes('password')) return SAFE_MESSAGES.weak_password;
    if (m.includes('invalid_invite') || m.includes('invite') || m.includes('beta-code') || m.includes('ungültig')) return SAFE_MESSAGES.invalid_invite;
    return SAFE_MESSAGES.invite_only;
  }

  async function onForgot() {
    const email = val('ogEmail').trim().toLowerCase();
    if (!email) {
      err('E-Mail eingeben, dann Passwort-Reset anfordern.');
      return;
    }
    try {
      // Zweckgebundene Redirect-URL → muss bei Supabase unter Additional Redirect URLs eingetragen sein.
      await sb.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl('recovery') });
      err('Falls die E-Mail existiert, wurde ein Reset-Link gesendet.');
    } catch (e) {
      err('Reset aktuell nicht möglich.');
    }
  }

  // Bestätigungs-Screen nach Registrierung (Hybrid): E-Mail anzeigen, erneut senden, Adresse korrigieren.
  // regData: Server-Antwort des Registrierungsvertrags. emailSent === false → ehrlicher Hinweis,
  // dass der Versand fehlschlug (Account existiert; "Erneut senden" ist der Recovery-Pfad).
  function showConfirmPending(email, regData) {
    if (gateEl) gateEl.style.display = 'none';
    document.documentElement.classList.add('orvia-gated');
    var ex = document.getElementById('orviaConfirm'); if (ex) ex.remove();
    var wrap = document.createElement('div');
    wrap.id = 'orviaConfirm'; wrap.className = 'orvia-gate'; wrap.style.display = 'flex';
    // E-Mail NICHT in innerHTML interpolieren (XSS) → neutrales Element + textContent.
    wrap.innerHTML =
      '<div class="og-card">' +
        '<div class="og-wm">ORVIA</div>' +
        '<div class="og-claim">E-Mail bestätigen</div>' +
        '<p class="og-note" style="text-align:center">Wir haben einen Bestätigungslink an<br><b id="cfEmail"></b> gesendet. Öffne den Link, dann melde dich an.</p>' +
        '<div class="og-err" id="cfErr"></div>' +
        '<button type="button" class="btn" id="cfDone">Ich habe meine E-Mail bestätigt</button>' +
        '<button type="button" class="og-link" id="cfResend">Bestätigung erneut senden</button>' +
        '<button type="button" class="og-link" id="cfBack">Adresse korrigieren / zurück</button>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#cfEmail').textContent = email || '';
    function se(m) { var e = wrap.querySelector('#cfErr'); e.style.display = 'block'; e.textContent = m; }
    if (regData && regData.emailSent === false) {
      se('Dein Konto wurde erstellt, aber die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte „Bestätigung erneut senden" antippen.');
    }
    wrap.querySelector('#cfBack').onclick = function () { wrap.remove(); showGate('register'); };
    // „Ich habe bestätigt": NUR lokale Session prüfen (Remote-Status kann der Client nicht
    // nachweisen). Mit Session → App; sonst kontrolliert zum Login mit vorausgefüllter E-Mail.
    wrap.querySelector('#cfDone').onclick = async function () {
      this.disabled = true;
      try {
        var { data } = await sb.auth.getSession();
        if (data && data.session) { wrap.remove(); onAuthed(data.session); return; }
      } catch (_) {}
      wrap.remove();
      showGate('login');
      var emEl = document.getElementById('ogEmail'); if (emEl) emEl.value = email || '';
      err('Bitte melde dich mit deiner bestätigten E-Mail-Adresse an.');
    };
    wrap.querySelector('#cfResend').onclick = async function () {
      this.disabled = true;
      try {
        var r = await sb.auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: authRedirectUrl('signup') } });
        se((r && r.error) ? 'Erneut senden fehlgeschlagen.' : 'Bestätigung erneut gesendet.');
      } catch (_) { se('Erneut senden fehlgeschlagen.'); }
      this.disabled = false;
    };
  }

  function rcErrShow(m) { var e = document.getElementById('rcErr'); if (e) { e.textContent = m; e.style.display = 'block'; } }
  // Recovery-Formular erst freischalten, wenn eine gültige Recovery-Session vorliegt (PASSWORD_RECOVERY).
  function enableRecoveryForm() {
    recoveryReady = true;
    if (recoveryTimer) { clearTimeout(recoveryTimer); recoveryTimer = null; }
    var st = document.getElementById('rcStatus'); if (st) st.style.display = 'none';
    ['rcPw', 'rcPw2', 'rcSubmit'].forEach(function (id) { var el = document.getElementById(id); if (el) el.disabled = false; });
  }
  // Recovery-Screen. Startzustand „checking": Felder/Speichern deaktiviert, bis PASSWORD_RECOVERY kommt.
  function showRecovery() {
    document.documentElement.classList.add('orvia-gated');
    if (gateEl) gateEl.style.display = 'none';
    if (document.getElementById('orviaRecovery')) { if (recoveryReady) enableRecoveryForm(); return; } // idempotent
    var wrap = document.createElement('div');
    wrap.id = 'orviaRecovery'; wrap.className = 'orvia-gate'; wrap.style.display = 'flex';
    wrap.innerHTML =
      '<div class="og-card">' +
        '<div class="og-wm">ORVIA</div>' +
        '<div class="og-claim">Neues Passwort setzen</div>' +
        '<div class="og-note" id="rcStatus" style="text-align:center">Reset-Link wird geprüft …</div>' +
        '<form class="og-form" autocomplete="off">' +
          '<div class="og-field"><label>Neues Passwort</label>' +
            '<input type="password" id="rcPw" autocomplete="new-password" placeholder="min. 8 Zeichen" disabled></div>' +
          '<div class="og-pwrules" id="rcRules"></div>' +
          '<div class="og-field"><label>Passwort bestätigen</label>' +
            '<input type="password" id="rcPw2" autocomplete="new-password" placeholder="noch einmal eingeben" disabled></div>' +
          '<label class="og-show"><input type="checkbox" id="rcShow"> Passwort anzeigen</label>' +
          '<div class="og-err" id="rcErr"></div>' +
          '<button type="submit" class="btn" id="rcSubmit" disabled>Passwort speichern</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(wrap);
    var pwEl = document.getElementById('rcPw'), pw2El = document.getElementById('rcPw2');
    // Initial programmatisch sperren (zusätzlich zum HTML-disabled), bis Recovery-Session bestätigt.
    if (!recoveryReady) { ['rcPw', 'rcPw2', 'rcSubmit'].forEach(function (id) { var el = document.getElementById(id); if (el) el.disabled = true; }); }
    function upd() { var r = document.getElementById('rcRules'); if (r) r.innerHTML = pwRulesHTML(AL.pwChecks(pwEl.value)); }
    pwEl.addEventListener('input', upd); upd();
    document.getElementById('rcShow').addEventListener('change', function () { var t = this.checked ? 'text' : 'password'; pwEl.type = t; pw2El.type = t; });
    wrap.querySelector('.og-form').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      // Race-Schutz: vor gültiger Recovery-Session NICHT updateUser aufrufen.
      if (!recoveryReady) { rcErrShow('Der Reset-Link ist noch nicht bestätigt oder nicht mehr gültig.'); return; }
      var pw = pwEl.value, pw2 = pw2El.value;
      if (!AL.pwValid(pw)) { rcErrShow('Passwort: min. 8 Zeichen, Groß- und Kleinbuchstabe sowie Zahl.'); return; }
      if (pw !== pw2) { rcErrShow('Die Passwörter stimmen nicht überein.'); return; }
      var btn = document.getElementById('rcSubmit'); btn.disabled = true;
      try {
        var r = await sb.auth.updateUser({ password: pw });
        if (r && r.error) { rcErrShow('Konnte nicht gespeichert werden. Der Link ist evtl. abgelaufen oder schon benutzt.'); btn.disabled = false; return; }
        await safeSignOut();
        cleanAuthUrl();
        authFlow = 'normal';
        wrap.remove();
        showGate('login');
        err('Passwort geändert. Bitte neu anmelden.');
      } catch (_) { rcErrShow('Unerwarteter Fehler. Bitte erneut versuchen.'); btn.disabled = false; }
    });
    if (recoveryReady) { enableRecoveryForm(); return; }
    // Kontrollierter Timeout: kommt keine Recovery-Session, neutralen Fehler zeigen (kein falsches „abgelaufen").
    recoveryTimer = setTimeout(function () {
      if (recoveryReady) return;
      var st = document.getElementById('rcStatus'); if (st) st.style.display = 'none';
      rcErrShow('Der Reset-Link konnte nicht bestätigt werden. Bitte fordere einen neuen Link an.');
    }, 12000);
  }

  async function safeSignOut() {
    try { await sb.auth.signOut(); } catch (e) {}
  }

  window.orviaLogout = async function () {
    await safeSignOut();
    try { if (window.orviaClearLocal) window.orviaClearLocal(); } catch (e) {}
    try { ['orvia_active_user', 'orvia_onboard_pending'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    O.user = null;
    O.profile = null;
    location.reload();
  };

  /* H4 (2026-07-11): echte Konto-Flows für eingeloggte Nutzer. */
  window.orviaChangePassword = async function () {
    var p1 = prompt('Neues Passwort (min. 8 Zeichen, Groß-/Kleinbuchstabe, Zahl):');
    if (p1 == null) return;
    if (!AL.pwValid(p1)) { alert('Passwort erfüllt die Regeln nicht (min. 8 Zeichen, Groß-/Kleinbuchstabe, Zahl).'); return; }
    var p2 = prompt('Neues Passwort wiederholen:');
    if (p2 !== p1) { alert(SAFE_MESSAGES.password_mismatch); return; }
    try {
      var r = await sb.auth.updateUser({ password: p1 });
      if (r && r.error) throw r.error;
      alert('Passwort geändert.');
    } catch (e) { alert('Passwort-Änderung fehlgeschlagen: ' + ((e && e.message) || 'unbekannt')); }
  };
  window.orviaChangeEmail = async function () {
    var mail = prompt('Neue E-Mail-Adresse:');
    if (!mail) return;
    try {
      // Bestätigungslink nutzt den bereits vorhandenen pkce_email_change-Callback-Router.
      var r = await sb.auth.updateUser({ email: mail.trim() }, { emailRedirectTo: authRedirectUrl('email_change') });
      if (r && r.error) throw r.error;
      alert('Bestätigungs-E-Mail versendet — bitte den Link in der neuen Mailbox öffnen.');
    } catch (e) { alert('E-Mail-Änderung fehlgeschlagen: ' + ((e && e.message) || 'unbekannt')); }
  };
  /* H4: ECHTE serverseitige Löschung über die Edge Function delete-account
     (löscht den Auth-User; alle Tabellen hängen mit on delete cascade daran).
     Fail-closed: ohne Server-Erfolg wird lokal NICHTS gelöscht. */
  window.orviaDeleteAccount = async function () {
    var sure = prompt('Konto DAUERHAFT löschen? Alle Cloud- und Gerätedaten gehen verloren. Zum Bestätigen LÖSCHEN eingeben:');
    if (sure !== 'LÖSCHEN') { if (sure != null) alert('Nicht bestätigt — es wurde nichts gelöscht.'); return; }
    try {
      var sess = await sb.auth.getSession();
      var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!token) { alert('Keine aktive Sitzung.'); return; }
      var resp = await fetch(CFG.SUPABASE_URL + '/functions/v1/delete-account', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'apikey': CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      var body = null; try { body = await resp.json(); } catch (e) {}
      if (!resp.ok || !(body && body.ok)) {
        alert('Serverseitige Löschung fehlgeschlagen (' + resp.status + '). Es wurde nichts gelöscht.');
        return;
      }
      try { await sb.auth.signOut(); } catch (e) {}
      try { if (window.clearLocalUserData) window.clearLocalUserData(); } catch (e) {}
      try {
        localStorage.removeItem('orvia_profile_v1');
        localStorage.removeItem('gian_checkins_v2');
        localStorage.removeItem('orvia_consent');
        localStorage.removeItem('orvia_data_owner');
        localStorage.removeItem('orvia_sync_rev');
      } catch (e) {}
      alert('Konto und Daten wurden gelöscht.');
      location.reload();
    } catch (e) { alert('Löschung fehlgeschlagen: ' + ((e && e.message) || 'unbekannt') + ' — es wurde nichts gelöscht.'); }
  };

  function val(id) {
    const e = document.getElementById(id);
    return e ? e.value : '';
  }
})();

/* ============================================================
   Konto-/Sync-Karte im Profil  (global, von Profil-Render + Sync genutzt)
   ============================================================ */
window.renderAccountCard = function () {
  const box = document.getElementById('accountBox');
  if (!box) return;
  const O = window.ORVIA || {};
  const cfg = window.ORVIA_CFG || {};
  const state = (window.orviaSyncState ? window.orviaSyncState() : 'local');
  const badge = '<span class="syncbadge" id="syncBadge"></span>';
  const roleLabel = O.profile && O.profile.role === 'owner' ? 'Owner' : 'Tester';
  // Nutzerkontrollierter Text (E-Mail) NIE unescaped in innerHTML.
  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  if (!cfg.configured) {
    box.innerHTML =
      '<div class="acc-row"><span>Modus</span><b>Lokal (kein Konto)</b></div>' +
      '<div class="acc-row"><span>Status</span>' + badge + '</div>' +
      '<p class="note" style="text-align:left">Cloud-Sync &amp; Accounts sind vorbereitet. Sobald Supabase-URL und anon public key konfiguriert sind, aktivieren sich Login, Invite-Gate und geräteübergreifender Sync.</p>';
  } else if (O.user && O.profile) {
    box.innerHTML =
      '<div class="acc-row"><span>Angemeldet</span><b>' + _esc(O.user.email || '—') + '</b></div>' +
      '<div class="acc-row"><span>Rolle</span><b>' + roleLabel + '</b></div>' +
      '<div class="acc-row"><span>Sync</span>' + badge + '</div>' +
      '<div class="row2" style="margin-top:12px">' +
        '<button class="btn sec" onclick="orviaSchedulePush&&orviaSchedulePush()">Jetzt synchronisieren</button>' +
        '<button class="btn sec" onclick="orviaLogout&&orviaLogout()">Abmelden</button>' +
      '</div>' +
      '<div class="row2" style="margin-top:10px">' +
        '<button class="btn sec" onclick="orviaChangePassword&&orviaChangePassword()">Passwort ändern</button>' +
        '<button class="btn sec" onclick="orviaChangeEmail&&orviaChangeEmail()">E-Mail ändern</button>' +
      '</div>' +
      '<button class="btn gline" style="margin-top:10px" onclick="orviaDeleteAccount&&orviaDeleteAccount()">Konto löschen</button>';
  } else {
    box.innerHTML = '<div class="acc-row"><span>Status</span><b>Nicht angemeldet</b></div>';
  }

  const el = document.getElementById('syncBadge');
  if (el) {
    const L = {
      local: ['Lokaler Modus', 'muted'],
      synced: ['Synchronisiert', 'ok'],
      pending: ['Sync läuft ...', 'warn'],
      error: ['Sync-Fehler', 'err'],
      offline: ['Offline - lokal', 'warn']
    }[state] || ['Lokaler Modus', 'muted'];
    el.textContent = L[0];
    el.className = 'syncbadge ' + L[1];
  }
};
