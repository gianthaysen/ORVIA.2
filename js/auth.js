/* ============================================================
   ORVIA · Auth + Invite-Gate  (Phase 1)
   - Privater Beta-Zugang: Registrierung nur mit gültigem Invite-Code.
   - E-Mail/Passwort-Login, Session bleibt erhalten (kein erneuter Code).
   - Läuft NUR wenn config.js konfiguriert ist; sonst lokaler Modus.
   Lädt nach allen App-Skripten (nutzt DB, PROFILE, renderDay, save …).
   ============================================================ */
(function () {
  const CFG = window.ORVIA_CFG || {};
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;

  /* ---------- LOKALER MODUS (Cloud nicht konfiguriert) ---------- */
  if (!CFG.configured) {
    document.documentElement.classList.remove('orvia-gated');
    if (window.orviaSetSyncState) window.orviaSetSyncState('local');
    if (window.renderAccountCard) window.renderAccountCard();
    return;
  }

  /* ---------- Supabase-Client ---------- */
  let sb;
  try {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true } });
  } catch (e) {
    console.error('[ORVIA auth] Supabase-Init fehlgeschlagen — lokaler Modus.', e);
    document.documentElement.classList.remove('orvia-gated');
    if (window.orviaSetSyncState) window.orviaSetSyncState('local');
    return;
  }
  O.sb = sb;

  let mode = 'login';        // 'login' | 'register'
  let gateEl = null;

  buildGate();

  sb.auth.getSession().then(({ data }) => {
    if (data && data.session) onAuthed(data.session);
    else showGate('login');
  }).catch(() => showGate('login'));

  sb.auth.onAuthStateChange((evt, session) => {
    if (evt === 'SIGNED_OUT') { O.user = null; showGate('login'); if (window.orviaSetSyncState) window.orviaSetSyncState('local'); }
  });

  /* ---------- nach erfolgreichem Login/Registrierung ---------- */
  async function onAuthed(session) {
    O.user = session.user;
    // ausstehenden Invite einlösen (idempotent)
    try {
      const pending = localStorage.getItem('orvia_pending_invite');
      if (pending) { await sb.rpc('orvia_redeem_invite', { p_code: pending }); localStorage.removeItem('orvia_pending_invite'); }
    } catch (e) { /* nicht blockierend */ }
    hideGate();
    document.documentElement.classList.remove('orvia-gated');
    if (window.renderAccountCard) window.renderAccountCard();
    if (window.orviaSyncStart) { try { await window.orviaSyncStart(); } catch (e) {} }
  }

  /* ---------- Gate UI ---------- */
  function buildGate() {
    gateEl = document.createElement('div');
    gateEl.className = 'orvia-gate';
    gateEl.style.display = 'none';
    gateEl.innerHTML =
      '<div class="og-card">' +
        '<svg class="og-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#orvia-mark"/></svg>' +
        '<div class="og-wm">ORVIA</div>' +
        '<div class="og-claim">Know your state. Move with precision.</div>' +
        '<div class="og-tabs">' +
          '<button type="button" data-m="login">Anmelden</button>' +
          '<button type="button" data-m="register">Registrieren</button>' +
        '</div>' +
        '<form class="og-form" autocomplete="on">' +
          '<div class="og-field og-invite"><label>Invite-Code</label>' +
            '<input type="text" id="ogCode" autocapitalize="characters" placeholder="ORVIA-…"></div>' +
          '<div class="og-field"><label>E-Mail</label>' +
            '<input type="email" id="ogEmail" autocomplete="email" placeholder="du@mail.de"></div>' +
          '<div class="og-field"><label>Passwort</label>' +
            '<input type="password" id="ogPw" autocomplete="current-password" placeholder="mind. 8 Zeichen"></div>' +
          '<div class="og-err" id="ogErr"></div>' +
          '<button type="submit" class="btn" id="ogSubmit">Anmelden</button>' +
        '</form>' +
        '<button type="button" class="og-link" id="ogForgot">Passwort vergessen?</button>' +
        '<div class="og-note">Privater Beta-Zugang. Deine Daten sind durch Login + serverseitige Zugriffsregeln geschützt.</div>' +
      '</div>';
    document.body.appendChild(gateEl);

    gateEl.querySelectorAll('.og-tabs button').forEach(b =>
      b.onclick = () => setMode(b.dataset.m));
    gateEl.querySelector('.og-form').addEventListener('submit', onSubmit);
    gateEl.querySelector('#ogForgot').onclick = onForgot;
  }

  function setMode(m) {
    mode = m;
    gateEl.querySelectorAll('.og-tabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    gateEl.querySelector('.og-invite').style.display = (m === 'register') ? '' : 'none';
    gateEl.querySelector('#ogSubmit').textContent = (m === 'register') ? 'Account erstellen' : 'Anmelden';
    gateEl.querySelector('#ogPw').setAttribute('autocomplete', m === 'register' ? 'new-password' : 'current-password');
    err('');
  }
  function showGate(m) {
    if (!gateEl) return;
    gateEl.style.display = 'flex';
    document.documentElement.classList.add('orvia-gated');
    setMode(m || 'login');
  }
  function hideGate() { if (gateEl) gateEl.style.display = 'none'; }
  function err(msg) { const e = gateEl && gateEl.querySelector('#ogErr'); if (e) { e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; } }
  function busy(on) { const b = gateEl.querySelector('#ogSubmit'); b.disabled = on; b.style.opacity = on ? '.6' : '1'; }

  /* ---------- Submit (Login oder Registrierung) ---------- */
  async function onSubmit(ev) {
    ev.preventDefault();
    err('');
    const email = val('ogEmail').trim().toLowerCase();
    const pw = val('ogPw');
    if (!email || !pw) { err('Bitte E-Mail und Passwort eingeben.'); return; }
    if (mode === 'register' && pw.length < 8) { err('Passwort muss mindestens 8 Zeichen haben.'); return; }
    busy(true);
    try {
      if (mode === 'register') {
        const code = val('ogCode').trim();
        if (!code) { err('Bitte Invite-Code eingeben.'); busy(false); return; }
        const { data: ok, error: ce } = await sb.rpc('orvia_check_invite', { p_code: code });
        if (ce) { err('Code konnte nicht geprüft werden. Internet/Setup prüfen.'); busy(false); return; }
        if (!ok) { err('Invite-Code ungültig, abgelaufen oder aufgebraucht.'); busy(false); return; }
        localStorage.setItem('orvia_pending_invite', code);
        const { data, error } = await sb.auth.signUp({ email, password: pw });
        if (error) { err(germanAuthError(error)); localStorage.removeItem('orvia_pending_invite'); busy(false); return; }
        if (data.session) { await onAuthed(data.session); }
        else { err('Fast geschafft: Bestätige deine E-Mail, dann melde dich an. (Tipp: In Supabase die E-Mail-Bestätigung für die Beta deaktivieren.)'); setMode('login'); }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) { err(germanAuthError(error)); busy(false); return; }
        await onAuthed(data.session);
      }
    } catch (e) { console.error(e); err('Unerwarteter Fehler. Bitte erneut versuchen.'); }
    busy(false);
  }

  async function onForgot() {
    const email = val('ogEmail').trim().toLowerCase();
    if (!email) { err('E-Mail eingeben, dann „Passwort vergessen" tippen.'); return; }
    try { await sb.auth.resetPasswordForEmail(email); err('Falls die E-Mail existiert, wurde ein Reset-Link gesendet.'); }
    catch (e) { err('Reset aktuell nicht möglich.'); }
  }

  function germanAuthError(e) {
    const m = (e && e.message || '').toLowerCase();
    if (m.includes('already registered') || m.includes('already exists')) return 'Diese E-Mail ist bereits registriert. Bitte anmelden.';
    if (m.includes('invalid login')) return 'E-Mail oder Passwort falsch.';
    if (m.includes('email not confirmed')) return 'E-Mail noch nicht bestätigt. Postfach prüfen.';
    if (m.includes('password')) return 'Passwort zu schwach (mind. 8 Zeichen).';
    return e.message || 'Anmeldung fehlgeschlagen.';
  }

  /* ---------- Logout ---------- */
  window.orviaLogout = async function () {
    try { await sb.auth.signOut(); } catch (e) {}
    O.user = null; showGate('login');
  };

  /* ---------- Konto löschen (vorbereitet) ---------- */
  window.orviaDeleteAccount = function () {
    alert('Konto-Löschung wird in einer kommenden Runde serverseitig umgesetzt (Edge Function). '
        + 'Aktuell: Daten im Profil exportieren und bei Bedarf Support kontaktieren.');
  };

  function val(id) { const e = document.getElementById(id); return e ? e.value : ''; }
})();

