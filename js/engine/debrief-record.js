/* ============================================================
   ORVIA · debrief-record — der kanonische Debrief-Persistenzvertrag

   WARUM ES DIESES MODUL GIBT: gmDbSave() baute den gespeicherten Record
   inline in ui.js — ohne id, ohne userId, ohne planId/planRevision, ohne
   createdAt, ohne completed, und mit der TEMPLATE-Session-ID statt der
   konkreten Occurrence. Damit war der Record fuer jeden spaeteren Konsumenten
   (Prediction-Resolve, Reconciliation, Kalibrierung) unbrauchbar — und das
   fiel nicht auf, weil die Tests gegen eine handgebaute Ideal-Fixture liefen
   statt gegen den echten Speicherpfad. Dieses Modul IST der Speicherpfad:
   ui.js delegiert hierher, und die Tests bauen ihre Debriefs mit DERSELBEN
   Funktion, die produktiv schreibt.

   OCCURRENCE ≠ TEMPLATE. `psg:tag:pos:slug` identifiziert die Planvorlage —
   dieselbe ID kehrt jede Woche wieder. Die OCCURRENCE ist die eine konkrete
   Einheit an einem konkreten Tag: `occ:<datum>|<t>|<l>`. Vorhersage und
   Debrief muessen sich auf die Occurrence beziehen, sonst verheiratet die
   Reconciliation ein Debrief mit der Vorhersage einer anderen Woche.

   PLANNED BLEIBT PLANNED. Dieses Modul uebernimmt NIE Ist-Werte in die
   geplante Vorgabe. Die geplante Dauer kommt aus dem Planfeld (`45 min`) oder
   bleibt null — dann greift in C3 die Session-Typ-Tabelle, ausgewiesen als
   Tabellenerwartung. Ist-Werte in `planned` waeren Outcome Leakage: Die
   Ausfuehrung diktierte rueckwirkend die Erwartung, completionPct waere
   konstruktionsbedingt 1, und jede lernende Schicht lernte aus einem Echo.

   Kein DOM, keine Uhr, kein Storage. Zeit und Identitaeten werden injiziert.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'debrief-record@5';

  function _req(n) { if (typeof require !== 'function') return null; try { return require(n); } catch (e) { return null; } }
  var SD = O.sessionDebrief || _req('./session-debrief.js');

  /* Occurrence-Schluessel: Datum + Anzeige-Identitaet der Einheit. Bewusst
     DERSELBE Aufbau wie der bisherige gmDbKey, damit bestehende Records ihre
     Identitaet behalten. */
  /* DIE APP HAT BEREITS EINE OCCURRENCE-IDENTITAET: `po:<datum>:<templateId>`
     (Plan-Actual-Link, ui.js/scheduler-input-factory). Der Builder nutzt SIE —
     zwei gleich benannte Einheiten am selben Tag haben verschiedene
     Template-IDs (Position im Tag) und kollidieren nicht. Nur ohne Template-ID
     bleibt der Label-Schluessel, und der Record weist die schwaechere Basis
     aus, statt Eindeutigkeit zu behaupten. */
  function occurrenceIdOf(dateIso, unit) {
    if (unit && unit.id != null && unit.id !== '') {
      return 'po:' + String(dateIso || '') + ':' + String(unit.id);
    }
    return 'occ:' + String(dateIso || '') + '|' + String((unit && unit.t) || '') +
      '|' + String((unit && unit.l) || '');
  }
  function occurrenceBasisOf(unit) {
    return (unit && unit.id != null && unit.id !== '') ? 'template_id' : 'label_fallback';
  }

  /* Geplante Dauer aus dem PLANFELD — nie aus dem Ist. `d` ist ein
     Anzeigetext ('45 min', '6:00 Uhr · ~900 m', 'iv'); nur ein explizites
     Minutenmuster zaehlt. Alles andere bleibt null, und C3 weist die
     Tabellenerwartung als solche aus. */
  function plannedDurationOf(unit) {
    var d = String((unit && unit.d) || '');
    var m = d.match(/(\d+)\s*min\b/i);
    return m ? parseInt(m[1], 10) : null;
  }

  /* ============================================================
     DER KANONISCHE RECORD. Alles, was ein spaeterer Konsument zum Verbinden
     und Bewerten braucht, steht ausdruecklich darin — nichts davon ist
     „aus dem Kontext rekonstruierbar".
     ============================================================ */
  function build(input) {
    var i = input || {};
    var unit = i.unit || null;
    var dateIso = i.date || null;
    var occ = occurrenceIdOf(dateIso, unit);

    var rec = {
      v: 2,
      id: 'db:' + occ.replace(/^(po:|occ:)/, ''),
      sessionIdBasis: occurrenceBasisOf(unit),
      /* Wessen, welche Einheit, welcher Plan — die Verbindungsidentitaet. */
      userId: i.userId != null ? i.userId : null,
      sessionId: occ,
      sessionTemplateId: (unit && unit.id != null) ? unit.id : null,
      planId: i.planId != null ? i.planId : null,
      planRevision: i.planRevision != null ? i.planRevision : null,
      key: i.key || null, date: dateIso,
      /* Rueckfall-Mapping identisch zur ui-Quelle gmSportIdOfUnit (@5):
         das alte Laufen-only-Mapping liess Rad/Schwimmen als null durch —
         und die Kalibrierung haette sie zu 'unknown' vermengt. */
      sportId: (i.planned && i.planned.sportId) || (function () {
        var t = String((unit && unit.t) || '').toLowerCase();
        if (t.indexOf('lauf') >= 0) return 'running';
        if (t.indexOf('rad') >= 0) return 'cycling';
        if (t.indexOf('schwimm') >= 0) return 'swimming';
        return null;
      })(),
      rpe: i.rpe != null ? i.rpe : null,
      pain: !!i.pain,
      reason: i.reason || null,
      createdAt: i.now || null,
      debriefedAt: i.now || null
    };

    /* Das Urteil aus C3 — gegen die GEPLANTE Vorgabe, nie gegen das Echo. */
    try {
      var sd = i.SD || SD;
      if (sd && sd.debrief && i.planned && i.actual) {
        var planned = i.planned;
        if (planned.durationMin != null && i.actual &&
            planned.durationMin === i.actual.durationMin && plannedDurationOf(unit) == null) {
          /* Schutzschicht: Sollte ein Aufrufer doch Ist-Werte hineinkopiert
             haben, wird die Kopie verworfen — planned ohne echte Planquelle
             bleibt ohne Dauer. */
          planned = {};
          Object.keys(i.planned).forEach(function (k) { planned[k] = i.planned[k]; });
          planned.durationMin = plannedDurationOf(unit);
          planned.distanceKm = null;
        }
        var d = sd.debrief({ planned: planned, actual: i.actual,
          zones: i.zones || null, rpe: i.rpe, painDuring: i.pain, today: dateIso });
        rec.judged = d.judged; rec.adherence = d.adherence;
        rec.executionScore = d.executionScore;
        rec.zoneHit = d.zoneHit; rec.deltaPace = d.deltaPace; rec.deltaRpe = d.deltaRpe;
        rec.completionPct = d.completionPct;
        rec.completed = d.completed != null ? d.completed : null;
        rec.expectedRpe = d.expectedRpe; rec.expectedRpeEvidence = d.expectedRpeEvidence;
        rec.domains = d.domains; rec.sessionType = d.sessionType; rec.note = d.note;
        rec.snapshot = d.snapshot || null;
        rec.completedAt = (i.actual && i.actual.completedAt) || dateIso;
      }
    } catch (e) { rec.judgeError = true; }
    return rec;
  }

  /* ============================================================
     UPSERT — die Dedup-Regel des Speicherpfads, PUR UND TESTBAR.

     gmDbSave suchte bisher ueber Datum|Sport|Label — zwei gleich benannte
     Einheiten am selben Tag ueberschrieben sich im Profil, obwohl der Builder
     laengst verschiedene po:-IDs erzeugte. Die Regel lebt jetzt hier:

       beide haben eine ID  -> Treffer nur bei GLEICHER ID
       Bestand ohne ID      -> Legacy-Treffer ueber den Schluessel, und der
                                Bestandsrecord ERHAELT die ID (einmalige
                                Migration beim naechsten Speichern)
       sonst                -> neuer Eintrag

     Zwei Zwillinge mit verschiedenen IDs treffen sich nie.

     ERSETZT WIRD GANZHEITLICH, NIE FELDWEISE (@4). Die feldweise Kopie
     liess Felder des Altrecords stehen, die der neue Record nicht trug —
     nach einem fehlgeschlagenen C3-Urteil (judgeError, kein Snapshot)
     haette der gespeicherte Record das NEUE RPE mit dem ALTEN Snapshot
     kombiniert: eine Chimaere, der jeder Konsument geglaubt haette. Der
     kanonische Builder liefert immer den vollen Vertrag; was er nicht
     liefert, existiert nicht mehr.
     ============================================================ */
  function upsert(store, rec) {
    if (!Array.isArray(store) || !rec) return { stored: false, replaced: false };
    var i;
    for (i = 0; i < store.length; i++) {
      var r = store[i];
      if (!r) continue;
      if (rec.id != null && r.id != null) {
        if (r.id === rec.id) {
          store[i] = rec;                      /* ganzheitlich, keine Altfelder */
          return { stored: true, replaced: true, legacyMigrated: false };
        }
        continue;                              /* verschiedene IDs: NIE mischen */
      }
      if (r.id == null && rec.key != null && r.key === rec.key) {
        store[i] = rec;                        /* einmalige Legacy-Migration */
        return { stored: true, replaced: true, legacyMigrated: true };
      }
    }
    store.push(rec);
    return { stored: true, replaced: false, legacyMigrated: false };
  }

  var api = { VERSION: VERSION, build: build, upsert: upsert,
    occurrenceIdOf: occurrenceIdOf, occurrenceBasisOf: occurrenceBasisOf,
    plannedDurationOf: plannedDurationOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.debriefRecord = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
