// ── Session ───────────────────────────────────────────
const currentName   = sessionStorage.getItem('cm_name');
const currentRoom   = sessionStorage.getItem('cm_room');
const currentIsHost = sessionStorage.getItem('cm_isHost') === 'true';

document.getElementById('roomCode').innerText = currentRoom;
document.getElementById('roomTitle').innerText = `Room ${currentRoom}`;

// ── State ─────────────────────────────────────────────
let socket      = null;
let replyTo     = null;
let msgMap      = {};
let lastMsgDate = null;

const COLORS = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#db2777','#7c3aed','#0284c7'];
const QUICK_REACTIONS = ['👍','❤️','😂','😮','😢','🔥'];

// ── Toast ─────────────────────────────────────────────
let toastTimer;
function toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Helpers ───────────────────────────────────────────
function avatarColor(str) {
    let h = 0;
    for (let c of str) h = c.charCodeAt(0) + ((h << 5) - h);
    return COLORS[Math.abs(h) % COLORS.length];
}

function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Connection Status ─────────────────────────────────
function setConnStatus(connected) {
    const el = document.getElementById('connStatus');
    const txt = document.getElementById('connText');
    el.className = 'conn-status ' + (connected ? 'connected' : 'disconnected');
    txt.textContent = connected ? 'Connected' : 'Reconnecting...';
}

// ── Date Separator ────────────────────────────────────
function maybeAddDateSep(ts) {
    const dateStr = formatDate(ts);
    if (dateStr !== lastMsgDate) {
        lastMsgDate = dateStr;
        const sep = document.createElement('div');
        sep.className = 'date-sep';
        sep.textContent = dateStr;
        document.getElementById('chatBox').appendChild(sep);
    }
}

// ── Append Message ────────────────────────────────────
function appendMessage(data, skipScroll = false) {
    const chatBox = document.getElementById('chatBox');

    if (data.name === 'System') {
        const d = document.createElement('div');
        d.className = 'system-msg';
        d.innerText = data.text;
        chatBox.appendChild(d);
        if (!skipScroll) chatBox.scrollTop = chatBox.scrollHeight;
        return;
    }

    if (data.time) maybeAddDateSep(data.time);

    const isMine = data.name === currentName;
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap ' + (isMine ? 'sent-wrap' : 'recv-wrap');
    if (data.id) wrap.dataset.msgId = data.id;

    // Action bar
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    QUICK_REACTIONS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'msg-action-btn';
        btn.textContent = emoji;
        btn.title = `React with ${emoji}`;
        btn.onclick = () => reactTo(data.id, emoji);
        actions.appendChild(btn);
    });

    const replyBtn = document.createElement('button');
    replyBtn.className = 'msg-action-btn';
    replyBtn.textContent = '↩️';
    replyBtn.title = 'Reply';
    replyBtn.onclick = () => setReply(data);
    actions.appendChild(replyBtn);

    if (data.text) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn';
        copyBtn.textContent = '📋';
        copyBtn.title = 'Copy message';
        copyBtn.onclick = () => { navigator.clipboard.writeText(data.text); toast('✅ Message copied!'); };
        actions.appendChild(copyBtn);
    }

    wrap.appendChild(actions);

    // Bubble
    const div = document.createElement('div');
    div.className = 'msg ' + (isMine ? 'sent' : 'received');

    let html = `<span class="msg-name">${data.name}</span>`;

    if (data.replyTo) {
        html += `<div class="reply-quote" onclick="scrollToMsg('${data.replyTo.id}')">
            <div class="rq-name">↩ ${data.replyTo.name}</div>
            <div>${data.replyTo.text || '📎 Attachment'}</div>
        </div>`;
    }

    if (data.text) html += `<div class="msg-text">${escapeHtml(data.text)}</div>`;

    if (data.file) {
        if (data.fileType && data.fileType.startsWith('image')) {
            html += `<img src="${data.file}" alt="image" onclick="openLightbox(this.src)">`;
        } else {
            html += `<a href="${data.file}" download>📎 Download File</a>`;
        }
    }

    html += `<div class="msg-time">${formatTime(data.time)}</div>`;
    html += `<div class="msg-reactions" id="reactions-${data.id}"></div>`;

    div.innerHTML = html;
    wrap.appendChild(div);
    chatBox.appendChild(wrap);

    if (!skipScroll) chatBox.scrollTop = chatBox.scrollHeight;
    if (data.id) msgMap[data.id] = wrap;

    if (!isMine && !skipScroll) {
        document.getElementById('notifySound').play().catch(() => {});
        if (document.hidden) { unread++; document.title = `(${unread}) ChatMeet`; }
    }
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Reactions ─────────────────────────────────────────
function reactTo(msgId, emoji) {
    if (!socket || !msgId) return;
    socket.emit('reactMessage', { room: currentRoom, msgId, emoji });
}

