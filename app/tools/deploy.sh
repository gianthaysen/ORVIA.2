#!/usr/bin/env bash
# ============================================================
# ORVIA · Deploy  (main → entwicklung · Upload-Satz → origin/main)
# ------------------------------------------------------------
# WOZU. Der bisherige Einzeiler liess das Repo dreimal auf dem Zweig `deploy` mit
# offenem Stash zurueck (v8-421, v8-431, v8-432): Lief er ein zweites Mal — oder bevor
# ein Patch eingespielt war —, gab es nichts zu committen, die &&-Kette brach ab, und
# der Rueckweg (checkout main, stash pop) wurde nie erreicht.
#
# WAS DIESES SKRIPT ANDERS MACHT.
#   · Prueft ZUERST, ohne etwas anzufassen: richtiger Zweig? Suite fuer genau diesen
#     Stand gruen? Ist der Stand schon live?  → „schon live" ist ein sauberes Ende.
#   · Der Rueckweg haengt an einem trap: egal wo es abbricht, am Ende steht das Repo
#     wieder auf main, mit zurueckgespieltem Stash.
#   · Kein force-push. Nie.
#
#   bash app/tools/deploy.sh
# ============================================================
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "❌ kein Git-Repo"; exit 2; }
SATZ="index.html styles.css sw.js manifest.webmanifest js assets locales"
MARK="supabase/tests/.suite-green"
TMP="${TMPDIR:-/tmp}/orvia-upload.$$"
sag()  { printf "%s\n" "$1"; }
ende() { sag "❌ $1"; exit "${2:-1}"; }

# ---- 1 · Vorpruefung: nichts wird veraendert ----
ZWEIG=$(git branch --show-current)
[ "$ZWEIG" = "main" ] || ende "Bitte auf main ausfuehren (aktuell: ${ZWEIG:-unbekannt}). Zurueck:  git checkout main"
HEAD_SHA=$(git rev-parse HEAD)
BUILD=$(grep -o "orvia-v8-[0-9]*" app/sw.js | head -1)
[ -n "$BUILD" ] || ende "Build-Nummer in app/sw.js nicht gefunden."
MSHA=$(grep -o '"sha": *"[0-9a-f]*"' "$MARK" 2>/dev/null | grep -o '[0-9a-f]\{40\}' | head -1)
[ -n "$MSHA" ] || ende "kein Test-Marker — erst:  node supabase/tests/run-all.mjs"
[ "$MSHA" = "$HEAD_SHA" ] || ende "Suite ist fuer ${MSHA:0:7} gruen, HEAD ist ${HEAD_SHA:0:7} — erst:  node supabase/tests/run-all.mjs"
git fetch -q origin || ende "git fetch fehlgeschlagen — ohne Netz kein Deploy." 2

# Was wuerde hochgeladen — und liegt genau das schon auf origin/main?
soll=$(git ls-tree -r "HEAD:app" -- $SATZ | awk '{print $3" "$4}' | sort)
ist=$(git ls-tree -r "origin/main" -- $SATZ 2>/dev/null | awk '{print $3" "$4}' | sort)
[ -n "$soll" ] || ende "Upload-Satz ist leer — app/ nicht gefunden?"
if [ "$soll" = "$ist" ]; then
  sag "✅ $BUILD ist bereits live (origin/main traegt genau diesen Stand) — nichts zu tun."
  git push -q origin main:entwicklung 2>/dev/null || true
  [ "${ORVIA_DEPLOY_OHNE_ABNAHME:-}" = "1" ] || bash app/tools/deploy-verify.sh
  exit 0
fi

# ---- 2 · Deploy; der Rueckweg ist ab hier garantiert ----
GESTASHT=0; MARK_KOPIE=""
zurueck() {
  local rc=$?
  trap - EXIT
  if [ "$(git branch --show-current)" = "deploy" ]; then
    # halb kopierter Upload-Satz: auf dem Zweig deploy sind das nur erzeugte Dateien — verwerfen
    git reset -q --hard 2>/dev/null; git clean -fdq -- $SATZ 2>/dev/null
  fi
  if [ "$(git branch --show-current)" != "main" ]; then git checkout -q main 2>/dev/null || sag "❌ Rueckweg auf main gescheitert — bitte melden."; fi
  if [ "$GESTASHT" = "1" ]; then git stash pop -q 2>/dev/null || sag "❌ Stash liess sich nicht zurueckspielen (git stash list) — bitte melden."; fi
  if [ -n "$MARK_KOPIE" ] && [ -f "$MARK_KOPIE" ] && [ ! -f "$MARK" ]; then cp "$MARK_KOPIE" "$MARK" 2>/dev/null || true; fi
  rm -rf "$TMP" 2>/dev/null
  exit $rc
}
trap zurueck EXIT

git push origin main:entwicklung || ende "Push nach entwicklung gescheitert."
rm -rf "$TMP"; mkdir -p "$TMP" || ende "Zwischenordner nicht anlegbar." 2
git archive HEAD app | tar -x -C "$TMP" || ende "Upload-Satz liess sich nicht entpacken." 2
MARK_KOPIE="$TMP/suite-green"; cp "$MARK" "$MARK_KOPIE" 2>/dev/null || MARK_KOPIE=""
if [ -n "$(git status --porcelain)" ]; then git stash -u -q || ende "Stash gescheitert." 2; GESTASHT=1; fi
git checkout -q -B deploy origin/main || ende "Zweig deploy liess sich nicht anlegen." 2
# Ordner des Upload-Satzes exakt spiegeln (Geloeschtes verschwindet auch live)
spiegeln() { if command -v rsync >/dev/null 2>&1; then rsync -a --delete "$1/" "$2/"; else rm -rf "$2" && cp -R "$1" "$2"; fi; }
spiegeln "$TMP/app/js" js && spiegeln "$TMP/app/assets" assets && spiegeln "$TMP/app/locales" locales || ende "Kopieren des Upload-Satzes gescheitert." 2
cp "$TMP/app/index.html" "$TMP/app/styles.css" "$TMP/app/sw.js" "$TMP/app/manifest.webmanifest" . || ende "Kopieren der Wurzeldateien gescheitert." 2
git add -A -- $SATZ
if git diff --cached --quiet; then
  sag "• nichts zu committen — origin/main traegt den Stand bereits."
else
  git -c user.name="Gian Thaysen" -c user.email="gthaysen@thaysen.com" commit -q -m "Deploy ${BUILD#orvia-}" || ende "Commit gescheitert." 2
  git push origin deploy:main || ende "Push nach main gescheitert (kein force-push — erst klaeren, was auf origin/main neu ist)."
  sag "✅ ${BUILD#orvia-} ausgeliefert."
fi

# zurueck auf main (trap raeumt auf), dann die Abnahme
git checkout -q main || ende "Rueckweg auf main gescheitert." 2
if [ "$GESTASHT" = "1" ]; then git stash pop -q || ende "Stash liess sich nicht zurueckspielen." 2; GESTASHT=0; fi
if [ -n "$MARK_KOPIE" ] && [ ! -f "$MARK" ]; then cp "$MARK_KOPIE" "$MARK" 2>/dev/null || true; fi
rm -rf "$TMP"; trap - EXIT
[ "${ORVIA_DEPLOY_OHNE_ABNAHME:-}" = "1" ] && exit 0
bash app/tools/deploy-verify.sh
