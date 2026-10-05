/* ============================================================
   ORVIA · deploy_script — app/tools/deploy.sh (v8-433)
   Der fruehere Einzeiler liess das Repo dreimal auf `deploy` mit offenem Stash zurueck
   (Doppellauf ⇒ „nothing to commit" ⇒ &&-Kette bricht vor dem Rueckweg ab).
   Hier: Aufbau und Reihenfolge des Skripts. Das Verhalten selbst wurde gegen ein lokales
   Wegwerf-Remote durchgespielt (ohne Marker, falscher Marker, echter Deploy mit
   ungesicherten Aenderungen, Doppellauf, falscher Zweig, geloeschte Datei, fremder Commit
   auf origin/main, abgewiesener Push) — das laeuft nicht in der Suite (klont das Repo).
   node supabase/tests/deploy_script_test.mjs
   ============================================================ */
import fs from 'fs';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const p = new URL(_APPREL + 'tools/deploy.sh', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const src = fs.readFileSync(p, 'utf8');
const code = src.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
let syn = false; try { execFileSync('bash', ['-n', p.pathname]); syn = true; } catch (e) {}
ok('A1 Skript ist syntaktisch gueltig (bash -n)', syn);
ok('A2 kein force-push, nirgends', !/push[^\n]*(--force|-f\b|\+deploy|\+main)/.test(code) && !/--force/.test(code));
const iBranch = code.indexOf('[ "$ZWEIG" = "main" ] || ende'), iMark = code.indexOf('[ "$MSHA" = "$HEAD_SHA" ] || ende'), iLive = code.indexOf('if [ "$soll" = "$ist" ]; then'), iPush = code.indexOf('git push origin main:entwicklung ||'), iStash = code.indexOf('git stash -u -q'), iCo = code.indexOf('git checkout -q -B deploy origin/main'), iTrap = code.indexOf('trap zurueck EXIT');
ok('A3 Vorpruefung (Zweig, Suite-Marker == HEAD, schon live?) steht VOR jeder Aenderung', iBranch > 0 && iMark > iBranch && iLive > iMark && iPush > iLive && iStash > iLive && iCo > iLive);
ok('A4 „schon live" ist ein sauberes Ende ohne Zweigwechsel (der Doppellauf)', /if \[ "\$soll" = "\$ist" \]; then[\s\S]{0,400}exit 0\s*\nfi/.test(code) && code.indexOf('exit 0', iLive) < iStash);
ok('A5 der Rueckweg haengt an einem trap, gesetzt BEVOR gestasht oder der Zweig gewechselt wird', iTrap > iLive && iTrap < iStash && iTrap < iCo);
const z = code.slice(code.indexOf('zurueck() {'), iTrap);
ok('A6 Rueckweg: halben Upload verwerfen, main auschecken, Stash zurueckspielen, Marker sichern, Fehlercode durchreichen', /git reset -q --hard/.test(z) && /git clean -fdq -- \$SATZ/.test(z) && /git checkout -q main/.test(z) && /git stash pop -q/.test(z) && /local rc=\$\?/.test(z) && /exit \$rc/.test(z));
ok('A7 gestasht wird nur, wenn es etwas zu stashen gibt (sonst wuerde ein fremder Stash zurueckgespielt)', /if \[ -n "\$\(git status --porcelain\)" \]; then git stash -u -q \|\| ende "Stash gescheitert\." 2; GESTASHT=1; fi/.test(code));
ok('A8 Upload-Satz wie bisher: index, styles, sw, manifest, js, assets, locales — env.js bleibt unberuehrt', /SATZ="index\.html styles\.css sw\.js manifest\.webmanifest js assets locales"/.test(code) && !/env\.js/.test(code));
ok('A9 nichts zu committen bricht nicht ab', /if git diff --cached --quiet; then[\s\S]{0,160}else[\s\S]{0,260}git push origin deploy:main \|\| ende/.test(code));
ok('A10 Ordner werden gespiegelt (rsync --delete; ohne rsync loeschen + kopieren)', /rsync -a --delete "\$1\/" "\$2\/"; else rm -rf "\$2" && cp -R "\$1" "\$2"/.test(code));
ok('A11 am Ende die bestehende Abnahme (deploy-verify.sh)', /bash app\/tools\/deploy-verify\.sh\s*$/.test(code.trim()));
console.log('\n' + (fail ? '❌' : '✅') + ' deploy_script: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
