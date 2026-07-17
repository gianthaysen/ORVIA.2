// ORVIA · export-registry — generiert das Registry-JSON für den Python-Worker.
// Aufruf (aus app/):  node js/metrics/export-registry.mjs > ../garmin-worker/orvia_worker/metric_registry.json
// Der Vertragstest supabase/tests/metric_registry_test.mjs prüft, dass das
// eingecheckte JSON mit dieser JS-Quelle (SSOT) übereinstimmt.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const registry = require(path.join(here, 'metric-registry.js'));

process.stdout.write(JSON.stringify(registry.toJSON(), null, 2) + '\n');