/* ============================================================
   Konto-/Sync-Karte im Profil  (global, von Profil-Render + Sync genutzt)
   ============================================================ */
window.renderAccountCard = function () {
  const box = document.getElementById('accountBox');
  if (!box) return;
  const O = window.ORVIA || {};
  const cfg = window.ORVIA_CFG || {};
  const state = (window.orviaSyncState ? window.orviaSyncState() : 'local');
  const badge = '<span class="syncbadge" id="syncBadge"></span>';

  if (!cfg.configured) {
    box.innerHTML =
      '<div class="acc-row"><span>Modus</span><b>Lokal (kein Konto)</b></div>' +
      '<div class="acc-row"><span>Status</span>' + badge + '</div>' +
      '<p class="note" style="text-align:left">Cloud-Sync &amp; Accounts sind vorbereitet. Sobald die Supabase-Schlüssel in <code>js/config.js</code> eingetragen sind, aktivieren sich Login, Invite-Gate und geräteübergreifender Sync.</p>';
  } else if (O.user) {
    box.innerHTML =
      '<div class="acc-row"><span>Angemeldet</span><b>' + (O.user.email || '—') + '</b></div>' +
      '<div class="acc-row"><span>Sync</span>' + badge + '</div>' +
      '<div class="row2" style="margin-top:12px">' +
        '<button class="btn sec" onclick="orviaSchedulePush&&orviaSchedulePush()">Jetzt synchronisieren</button>' +
        '<button class="btn sec" onclick="orviaLogout&&orviaLogout()">Abmelden</button>' +
      '</div>' +
      '<button class="btn gline" style="margin-top:10px" onclick="orviaDeleteAccount&&orviaDeleteAccount()">Konto löschen (vorbereitet)</button>';
  } else {
    box.innerHTML = '<div class="acc-row"><span>Status</span><b>Nicht angemeldet</b></div>';
  }
  // Badge nach dem (Neu-)Einfügen aktualisieren
  const el = document.getElementById('syncBadge');
  if (el) { const L = { local:['Lokaler Modus','muted'], synced:['Synchronisiert','ok'], pending:['Sync läuft …','warn'], error:['Sync-Fehler','err'], offline:['Offline – lokal','warn'] }[state] || ['Lokaler Modus','muted']; el.textContent = L[0]; el.className = 'syncbadge ' + L[1]; }
};
