#!/usr/bin/env bash
# ============================================================
# ORVIA · Deploy-Abnahme  (nach jedem Upload in die Repo-Wurzel)
# ------------------------------------------------------------
# WOZU. Zwei Vorfälle, die diese Datei beide gefunden hätte:
#   16.08. Teildeploy — styles.css kam nicht mit, sw.js meldete trotzdem die
#          neue Version. Der Cache wurde mit der ALTEN CSS einbetoniert.
#   17.08. Force-Push — die Historie von origin/main wurde ersetzt. Hätte der
#          Upload dabei das lokale app/-Layout getroffen, wäre Pages sofort tot.
# Beides war grün in CI. CI prüft entwicklung; NIEMAND prüfte die Wurzel.
#
# WAS SIE TUT. Sie vergleicht jede Datei des Upload-Satzes byteweise (über den
# Git-Blob-Hash) zwischen lokalem app/ und origin/main. Fehlend, abweichend und
# zusätzlich werden getrennt gemeldet. Zusätzlich: Layout, Dateizahlen,
# Versionsgleichstand und ob die Historie umgeschrieben wurde.
#
# WAS SIE NICHT TUT. Sie ruft die Live-URL nicht ab — GitHub Pages liefert
# gecacht aus und würde falsch beruhigen. Geprüft wird das Repo; der Pages-Bau
# folgt daraus 1–2 Minuten später.
#
#   bash app/tools/deploy-verify.sh              # mit git fetch
#   bash app/tools/deploy-verify.sh --kein-fetch # gegen den vorhandenen Stand
# ============================================================
set -u
cd "$(dirname "$0")/../.." || exit 2
ROT=$'\033[31m'; GRUEN=$'\033[32m'; GELB=$'\033[33m'; AUS=$'\033[0m'
fehler=0
ok()   { printf "%s✅%s %s\n" "$GRUEN" "$AUS" "$1"; }
rot()  { printf "%s❌%s %s\n" "$ROT" "$AUS" "$1"; fehler=$((fehler+1)); }
hinw() { printf "%s•%s  %s\n" "$GELB" "$AUS" "$1"; }

if [ "${1:-}" != "--kein-fetch" ]; then
  git fetch origin --quiet || { rot "git fetch fehlgeschlagen — ohne Netz keine Aussage."; exit 2; }
fi

echo "══ 0 · Test-Marker (A-05) ══"
# Ein gruener Suite-Lauf hinterlaesst supabase/tests/.suite-green mit dem
# HEAD-SHA (run-all.mjs). Ohne diesen Marker — oder gehoert er zu einem anderen
# Commit — ist NICHT belegt, dass die Tests fuer den auszuliefernden Stand
# gruen waren. Das ist die technische Sperre, die den fehlenden PR-Statuscheck
# ersetzt: ein roter Test blockiert damit den DEPLOY, nicht einen Merge.
MARK_SUITE="supabase/tests/.suite-green"
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null)
if [ ! -f "$MARK_SUITE" ]; then
  rot "kein Test-Marker — erst  node supabase/tests/run-all.mjs  gruen fahren."
else
  read -r MSHA MCOMPLETE MDIRTY <<MARKEOF
$(node -e 'const fs=require("fs");try{const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write((m.sha||"-")+" "+(m.complete===true)+" "+(m.dirty===true))}catch(e){process.stdout.write("- false false")}' "$MARK_SUITE" 2>/dev/null)
MARKEOF
  if [ "$MSHA" = "-" ] || [ -z "$MSHA" ]; then
    rot "Test-Marker ohne SHA — Lauf konnte HEAD nicht bestimmen, nicht verwertbar."
  elif [ "$MSHA" != "$HEAD_SHA" ]; then
    rot "Test-Marker gehoert zu ${MSHA:0:7}, HEAD ist ${HEAD_SHA:0:7} — Suite erneut gruen fahren."
  else
    ok "Suite gruen fuer ${HEAD_SHA:0:7} belegt"
    [ "$MCOMPLETE" = "true" ] || hinw "lokaler Lauf unvollstaendig (Browser-Tests uebersprungen) — die vollstaendige Pruefung ist die CI auf entwicklung."
    [ "$MDIRTY" = "true" ] && hinw "Testlauf erfolgte auf einem geaenderten Arbeitsbaum — Block 3 vergleicht die ausgelieferten Dateien byteweise."
  fi
fi

