/* ORVIA · v8-456/457 · Einbrueche im Tempo-/Kadenz-Verlauf einer Aktivitaet einordnen — NUR LESEN.
   Angemeldet in der Konsole des Desktop-Browsers einfuegen (ORVIA ab v8-456). Optional vorher setzen:
     window.__ORVIA_DIPS_DAY = '2026-09-06'   (Standard: Halbmarathon 06.09.)   window.__ORVIA_DIPS_SPORT = 'running'
   Schreibt nichts (kein Server, kein Zwischenspeicher, kein Flag). Liest die gespeicherte Zeile und ordnet JEDEN gespeicherten
   Messpunkt mit auffaelligem Wert einer Klasse zu:
     stop          Geschwindigkeit ≤ 0,3 m/s (Stillstand)          → v8-456: eigener Punkt am Grund, kein Tempo
     slow_move     Geschwindigkeit 0,3–1,7 m/s (Gehen, ≥ 10 min/km) → Messwert, Tempoachse zeigt ihn am Rand
     cadence_zero  Kadenz 0 bei Bewegung (> 0,3 m/s)               → Sensor-/Uebertragungsausfall, nicht geloescht
     time_gap      Zeitsprung > max(3 × Median, 60 s) vor dem Punkt → Abschnitt ohne Messwerte (Timer/Lücke)
   und vergleicht mit Garmins Zeiten (Timer, Gesamt, Bewegung) sowie mit der Abtastung (gelieferte vs. gespeicherte Zeilen).
   Ausgabe: nur Zaehlungen, Anteile und Zeitpunkte (Sekunden seit Start) — keine GPS-Punkte, keine Namen, keine Kennungen
   (8 Zeichen), keine Zugangsdaten, keine vollstaendigen Messreihen. Ergebnis als JSON in der Zwischenablage. */
