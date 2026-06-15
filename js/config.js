/* ============================================================
   ORVIA · Cloud-Konfiguration
   Trage hier deine Supabase-Werte ein (Dashboard → Project Settings → API).
   Der ANON-Key ist für das Frontend gedacht und durch Row-Level-Security
   abgesichert — er darf öffentlich sein. Den service_role-Key NIEMALS hier.
   Solange die Platzhalter stehen, läuft ORVIA im LOKALEN MODUS (ohne Cloud).
   ============================================================ */
window.ORVIA_CFG = {
  SUPABASE_URL:      'https://qzfaawmsurfzxmtysbbu.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_SKIgUPnKxaSAsIi6mzc3Lg_t1hYzsSj'
};

window.ORVIA_CFG.configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(window.ORVIA_CFG.SUPABASE_URL || '') &&
  (window.ORVIA_CFG.SUPABASE_ANON_KEY || '').length > 30;

/* Verdeckt die App synchron, bis Auth entschieden ist (kein Aufblitzen vor dem Gate). */
if (window.ORVIA_CFG.configured) document.documentElement.classList.add('orvia-gated');
