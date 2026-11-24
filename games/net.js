/* Offline 2-phone transport for the web games.
 * Uses WebRTC data channels over a local Wi-Fi hotspot / Bluetooth tethering.
 * No internet, STUN or signalling server is needed; the two pairing codes are
 * exchanged by the players (copy/paste, SMS, Bluetooth share, etc.). */
(function (root) {
  'use strict';

  var PREFIX = 'WGNET1:';
  var PC = root.RTCPeerConnection || root.webkitRTCPeerConnection || root.mozRTCPeerConnection || null;

  function supported() { return !!PC; }

  function b64enc(str) {
    return root.btoa(root.unescape(root.encodeURIComponent(str)));
  }
  function b64dec(str) {
    return root.decodeURIComponent(root.escape(root.atob(str)));
  }

  function pack(desc) {
    return PREFIX + b64enc(JSON.stringify({ t: desc.type, s: desc.sdp }));
  }

  function unpack(code) {
    var s = String(code || '').replace(/\s+/g, '');
    var at = s.indexOf(PREFIX);
    if (at > 0) s = s.slice(at);
    if (s.indexOf(PREFIX) !== 0) throw new Error('Invalid pairing code');
    var obj;
    try { obj = JSON.parse(b64dec(s.slice(PREFIX.length))); }
    catch (e) { throw new Error('Damaged pairing code'); }
    if (!obj || typeof obj.s !== 'string' || (obj.t !== 'offer' && obj.t !== 'answer')) {
      throw new Error('Invalid pairing code');
    }
    return { type: obj.t, sdp: obj.s };
  }

  function newPc() {
    try { return new PC({ iceServers: [] }); }
    catch (e) { return new PC(); }
  }

  function callPc(pc, name, args) {
    return new Promise(function (resolve, reject) {
      var result;
      try { result = pc[name].apply(pc, args || []); }
      catch (e) { reject(e); return; }
      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
        return;
      }
      try {
        if (name === 'createOffer' || name === 'createAnswer') {
          pc[name](resolve, reject);
        } else {
          pc[name].apply(pc, (args || []).concat([resolve, reject]));
        }
      } catch (e2) { reject(e2); }
    });
  }

  function waitIce(pc, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(finish, timeoutMs);
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      }
      try {
        if (pc.iceGatheringState === 'complete') { finish(); return; }
        pc.addEventListener('icecandidate', function (e) {
          if (!e.candidate) finish();
        });
        pc.addEventListener('icegatheringstatechange', function () {
          if (pc.iceGatheringState === 'complete') finish();
        });
      } catch (e) { finish(); }
    });
  }

  function createSession() {
    var pc = null;
    var dc = null;
    var closed = false;
    var opened = false;

    var api = {
      role: null,
      onopen: null,
      onmessage: null,
      onclose: null,
      onstate: null,
      createOffer: createOffer,
      acceptOffer: acceptOffer,
      acceptAnswer: acceptAnswer,
      send: send,
      isOpen: isOpen,
      close: close
    };

    function isOpen() {
      return !!(dc && dc.readyState === 'open');
    }

    function emitClose(reason) {
      if (closed) return;
      closed = true;
      if (api.onclose) {
        try { api.onclose(reason || 'closed'); } catch (e) {}
      }
    }

    function attachChannel(ch) {
      dc = ch;
      try {
        ch.onopen = function () {
          opened = true;
          if (api.onopen) {
            try { api.onopen(); } catch (e) {}
          }
        };
        ch.onmessage = function (e) {
          var msg;
          try { msg = JSON.parse(e.data); } catch (err) { return; }
          if (msg && msg.t === '_wgping') return;
          if (api.onmessage) {
            try { api.onmessage(msg); } catch (err) {}
          }
        };
        ch.onclose = function () {
          if (!opened) emitClose('unreachable');
          else emitClose('closed');
        };
        ch.onerror = function () {
          if (!opened) emitClose('error');
        };
      } catch (e) {}
    }

    function wirePc() {
      function changed() {
        var state = '';
        try { state = pc.connectionState || pc.iceConnectionState || ''; } catch (e) {}
        if (api.onstate) {
          try { api.onstate(state); } catch (e) {}
        }
        if (state === 'failed') emitClose('failed');
      }
      try {
        pc.onconnectionstatechange = changed;
        pc.oniceconnectionstatechange = changed;
      } catch (e) {}
    }

    function createOffer() {
      api.role = 'host';
      return new Promise(function (resolve, reject) {
        try {
          pc = newPc();
          wirePc();
          var ch;
          try { ch = pc.createDataChannel('wg'); }
          catch (e) { ch = pc.createDataChannel('wg', { reliable: true }); }
          attachChannel(ch);
        } catch (e) { reject(e); return; }
        callPc(pc, 'createOffer', [])
          .then(function (offer) { return callPc(pc, 'setLocalDescription', [offer]); })
          .then(function () { return waitIce(pc, 7000); })
          .then(function () {
            if (!pc.localDescription) throw new Error('Could not create invite code');
            resolve(pack(pc.localDescription));
          })
          .catch(reject);
      });
    }

    function acceptOffer(code) {
      api.role = 'join';
      var desc;
      try { desc = unpack(code); }
      catch (e) { return Promise.reject(e); }
      if (desc.type !== 'offer') return Promise.reject(new Error('That is not a host invite code'));
      return new Promise(function (resolve, reject) {
        try {
          pc = newPc();
          wirePc();
          pc.ondatachannel = function (e) { attachChannel(e.channel); };
        } catch (e) { reject(e); return; }
        callPc(pc, 'setRemoteDescription', [desc])
          .then(function () { return callPc(pc, 'createAnswer', []); })
          .then(function (answer) { return callPc(pc, 'setLocalDescription', [answer]); })
          .then(function () { return waitIce(pc, 7000); })
          .then(function () {
            if (!pc.localDescription) throw new Error('Could not create reply code');
            resolve(pack(pc.localDescription));
          })
          .catch(reject);
      });
    }

    function acceptAnswer(code) {
      var desc;
      try { desc = unpack(code); }
      catch (e) { return Promise.reject(e); }
      if (desc.type !== 'answer') return Promise.reject(new Error('That is not a guest reply code'));
      if (!pc) return Promise.reject(new Error('Create an invite code first'));
      return callPc(pc, 'setRemoteDescription', [desc]);
    }

    function send(obj) {
      if (!dc || dc.readyState !== 'open') return false;
      try {
        dc.send(JSON.stringify(obj));
        return true;
      } catch (e) { return false; }
    }

    function close() {
      if (!closed) {
        closed = true;
        if (api.onclose) {
          try { api.onclose('local'); } catch (e) {}
        }
      }
      try { if (dc) dc.close(); } catch (e) {}
      try { if (pc) pc.close(); } catch (e) {}
      dc = null;
      pc = null;
    }

    return api;
  }

  function copyText(text) {
    var ok = false;
    try {
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
        root.navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      try {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;opacity:0';
        document.body.appendChild(area);
        area.focus();
        area.select();
        area.setSelectionRange(0, area.value.length);
        ok = document.execCommand('copy');
        document.body.removeChild(area);
      } catch (e) { ok = false; }
    }
    return ok;
  }


  function mozShare(text) {
    if (typeof root.MozActivity !== 'function') return false;
    try {
      new root.MozActivity({ name: 'share', data: { type: 'text/plain', blobs: [text] } });
      return true;
    } catch (e) {}
    try {
      new root.MozActivity({ name: 'share', data: { type: 'text/plain', text: text } });
      return true;
    } catch (e) {}
    return false;
  }

  function shareText(text, title) {
    if (root.navigator && typeof root.navigator.share === 'function') {
      try {
        return root.navigator.share({ title: title || 'Offline game code', text: text });
      } catch (e) {}
    }
    if (mozShare(text)) return Promise.resolve();
    return Promise.reject(new Error('Sharing is not available'));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function chunkCode(code) {
    code = String(code == null ? '' : code).replace(/\\s+/g, '');
    return code.replace(/.{1,6}/g, function (m) { return m + ' '; }).trim();
  }

  function extractCode(input) {
    var s = String(input == null ? '' : input);
    var m = s.match(/[?&#]pair=([^&#\\s]+)/i);
    if (m) {
      try { s = decodeURIComponent(m[1]); } catch (e) { s = m[1]; }
    }
    s = s.replace(/\\s+/g, '');
    var at = s.indexOf(PREFIX);
    if (at > 0) s = s.slice(at);
    return s;
  }

  function makeLink(code) {
    try {
      var url = new URL(root.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('pair', code);
      return url.toString();
    } catch (e) {
      return (root.location.href.split('?')[0].split('#')[0]) + '?pair=' + encodeURIComponent(code);
    }
  }

  function pair(opts) {
    opts = opts || {};
    var rootEl = opts.root;
    if (!rootEl) throw new Error('Pairing container missing');
    var incoming = opts.initialCode || '';
    try {
      var sp = new URLSearchParams(root.location.search);
      if (sp.get('pair')) incoming = sp.get('pair');
    } catch (e) {}
    incoming = extractCode(incoming);
    var connType = 'hotspot';
    var session = null;
    var timer = null;
    var destroyed = false;
    var handedOff = false;
    var role = '';
    var pending = [];

    function statusText(msg, kind) {
      var el = rootEl.querySelector('#netStatus');
      if (!el) return;
      el.textContent = msg || '';
      el.className = 'netpan-status' + (kind ? ' ' + kind : '');
    }

    function focusFirst(sel) {
      setTimeout(function () {
        if (destroyed) return;
        var el = rootEl.querySelector(sel || '[data-focus]');
        if (!el) el = rootEl.querySelector('button:not(:disabled),textarea');
        if (el) { try { el.focus(); } catch (e) {} }
      }, 30);
    }

    function clearTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function stopSession() {
      clearTimer();
      if (session) {
        try {
          session.onopen = null;
          session.onclose = null;
          session.onmessage = null;
          session.onstate = null;
          session.close();
        } catch (e) {}
        session = null;
      }
      pending = [];
      handedOff = false;
    }

    function attachSession(s) {
      s.onopen = function () {
        if (destroyed || handedOff) return;
        clearTimer();
        handedOff = true;
        statusText('Connected! Starting game...', 'ok');
        var waiting = pending;
        pending = [];
        if (opts.onConnected) {
          try { opts.onConnected(s, role, connType); } catch (e) {
            statusText('Could not start game: ' + e.message, 'err');
          }
        }
        var handler = s.onmessage;
        if (typeof handler === 'function' && waiting.length) {
          for (var i = 0; i < waiting.length; i++) {
            try { handler(waiting[i]); } catch (e) {}
          }
        }
      };
      s.onmessage = function (msg) {
        if (handedOff) {
          if (opts.onMessage) {
            try { opts.onMessage(msg); } catch (e) {}
          }
        } else {
          pending.push(msg);
        }
      };
      s.onclose = function (reason) {
        if (destroyed || handedOff) return;
        clearTimer();
        statusText(reason === 'failed' || reason === 'unreachable'
          ? 'Could not connect. Keep both phones on the same hotspot / Bluetooth network and try again.'
          : 'Connection closed. Try again.', 'err');
      };
      s.onstate = function (state) {
        if (state === 'checking' && !handedOff) statusText('Connecting... keep both phones nearby.', 'wait');
      };
      return s;
    }

    function createNewSession() {
      stopSession();
      session = attachSession(createSession());
      return session;
    }

    function connHelp() {
      if (connType === 'bluetooth') {
        return '<b>Bluetooth tethering</b><br>1. Pair both phones in Bluetooth settings.<br>2. On the host phone turn on Bluetooth tethering / Bluetooth network sharing.<br>3. Join that Bluetooth network on the other phone. If your phone does not show Bluetooth tethering, use Wi-Fi Hotspot.';
      }
      return '<b>Wi-Fi hotspot</b><br>1. Turn on Wi-Fi hotspot on one phone (mobile data can stay off).<br>2. Connect the other phone to that hotspot.<br>3. Keep both phones on this screen.';
    }

  function codeButtons() {
    return '<div class="netpan-btns">' +
      '<button type="button" data-act="copy" data-focus>Copy code</button>' +
      '<button type="button" data-act="share" class="alt">Share/SMS</button>' +
      '<button type="button" data-act="share-link" class="alt">Share link</button>' +
      '<button type="button" data-act="copy-link" class="alt">Copy link</button>' +
      '<button type="button" data-act="qr" class="alt">Show QR</button>' +
      '<button type="button" data-act="select-code" class="alt">Select all</button>' +
      '</div>';
  }

    function renderQr(code) {
      var box = rootEl.querySelector('#qrBox');
      if (!box) return;
      box.innerHTML = '';
      var link = makeLink(code);
      if (window.QRCode) {
        try {
          new window.QRCode(box, { text: link, width: 152, height: 152, correctLevel: (window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0) });
        } catch (e) {
          box.textContent = '';
        }
      }
      var p = document.createElement('p');
      p.className = 'netpan-tip';
      p.textContent = 'Scan QR or open link: ' + link;
      p.style.wordBreak = 'break-all';
      box.appendChild(p);
    }

    function renderMenu() {
      stopSession();
      role = '';
      rootEl.innerHTML =
        '<div class="netpanel">' +
        '<h2>2 Phones &mdash; Offline</h2>' +
        '<div class="netpan-head"><span class="netpan-sub">No internet needed. Both games run directly phone-to-phone.</span></div>' +
        '<div class="netpan-types">' +
        '<button type="button" data-conn="hotspot" class="' + (connType === 'hotspot' ? 'on' : '') + '">Wi-Fi Hotspot</button>' +
        '<button type="button" data-conn="bluetooth" class="' + (connType === 'bluetooth' ? 'on' : '') + '">Bluetooth</button>' +
        '</div>' +
        '<p class="netpan-help" id="connHelp">' + connHelp() + '</p>' +
        '<div class="netpan-btns">' +
        '<button type="button" data-act="host">Host game</button>' +
        '<button type="button" data-act="join">Join game</button>' +
        '<button type="button" data-act="back" class="alt wide">Back</button>' +
        '</div>' +
        '<p class="netpan-note">Pairing codes can be sent by SMS or Bluetooth share, or copied on one phone and pasted on the other. Gameplay itself does not use the internet.</p>' +
        '</div>';
      focusFirst('[data-act="host"]');
    }

    function renderHost(status, kind) {
      rootEl.innerHTML =
        '<div class="netpanel">' +
        '<h2>Host game</h2>' +
        '<span class="netpan-sub">' + (connType === 'bluetooth' ? 'Bluetooth tethering' : 'Wi-Fi hotspot') + ' &middot; no internet</span>' +
        '<p class="netpan-help">' + connHelp() + '</p>' +
        '<label class="netpan-label">1. Send this invite code to the other phone:</label>' +
        '<textarea class="netpan-code" id="offerCode" readonly spellcheck="false" onfocus="try{this.select();this.setSelectionRange(0,this.value.length);}catch(e){}">' + esc(chunkCode(status && status.code || '')) + '</textarea>' +
(status && status.code ? codeButtons() : '') +
(status && status.code ? '<div class="netpan-qr" id="qrBox"></div>' : '') +
'<label class="netpan-label">2. Paste or type the guest reply code:</label>' +
        '<textarea class="netpan-code" id="answerCode" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" inputmode="text" onfocus="try{this.select();this.setSelectionRange(0,this.value.length);}catch(e){}" placeholder="Reply code from the other phone"></textarea>' +
        '<div class="netpan-btns">' +
        '<button type="button" data-act="paste-answer" class="alt">Paste code</button>' +
        '<button type="button" data-act="select-answer" class="alt">Select all</button>' +
        '<button type="button" data-act="connect" class="wide" ' + (status && status.code ? '' : 'disabled') + '>Connect</button>' +
        '<button type="button" data-act="host-back" class="alt wide">Cancel</button>' +
        '</div>' +
        '<p class="netpan-status' + (status && status.kind ? ' ' + status.kind : '') + '" id="netStatus">' + esc(status && status.msg || '') + '</p>' +
        '<p class="netpan-tip">Spaces in the code are okay. Use Copy/Share/Paste; type manually only if needed.</p>' +
        '</div>';
      if (status && status.code) focusFirst('[data-act="copy"]');
      else focusFirst('[data-act="host-back"]');
      if (status && status.code) {
        var offerArea = rootEl.querySelector('#offerCode');
        if (offerArea) offerArea.value = chunkCode(status.code);
      }
    }

    function renderJoin(status, kind) {
      rootEl.innerHTML =
        '<div class="netpanel">' +
        '<h2>Join game</h2>' +
        '<span class="netpan-sub">' + (connType === 'bluetooth' ? 'Bluetooth tethering' : 'Wi-Fi hotspot') + ' &middot; no internet</span>' +
        '<p class="netpan-help">' + connHelp() + '</p>' +
        '<label class="netpan-label">1. Paste or type the host invite code:</label>' +
        '<textarea class="netpan-code" id="joinOffer" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" inputmode="text" onfocus="try{this.select();this.setSelectionRange(0,this.value.length);}catch(e){}" placeholder="Invite code from the host phone">' + esc(chunkCode(status && status.offer || '')) + '</textarea>' +
        '<div class="netpan-btns">' +
        '<button type="button" data-act="paste-offer" class="alt">Paste code</button>' +
        '<button type="button" data-act="select-offer" class="alt">Select all</button>' +
        '<button type="button" data-act="reply" class="wide">Create reply code</button>' +
        '<button type="button" data-act="join-back" class="alt wide">Cancel</button>' +
        '</div>' +
        '<p class="netpan-status' + (status && status.kind ? ' ' + status.kind : '') + '" id="netStatus">' + esc(status && status.msg || '') + '</p>' +
        '<p class="netpan-tip">After the host receives your reply code, the game starts automatically.</p>' +
        '</div>';
      focusFirst('#joinOffer');
      if (status && status.offer) {
        var joinArea = rootEl.querySelector('#joinOffer');
        if (joinArea) joinArea.value = chunkCode(status.offer);
      }
    }

    function renderAnswer(answer) {
      rootEl.innerHTML =
        '<div class="netpanel">' +
        '<h2>Reply code</h2>' +
        '<p class="netpan-help">Send this reply code back to the host phone. Keep this screen open.</p>' +
        '<textarea class="netpan-code" id="replyCode" readonly spellcheck="false" onfocus="try{this.select();this.setSelectionRange(0,this.value.length);}catch(e){}">' + esc(chunkCode(answer)) + '</textarea>' +
        codeButtons() +
        '<div class="netpan-qr" id="qrBox"></div>' +
        '<div class="netpan-btns">' +
        '<button type="button" data-act="join-back" class="alt wide">Cancel</button>' +
        '</div>' +
        '<p class="netpan-status wait" id="netStatus">Waiting for host to connect...</p>' +
        '<p class="netpan-tip">Spaces in the code are okay. Host must paste this reply code and tap Connect.</p>' +
        '</div>';
      focusFirst('[data-act="copy"]');
      var area = rootEl.querySelector('#replyCode');
      if (area) area.value = chunkCode(answer);
    }

    function renderError(title, msg) {
      rootEl.innerHTML =
        '<div class="netpanel">' +
        '<h2>' + esc(title || 'Connection problem') + '</h2>' +
        '<p class="netpan-help">' + esc(msg || 'Try again.') + '</p>' +
        '<div class="netpan-btns">' +
        '<button type="button" data-act="retry">Try again</button>' +
        '<button type="button" data-act="menu" class="alt">Back</button>' +
        '</div>' +
        '</div>';
      focusFirst('[data-act="retry"]');
    }

    function startHost() {
      role = 'host';
      renderHost({ msg: 'Creating invite code...', kind: 'wait' });
      var s = createNewSession();
      s.createOffer().then(function (code) {
        if (destroyed || handedOff) return;
        renderHost({ code: code, msg: 'Invite code ready. Send it to the guest.', kind: 'ok' });
        renderQr(code);
      }).catch(function (e) {
        if (destroyed) return;
        stopSession();
        renderError('Could not create invite', e.message || 'WebRTC is not available.');
      });
    }

    function readCode(id) {
      var el = rootEl.querySelector('#' + id);
      return el ? extractCode(el.value) : '';
    }

    function connectHost() {
      if (!session) { renderError('Session ended', 'Tap Try again.'); return; }
      var code = readCode('answerCode');
      if (!code) { statusText('Paste the guest reply code first.', 'err'); return; }
      statusText('Connecting... keep both phones nearby.', 'wait');
      var btn = rootEl.querySelector('[data-act="connect"]');
      if (btn) btn.disabled = true;
      clearTimer();
      timer = setTimeout(function () {
        if (destroyed || handedOff) return;
        statusText('Connection timed out. Check the same hotspot / Bluetooth network, then try again.', 'err');
        if (btn) btn.disabled = false;
      }, 25000);
      session.acceptAnswer(code).then(function () {
        if (destroyed || handedOff) return;
        statusText('Connecting... waiting for the data channel.', 'wait');
      }).catch(function (e) {
        if (destroyed || handedOff) return;
        clearTimer();
        statusText(e.message || 'Could not connect. Check the reply code.', 'err');
        if (btn) btn.disabled = false;
      });
    }

    function createReply() {
      var code = readCode('joinOffer');
      if (!code) { statusText('Paste the host invite code first.', 'err'); return; }
      statusText('Creating reply code...', 'wait');
      var s = createNewSession();
      s.acceptOffer(code).then(function (answer) {
        if (destroyed || handedOff) return;
        renderAnswer(answer);
        renderQr(answer);
      }).catch(function (e) {
        if (destroyed) return;
        stopSession();
        renderError('Could not join', e.message || 'Check that you pasted the host invite code.');
      });
    }

    function updateConnType(type) {
      connType = type;
      var help = rootEl.querySelector('#connHelp');
      if (help) help.innerHTML = connHelp();
      var buttons = rootEl.querySelectorAll('[data-conn]');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].className = buttons[i].getAttribute('data-conn') === type ? 'on' : '';
      }
    }

    function pasteInto(id) {
      var el = rootEl.querySelector('#' + id);
      if (!el) return;
       function done(v) {
         var code = extractCode(v);
         if (code) el.value = code;
         else if (v != null && String(v).trim()) el.value = String(v).trim();
         try { el.focus(); el.select(); el.setSelectionRange(0, el.value.length); } catch (e) {}
       }
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.readText === 'function') {
        root.navigator.clipboard.readText().then(done).catch(function () {
          try { el.focus(); el.select(); } catch (e) {}
          statusText('Paste failed. Tap the box and paste/type manually.', 'err');
        });
      } else {
        try { el.focus(); el.select(); } catch (e) {}
        statusText('Paste is not available here. Select the box and type/paste the code.', 'err');
      }
    }

    function onCopySuccess() {
      statusText('Code copied. Now paste it on the other phone.', 'ok');
    }

    function onCopyFail() {
      statusText('Copy failed. Select the code in the box and copy it manually.', 'err');
    }

    rootEl.onclick = function (e) {
      var node = e.target;
      while (node && node !== rootEl && node.nodeName !== 'BUTTON') node = node.parentNode;
      if (!node || node === rootEl) return;
      var act = node.getAttribute('data-act');
      var conn = node.getAttribute('data-conn');
      if (conn) { updateConnType(conn); return; }
      if (!act) return;
      if (act === 'host') { startHost(); return; }
      if (act === 'join') { role = 'join'; renderJoin({}); return; }
      if (act === 'back') {
        stopSession();
        if (opts.onClose) { try { opts.onClose(); } catch (err) {} }
        return;
      }
      if (act === 'host-back' || act === 'join-back') { renderMenu(); return; }
      if (act === 'menu') { renderMenu(); return; }
      if (act === 'retry') {
        if (role === 'host') startHost();
        else { role = 'join'; renderJoin({}); }
        return;
      }
      if (act === 'copy') {
        var el = rootEl.querySelector(role === 'host' ? '#offerCode' : '#replyCode');
        if (el) {
          if (copyText(el.value)) onCopySuccess(); else onCopyFail();
        }
        return;
      }
      if (act === 'copy-link' || act === 'share-link') {
        var cel = rootEl.querySelector(role === 'host' ? '#offerCode' : '#replyCode');
        var code = cel ? extractCode(cel.value) : '';
        if (!code) { statusText('Code not ready yet.', 'err'); return; }
        var link = makeLink(code);
        if (act === 'copy-link') {
          if (copyText(link)) statusText('Link copied. Send it to the other phone.', 'ok');
          else statusText('Copy failed. Select the link manually.', 'err');
        } else {
          shareText(link, 'Offline game link').then(function () {
            statusText('Link shared. Other phone can tap it to join.', 'ok');
          }).catch(function () {
            if (copyText(link)) onCopySuccess(); else onCopyFail();
          });
        }
        return;
      }
      if (act === 'qr') {
        var qel = rootEl.querySelector(role === 'host' ? '#offerCode' : '#replyCode');
        var qcode = qel ? extractCode(qel.value) : '';
        if (!qcode) { statusText('Code not ready yet.', 'err'); return; }
        renderQr(qcode);
        statusText('QR code shown. Scan it with the other phone.', 'ok');
        return;
      }
      if (act === 'select-code') {
        var selEl = rootEl.querySelector(role === 'host' ? '#offerCode' : '#replyCode');
        if (selEl) {
          try { selEl.focus(); selEl.select(); selEl.setSelectionRange(0, selEl.value.length); } catch (e) {}
        }
        return;
      }
      if (act === 'select-answer') {
        var aEl = rootEl.querySelector('#answerCode');
        if (aEl) { try { aEl.focus(); aEl.select(); aEl.setSelectionRange(0, aEl.value.length); } catch (e) {} }
        return;
      }
      if (act === 'select-offer') {
        var oEl = rootEl.querySelector('#joinOffer');
        if (oEl) { try { oEl.focus(); oEl.select(); oEl.setSelectionRange(0, oEl.value.length); } catch (e) {} }
        return;
      }
      if (act === 'paste-answer') { pasteInto('answerCode'); return; }
      if (act === 'paste-offer') { pasteInto('joinOffer'); return; }
      if (act === 'share') {
        var shareEl = rootEl.querySelector(role === 'host' ? '#offerCode' : '#replyCode');
        if (shareEl) {
          shareText(shareEl.value, 'Offline game pairing code').then(function () {
            statusText('Code shared via SMS/Bluetooth/Share sheet.', 'ok');
          }).catch(function () {
            if (copyText(shareEl.value)) onCopySuccess(); else onCopyFail();
          });
        }
        return;
      }
      if (act === 'connect') { connectHost(); return; }
      if (act === 'reply') { createReply(); return; }
    };

    rootEl.onkeydown = function (e) {
      var tag = (e.target && e.target.nodeName || '').toUpperCase();
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      var k = e.key || '';
      var c = e.keyCode || 0;
      var down = k === 'ArrowDown' || k === 'ArrowRight' || k === '8' || k === '6' || c === 40 || c === 39 || c === 56 || c === 54;
      var up = k === 'ArrowUp' || k === 'ArrowLeft' || k === '2' || k === '4' || c === 38 || c === 37 || c === 50 || c === 52;
      if (!down && !up) return;
      var list = rootEl.querySelectorAll('button:not(:disabled)');
      if (!list.length) return;
      e.preventDefault();
      var idx = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i] === document.activeElement) { idx = i; break; }
      }
      idx = idx < 0 ? 0 : (idx + (down ? 1 : -1) + list.length) % list.length;
      try { list[idx].focus(); } catch (err) {}
    };

    var autoJoin = false;
    if (incoming) {
      try {
        var d = unpack(incoming);
        if (d.type === 'offer') autoJoin = true;
      } catch (e) {}
    }

    if (autoJoin) {
      role = 'join';
      renderJoin({ offer: incoming });
      setTimeout(function () {
        if (destroyed) return;
        createReply();
      }, 50);
    } else {
      renderMenu();
    }
    // clean URL
    try { root.history.replaceState({}, '', root.location.pathname + root.location.hash); } catch (e) {}

    return {
      destroy: function () {
        destroyed = true;
        clearTimer();
        if (!handedOff) stopSession();
        rootEl.onclick = null;
        rootEl.onkeydown = null;
        rootEl.innerHTML = '';
      }
    };
  }

  root.WGNet = {
    supported: supported,
    create: createSession,
    pair: pair,
    pack: pack,
    unpack: unpack
  };
})(typeof window !== 'undefined' ? window : this);