(async () => {
  const O = window.ORVIA, sb = O && O.sb, uid = O && O.user && O.user.id;
  if (!sb || !uid) return 'Nicht angemeldet oder Supabase nicht geladen.';
  const DAY = window.__ORVIA_DIPS_DAY || '2026-09-06', SPORT = window.__ORVIA_DIPS_SPORT || 'running';
  const isN = v => typeof v === 'number' && isFinite(v);
  const r1 = v => isN(v) ? Math.round(v * 10) / 10 : v;
  const { data, error } = await sb.from('activities').select('id,sport_id,source,started_at,duration_seconds,status,summary,metrics')
    .eq('user_id', uid).eq('sport_id', SPORT).gte('started_at', DAY + 'T00:00:00Z').lte('started_at', DAY + 'T23:59:59Z');
  if (error) return 'Lesefehler: ' + (error.message || error.code);
  if (!data || !data.length) return 'Keine Aktivitaet ' + SPORT + ' am ' + DAY + '.';
  const out = data.map(r => {
    const m = r.metrics || {}, st = m.streams || {}, g = m.garmin || {};
    const sp = Array.isArray(st.speed) ? st.speed : null, cad = Array.isArray(st.cadence) ? st.cadence : null, t = Array.isArray(st.time) ? st.time : null;
    const n = Math.max(sp ? sp.length : 0, cad ? cad.length : 0);
    const dts = []; if (t) for (let i = 1; i < t.length; i++) if (isN(t[i]) && isN(t[i - 1])) dts.push(t[i] - t[i - 1]);
    const med = dts.length ? dts.slice().sort((a, b) => a - b)[Math.floor(dts.length / 2)] : null;
    const gapLim = med != null ? Math.max(3 * med, 60) : null;
    const cls = { stop: [], slow_move: [], cadence_zero: [], time_gap: [] };
    for (let i = 0; i < n; i++) {
      const v = sp && isN(sp[i]) ? sp[i] : null, c = cad && isN(cad[i]) ? cad[i] : null, at = t && isN(t[i]) ? Math.round(t[i]) : i;
      if (v !== null && v <= 0.3) cls.stop.push(at);
      else if (v !== null && v < 1.67) cls.slow_move.push(at);
      if (c === 0 && v !== null && v > 0.3) cls.cadence_zero.push(at);
      if (gapLim != null && i > 0 && isN(t[i]) && isN(t[i - 1]) && t[i] - t[i - 1] > gapLim) cls.time_gap.push(at + ' (+' + Math.round(t[i] - t[i - 1]) + ' s)');
    }
    /* v8-457 · Entscheidende Gegenprobe: Kadenz und Puls AN DEN langsamen Punkten. Gehen = Kadenz deutlich niedriger (≈ 100–135 spm)
       → echter Einbruch. Kadenz normal (≥ 145) bei niedriger Geschwindigkeit → GPS-/Geschwindigkeitsfehler, kein Gehen. */
    const medOf = a => { const v = a.filter(isN).slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const hrS = Array.isArray(st.heart_rate) ? st.heart_rate : null, cadAt = [], hrAt = [], cadAll = [];
    for (let i = 0; i < n; i++) { const v = sp && isN(sp[i]) ? sp[i] : null; if (cad && isN(cad[i]) && v !== null && v >= 1.67) cadAll.push(cad[i]); if (v !== null && v > 0.3 && v < 1.67) { if (cad && isN(cad[i])) cadAt.push(cad[i]); if (hrS && isN(hrS[i])) hrAt.push(hrS[i]); } }
    const cS = medOf(cadAt), cA = medOf(cadAll);
    const gegenprobe = { kadenz_median_langsame_punkte: cS, kadenz_median_laufend: cA, puls_median_langsame_punkte: medOf(hrAt),
      deutung: cS == null ? 'keine Kadenz an langsamen Punkten' : (cS <= 135 ? 'Kadenz an den Einbruechen deutlich niedriger → wahrscheinlich echtes Gehen (z. B. Anstiege, Verpflegung)' : (cS >= 145 ? 'Kadenz an den Einbruechen normal → wahrscheinlich GPS-/Geschwindigkeitsfehler, kein Gehen' : 'Kadenz dazwischen → nicht eindeutig')) };
    const short = a => a.length > 24 ? a.slice(0, 12).concat(['…'], a.slice(-6)) : a;
    const timer = isN(g.timer_duration_s) ? g.timer_duration_s : null, el = isN(g.elapsed_duration_s) ? g.elapsed_duration_s : null, mv = isN(g.moving_duration_s) ? g.moving_duration_s : null;
    return {
      id: String(r.id).slice(0, 8), start: r.started_at, source: r.source,
      zeiten: { timer: timer, gesamt: el, bewegung: mv, gesamt_minus_timer: (el != null && timer != null) ? Math.round(el - timer) : null, timer_minus_bewegung: (timer != null && mv != null) ? Math.round(timer - mv) : null },
      abtastung: { geliefert: isN(g.stream_rows) ? g.stream_rows : null, gespeichert: isN(g.stream_kept) ? g.stream_kept : n, median_abstand_s: med, luecken_grenze_s: gapLim,
                   hinweis: (isN(g.stream_rows) && isN(g.stream_kept) && g.stream_kept < g.stream_rows) ? 'gespeichert ist jede ' + Math.ceil(g.stream_rows / g.stream_kept) + '. Zeile — kurze Stopps koennen als einzelner Einbruch erscheinen' : null },
      punkte: n, gegenprobe: gegenprobe,
      klassen: Object.fromEntries(Object.keys(cls).map(k => [k, { anzahl: cls[k].length, anteil_pct: n ? r1(cls[k].length / n * 100) : null, sekunden: short(cls[k]) }])),
      einordnung: cls.stop.length && !cls.time_gap.length && timer != null && mv != null && timer - mv > 30
        ? 'Einbrueche passen zu Stillstand OHNE angehaltene Uhr (Timer − Bewegung = ' + Math.round(timer - mv) + ' s): echte Messpunkte, ab v8-456 als Stillstand markiert, nicht geloescht.'
        : (cls.time_gap.length ? 'Abschnitte ohne Messwerte vorhanden — v8-456 zeigt sie als verkuerzte Luecke (aktive Zeit) bzw. Flaeche (Gesamtzeit).' : 'Keine Stillstands- oder Lueckenpunkte — Einbrueche anders verursacht; Ausgabe an Claude geben.')
    };
  });
  const json = JSON.stringify({ tool: 'activity-dips@2', build: (document.querySelector('meta[name="orvia-build"]') || {}).content || null, tag: DAY, sport: SPORT, aktivitaeten: out }, null, 2);
  try { await navigator.clipboard.writeText(json); console.log('In der Zwischenablage (' + json.length + ' Zeichen).'); } catch (e) { console.log(json); }
  return out;
})();
