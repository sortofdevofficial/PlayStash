// Website <-> Discord live chat client.
// Polls the bot (GET /api/chat/messages) and posts with a Firebase ID token (POST /api/chat/send).
import { BOT_API_BASE, BOT_API_KEY, sanitizeHTML, safeAvatarUrl } from './discord.js';

const NICK_KEY = 'ps_chat_nick';
const FAST_MS = 2500, IDLE_MS = 15000, MAX_DOM = 150;
const CDN_OK = /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//;

export function initChat({ auth, toast, section, loginBtn }) {
  if (!section) return;
  const $ = (id) => document.getElementById(id);
  const log = $('chat-log'), form = $('chat-form'), input = $('chat-input'), send = $('chat-send');
  const count = $('chat-count'), status = $('chat-status'), jump = $('chat-jump'), who = $('chat-who');
  const nickBox = $('chat-nick'), nickInput = $('chat-nick-input');

  const rendered = new Map(); // id -> element
  const mine = new Set();     // ids this browser sent
  let seq = 0, timer = null, inflight = false, failures = 0, sending = false;

  const getNick = () => { try { return localStorage.getItem(NICK_KEY) || ''; } catch { return ''; } };
  const isGuest = () => !auth.currentUser || auth.currentUser.isAnonymous;
  const needsNick = () => isGuest() && getNick().length < 2;
  const visible = () => !section.classList.contains('hidden') && !document.hidden;

  function setStatus(state, text) {
    status.dataset.state = state;
    status.lastElementChild.textContent = text;
  }

  function refreshComposer() {
    const gate = needsNick();
    nickBox.classList.toggle('hidden', !gate);
    form.classList.toggle('chat-disabled', gate);
    input.disabled = gate; send.disabled = gate;
    const name = isGuest() ? getNick() : (auth.currentUser?.displayName || 'Player');
    who.textContent = gate ? '' : `Chatting as ${name}${isGuest() ? ' (guest)' : ''} · appears on Discord as “${name} • Web”`;
  }

  // ---- rendering ----
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function linkify(text) {
    return sanitizeHTML(text).replace(/https?:\/\/[^\s<]+/g, (u) => {
      const clean = u.replace(/[.,!?)]+$/, ''), tail = u.slice(clean.length);
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer nofollow">${clean}</a>${tail}`;
    });
  }

  function buildMsg(m) {
    const el = document.createElement('article');
    el.className = `chat-msg${mine.has(m.id) ? ' is-mine' : ''}`;
    el.dataset.id = m.id;
    const img = document.createElement('img');
    img.className = 'chat-avatar'; img.alt = ''; img.loading = 'lazy';
    img.src = safeAvatarUrl(m.avatar); img.onerror = () => { img.onerror = null; img.src = 'favicon.png'; };
    const body = document.createElement('div');
    body.className = 'chat-bubble';
    const badge = m.src === 'discord'
      ? `<span class="chat-badge discord">${m.staff ? 'Staff' : 'Discord'}</span>`
      : '<span class="chat-badge web">Web</span>';
    const imgs = (m.images || []).filter((u) => CDN_OK.test(u))
      .map((u) => `<a href="${u}" target="_blank" rel="noopener noreferrer"><img class="chat-attach" src="${u}" loading="lazy" alt="Attachment" /></a>`).join('');
    body.innerHTML = `<div class="chat-meta"><strong>${sanitizeHTML(m.name)}</strong>${badge}<time>${fmtTime(m.at)}</time>${m.edited ? '<em>(edited)</em>' : ''}</div>`
      + (m.content ? `<div class="chat-text">${linkify(m.content)}</div>` : '') + imgs;
    el.append(img, body);
    return el;
  }

  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 90;
  const toBottom = (smooth) => log.scrollTo({ top: log.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  function apply(events, reset) {
    const stick = reset || nearBottom();
    if (reset) { log.replaceChildren(); rendered.clear(); }
    let added = 0;
    for (const ev of events) {
      const m = ev.msg;
      if (ev.type === 'add') {
        if (rendered.has(m.id)) continue;
        const el = buildMsg(m); rendered.set(m.id, el); log.appendChild(el); added++;
      } else if (ev.type === 'edit') {
        const old = rendered.get(m.id);
        if (old) { const el = buildMsg(m); old.replaceWith(el); rendered.set(m.id, el); }
      } else if (ev.type === 'del') {
        rendered.get(m.id)?.remove(); rendered.delete(m.id);
      }
    }
    while (log.children.length > MAX_DOM) { const first = log.firstElementChild; rendered.delete(first.dataset.id); first.remove(); }
    if (!log.children.length) log.innerHTML = '<div class="chat-empty">No messages yet — say hi 👋</div>';
    else log.querySelector('.chat-empty')?.remove();
    if (stick) { toBottom(!reset); jump.classList.add('hidden'); }
    else if (added) jump.classList.remove('hidden');
  }

  // ---- polling ----
  async function poll() {
    if (inflight) return;
    inflight = true;
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(`${BOT_API_BASE}/api/chat/messages?after=${seq}`, { headers: { Authorization: `Bearer ${BOT_API_KEY}` }, signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.reset || data.events.length) apply(data.events, data.reset);
      seq = data.seq; failures = 0;
      setStatus('live', 'Live');
    } catch (err) {
      failures++;
      setStatus('offline', failures > 1 ? 'Offline — retrying' : 'Reconnecting');
    } finally { inflight = false; }
  }

  function schedule() {
    clearTimeout(timer);
    const delay = !visible() ? IDLE_MS : Math.min(FAST_MS * (1 + failures), 20000);
    timer = setTimeout(async () => { if (visible() || !rendered.size) await poll(); schedule(); }, delay);
  }

  // ---- sending ----
  async function submit(e) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sending || needsNick()) return;
    sending = true; send.disabled = true;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Still connecting — try again in a moment.');
      const idToken = await user.getIdToken();
      const res = await fetch(`${BOT_API_BASE}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BOT_API_KEY}` },
        body: JSON.stringify({ idToken, name: isGuest() ? getNick() : user.displayName, message: text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Send failed (${res.status})`);
      mine.add(data.message.id);
      input.value = ''; count.textContent = '0/300';
      apply([{ type: 'add', msg: data.message }], false);
      toBottom(true);
    } catch (err) {
      toast(err.name === 'TypeError' ? 'Chat server unreachable.' : err.message, 'error');
    } finally { sending = false; send.disabled = needsNick(); input.focus(); }
  }

  // ---- wiring ----
  form.addEventListener('submit', submit);
  input.addEventListener('input', () => { count.textContent = `${input.value.length}/300`; });
  log.addEventListener('scroll', () => { if (nearBottom()) jump.classList.add('hidden'); }, { passive: true });
  jump.addEventListener('click', () => { toBottom(true); jump.classList.add('hidden'); });

  const saveNick = () => {
    const v = nickInput.value.normalize('NFKC').replace(/[^\p{L}\p{N} ._'\-]/gu, '').trim().slice(0, 20);
    if (v.length < 2) return toast('Nickname must be 2–20 letters or numbers.', 'error');
    try { localStorage.setItem(NICK_KEY, v); } catch {}
    refreshComposer(); input.focus();
  };
  $('chat-nick-save').addEventListener('click', saveNick);
  nickInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveNick(); } });
  $('chat-nick-google').addEventListener('click', () => loginBtn?.click());

  auth.onAuthStateChanged(refreshComposer);
  document.addEventListener('visibilitychange', () => { if (visible()) { poll(); schedule(); } });
  new MutationObserver(() => { if (visible()) { poll(); schedule(); } }).observe(section, { attributes: true, attributeFilter: ['class'] });

  refreshComposer();
  setStatus('connecting', 'Connecting');
  poll().then(schedule);
}