echo "══ 1 · Historie ══"
# Der zuletzt abgenommene Stand steht in dieser Datei. Ist er kein Vorfahre
# mehr, wurde origin/main force-gepusht — der Fall vom 17.08.
MERK="app/tools/.deploy-main-tip"
NEU=$(git rev-parse origin/main)
if [ -f "$MERK" ]; then
  ALT=$(cat "$MERK")
  if git cat-file -e "$ALT" 2>/dev/null; then
    if git merge-base --is-ancestor "$ALT" "$NEU"; then
      ok "Historie fortgeschrieben (${ALT:0:7} → ${NEU:0:7})"
    else
      rot "HISTORIE UMGESCHRIEBEN: ${ALT:0:7} ist kein Vorfahre von ${NEU:0:7}."
      hinw "alten Stand sichern:  git tag -f historie-$(date +%F) $ALT"
    fi
  else hinw "gemerkter Stand ${ALT:0:7} lokal unbekannt — Prüfung übersprungen"; fi
else hinw "kein gemerkter Stand — erste Abnahme, Historienprüfung ab dem nächsten Lauf"; fi

echo "══ 2 · Layout der Wurzel ══"
WURZEL=$(git ls-tree --name-only origin/main)
for p in index.html sw.js styles.css env.js manifest.webmanifest js assets; do
  echo "$WURZEL" | grep -qx "$p" && ok "$p liegt in der Wurzel" || rot "$p FEHLT in der Wurzel"
done
echo "$WURZEL" | grep -qx "app" && rot "Wurzel enthält app/ — falsches Layout, Pages findet nichts!" \
  || ok "kein app/ in der Wurzel"

echo "══ 3 · Dateivergleich app/ ↔ origin/main ══"
fehlt=(); abw=(); anz=0
while IFS= read -r f; do
  rel="${f#app/}"
  anz=$((anz+1))
  lokal=$(git hash-object "$f")
  fern=$(git rev-parse -q --verify "origin/main:$rel" 2>/dev/null)
  if [ -z "$fern" ]; then fehlt+=("$rel")
  elif [ "$lokal" != "$fern" ]; then abw+=("$rel"); fi
done < <(cd app && find index.html styles.css sw.js env.js manifest.webmanifest js assets -type f \
          ! -name '.DS_Store' ! -name '.fuse_hidden*' 2>/dev/null | sed 's|^|app/|')
echo "   $anz Dateien im Upload-Satz geprüft"
if [ ${#fehlt[@]} -eq 0 ]; then ok "keine Datei fehlt oben"; else
  rot "${#fehlt[@]} Datei(en) FEHLEN oben:"; printf '     %s\n' "${fehlt[@]}" | head -20; fi
if [ ${#abw[@]} -eq 0 ]; then ok "kein Inhalt weicht ab"; else
  rot "${#abw[@]} Datei(en) weichen ab (alter Stand oben):"; printf '     %s\n' "${abw[@]}" | head -20; fi

echo "══ 4 · Versionsgleichstand ══"
lv=$(grep -o "orvia-v8-[0-9]*" app/sw.js | head -1)
fv=$(git show origin/main:sw.js 2>/dev/null | grep -o "orvia-v8-[0-9]*" | head -1)
mv=$(git show origin/main:index.html 2>/dev/null | grep -o 'orvia-build" content="[^"]*"' | grep -o 'orvia-v8-[0-9]*')
[ "$lv" = "$fv" ] && ok "sw.js: lokal und oben $fv" || rot "sw.js: lokal $lv, oben $fv"
[ "$fv" = "$mv" ] && ok "index.html Build-Marker: $mv" || rot "Build-Marker $mv passt nicht zu sw.js $fv"

echo "══════════════════════════════════════════"
if [ $fehler -eq 0 ]; then
  printf "%sABNAHME BESTANDEN%s — %s ist vollständig oben.\n" "$GRUEN" "$AUS" "$fv"
  echo "$NEU" > "$MERK"
  echo "gemerkt für die nächste Historienprüfung: ${NEU:0:7}"
  exit 0
else
  printf "%s%d BEFUND(E) — NICHT abgenommen.%s\n" "$ROT" "$fehler" "$AUS"
  echo "Bei fehlenden/abweichenden Dateien: erst hochladen, DANN die SW-Version erhöhen."
  echo "Der gemerkte Stand bleibt unverändert."
  exit 1
fi
