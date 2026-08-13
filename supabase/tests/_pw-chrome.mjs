/* ORVIA · _pw-chrome — Browser-Binary-Aufloesung fuer Playwright-Tests

   WARUM (v8-307b): Die Skip-Bedingung der Browser-Tests war „playwright-
   MODUL fehlt". Sobald ein npm install im Repo-Stamm (noetig fuer die
   Live-Tests) playwright mitbrachte, griff sie nicht mehr — und auf jeder
   Umgebung ohne /opt/pw-browsers crashten 21 Tests rot am hartkodierten
   Container-Pfad, obwohl KEIN Produktfehler vorlag. Das verletzt die
   eigene Regel dieser Tests: „nie ein Crash, der wie ein Produktfehler
   aussieht, und nie ein stilles Gruen."

   Die Binary-Existenz gehoert deshalb ZUR Skip-Bedingung. Aufloesung:
     1. ORVIA_CHROME (ausdrueckliche Wahl des Nutzers)
     2. chromium.executablePath() — playwright kennt seinen eigenen
        Installationsort je Betriebssystem (Mac: ~/Library/Caches/…)
     3. der Container-Standardpfad (dort liegt das vorinstallierte Binary)
   Existiert keiner davon: UEBERSPRUNGEN (exit 2) mit Anleitung —
   `npx playwright install chromium` holt das Binary nach. */
import { existsSync } from 'node:fs';

export function resolveChrome(chromium) {
  const cands = [process.env.ORVIA_CHROME];
  try { if (chromium && chromium.executablePath) cands.push(chromium.executablePath()); } catch (_e) { }
  cands.push('/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
  return cands.find(p => { try { return p && existsSync(p); } catch (_e) { return false; } }) || null;
}

export function chromeOrSkip(chromium) {
  const hit = resolveChrome(chromium);
  if (!hit) {
    console.log('⏭️  ÜBERSPRUNGEN — playwright ist installiert, aber kein Browser-Binary vorhanden'
      + ' (`npx playwright install chromium` holt es nach, oder ORVIA_CHROME setzen)');
    process.exit(2);
  }
  return hit;
}
