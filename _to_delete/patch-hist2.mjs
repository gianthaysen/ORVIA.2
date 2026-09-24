import fs from 'node:fs';
function patch(f, pairs) { let s = fs.readFileSync(f, 'utf8'); pairs.forEach(([a, b]) => { if (!s.includes(a)) throw new Error(f + ' anchor: ' + a.slice(0, 70)); s = s.replace(a, b); }); fs.writeFileSync(f, s); }
patch('app/js/repos/goalRepository.js', [[
`    if (goal.result && typeof goal.result === 'object') row.result = goal.result;
    return row;`,
`    if (goal.result && typeof goal.result === 'object') row.result = goal.result;
    /* S1.5 (Migration 0045): history NUR senden, wenn belegt — gleiche Schutzregel wie result. */
    if (Array.isArray(goal.history) && goal.history.length) row.history = goal.history;
    return row;`]]);
patch('app/js/profile-store.js', [[
`          result: (r.result && typeof r.result === 'object') ? r.result : (prev.result || null)
        });`,
`          result: (r.result && typeof r.result === 'object') ? r.result : (prev.result || null),
          history: Array.isArray(r.history) ? r.history : (Array.isArray(prev.history) ? prev.history : [])
        });`]]);
patch('app/js/profile.js', [[
`function goalAdd(input,reason){commitGoals(pmModel().addGoal(listGoals(),input),'add');}
function goalUpdate(id,patch,reason){commitGoals(pmModel().updateGoal(listGoals(),id,patch),'update');}`,
`/* S1.5: Historien-Kontext — Prognose (Goal-Engine, Minuten) zum Zeitpunkt der Aenderung, nur fuer das Hauptziel. */
function _goalHistMeta(id,reason){var meta={};if(reason)meta.source=String(reason);
  try{var mg=typeof mainGoalOf==='function'?mainGoalOf():null;if(mg&&(id==null||mg.id===id)&&typeof buildGoal==='function'){var e=buildGoal();if(e&&e.tPred>0&&e.state!=='nodata')meta.forecastMin=e.tPred;}}catch(_){ }
  return meta;}
function goalAdd(input,reason){commitGoals(pmModel().addGoal(listGoals(),input,undefined,_goalHistMeta(null,reason)),'add');}
function goalUpdate(id,patch,reason){commitGoals(pmModel().updateGoal(listGoals(),id,patch,undefined,_goalHistMeta(id,reason)),'update');}`],
[`function goalSetStatus(id,st){commitGoals(pmModel().setGoalStatus(listGoals(),id,st),'status');}`,
 `function goalSetStatus(id,st){commitGoals(pmModel().updateGoal(listGoals(),id,{status:st},undefined,_goalHistMeta(id,'status')),'status');}`]]);
fs.writeFileSync('supabase/migrations/0045_goal_history.sql', `-- ============================================================
-- 0045 · user_goals.history — Aenderungsgeschichte je Ziel (S1.5, 13.09.2026)
-- ------------------------------------------------------------
-- WOFUER. Die Ziel-Detailseite (Prototyp v14) zeigt eine Historie: „Zielzeit
-- verschaerft 1:55 → 1:50, Prognose zu dem Zeitpunkt 1:50:40", „Ziel angelegt".
-- Der A-06-Shadow-Log (0037) ist dafuer ungeeignet: er protokolliert nur das
-- Hauptziel als Schnappschuss und ist ein Beobachter, kein Produktdatum.
--
--   history jsonb  [{at, type: created|title|target|date|priority|status|result|milestone,
--                    from, to, forecastMin?, note?}]   append-only, max. 60, vom
--                   Client-Modell (profile-model.updateGoal) geschrieben.
--
-- REIHENFOLGE. Vor dem Client-Deploy v8-374 ausfuehren: der Client sendet
-- history nur, wenn belegt — ohne 0045 schluege der Upsert fuer jedes geaenderte
-- Ziel fehl (unbekannte Spalte). Bestehende Ziele ohne Historie bleiben leer;
-- die Detailseite zeigt dann nur „angelegt am <created_at>".
-- ============================================================

begin;

alter table public.user_goals add column if not exists history jsonb;

comment on column public.user_goals.history is
  'S1.5: Aenderungsgeschichte des Ziels (append-only, vom Client-Modell geschrieben). Null/leer = keine Eintraege.';

commit;
`);
console.log('ok');
