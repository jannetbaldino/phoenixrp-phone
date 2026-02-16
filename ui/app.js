(() => {
  const root = document.getElementById('root');
  const timeEl = document.getElementById('time');
  const gridEl = document.getElementById('appGrid');
  const panelEl = document.getElementById('panel');
  const panelTitle = document.getElementById('panelTitle');
  const panelSub = document.getElementById('panelSub');
  const panelBody = document.getElementById('panelBody');
  const closePanelBtn = document.getElementById('closePanel');
  const wallpaper = document.getElementById('wallpaper');

  let state = {
    user: null,
    conversations: [],
    unread_notifications: [],
    config: {},
    lists: {},
  };

  let activeCallId = null;

  // --- Apps shown on the grid (dock apps are handled separately) ---
  const apps = [
    { id: 'wallet', label: 'Wallet', icon: '$', bg: 'linear-gradient(135deg, #17f1c7, #0aa2ff)' },
    { id: 'directory', label: 'Directory', icon: '🧭', bg: 'linear-gradient(135deg, #2ee3ff, #a8ffdb)' },
    { id: 'calculator', label: 'Calculator', icon: '🔢', bg: 'linear-gradient(135deg, #ffbe5c, #ff6a2a)' },
    { id: 'calendar', label: 'Calendar', icon: '📅', bg: 'linear-gradient(135deg, #ff4f74, #ffb1d6)' },
    { id: 'cityhall', label: 'City Hall', icon: '⚖️', bg: 'linear-gradient(135deg, #7bdbff, #59b6ff)' },
    { id: 'documents', label: 'Documents', icon: '📁', bg: 'linear-gradient(135deg, #ffd85a, #ffb347)' },
    { id: 'emails', label: 'Emails', icon: '✉️', bg: 'linear-gradient(135deg, #ff4bb2, #ff884b)' },
    { id: 'gallery', label: 'Gallery', icon: '🖼️', bg: 'linear-gradient(135deg, #4af3a8, #1dd0ff)' },
    { id: 'groups', label: 'Groups', icon: '👥', bg: 'linear-gradient(135deg, #3bdcff, #60a4ff)' },
    { id: 'news', label: 'News', icon: '📰', bg: 'linear-gradient(135deg, #47d6ff, #7bf0ff)' },
    { id: 'property', label: 'Property', icon: '🏠', bg: 'linear-gradient(135deg, #ff6a5f, #ffb25e)' },
    { id: 'twinsta', label: 'Twinsta', icon: '🟣', bg: 'linear-gradient(135deg, #7a4cff, #ff4db8)' },
    { id: 'vehicles', label: 'Vehicles', icon: '🚗', bg: 'linear-gradient(135deg, #56e6ff, #4bffd5)' },
    { id: 'racing', label: 'Racing', icon: '🏁', bg: 'linear-gradient(135deg, #ff4d4d, #ffd24d)' },
  ];

  // start hidden; Lua will open it
  root.classList.add('hidden');

  function setTime() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hh}:${mm}`;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function fmtMoney(n) {
    const x = Number(n || 0);
    return x.toLocaleString('en-US');
  }

  function openPanel(title, sub) {
    panelEl.classList.remove('hidden');
    panelTitle.textContent = title || 'App';
    panelSub.textContent = sub || (state?.user?.phone_number ? `#${state.user.phone_number}` : '');
  }

  function closePanel() {
    panelEl.classList.add('hidden');
  }

  function nui(action, data) {
    return fetch(`https://${GetParentResourceName()}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data || {})
    })
      .then(r => r.json())
      .catch(() => ({}));
  }

  function renderGrid() {
    gridEl.innerHTML = '';

    apps.forEach(app => {
      const wrap = document.createElement('div');
      wrap.className = 'app';
      wrap.innerHTML = `
        <div class="icon" style="background:${app.bg}">${app.icon}</div>
        <div class="label">${app.label}</div>
      `;
      wrap.addEventListener('click', () => openApp(app.id));
      gridEl.appendChild(wrap);
    });

    // Dock buttons (from your index.html): messages, phone, contacts, settings
    document.querySelectorAll('.dockBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-app');
        openApp(id);
      });
    });
  }

  function openApp(id) {
    if (id === 'messages') return renderMessages();
    if (id === 'settings') return renderSettings();
    if (id === 'phone') return renderDialer();
    if (id === 'wallet') return renderWallet();
    if (id === 'contacts') return renderContacts();
    if (id === 'directory') return renderDirectory();
    if (id === 'calculator') return renderCalculator();

    openPanel(id[0].toUpperCase() + id.slice(1));
    panelBody.innerHTML = `
      <div class="card">
        <div style="font-weight:900; margin-bottom:8px;">${escapeHtml(id)}</div>
        <div style="opacity:.85;">This app is a placeholder for now.</div>
      </div>
    `;
  }

  // ---------------------------
  // Settings
  // ---------------------------
  function getRingtonesAndTextTones() {
    // support both old bootstrap shape (config) and newer (lists)
    const cfg = state.config || {};
    const lists = state.lists || {};
    return {
      ringtones: (lists.ringtones || cfg.ringtones || []),
      text_tones: (lists.text_tones || cfg.text_tones || []),
    };
  }

  function renderSettings() {
    const u = state.user || {};
    const { ringtones, text_tones } = getRingtonesAndTextTones();
    const settings = (u.settings || {});
    const currentRingtone = settings.ringtone || 'default';
    const currentTextTone = settings.text_tone || 'default';

    openPanel('Settings');

    const ringtoneOptions = (ringtones.length ? ringtones : [{ id: 'default', label: 'Default' }])
      .map(r => `<option value="${escapeHtml(r.id)}" ${currentRingtone === r.id ? 'selected' : ''}>${escapeHtml(r.label)}</option>`)
      .join('');

    const textOptions = (text_tones.length ? text_tones : [{ id: 'default', label: 'Default' }])
      .map(t => `<option value="${escapeHtml(t.id)}" ${currentTextTone === t.id ? 'selected' : ''}>${escapeHtml(t.label)}</option>`)
      .join('');

    panelBody.innerHTML = `
      <div class="card">
        <div style="font-weight:900; margin-bottom:10px;">Your Info</div>
        <div style="opacity:.92; line-height:1.7;">
          <div><b>Phone #</b>: ${escapeHtml(u.phone_number || 'Unknown')}</div>
          <div><b>State ID</b>: ${escapeHtml(u.citizenid || 'Unknown')}</div>
          <div><b>Server ID</b>: ${escapeHtml(u.server_id ?? 'Unknown')}</div>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:900; margin-bottom:10px;">Sounds</div>

        <div style="font-size:12px; opacity:.85; margin-bottom:6px;">Ringtone</div>
        <select class="input" id="ringtoneSel">${ringtoneOptions}</select>

        <div style="font-size:12px; opacity:.85; margin:12px 0 6px;">Text Tone</div>
        <select class="input" id="textToneSel">${textOptions}</select>

        <button class="btn" id="saveSettingsBtn" style="margin-top:12px;">Save</button>
        <div id="saveSettingsStatus" style="margin-top:10px; font-size:12px; opacity:.85;"></div>
      </div>

      <div class="card">
        <div style="font-weight:900; margin-bottom:10px;">Wallpaper</div>
        <button class="btn" id="setWallpaper">Use Default</button>
      </div>
    `;

    document.getElementById('setWallpaper').addEventListener('click', () => {
      wallpaper.style.backgroundImage = "url('assets/wallpaper.png')";
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
      const ringtone = document.getElementById('ringtoneSel').value;
      const text_tone = document.getElementById('textToneSel').value;

      const resp = await nui('saveSettings', { ringtone, text_tone });
      const status = document.getElementById('saveSettingsStatus');

      if (resp && resp.ok) {
        state.user = state.user || {};
        state.user.settings = state.user.settings || {};
        state.user.settings.ringtone = resp.settings?.ringtone || ringtone;
        state.user.settings.text_tone = resp.settings?.text_tone || text_tone;
        status.textContent = 'Saved.';
      } else {
        status.textContent = `Save failed${resp?.error ? `: ${resp.error}` : '.'}`;
      }
    });
  }

  // ---------------------------
  // Messages (simple)
  // ---------------------------
  function renderMessages() {
    openPanel('Messages');

    const convos = state.conversations || [];
    const rows = convos.map(c => `
      <div class="card" data-peer="${escapeHtml(c.peer_number)}">
        <div>
          <div style="font-weight:800;">${escapeHtml(c.peer_number)}</div>
          <div style="opacity:.85; font-size:12px;">${escapeHtml(c.last_body || '')}</div>
        </div>
      </div>
    `).join('');

    panelBody.innerHTML = `
      <div class="card">
        <div style="font-weight:800; margin-bottom:10px;">New message</div>
        <input class="input" id="peer" placeholder="Peer number (ex: 5550001)" />
        <input class="input" id="body" placeholder="Message..." style="margin-top:10px;" />
        <button class="btn" id="send">Send</button>
        <div id="msgStatus" style="margin-top:10px; font-size:12px; opacity:.85;"></div>
      </div>

      <div style="opacity:.8; font-size:12px; margin:8px 2px;">Conversations</div>
      ${rows || '<div class="card" style="opacity:.85;">No conversations yet.</div>'}
    `;

    panelBody.querySelectorAll('[data-peer]').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('peer').value = el.getAttribute('data-peer');
      });
    });

    document.getElementById('send').addEventListener('click', async () => {
      const peer = document.getElementById('peer').value.trim();
      const body = document.getElementById('body').value.trim();
      const status = document.getElementById('msgStatus');
      status.textContent = '';

      if (!peer || !body) {
        status.textContent = 'Enter a number and a message.';
        return;
      }

      const resp = await nui('sendMessage', { peer_number: peer, body });
      if (resp && resp.ok) {
        document.getElementById('body').value = '';
        status.textContent = 'Sent.';
      } else {
        status.textContent = `Send failed${resp?.error ? `: ${resp.error}` : '.'}`;
      }
    });
  }

  // ---------------------------
  // Phone dialer (basic)
  // ---------------------------
  function renderDialer() {
    openPanel('Phone');

    panelBody.innerHTML = `
      <div class="card">
        <div style="font-weight:900; margin-bottom:10px;">Dial</div>
        <input class="input" id="dialNumber" placeholder="Number (ex: 5550001)" />
        <button class="btn" id="dialBtn">Call</button>
        <div id="dialStatus" style="margin-top:10px; font-size:12px; opacity:.85;"></div>
      </div>
    `;

    document.getElementById('dialBtn').addEventListener('click', async () => {
      const num = document.getElementById('dialNumber').value.trim();
      const status = document.getElementById('dialStatus');
      status.textContent = '';

      if (!num) {
        status.textContent = 'Enter a number.';
        return;
      }

      const resp = await nui('callDial', { number: num });
      if (!resp || resp.ok === false) {
        status.textContent = 'Call failed.';
      }
    });
  }

  // ---------------------------
  // Wallet (Renewed-Banking via server callbacks)
  // ---------------------------
  async function renderWallet() {
    openPanel('Wallet');

    panelBody.innerHTML = `<div class="card" style="opacity:.9;">Loading accounts...</div>`;

    const accResp = await nui('walletGetAccounts');
    const histResp = await nui('walletHistory');

    const accounts = (accResp && accResp.ok && Array.isArray(accResp.accounts)) ? accResp.accounts : (Array.isArray(accResp) ? accResp : []);
    const history = (histResp && histResp.ok && Array.isArray(histResp.items)) ? histResp.items : [];

    if (!accounts || !accounts.length) {
      panelBody.innerHTML = `
        <div class="card">
          <div style="font-weight:900;">No accounts found</div>
          <div style="opacity:.85; margin-top:8px; font-size:12px;">
            This usually means the server callback returned no accounts.
            If your server returns <code>{ ok=true, accounts=[...] }</code> you’re good.
          </div>
          <div style="opacity:.85; margin-top:8px; font-size:12px;">
            Server response: <code>${escapeHtml(JSON.stringify(accResp || {}))}</code>
          </div>
        </div>
      `;
      return;
    }

    const accountOptions = accounts.map(a =>
      `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label || a.id)} ($${fmtMoney(a.balance)})</option>`
    ).join('');

    const accountCards = accounts.map(a => `
      <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:900;">${escapeHtml(a.label || a.id)}</div>
          <div style="opacity:.75; font-size:12px;">${escapeHtml(a.id)}${a.type ? ` • ${escapeHtml(a.type)}` : ''}</div>
        </div>
        <div style="font-weight:900;">$${fmtMoney(a.balance)}</div>
      </div>
    `).join('');

    const historyRows = (history || []).map(h => `
      <div class="card" style="padding:10px;">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <div style="font-weight:800;">$${fmtMoney(h.amount)}</div>
          <div style="opacity:.75; font-size:12px;">${escapeHtml(h.created_at || '')}</div>
        </div>
        <div style="opacity:.9; font-size:12px; margin-top:6px;">
          <div><b>From</b>: ${escapeHtml(h.from_account || '')}</div>
          <div><b>To</b>: ${escapeHtml(h.to_account || '')}</div>
          <div><b>Note</b>: ${escapeHtml(h.note || '')}</div>
        </div>
      </div>
    `).join('') || `<div class="card" style="opacity:.85;">No recent transfers.</div>`;

    panelBody.innerHTML = `
      <div style="opacity:.8; font-size:12px; margin:8px 2px;">Accounts</div>
      ${accountCards}

      <div style="opacity:.8; font-size:12px; margin:12px 2px 8px;">Transfer</div>
      <div class="card">
        <div style="font-size:12px; opacity:.85; margin-bottom:6px;">From</div>
        <select class="input" id="walletFrom">${accountOptions}</select>

        <div style="font-size:12px; opacity:.85; margin:12px 0 6px;">To (account id)</div>
        <input class="input" id="walletTo" placeholder="citizenid / job / shared account id" />

        <div style="display:flex; gap:10px; margin-top:12px;">
          <input class="input" id="walletAmt" placeholder="Amount" style="flex:1;" />
          <button class="btn" id="walletSend" style="width:110px;">Send</button>
        </div>

        <div style="font-size:12px; opacity:.85; margin:12px 0 6px;">Note</div>
        <input class="input" id="walletNote" placeholder="Optional note..." />

        <div id="walletStatus" style="margin-top:10px; font-size:12px; opacity:.85;"></div>
      </div>

      <div style="opacity:.8; font-size:12px; margin:12px 2px 8px;">Recent Transfers</div>
      ${historyRows}
    `;

    document.getElementById('walletSend').addEventListener('click', async () => {
      const from_account = document.getElementById('walletFrom').value;
      const to_account = document.getElementById('walletTo').value.trim();
      const amount = Number(document.getElementById('walletAmt').value);
      const note = document.getElementById('walletNote').value.trim();

      const status = document.getElementById('walletStatus');
      status.textContent = '';

      if (!from_account) return status.textContent = 'Pick a "From" account.';
      if (!to_account) return status.textContent = 'Enter a "To" account id.';
      if (!Number.isFinite(amount) || amount <= 0) return status.textContent = 'Enter a valid amount.';

      const resp = await nui('walletTransfer', { from_account, to_account, amount, note });

      if (resp && resp.ok) {
        status.textContent = 'Transfer complete.';
        await renderWallet(); // refresh
      } else {
        const e = (resp && resp.error) ? resp.error : 'transfer_failed';
        status.textContent = `Transfer failed: ${e}`;
      }
    });
  }

  // ---------------------------
  // Contacts / Directory / Calculator placeholders
  // ---------------------------
  function renderContacts() {
    openPanel('Contacts');
    panelBody.innerHTML = `
      <div class="card">
        <div style="font-weight:900; margin-bottom:8px;">Contacts</div>
        <div style="opacity:.85;">Coming next.</div>
      </div>
    `;
  }

  function renderDirectory() {
    openPanel('Directory');
    panelBody.innerHTML = `
      <div class="card">
        <div style="font-weight:900; margin-bottom:8px;">Directory</div>
        <div style="opacity:.85;">Coming next.</div>
      </div>
    `;
  }

  function renderCalculator() {
    openPanel('Calculator');
    panelBody.innerHTML = `
      <div class="card">
        <div style="font-weight:900; margin-bottom:8px;">Calculator</div>
        <div style="opacity:.85;">Coming next.</div>
      </div>
    `;
  }

  // ---------------------------
  // Calls UI (server -> UI events)
  // ---------------------------
  function showCallUI(kind, data) {
    if (!data) data = {};

    if (kind === 'incoming') {
      activeCallId = data.call_id;
      openPanel('Incoming Call', data.from_number || '');

      panelBody.innerHTML = `
        <div class="card">
          <div style="font-weight:900;">${escapeHtml(data.from_number || 'Unknown')}</div>
          <div style="opacity:.85; margin-top:6px;">Incoming call...</div>
          <button class="btn" id="acceptCall">Accept</button>
          <button class="btn" id="declineCall" style="margin-top:8px;">Decline</button>
        </div>
      `;

      document.getElementById('acceptCall').onclick = () => nui('callAccept', { call_id: data.call_id });
      document.getElementById('declineCall').onclick = () => nui('callDecline', { call_id: data.call_id });
      return;
    }

    if (kind === 'outgoing') {
      activeCallId = data.call_id;
      openPanel('Calling', data.to_number || '');

      panelBody.innerHTML = `
        <div class="card">
          <div style="font-weight:900;">${escapeHtml(data.to_number || 'Unknown')}</div>
          <div style="opacity:.85; margin-top:6px;">Dialing...</div>
          <button class="btn" id="hangupCall">Hang up</button>
        </div>
      `;

      document.getElementById('hangupCall').onclick = () => nui('callHangup', { call_id: data.call_id });
      return;
    }

    if (kind === 'active') {
      activeCallId = data.call_id;
      openPanel('On Call', data.peer_number || '');

      panelBody.innerHTML = `
        <div class="card">
          <div style="font-weight:900;">${escapeHtml(data.peer_number || 'Unknown')}</div>
          <div style="opacity:.85; margin-top:6px;">Connected</div>
          <button class="btn" id="hangupCall">Hang up</button>
        </div>
      `;

      document.getElementById('hangupCall').onclick = () => nui('callHangup', { call_id: data.call_id });
    }
  }

  // ---------------------------
  // Wire up UI buttons + messages
  // ---------------------------
  closePanelBtn.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      nui('close');
    }
  });

  window.addEventListener('message', (event) => {
    const msg = event.data || {};
    const action = msg.action;
    const data = msg.data;

    if (action === 'open') {
      // Your CSS gates visibility with body.show
      document.body.classList.add('show');

      state = data || state;

      wallpaper.style.backgroundImage = "url('assets/wallpaper.png')";
      root.classList.remove('hidden');
      panelEl.classList.add('hidden');

      renderGrid();
      setTime();
      return;
    }

    if (action === 'close') {
      document.body.classList.remove('show');
      root.classList.add('hidden');
      panelEl.classList.add('hidden');
      activeCallId = null;
      return;
    }

    // optional notifications/messages
    if (action === 'notify') {
      state.unread_notifications = [data, ...(state.unread_notifications || [])].slice(0, 50);
      return;
    }

    if (action === 'messageNew') {
      // you can refresh messages UI if currently open, later
      return;
    }

    // Calls
    if (action === 'callIncoming') return showCallUI('incoming', data);
    if (action === 'callOutgoing') return showCallUI('outgoing', data);
    if (action === 'callActive') return showCallUI('active', data);
    if (action === 'callEnded') {
      activeCallId = null;
      return;
    }
  });

  setInterval(setTime, 1000);
})();