function renderReactions(msgId, reactions) {
    const el = document.getElementById('reactions-' + msgId);
    if (!el) return;
    el.innerHTML = '';
    Object.entries(reactions).forEach(([emoji, names]) => {
        if (!names.length) return;
        const pill = document.createElement('span');
        pill.className = 'reaction-pill' + (names.includes(currentName) ? ' mine' : '');
        pill.title = names.join(', ');
        pill.innerHTML = `${emoji} <span>${names.length}</span>`;
        pill.onclick = () => reactTo(msgId, emoji);
        el.appendChild(pill);
    });
}

// ── Reply ─────────────────────────────────────────────
function setReply(data) {
    replyTo = { id: data.id, name: data.name, text: data.text };
    document.getElementById('replyText').innerHTML =
        `Replying to <strong>${data.name}</strong>: ${data.text ? escapeHtml(data.text) : '📎 Attachment'}`;
    document.getElementById('replyPreview').classList.add('show');
    document.getElementById('msg').focus();
}

function cancelReply() {
    replyTo = null;
    document.getElementById('replyPreview').classList.remove('show');
}

function scrollToMsg(msgId) {
    const el = msgMap[msgId];
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid var(--primary)';
        el.style.borderRadius = '18px';
        setTimeout(() => { el.style.outline = ''; el.style.borderRadius = ''; }, 1600);
    }
}

// ── Lightbox ──────────────────────────────────────────
function openLightbox(src) {
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── Chat Search ───────────────────────────────────────
function toggleChatSearch() {
    const bar = document.getElementById('chatSearchBar');
    bar.classList.toggle('open');
    if (bar.classList.contains('open')) document.getElementById('chatSearchInput').focus();
    else { document.getElementById('chatSearchInput').value = ''; clearHighlights(); }
}
function closeChatSearch() {
    document.getElementById('chatSearchBar').classList.remove('open');
    document.getElementById('chatSearchInput').value = '';
    clearHighlights();
}
function clearHighlights() {
    document.querySelectorAll('.msg-text').forEach(el => { el.innerHTML = el.textContent; });
}
function searchMessages() {
    const q = document.getElementById('chatSearchInput').value.trim().toLowerCase();
    clearHighlights();
    if (!q) return;
    let first = true;
    document.querySelectorAll('.msg-text').forEach(el => {
        const text = el.textContent;
        if (text.toLowerCase().includes(q)) {
            const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
            el.innerHTML = text.replace(re, '<mark class="highlight">$1</mark>');
            if (first) { el.closest('.msg-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); first = false; }
        }
    });
}

// ── Participant Search ────────────────────────────────
function filterUsers() {
    const q = document.getElementById('userSearch').value.trim().toLowerCase();
    document.querySelectorAll('.participant-item').forEach(li => {
        const n = li.querySelector('.participant-name')?.textContent.toLowerCase() || '';
        li.style.display = n.includes(q) ? '' : 'none';
    });
}

// ── Unread ────────────────────────────────────────────
let unread = 0;
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { unread = 0; document.title = 'ChatMeet'; }
});

// ── Away Status ───────────────────────────────────────
let awayTimer;
function resetAway() {
    if (socket) socket.emit('setStatus', { room: currentRoom, status: 'online' });
    clearTimeout(awayTimer);
    awayTimer = setTimeout(() => {
        if (socket) socket.emit('setStatus', { room: currentRoom, status: 'away' });
    }, 60000);
}
document.addEventListener('mousemove', resetAway);
document.addEventListener('keypress', resetAway);

// ── Render Users ──────────────────────────────────────
function renderUsers(users, host) {
    const list = document.getElementById('users');
    list.innerHTML = '';
    document.getElementById('onlineCount').textContent =
        `${users.length} participant${users.length !== 1 ? 's' : ''} online`;

    users.forEach(u => {
        const li = document.createElement('li');
        li.className = 'participant-item';
        const color = avatarColor(u.name);
        let badges = '';
        if (u.id === host) badges += `<span title="Host">👑</span>`;
        if (u.muted)       badges += `<span title="Muted">🔇</span>`;

        li.innerHTML = `
            <div class="participant-left">
                <div class="avatar-wrap">
                    <div class="avatar" style="background:${color}18;color:${color}">${u.name.charAt(0).toUpperCase()}</div>
                    <span class="status-dot ${u.status || 'online'}"></span>
                </div>
                <span class="participant-name">${u.name}${u.name === currentName ? ' (you)' : ''}</span>
            </div>
            <div class="participant-badges">${badges}</div>
        `;

        if (currentIsHost && u.id !== host) {
            const acts = document.createElement('div');
            acts.className = 'participant-actions';

            const muteBtn = document.createElement('button');
            muteBtn.className = 'btn-mute';
            muteBtn.innerText = u.muted ? 'Unmute' : 'Mute';
            muteBtn.onclick = () => socket.emit('muteUser', { room: currentRoom, userId: u.id });

            const kickBtn = document.createElement('button');
            kickBtn.className = 'btn-kick';
            kickBtn.innerText = 'Kick';
            kickBtn.onclick = () => {
                if (confirm(`Kick ${u.name} from the room?`))
                    socket.emit('kickUser', { room: currentRoom, userId: u.id });
            };

            acts.appendChild(muteBtn);
            acts.appendChild(kickBtn);
            li.querySelector('.participant-badges').replaceWith(acts);
        }

        list.appendChild(li);
    });
}

// ── Send ──────────────────────────────────────────────
const MAX_FILE = 5 * 1024 * 1024;

function send() {
    if (!socket || !socket.connected) { toast('⚠️ Not connected. Please wait...', 3000); return; }
    const msgInput  = document.getElementById('msg');
    const fileInput = document.getElementById('fileInput');
    const text = msgInput.value.trim();
    const file = fileInput.files[0];
    if (!text && !file) return;

    const payload = { room: currentRoom, name: currentName, text };
    if (replyTo) payload.replyTo = replyTo;

    if (file) {
        if (file.size > MAX_FILE) {
            toast('⚠️ File too large. Max 5MB.', 3000);
            fileInput.value = '';
            document.getElementById('fileNameTag').textContent = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => socket.emit('sendMessage', { ...payload, file: e.target.result, fileType: file.type });
        reader.readAsDataURL(file);
    } else {
        socket.emit('sendMessage', payload);
    }

    msgInput.value = '';
    fileInput.value = '';
    document.getElementById('fileNameTag').textContent = '';
    cancelReply();
}

document.getElementById('msg').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    else if (socket) socket.emit('typing', { room: currentRoom, name: currentName });
});

