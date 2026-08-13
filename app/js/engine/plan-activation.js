/* ============================================================
   ORVIA · engine/plan-activation — Phase 8.4: der flag-gesteuerte Aktivierungspfad

   WOFÜR: Bis hierher endete die Engine im Protokoll. `week-projection` (8.1) baut
   aus `scheduler-v2.sessions[]` das Anzeigemodell, aber NIEMAND schrieb es je in
   den Plan des Nutzers. Genau deshalb war der 8.2-Punkt „manuelle Overrides
   überleben den Weg" offen: man kann eine Mechanik nicht prüfen, die es nicht gibt.
   Dieses Modul ist diese Mechanik — und nur sie. Es rendert nichts und speichert
   nichts; es rechnet aus, WAS der neue Plan wäre, und sagt begründet Ja oder Nein.

   DIE ZENTRALE ZUSAGE (Canary-Gate: „kein Verlust manueller Overrides"):
   Ein Override des Nutzers darf durch eine Engine-Aktivierung NIEMALS still
   verschwinden. Das wird hier nicht gehofft, sondern gerechnet:

     overrides_vorher === kept + retargeted + conflicts + dropped

   Geht diese Rechnung nicht auf, wird NICHT aktiviert (`override_accounting_
   mismatch`). Und selbst wenn sie aufgeht, aber ein Override verworfen würde
   (`dropped > 0`), wird NICHT aktiviert (`would_drop_overrides`).

   WARUM „gar nicht aktivieren" die richtige Antwort ist und nicht „aktivieren und
   den Override melden": Der Plan bleibt in diesem Fall exakt so, wie der Nutzer ihn
   hinterlassen hat — der Legacy-Zustand ist immer der sichere. Ein verlorener
   Override wäre dagegen nicht wiederherstellbar. Der Fall wird stattdessen als
   Ereignis protokolliert und vom Canary-Auswerter gezählt: ein messbarer
   Blocker statt eines stillen Datenverlusts.

   FAIL-CLOSED: Flag aus, kein Flag-Modul, kein kanonischer Plan, fehlgeschlagene
   Projektion, unerwarteter Fehler — jeder dieser Ausgänge bedeutet „nicht
   aktiviert, Legacy unverändert". Nur der vollständig belegte Pfad aktiviert.

   REVERSIBEL: `activate()` liefert `previous` (tiefe Kopie des Plans VOR der
   Änderung) mit. Der Aufrufer kann damit ohne Serverabfrage zurückrollen; das ist
   die technische Grundlage für „Migration reversibel" im Canary-Gate.

   REINHEIT: `activate()` ist pur — keine Uhr, kein Zufall, kein DOM, kein Storage.
   Zeitstempel und ID-Fabrik kommen von außen herein (sonst wäre der Determinismus,
   den das Shadow-Gate für S3 verlangt, hier wieder verloren). Die Protokoll-
   Hilfen darunter sind der einzige Teil mit Storage-Zugriff und klar getrennt.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'plan-activation@1';
  var FLAG = 'engine_v2_plan';
  var LOG_MAX = 200;

  function _clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }

  /* Vergleichsform einer Baseline: Tag + Inhalt, ohne IDs und ohne Reihenfolge-
     Zufall. Dient NUR dem Idempotenz-Test „hat sich überhaupt etwas geändert".
     Ohne ihn stiege die Revisionsnummer bei jedem Öffnen des Plans um eins und
     die Historie wäre nach einem Tag unlesbar. */
  /* Kurzform der Verordnung (v8-332b). BEFUND: Bis hierher verglich der
     Fingerabdruck nur Tag, Sportart, Einheitenname und Umfangstext. Damit war
     er BLIND fuer die Verordnung selbst — gemessen:

       4 × 5 min  →  "1|Laufen|Intervalle|32 min"
       5 × 4 min  →  "1|Laufen|Intervalle|32 min"   (identisch!)
       gleiche Struktur, anderes Pace-Fenster       (identisch!)

     Folge: Passt die Engine die Intervallstruktur an oder verschiebt sie das
     Tempofenster, weil eine neue Schwellenpace gemessen wurde, meldet
     activate() 'unchanged' und aktiviert NICHT. Der Nutzer bekaeme die neue
     Vorgabe nie — und wuerde sich irgendwann wundern, warum sich sein Tempo
     nie anpasst. Genau die Vorgabe, die v8-332 sichtbar gemacht hat, waere im
     Betrieb eingefroren gewesen.

     Warum das die Idempotenz NICHT kaputtmacht: die prescription-factory ist
     nachweislich rein (kein Date.now, kein Math.random, byte-identisch bei
     identischer Eingabe). Gleiche Lage ⇒ gleiche Verordnung ⇒ gleicher
     Fingerabdruck. Es entsteht also weiterhin keine Revision beim blossen
     Oeffnen des Plans — der urspruengliche Grund fuer den Fingerabdruck
     bleibt gewahrt.

     Bewusst der VOLLE Strukturvergleich statt einer Auswahl einzelner Felder:
     eine Auswahl waere wieder blind fuer alles, woran heute niemand denkt. */
  function _rxPrint(rx) {
    if (rx == null) return '';                       // Legacy-Einheiten: unveraendert
    try { return _fnv(JSON.stringify(rx)); } catch (e) { }
    /* Notfallweg, falls sich eine Verordnung nicht serialisieren laesst
       (Zyklus, BigInt). Ein fester Ersatzwert waere hier das Schlechteste:
       dann traegen ALLE unserialisierbaren Verordnungen denselben Abdruck und
       der Vergleich waere wieder blind — genau der Fehler, den v8-332b
       behebt. Stattdessen ein grober, aber stabiler Strukturabdruck. */
    try {
      var n = (rx.blocks && rx.blocks.length) || 0;
      var typen = [];
      for (var i = 0; i < n; i++) {
        var b = rx.blocks[i] || {};
        typen.push(String(b.type) + ':' + (b.iterations == null ? '' : b.iterations) +
          ':' + ((b.completion && b.completion.value) || '') +
          ':' + ((b.target && (b.target.value != null ? b.target.value : b.target.min)) || ''));
      }
      return 'rx!' + _fnv(String(rx.session_type) + '|' + n + '|' + typen.join(','));
    } catch (e2) { return 'rx?'; }                   // wirklich letzter Ausweg
  }
  function _fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function baselineFingerprint(sessions) {
    return (Array.isArray(sessions) ? sessions : []).map(function (s) {
      var it = (s && s.session) || {};
      return [s && s.dayIndex, it.t || '', it.l || '', it.d == null ? '' : it.d,
        _rxPrint(it.rx)].join('|');
    }).sort().join(';');
  }

  /* ---- Hauptfunktion ----
     opts:
       plan              kanonischer Plan (plan-domain) oder null
       schedulerOutput   Ausgabe von scheduler-v2
       enabled           Ergebnis von featureFlags.isEnabled(FLAG) — wird NICHT
                         hier selbst gelesen, damit die Funktion pur bleibt und
                         der Test beide Schaltstellungen prüfen kann
       now               ISO-Zeitstempel (Pflicht für die Historie)
       idFactory         () => 'ps:…' — injizierbar (Determinismus im Test)
       weekKey           erwarteter Wochenschlüssel; passt er nicht zum Plan,
                         wird nicht aktiviert (fremde Woche überschreibt nichts) */
  function activate(opts) {
    var o = opts || {};
    var ev = {
      at: o.now || null, flag: FLAG, version: VERSION,
      weekKey: (o.schedulerOutput && o.schedulerOutput.weekKey) || o.weekKey || null,
      applied: false, reason: null, error: null,
      sessions: null, unmapped: 0, notPlanned: 0,
      overrides: null
    };
    function no(reason, extra) {
      ev.reason = reason;
      if (extra) { Object.keys(extra).forEach(function (k) { ev[k] = extra[k]; }); }
      return { applied: false, reason: reason, plan: o.plan || null, previous: null, event: ev };
    }

    if (o.enabled !== true) return no('flag_off');

    var PD = o.planDomain || O.planDomain || null;
    var WP = o.projection || O.weekProjection || null;
    if (!PD || typeof PD.rebase !== 'function' || typeof PD.baselineFromDays !== 'function') return no('plan_domain_missing');
    if (!WP || typeof WP.projectWeek !== 'function') return no('projection_missing');

    var plan = o.plan;
    if (!plan || typeof plan !== 'object' || !plan.baseline) return no('no_canonical_plan');
    if (ev.weekKey && plan.weekKey && ev.weekKey !== plan.weekKey) return no('week_key_mismatch');

    var proj;
    try { proj = WP.projectWeek(o.schedulerOutput); }
    catch (e) { return no('projection_threw', { error: String((e && e.message) || e) }); }
    if (!proj || proj.ok !== true) return no('projection_failed', { error: (proj && proj.error) || null });

    ev.unmapped = (proj.unmapped || []).length;
    ev.notPlanned = (proj.notPlanned || []).length;

    var count = 0;
    for (var di = 0; di < 7; di++) count += ((proj.days && proj.days[di]) || []).length;
    ev.sessions = count;
    /* Eine leere Woche ist kein Plan. Sie zu schreiben hieße, dem Nutzer den
       bestehenden Plan wortlos wegzunehmen. */
    if (count === 0) return no('projection_empty');

    var newBaseline;
    try {
      newBaseline = PD.baselineFromDays(proj.days, {
        source: 'engine',
        engineVersion: (proj.provenance && proj.provenance.scheduler) || null,
        generatedAt: o.now || null,
        snapshotId: (o.schedulerOutput && o.schedulerOutput.snapshotId) || null,
        idFactory: o.idFactory
      });
    } catch (e2) { return no('baseline_build_failed', { error: String((e2 && e2.message) || e2) }); }

    /* Idempotenz: identische Baseline ⇒ nichts tun (keine Revision, keine Historie). */
    if (baselineFingerprint(newBaseline.sessions) === baselineFingerprint(plan.baseline.sessions)) {
      return no('unchanged');
    }

    var before = ((plan.overrides || []).slice());
    var r;
    try { r = PD.rebase(plan, newBaseline, { now: o.now || null }); }
    catch (e3) { return no('rebase_threw', { error: String((e3 && e3.message) || e3) }); }

    var kept = (r.kept || []).length, retar = (r.retargeted || []).length;
    var conf = (r.conflicts || []).length, drop = (r.dropped || []).length;
    ev.overrides = { before: before.length, kept: kept, retargeted: retar, conflicts: conf, dropped: drop };

    /* DIE Prüfung, um die es geht. Jeder Override muss genau einer der vier
       Kategorien zugeordnet sein. Fehlt einer, ist er still verschwunden — und
       genau das darf nie passieren. */
    if (kept + retar + conf + drop !== before.length) {
      return no('override_accounting_mismatch');
    }
    /* Ein verworfener Override IST der Verlust, den das Gate ausschließt.
       Lieber nicht aktivieren als ihn wegwerfen. */
    if (drop > 0) {
      return no('would_drop_overrides', { droppedDetail: (r.dropped || []).slice(0, 5) });
    }

    ev.applied = true;
    ev.reason = 'applied';
    ev.revision = r.plan && r.plan.revision;
    return { applied: true, reason: 'applied', plan: r.plan, previous: _clone(plan), event: ev,
      conflicts: r.conflicts || [] };
  }

  /* Rücknahme ohne Serverabfrage: der Aufrufer hat `previous` aus activate().
     Bewusst eine eigene Funktion, damit der Rückweg im Code sichtbar ist und
     nicht als „einfach nicht speichern" implizit bleibt. */
  function revert(previous) {
    if (!previous || typeof previous !== 'object') return { ok: false, reason: 'no_snapshot', plan: null };
    return { ok: true, reason: 'reverted', plan: _clone(previous) };
  }

  /* ---- Protokoll (der einzige Teil mit Storage) ----
     User-scoped wie die Shadow-Protokolle. Der Canary-Auswerter liest genau
     dieses Log; ohne Einträge meldet er insufficient_data, nie „bestanden". */
  function _uid() { try { return (O.user && O.user.id) || 'local'; } catch (e) { return 'local'; } }
  function _key() { return 'orvia_canary_plan_' + _uid(); }
  function log() {
    try { var raw = root.localStorage && root.localStorage.getItem(_key()); var a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function logEvent(ev) {
    if (!ev) return log();
    var a = log();
    a.push(ev);
    try { if (root.localStorage) root.localStorage.setItem(_key(), JSON.stringify(a.slice(-LOG_MAX))); } catch (e) {}
    return a;
  }
  function clearLog() { try { if (root.localStorage) root.localStorage.removeItem(_key()); } catch (e) {} }

  var api = { VERSION: VERSION, FLAG: FLAG, LOG_MAX: LOG_MAX,
    activate: activate, revert: revert, baselineFingerprint: baselineFingerprint,
    log: log, logEvent: logEvent, clearLog: clearLog, _key: _key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.planActivation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
