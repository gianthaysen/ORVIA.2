import fs from 'fs';
const f='app/js/screens/strength-profile.js'; let s=fs.readFileSync(f,'utf8');
function rep(a,b){ if(!s.includes(a)){console.error('MISSING:',a.slice(0,90));process.exit(1);} s=s.replace(a,b); }
rep(`  function lvl() { try { return typeof root.gmLevel === 'function' ? root.gmLevel() : 'f'; } catch (e) { return 'f'; } }`,
`  function lvl() { try { return typeof root.gmLevel === 'function' ? root.gmLevel() : 'f'; } catch (e) { return 'f'; } }
  /* Niveau-Vertrag (S2b-1): dieselben Daten, drei Tiefen. Anfaenger sehen Maximum, Bestwerte,
     Ziel und EINE Balance-Aussage in Worten — keine Muskelzeilen, keine Tonnage, keine Historie,
     kein Fachjargon (e1RM/RIR/Korridor). Profi bekommt zusaetzlich Methode, relative Kraft,
     Korridorzahlen. */
  var DEPTH = { a: { jargon: false, history: false, muscles: false, tonnage: false, balanceBars: false, relative: false, meta: false },
                f: { jargon: true, history: true, muscles: true, tonnage: true, balanceBars: true, relative: false, meta: true },
                p: { jargon: true, history: true, muscles: true, tonnage: true, balanceBars: true, relative: true, meta: true } };
  function depth() { return DEPTH[lvl()] || DEPTH.f; }`);
/* Uebungskarte: Titel/Einheit/Meta nach Tiefe */
rep(`    var title = esc(em.name) + (em.mode === 'load' ? ' · ' + esc(T('kp.geschaetztes_1rm')) : '');`,
`    var D = depth();
    var title = esc(em.name) + (em.mode === 'load' ? ' · ' + esc(T(D.jargon ? 'kp.geschaetztes_1rm' : 'kp.geschaetztes_max')) : '');`);
rep(`      h += '<div class="kp-hero"><b>' + esc(kg(em.current)) + '</b><span>' + esc(T('kp.unit_e1rm')) + '</span>' + (dtx ? '<span class="kp-delta' + (em.delta.kg < 0 ? ' dn' : '') + '">' + esc(dtx) + '</span>' : '') + '</div>';
      var meta = [];
      if (em.lastScheme) meta.push(T('kp.letzter_satz') + ': ' + em.lastScheme);
      meta.push(em.lastTest ? T('kp.letzter_test') + ': ' + kg(em.lastTest.weight) + ' kg (' + deDateY(em.lastTest.date) + ')' : T('kp.kein_test'));
      if (em.relative != null && L !== 'a') meta.push(T('kp.relativ', { v: kg(em.relative, 2) }));
      h += '<div class="kp-meta">' + esc(meta.join(' · ')) + '</div>';
      h += chart(em, m);
      if (L === 'a') h += '<div class="kp-note">' + ic('info', 'sm') + '<div><b>' + esc(T('kp.kurz_erklaert')) + '</b> ' + esc(T('kp.e1rm_erklaerung')) + '</div></div>';
      if (em.stagnant) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.stagnation_t')) + '</b> ' + esc(T('kp.stagnation_d')) + '</div></div>';
      h += src(T(em.method === 'epley_rir' ? 'kp.src_epley_rir' : 'kp.src_epley'));`,
`      h += '<div class="kp-hero"><b>' + esc(kg(em.current)) + '</b><span>' + esc(T(D.jargon ? 'kp.unit_e1rm' : 'kp.unit_max')) + '</span>' + (dtx ? '<span class="kp-delta' + (em.delta.kg < 0 ? ' dn' : '') + '">' + esc(dtx) + '</span>' : '') + '</div>';
      var meta = [];
      if (em.lastScheme) meta.push(T('kp.letzter_satz') + ': ' + (D.jargon ? em.lastScheme : em.lastScheme.replace(/ · RIR \\d+/, '')));
      if (D.meta) meta.push(em.lastTest ? T('kp.letzter_test') + ': ' + kg(em.lastTest.weight) + ' kg (' + deDateY(em.lastTest.date) + ')' : T('kp.kein_test'));
      if (em.relative != null && D.relative) meta.push(T('kp.relativ', { v: kg(em.relative, 2) }));
      h += '<div class="kp-meta">' + esc(meta.join(' · ')) + '</div>';
      h += chart(em, m);
      if (!D.jargon) h += '<div class="kp-note">' + ic('info', 'sm') + '<div><b>' + esc(T('kp.kurz_erklaert')) + '</b> ' + esc(T('kp.e1rm_erklaerung')) + '</div></div>';
      if (em.stagnant) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.stagnation_t')) + '</b> ' + esc(T(D.jargon ? 'kp.stagnation_d' : 'kp.stagnation_d_einfach')) + '</div></div>';
      h += src(T(!D.jargon ? 'kp.src_einfach' : (em.method === 'epley_rir' ? 'kp.src_epley_rir' : 'kp.src_epley')));`);