document.getElementById('fileInput').addEventListener('change', () => {
    const f = document.getElementById('fileInput').files[0];
    document.getElementById('fileNameTag').textContent = f ? f.name : '';
});

// ── Copy / Leave ──────────────────────────────────────
function copyCode() {
    navigator.clipboard.writeText(currentRoom).then(() => toast('📋 Room code copied!'));
}

function leaveRoom() {
    if (confirm('Leave this room?')) {
        if (socket) socket.disconnect();
        sessionStorage.clear();
        location.href = 'index.html';
    }
}

// ── Emoji Picker ──────────────────────────────────────
const pickerEl = document.createElement('div');
pickerEl.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:9999;display:none;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.18);';
document.body.appendChild(pickerEl);
let pickerMounted = false;

function mountPicker() {
    if (pickerMounted) return;
    const picker = new EmojiMart.Picker({
        theme: 'light',
        onEmojiSelect: (emoji) => {
            const inp = document.getElementById('msg');
            inp.value += emoji.native;
            inp.focus();
            pickerEl.style.display = 'none';
        },
        onClickOutside: () => { pickerEl.style.display = 'none'; }
    });
    pickerEl.appendChild(picker);
    pickerMounted = true;
}

document.getElementById('emojiBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    mountPicker();
    pickerEl.style.display = pickerEl.style.display === 'none' ? 'block' : 'none';
});
document.addEventListener('click', () => { pickerEl.style.display = 'none'; });

// ── Socket Connection ─────────────────────────────────
const SERVER_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://YOUR-APP-NAME.onrender.com'; // 👈 replace with your Render URL

socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
});

socket.on('connect', () => {
    setConnStatus(true);
    socket.emit('joinRoom', { name: currentName, room: currentRoom, isHost: currentIsHost });
    resetAway();
});

socket.on('disconnect', () => setConnStatus(false));
socket.on('reconnect', () => setConnStatus(true));

// Full history on join/refresh
socket.on('chatHistory', ({ messages, reactions }) => {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '';
    msgMap = {};
    lastMsgDate = null;
    messages.forEach(m => appendMessage(m, true));
    Object.entries(reactions).forEach(([msgId, rxns]) => renderReactions(msgId, rxns));
    chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('message', appendMessage);
socket.on('reactions', ({ msgId, reactions }) => renderReactions(msgId, reactions));
socket.on('roomUsers', ({ users, host }) => renderUsers(users, host));

let typingTimeout;
socket.on('typing', (data) => {
    const box = document.getElementById('typing');
    if (data.name !== currentName) {
        box.innerText = `✏️ ${data.name} is typing...`;
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => box.innerText = '', 1500);
    }
});

socket.on('blocked', (msg) => toast('🚫 ' + msg, 3000));

socket.on('kicked', (msg) => {
    toast('👢 ' + msg, 3000);
    sessionStorage.clear();
    setTimeout(() => location.href = 'index.html', 1800);
});
