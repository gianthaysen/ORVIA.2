/* ============================================================
   ORVIA · Supabase Auth + Closed Beta Gate
   - Login: Supabase Auth E-Mail + Passwort.
   - Registrierung: nur via Edge Function register-with-invite.
   - App-Zugriff: gültige Session + aktives Profil.
   ============================================================ */
(function () {
  const CFG = window.ORVIA_CFG || {};
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;

  const SAFE_MESSAGES = {
    invite_only: 'Dieser Zugang ist aktuell nur für eingeladene Beta-Tester freigeschaltet.',
    invalid_invite: 'E-Mail oder Invite-Code ist ungültig.',
    invite_used: 'Dieser Invite-Code wurde bereits verwendet.',
    invite_expired: 'Dieser Invite-Code ist abgelaufen.',
    password_mismatch: 'Die Passwörter stimmen nicht überein.',
    weak_password: 'Das Passwort muss mindestens 8 Zeichen lang sein.'
  };

  if (!CFG.configured) {
    document.documentElement.classList.remove('orvia-gated');
    if (window.orviaSetSyncState) window.orviaSetSyncState('local');
    if (window.renderAccountCard) window.renderAccountCard();
    return;
  }

  let sb;
  try {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  } catch (e) {
    console.error('[ORVIA auth] Supabase-Init fehlgeschlagen.', e);
    document.documentElement.classList.remove('orvia-gated');
    if (window.orviaSetSyncState) window.orviaSetSyncState('local');
    return;
  }

  O.sb = sb;

  let mode = 'login';
  let gateEl = null;
  let activeUserId = null;

  buildGate();

  sb.auth.getSession()
    .then(({ data }) => {
      if (data && data.session) return onAuthed(data.session);
      showGate('login');
    })
    .catch(() => showGate('login'));

  sb.auth.onAuthStateChange((evt, session) => {
    if (evt === 'SIGNED_OUT') {
      activeUserId = null;
      O.user = null;
      O.profile = null;
      if (window.orviaSetSyncState) window.orviaSetSyncState('local');
      showGate('login');
      return;
    }
    if (session && (evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED' || evt === 'USER_UPDATED')) {
      onAuthed(session);
    }
  });

  async function onAuthed(session) {
    if (!session || !session.user) {
      showGate('login');
      return;
    }

    if (activeUserId === session.user.id && gateEl && gateEl.style.display === 'none') return;

    const profileResult = await loadAccessProfile(session.user.id);
    if (!profileResult.ok) {
      await safeSignOut();
      activeUserId = null;
      O.user = null;
      O.profile = null;
      showGate('login');
      err(profileResult.message);
      return;
    }

    activeUserId = session.user.id;
    O.user = session.user;
    O.profile = profileResult.profile;

    try { if (window.orviaApplyUserScope) window.orviaApplyUserScope(O.user.id); } catch (e) {}

    hideGate();
    document.documentElement.classList.remove('orvia-gated');
    if (window.renderAccountCard) window.renderAccountCard();
    if (window.orviaSyncStart) {
      try { await window.orviaSyncStart(); } catch (e) {}
    }

    try {
      if (localStorage.getItem('orvia_onboard_pending') && typeof openOnboarding === 'function') {
        localStorage.removeItem('orvia_onboard_pending');
        setTimeout(function () { try { openOnboarding(true); } catch (e) {} }, 400);
      }
    } catch (e) {}
  }

  async function loadAccessProfile(userId) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('user_id,email,role,is_active,name')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[ORVIA auth] Profilprüfung fehlgeschlagen.', error);
        return { ok: false, message: SAFE_MESSAGES.invite_only };
      }
      if (!data || data.is_active !== true) {
        return { ok: false, message: SAFE_MESSAGES.invite_only };
      }
      if (data.role !== 'owner' && data.role !== 'tester') {
        return { ok: false, message: SAFE_MESSAGES.invite_only };
      }
      return { ok: true, profile: data };
    } catch (e) {
      console.error('[ORVIA auth] Profilprüfung fehlgeschlagen.', e);
      return { ok: false, message: SAFE_MESSAGES.invite_only };
    }
  }

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
            '<input type="text" id="ogCode" autocapitalize="characters" autocomplete="one-time-code" placeholder="ORVIA-..."></div>' +
          '<div class="og-field"><label>E-Mail</label>' +
            '<input type="email" id="ogEmail" autocomplete="email" placeholder="du@mail.de"></div>' +
          '<div class="og-field"><label>Passwort</label>' +
            '<input type="password" id="ogPw" autocomplete="current-password" placeholder="mind. 8 Zeichen"></div>' +
          '<div class="og-field og-pw-confirm"><label>Passwort bestätigen</label>' +
            '<input type="password" id="ogPw2" autocomplete="new-password" placeholder="noch einmal eingeben"></div>' +
          '<div class="og-err" id="ogErr"></div>' +
          '<button type="submit" class="btn" id="ogSubmit">Anmelden</button>' +
        '</form>' +
        '<button type="button" class="og-link" id="ogForgot">Passwort vergessen?</button>' +
        '<div class="og-note">Geschlossene Beta. Registrierung ist nur mit zugewiesener E-Mail und Invite-Code möglich.</div>' +
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
    gateEl.querySelector('.og-pw-confirm').style.display = (m === 'register') ? '' : 'none';
    gateEl.querySelector('#ogSubmit').textContent = (m === 'register') ? 'Account erstellen' : 'Anmelden';
    gateEl.querySelector('#ogPw').setAttribute('autocomplete', m === 'register' ? 'new-password' : 'current-password');
    gateEl.querySelector('#ogForgot').style.display = (m === 'register') ? 'none' : 'block';
    err('');
  }

  function showGate(m) {
    if (!gateEl) return;
    gateEl.style.display = 'flex';
    document.documentElement.classList.add('orvia-gated');
    setMode(m || 'login');
  }

  function hideGate() {
    if (gateEl) gateEl.style.display = 'none';
  }

  function err(msg) {
    const e = gateEl && gateEl.querySelector('#ogErr');
    if (e) {
      e.textContent = msg || '';
      e.style.display = msg ? 'block' : 'none';
    }
  }

  function busy(on) {
    const b = gateEl.querySelector('#ogSubmit');
    b.disabled = on;
    b.style.opacity = on ? '.6' : '1';
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    err('');
    const email = val('ogEmail').trim().toLowerCase();
    const pw = val('ogPw');

    if (!email || !pw) {
      err('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    busy(true);
    try {
      if (mode === 'register') {
        const code = val('ogCode').trim();
        const pw2 = val('ogPw2');
        if (!code) {
          err(SAFE_MESSAGES.invalid_invite);
          busy(false);
          return;
        }
        if (pw.length < 8) {
          err(SAFE_MESSAGES.weak_password);
          busy(false);
          return;
        }
        if (pw !== pw2) {
          err(SAFE_MESSAGES.password_mismatch);
          busy(false);
          return;
        }

        const reg = await registerWithInvite(email, code, pw);
        if (!reg.ok) {
          err(reg.message);
          busy(false);
          return;
        }

        localStorage.setItem('orvia_onboard_pending', '1');
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error || !data || !data.session) {
          err('Account erstellt. Bitte melde dich jetzt an.');
          setMode('login');
          busy(false);
          return;
        }
        await onAuthed(data.session);
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error || !data || !data.session) {
          err('E-Mail oder Passwort ist ungültig.');
          busy(false);
          return;
        }
        await onAuthed(data.session);
      }
    } catch (e) {
      console.error(e);
      err('Unerwarteter Fehler. Bitte erneut versuchen.');
    }
    busy(false);
  }

  async function registerWithInvite(email, inviteCode, password) {
    try {
      const { error } = await sb.functions.invoke('register-with-invite', {
        body: { email, inviteCode, password }
      });
      if (error) return { ok: false, message: await functionErrorMessage(error) };
      return { ok: true };
    } catch (e) {
      console.error('[ORVIA auth] register-with-invite fehlgeschlagen.', e);
      return { ok: false, message: SAFE_MESSAGES.invite_only };
    }
  }

  async function functionErrorMessage(error) {
    try {
      if (error && error.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        return safeMessage(body && (body.code || body.message));
      }
    } catch (e) {}
    return safeMessage(error && error.message);
  }

  function safeMessage(raw) {
    const m = String(raw || '').toLowerCase();
    if (raw && Object.values(SAFE_MESSAGES).includes(String(raw))) return String(raw);
    if (m.includes('invite_used') || m.includes('bereits verwendet')) return SAFE_MESSAGES.invite_used;
    if (m.includes('invite_expired') || m.includes('abgelaufen')) return SAFE_MESSAGES.invite_expired;
    if (m.includes('weak_password') || m.includes('password')) return SAFE_MESSAGES.weak_password;
    if (m.includes('invalid_invite') || m.includes('invite')) return SAFE_MESSAGES.invalid_invite;
    return SAFE_MESSAGES.invite_only;
  }

  async function onForgot() {
    const email = val('ogEmail').trim().toLowerCase();
    if (!email) {
      err('E-Mail eingeben, dann Passwort-Reset anfordern.');
      return;
    }
    try {
      await sb.auth.resetPasswordForEmail(email);
      err('Falls die E-Mail existiert, wurde ein Reset-Link gesendet.');
    } catch (e) {
      err('Reset aktuell nicht möglich.');
    }
  }

  async function safeSignOut() {
    try { await sb.auth.signOut(); } catch (e) {}
  }

  window.orviaLogout = async function () {
    await safeSignOut();
    try { if (window.orviaClearLocal) window.orviaClearLocal(); } catch (e) {}
    try { ['orvia_active_user', 'orvia_onboard_pending'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    O.user = null;
    O.profile = null;
    location.reload();
  };

  window.orviaDeleteAccount = function () {
    alert('Konto-Löschung wird serverseitig über eine separate Edge Function umgesetzt. Aktuell bitte Support kontaktieren.');
  };

  function val(id) {
    const e = document.getElementById(id);
    return e ? e.value : '';
  }
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
  const roleLabel = O.profile && O.profile.role === 'owner' ? 'Owner' : 'Tester';

  if (!cfg.configured) {
    box.innerHTML =
      '<div class="acc-row"><span>Modus</span><b>Lokal (kein Konto)</b></div>' +
      '<div class="acc-row"><span>Status</span>' + badge + '</div>' +
      '<p class="note" style="text-align:left">Cloud-Sync &amp; Accounts sind vorbereitet. Sobald Supabase-URL und anon public key konfiguriert sind, aktivieren sich Login, Invite-Gate und geräteübergreifender Sync.</p>';
  } else if (O.user && O.profile) {
    box.innerHTML =
      '<div class="acc-row"><span>Angemeldet</span><b>' + (O.user.email || '—') + '</b></div>' +
      '<div class="acc-row"><span>Rolle</span><b>' + roleLabel + '</b></div>' +
      '<div class="acc-row"><span>Sync</span>' + badge + '</div>' +
      '<div class="row2" style="margin-top:12px">' +
        '<button class="btn sec" onclick="orviaSchedulePush&&orviaSchedulePush()">Jetzt synchronisieren</button>' +
        '<button class="btn sec" onclick="orviaLogout&&orviaLogout()">Abmelden</button>' +
      '</div>' +
      '<button class="btn gline" style="margin-top:10px" onclick="orviaDeleteAccount&&orviaDeleteAccount()">Konto löschen (vorbereitet)</button>';
  } else {
    box.innerHTML = '<div class="acc-row"><span>Status</span><b>Nicht angemeldet</b></div>';
  }

  const el = document.getElementById('syncBadge');
  if (el) {
    const L = {
      local: ['Lokaler Modus', 'muted'],
      synced: ['Synchronisiert', 'ok'],
      pending: ['Sync läuft ...', 'warn'],
      error: ['Sync-Fehler', 'err'],
      offline: ['Offline - lokal', 'warn']
    }[state] || ['Lokaler Modus', 'muted'];
    el.textContent = L[0];
    el.className = 'syncbadge ' + L[1];
  }
};