/* Kurve: Einheit im Read-out */
rep(`var unit = em.mode === 'load' ? T('kp.unit_e1rm') : em.mode === 'reps' ? T('kp.unit_wdh') : '';`,
`var unit = em.mode === 'load' ? T(depth().jargon ? 'kp.unit_e1rm' : 'kp.unit_max') : em.mode === 'reps' ? T('kp.unit_wdh') : '';`);
/* PR: e1RM-Wort nur mit Jargon */
rep(`(p.kind === 'best_set' ? T('kp.unit_e1rm_short') + ' ' + kg(p.value) : kg(p.value) + ' kg')`, `(p.kind === 'best_set' ? (depth().jargon ? T('kp.unit_e1rm_short') + ' ' : '') + kg(p.value) + (depth().jargon ? '' : ' kg') : kg(p.value) + ' kg')`);
/* Historie / Muskeln / Tonnage nach Tiefe */
rep(`    if (!em || !em.ready || em.mode !== 'load' || !em.history.length || lvl() === 'a') return '';`, `    if (!em || !em.ready || em.mode !== 'load' || !em.history.length || !depth().history) return '';`);
rep(`    var mr = m.muscles; if (!mr) return '';`, `    var mr = m.muscles; if (!mr || !depth().muscles) return '';`);
rep(`    var G = m.groups, keys = ['legs', 'push', 'pull', 'core'];`, `    if (!depth().tonnage) return '';
    var G = m.groups, keys = ['legs', 'push', 'pull', 'core'];`);
/* Balance: Anfaenger nur der Satz */
rep(`    var h = '<div class="card tight" data-gm-slot="strength-balance"><div class="ctitle"><div class="l">' + ic('shield') + ' ' + esc(T('kp.balance')) + '</div><span class="more">' + esc(T('kp.28_tage')) + '</span></div><div class="kp-bal">' +
      row(T('kp.druck_zug'), b.pushPull, grpLabel('push'), grpLabel('pull')) + row(T('kp.beine_oberkoerper'), b.legsUpper, grpLabel('legs'), T('kp.oberkoerper')) + '</div>';`,
`    var D = depth();
    var h = '<div class="card tight" data-gm-slot="strength-balance"><div class="ctitle"><div class="l">' + ic('shield') + ' ' + esc(T('kp.balance')) + '</div><span class="more">' + esc(T('kp.28_tage')) + '</span></div>' +
      (D.balanceBars ? '<div class="kp-bal">' + row(T('kp.druck_zug'), b.pushPull, grpLabel('push'), grpLabel('pull')) + row(T('kp.beine_oberkoerper'), b.legsUpper, grpLabel('legs'), T('kp.oberkoerper')) + '</div>' : '');`);
rep(`    return h + src(T('kp.src_balance')) + '</div>';
  }`, `    return h + (D.balanceBars ? src(T('kp.src_balance')) : '') + '</div>';
  }`);
fs.writeFileSync(f,s);
let l=fs.readFileSync('app/locales/de.js','utf8');
const anchor="    'kp.titel': 'Kraftprofil',";
l=l.replace(anchor, anchor+`
    'kp.geschaetztes_max': 'dein geschätztes Maximum',
    'kp.unit_max': 'kg Maximum (geschätzt)',
    'kp.stagnation_d_einfach': 'Du hast drei Einheiten in Folge dasselbe Gewicht und dieselben Wiederholungen geschafft. Mach eine Einheit mit etwa 10 % weniger Gewicht und steigere danach wieder.',
    'kp.src_einfach': 'Aus deinen normalen Sätzen hochgerechnet — eine Schätzung, kein Test',`);
fs.writeFileSync('app/locales/de.js',l);
console.log('patch4 ok');
