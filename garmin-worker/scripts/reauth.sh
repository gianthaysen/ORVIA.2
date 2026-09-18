#!/usr/bin/env bash
# ORVIA — Garmin-Neuanmeldung in einem Befehl.
#
# Hintergrund: Garmin blockt Passwort-Logins von Cloud-IPs (Railway). Der Login
# muss deshalb lokal auf diesem Rechner laufen; nur das Session-Token geht an
# den Worker (POST /connect/token-import). Passwort und Token werden nie
# angezeigt, nie gespeichert, landen nicht in der Shell-History.
#
# Aufruf:   bash scripts/reauth.sh        (aus dem Ordner garmin-worker/)
#
# Andere Worker-Domain (z. B. nach einem Railway-Redeploy):
#           ORVIA_WORKER_URL='https://<neue-domain>' bash scripts/reauth.sh
#
# Idempotent: baut sich bei Bedarf eine eigene Umgebung unter .venv-login.
# Das alte .venv wird nicht angefasst.
#
# WICHTIG: garminconnect 0.3.6 verlangt Python >= 3.12. Das System-Python von
# macOS ist 3.9 — damit ist der Login NICHT installierbar. Das Skript sucht
# deshalb selbst einen passenden Interpreter.

set -euo pipefail

GC_VERSION="0.3.6"          # Login-Pfad, der die aktuelle Garmin-Seite kennt
PY_MIN="3.12"               # von garminconnect 0.3.6 gefordert
VENV=".venv-login"

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f scripts/local_login.py ]; then
  echo "FEHLER: scripts/local_login.py nicht gefunden. Läuft das Skript im Ordner garmin-worker/?" >&2
  exit 1
fi

py_ok() {  # $1 = Interpreter -> Erfolg, wenn >= PY_MIN
  [ -n "${1:-}" ] || return 1
  "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)' >/dev/null 2>&1
}

find_python() {
  local c
  for c in \
      python3.14 python3.13 python3.12 \
      /opt/homebrew/bin/python3.14 /opt/homebrew/bin/python3.13 /opt/homebrew/bin/python3.12 \
      /opt/homebrew/opt/python@3.13/bin/python3.13 /opt/homebrew/opt/python@3.12/bin/python3.12 \
      /usr/local/bin/python3.14 /usr/local/bin/python3.13 /usr/local/bin/python3.12 \
      /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 \
      /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 \
      "$HOME/.pyenv/versions"/*/bin/python3 \
      python3 ; do
    if command -v "$c" >/dev/null 2>&1 && py_ok "$c"; then
      command -v "$c"
      return 0
    fi
  done
  return 1
}

# 1) Passenden Interpreter finden ---------------------------------------------
if ! PY="$(find_python)"; then
  CUR="$(python3 -V 2>&1 || echo 'kein python3')"
  cat >&2 <<HINT
FEHLER: Kein Python >= $PY_MIN gefunden (gefunden: $CUR).

garminconnect $GC_VERSION setzt Python >= $PY_MIN voraus, und ältere Versionen
kennen die aktuelle Garmin-Login-Seite nicht mehr. Einmalig installieren:

    brew install python@3.13

Danach dieses Skript erneut ausführen — es findet den neuen Interpreter selbst.
(Ohne Homebrew: Installer von python.org, Version 3.13.)
HINT
  exit 1
fi
echo "→ Interpreter: $PY ($("$PY" -V 2>&1))"

# 2) Umgebung prüfen / bei Bedarf neu bauen -----------------------------------
if ! py_ok "$VENV/bin/python"; then
  echo "→ Baue Python-Umgebung ($VENV) …"
  rm -rf "$VENV"
  "$PY" -m venv "$VENV"
  "$VENV/bin/python" -m pip install --quiet --upgrade pip
fi

INSTALLED="$("$VENV/bin/python" - <<'PY'
try:
    from importlib.metadata import version
    print(version("garminconnect"))
except Exception:
    print("")
PY
)"

if [ "$INSTALLED" != "$GC_VERSION" ]; then
  echo "→ Installiere garminconnect==$GC_VERSION (gefunden: ${INSTALLED:-nichts}) …"
  "$VENV/bin/python" -m pip install --quiet "garminconnect==$GC_VERSION"
fi

echo "→ Umgebung bereit (garminconnect $GC_VERSION)."
echo
echo "Reihenfolge: Worker-Check → JWT → Garmin-Login. Du brauchst:"
echo "  1. Garmin-E-Mail + Passwort (ggf. MFA-Code aus der E-Mail)"
echo "  2. Supabase-JWT: ORVIA im Browser öffnen, eingeloggt, Konsole (Alt-Cmd-I):"
echo "     (await ORVIA.sb.auth.getSession()).data.session.access_token"
echo "     → Token ohne Anführungszeichen kopieren (gültig ca. 1 Stunde)"
echo

# 3) Login + Token-Import ------------------------------------------------------
set +e
"$VENV/bin/python" scripts/local_login.py
RC=$?
set -e

if [ $RC -ne 0 ]; then
  cat >&2 <<'HINT'

Fehlgeschlagen. Übliche Fälle:
  · 404 "Application not found"   → Railway-Edge, nicht der Worker: Service oder
    Domain existiert nicht mehr. Dashboard prüfen (Settings → Networking →
    Public Domain, Deployment- und Zahlungsstatus). Neue Domain übergeben mit
    ORVIA_WORKER_URL='https://<neue-domain>' bash scripts/reauth.sh
  · 429 / "blockt die Anmeldung"  → Garmin-Sperre, KEIN Passwortproblem.
    30–60 Minuten warten, nicht wiederholt versuchen (verlängert die Sperre).
  · "sieht nicht nach einem JWT aus" → falscher Text kopiert; das JWT beginnt mit eyJ
  · HTTP 401 vom Worker          → JWT abgelaufen, neu aus der Konsole holen
  · TOKEN_INVALID vom Worker     → der Worker läuft noch auf garminconnect 0.3.2
    und lehnt das Token ab: in requirements.txt auf 0.3.6 heben und neu deployen
    (railway up), danach dieses Skript erneut ausführen.
HINT
  exit $RC
fi

# 4) Status-Kontrolle ----------------------------------------------------------
echo
read -r -p "Status jetzt prüfen? Dafür das JWT noch einmal einfügen [j/N]: " ANS
case "$ANS" in
  j|J|y|Y)
    read -r -p "Worker-URL [https://orvia-garmin-worker-production.up.railway.app]: " W
    W="${W:-https://orvia-garmin-worker-production.up.railway.app}"
    printf 'Supabase-JWT: '
    read -r -s JWT; echo
    curl -s "${W%/}/status" -H "Authorization: Bearer $JWT"
    unset JWT
    echo
    echo "Erwartet: connection_status \"connected\" und ein last_successful_sync_at."
    echo "Der Erstsync läuft im Hintergrund und braucht 1–2 Minuten."
    ;;
  *)
    echo "Übersprungen. Kontrolle sonst im ORVIA-Profil: die Zeile"
    echo "\"Neuanmeldung erforderlich\" muss nach 1–2 Minuten verschwunden sein."
    ;;
esac
