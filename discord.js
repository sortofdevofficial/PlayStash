const GUILD_ID = '1503297362246897694';
const WIDGET_URL = `https://discord.com/api/guilds/${GUILD_ID}/widget.json`;

/**
 * Fetches JSON widget data from the Discord API.
 */
export async function fetchDiscordWidget() {
  try {
    const res = await fetch(WIDGET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Discord widget fetch error:', err.message);
    return null;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const STATUS_ORDER = { online: 0, idle: 1, dnd: 2, offline: 3 };
const STATUS_LABEL = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };
const STATUS_DOT = {
  online: 'bg-emerald-400', idle: 'bg-amber-400', dnd: 'bg-red-500', offline: 'bg-slate-500'
};

// Discord activity "type" codes: 0 Playing, 1 Streaming, 2 Listening, 3 Watching, 4 Custom, 5 Competing
const ACTIVITY_SVG = {
  0: '<svg viewBox="0 0 24 24" class="fill-current w-full h-full"><path d="M17.5 6.5h-11A3.5 3.5 0 0 0 3 10v4a3.5 3.5 0 0 0 3.5 3.5c.75 0 1.47-.28 2.02-.79L11 14.5h2l2.48 2.21c.55.51 1.27.79 2.02.79A3.5 3.5 0 0 0 21 14v-4a3.5 3.5 0 0 0-3.5-3.5ZM8.5 12.75h-1.25V14H6v-1.25H4.75v-1.5H6V10h1.25v1.25H8.5v1.5Zm5.75-2.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm2.5 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
  1: '<svg viewBox="0 0 24 24" class="fill-current w-full h-full"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/></svg>',
  2: '<svg viewBox="0 0 24 24" class="fill-current w-full h-full"><path d="M9 3v10.55A4 4 0 1 0 11 17V7h6V3H9Z"/></svg>',
  3: '<svg viewBox="0 0 24 24" class="fill-current w-full h-full"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-5l2 2.5V20H7v-.5L9 17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v8h14V7H5Z"/></svg>',
  4: '<svg viewBox="0 0 24 24" class="fill-current w-full h-full"><path d="M2 12a10 10 0 1 1 4.5 8.3L2 21l1-4.2A9.96 9.96 0 0 1 2 12Z"/></svg>',
  5: '<svg viewBox="0 0 24 24" class="fill-current w-full h-full"><path d="M7 2h10v2h3a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4 5 5 0 0 1-3.5 3.9V17H16v2h1a1 1 0 0 1 1 1v1H6v-1a1 1 0 0 1 1-1h1v-2h2.5v-2.1A5 5 0 0 1 7 10a4 4 0 0 1-4-4V4a1 1 0 0 1 1-1h3V2ZM5 5v1a2 2 0 0 0 2 2V5H5Zm12 0v3a2 2 0 0 0 2-2V5h-2Z"/></svg>'
};
const ACTIVITY_VERB = { 0: 'Playing', 1: 'Streaming', 2: 'Listening to', 3: 'Watching', 4: '', 5: 'Competing in' };
const ACTIVITY_COLOR = { 0: 'text-emerald-400', 1: 'text-purple-400', 2: 'text-pink-400', 3: 'text-sky-400', 4: 'text-slate-400', 5: 'text-amber-400' };

function describeActivity(m) {
  const act = m.game || m.activity || null;
  if (!act || !act.name) return null;
  const verb = ACTIVITY_VERB[act.type] ?? 'Playing';
  const icon = ACTIVITY_SVG[act.type] ?? ACTIVITY_SVG[0];
  const color = ACTIVITY_COLOR[act.type] ?? 'text-emerald-400';
  const label = verb ? `${verb} ${act.name}` : act.name;
  return { icon, label, color };
}

/**
 * Renders Discord stats, server invite link, voice channels, and live members embed.
 */
export function renderDiscordWidget(data) {
  const countEl = document.getElementById('discord-online-count');
  const serverNameEl = document.getElementById('discord-server-name');
  const inviteBtn = document.getElementById('discord-invite-btn');
  const membersContainer = document.getElementById('discord-members-container');
  const memberBadgeEl = document.getElementById('discord-member-badge');

  // Full Discord tab elements
  const serverNameFullEl = document.getElementById('discord-server-name-full');
  const memberBadgeFullEl = document.getElementById('discord-member-badge-full');
  const inviteBtnFullEl = document.getElementById('discord-invite-btn-full');
  const inviteBtnFloatEl = document.getElementById('discord-float-btn');
  const statOnlineEl = document.getElementById('discord-stat-online');
  const statMembersEl = document.getElementById('discord-stat-members');
  const statVoiceEl = document.getElementById('discord-stat-voice');
  const statPlayingEl = document.getElementById('discord-stat-playing');

  const barOnline = document.getElementById('discord-bar-online');
  const barIdle = document.getElementById('discord-bar-idle');
  const barDnd = document.getElementById('discord-bar-dnd');
  const barOffline = document.getElementById('discord-bar-offline');
  const legendOnline = document.getElementById('discord-legend-online');
  const legendIdle = document.getElementById('discord-legend-idle');
  const legendDnd = document.getElementById('discord-legend-dnd');

  const voiceSection = document.getElementById('discord-voice-section');
  const voiceContainer = document.getElementById('discord-voice-container');

  if (!data || data.code) {
    if (countEl) countEl.textContent = '0';
    if (memberBadgeEl) memberBadgeEl.textContent = '0 online';
    if (memberBadgeFullEl) memberBadgeFullEl.textContent = '0 online';
    if (statOnlineEl) statOnlineEl.textContent = '0';
    if (statMembersEl) statMembersEl.textContent = '0';
    if (statVoiceEl) statVoiceEl.textContent = '0';
    if (statPlayingEl) statPlayingEl.textContent = '0';
    if (voiceSection) voiceSection.classList.add('hidden');
    if (membersContainer) {
      membersContainer.innerHTML = `
        <div class="col-span-full p-6 text-center text-slate-400 text-xs">
          Discord Widget is disabled or unreachable. Enable "Server Widget" in Discord Server Settings.
        </div>
      `;
    }
    return;
  }

  const members = Array.isArray(data.members) ? data.members : [];
  const onlineCount = data.presence_count ?? members.length;
  const shownMembers = members.length;

  // Status breakdown
  const counts = { online: 0, idle: 0, dnd: 0, offline: 0 };
  let voiceCount = 0;
  let playingCount = 0;
  members.forEach((m) => {
    counts[m.status] = (counts[m.status] || 0) + 1;
    if (m.channel_id) voiceCount++;
    if (describeActivity(m)) playingCount++;
  });
  const total = shownMembers || 1;

  if (countEl) {
    countEl.textContent = onlineCount;
    countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
  }
  if (memberBadgeEl) memberBadgeEl.textContent = `${onlineCount} online`;
  if (serverNameEl) serverNameEl.textContent = data.name || 'Discord Community';

  if (memberBadgeFullEl) memberBadgeFullEl.textContent = `${onlineCount} online`;
  if (serverNameFullEl) serverNameFullEl.textContent = data.name || 'Discord Community';
  if (statOnlineEl) {
    statOnlineEl.textContent = onlineCount;
    statOnlineEl.classList.remove('bump'); void statOnlineEl.offsetWidth; statOnlineEl.classList.add('bump');
  }
  if (statMembersEl) statMembersEl.textContent = shownMembers;
  if (statVoiceEl) statVoiceEl.textContent = voiceCount;
  if (statPlayingEl) statPlayingEl.textContent = playingCount;

  if (barOnline) barOnline.style.width = `${(counts.online / total) * 100}%`;
  if (barIdle) barIdle.style.width = `${(counts.idle / total) * 100}%`;
  if (barDnd) barDnd.style.width = `${(counts.dnd / total) * 100}%`;
  if (barOffline) barOffline.style.width = `${(counts.offline / total) * 100}%`;
  if (legendOnline) legendOnline.textContent = `${counts.online} online`;
  if (legendIdle) legendIdle.textContent = `${counts.idle} idle`;
  if (legendDnd) legendDnd.textContent = `${counts.dnd} dnd`;

  if (inviteBtn && data.instant_invite) {
    inviteBtn.href = data.instant_invite;
    inviteBtn.classList.remove('pointer-events-none', 'opacity-50');
  }
  if (inviteBtnFullEl && data.instant_invite) {
    inviteBtnFullEl.href = data.instant_invite;
    inviteBtnFullEl.classList.remove('pointer-events-none', 'opacity-50');
  }
  if (inviteBtnFloatEl && data.instant_invite) {
    inviteBtnFloatEl.href = data.instant_invite;
    inviteBtnFloatEl.classList.remove('pointer-events-none', 'opacity-50');
  }

  // Voice channels: group members by channel_id using data.channels for names
  const channelNameById = {};
  (data.channels || []).forEach((c) => { channelNameById[c.id] = c.name; });

  if (voiceSection && voiceContainer) {
    const voiceGroups = {};
    members.forEach((m) => {
      if (!m.channel_id) return;
      if (!voiceGroups[m.channel_id]) voiceGroups[m.channel_id] = [];
      voiceGroups[m.channel_id].push(m);
    });

    const channelIds = Object.keys(voiceGroups);
    if (channelIds.length === 0) {
      voiceSection.classList.add('hidden');
    } else {
      voiceSection.classList.remove('hidden');
      voiceContainer.innerHTML = channelIds.map((cid) => {
        const name = escapeHtml(channelNameById[cid] || 'Voice Channel');
        const groupMembers = voiceGroups[cid];
        const avatars = groupMembers.slice(0, 6).map((m) => {
          const avatarUrl = m.avatar_url || 'favicon.png';
          return `<img src="${avatarUrl}" class="w-7 h-7 rounded-full object-cover border-2 border-slate-900 -ml-2 first:ml-0" alt="${escapeHtml(m.username)}" title="${escapeHtml(m.username)}" onerror="this.src='favicon.png'" />`;
        }).join('');
        const overflow = groupMembers.length > 6 ? `<span class="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 -ml-2 flex items-center justify-center text-[9px] font-bold text-slate-300">+${groupMembers.length - 6}</span>` : '';

        return `
          <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-violet-500/20">
            <div class="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 fill-violet-300" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16.5 12c0-1.77-1-3.29-2.5-4.03v8.06c1.5-.74 2.5-2.26 2.5-4.03z"/></svg>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-bold text-white truncate">${name}</div>
              <div class="text-[10px] text-slate-400">${groupMembers.length} connected</div>
            </div>
            <div class="flex items-center shrink-0">${avatars}${overflow}</div>
          </div>
        `;
      }).join('');
    }
  }

  if (membersContainer) {
    if (members.length === 0) {
      membersContainer.innerHTML = `
        <div class="col-span-full p-6 text-center text-slate-400 text-xs">
          No online members currently visible in the widget.
        </div>
      `;
      return;
    }

    const sorted = [...members].sort((a, b) => {
      const so = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
      if (so !== 0) return so;
      const aAct = describeActivity(a) ? 0 : 1;
      const bAct = describeActivity(b) ? 0 : 1;
      return aAct - bAct;
    });

    membersContainer.innerHTML = sorted.map((m) => {
      const statusDot = STATUS_DOT[m.status] || 'bg-slate-500';
      const statusLabel = STATUS_LABEL[m.status] || 'Offline';
      const activity = describeActivity(m);
      const avatarUrl = m.avatar_url || 'favicon.png';
      const inVoice = !!m.channel_id;
      const voiceChannelName = inVoice ? escapeHtml(channelNameById[m.channel_id] || 'Voice') : null;
      const username = escapeHtml(m.username);

      const subline = activity
        ? `<span class="inline-flex items-center gap-1 ${activity.color}"><span class="w-3 h-3 shrink-0">${activity.icon}</span><span class="truncate">${escapeHtml(activity.label)}</span></span>`
        : (inVoice
          ? `<span class="inline-flex items-center gap-1 text-violet-300"><svg class="w-3 h-3 shrink-0 fill-current" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/></svg><span class="truncate">In ${voiceChannelName}</span></span>`
          : `<span class="text-slate-400">${statusLabel}</span>`);

      return `
        <div class="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-indigo-500/40 transition">
          <div class="relative shrink-0">
            <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-slate-700/80" alt="${username}" onerror="this.src='favicon.png'" />
            <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#030712] ${statusDot}" title="${statusLabel}"></span>
            ${inVoice ? `<span class="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-violet-500 border-2 border-[#030712] flex items-center justify-center"><svg class="w-2 h-2 fill-white" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/></svg></span>` : ''}
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-bold text-white truncate">${username}</div>
            <div class="text-[10px] truncate mt-0.5">${subline}</div>
          </div>
        </div>
      `;
    }).join('');
  }
}

/**
 * Initializes auto-refreshing Discord widget poll (every 60 seconds).
 */
export function initDiscordWidget() {
  const refresh = async () => {
    const data = await fetchDiscordWidget();
    renderDiscordWidget(data);
  };

  refresh();
  setInterval(refresh, 60000);
}

// ============================================================
// SHARED HELPERS (toasts, icons, sanitising)
// ============================================================

export function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str || '';
  return temp.innerHTML;
}

const TOAST_ICON = {
  success: '<svg class="w-4 h-4 shrink-0" aria-hidden="true"><use href="#ic-check"></use></svg>',
  error: '<svg class="w-4 h-4 shrink-0" aria-hidden="true"><use href="#ic-alert"></use></svg>',
  info: '<svg class="w-4 h-4 shrink-0" aria-hidden="true"><use href="#ic-info"></use></svg>'
};

export function toast(msg, type = 'info', action = null) {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = document.createElement('span');
  icon.className = 'flex items-center';
  icon.innerHTML = TOAST_ICON[type] || TOAST_ICON.info;
  const text = document.createElement('span');
  text.className = 'flex-1';
  text.textContent = msg;
  el.append(icon, text);
  if (action && action.href) {
    const link = document.createElement('a');
    link.href = action.href;
    link.textContent = action.label || 'Open';
    link.className = 'shrink-0 px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-black uppercase tracking-wider transition';
    el.appendChild(link);
  }
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, action ? 9000 : 3500);
}

// Icons are <use> references into the low-poly sprite in index.html — the same
// sheet WorldForge's HUD uses, so a wood log looks identical on either page.
export const ICON_IDS = {
  wood: 'ic-wood',
  water: 'ic-water',
  wheat: 'ic-food',
  food: 'ic-food',
  stone: 'ic-stone',
  gold: 'ic-gold',
  iron: 'ic-iron',
  meat: 'ic-meat',
  fish: 'ic-fish',
  box: 'ic-cap',
  house: 'ic-pop',
  person: 'ic-folk',
  medal: 'ic-medal-gold',
  chat: 'ic-chat',
  sound: 'ic-sound',
  clock: 'ic-clock',
  alert: 'ic-alert',
  info: 'ic-info',
  ping: 'ic-ping',
  eye: 'ic-eye',
  gamepad: 'ic-gamepad',
  globe: 'ic-globe'
};

export function iconSpan(key, extraClass = '') {
  const id = ICON_IDS[key] || ICON_IDS.box;
  return `<span class="inline-flex items-center justify-center shrink-0 ${extraClass}"><svg class="w-full h-full" aria-hidden="true"><use href="#${id}"></use></svg></span>`;
}

// Empty states read as broken panels when they are bare text in an otherwise
// iconned layout. col-span-full is inert outside a grid, so this serves both.
export const emptyNote = (text, iconKey = 'info') =>
  `<div class="col-span-full p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">${iconSpan(iconKey, 'w-5 h-5 opacity-70')}<span>${text}</span></div>`;

export function formatDateDetailed(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function safeAvatarUrl(url) {
  if (typeof url !== 'string' || !url) return 'favicon.png';
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : 'favicon.png';
  } catch {
    return 'favicon.png';
  }
}

// ============================================================
// COMMUNITY + MODERATION PANELS (live data from the bot HTTP APIs)
// ============================================================

export const BOT_API_BASE = 'https://72wkgkq29b.apps.bot-hosting.cloud';
export const BOT_API_KEY = 'sortofdev'; // Public-safe: this key is read-only on the bot's /api endpoints.

let communityLoaded = false;

function escapeHtmlJs(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDuration(sec) {
  sec = Number(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtUptime(ms) {
  const sec = Math.floor(Number(ms || 0) / 1000);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function communityAvatarImg(user, size = 'w-8 h-8') {
  const src = user.avatar || 'favicon.png';
  const name = escapeHtmlJs(user.username || 'User');
  return `<img src="${src}" class="${size} rounded-full object-cover border border-slate-700/80 shrink-0" alt="${name}" onerror="this.src='favicon.png'" />`;
}

function renderGiveawayCard(g) {
  const isDone = g.done;
  const timeLabel = isDone
    ? `Ended ${g.endedAt ? new Date(g.endedAt).toLocaleDateString() : ''}`
    : `Ends ${new Date(g.endsAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const winnersLine = isDone
    ? (g.winners && g.winners.length
        ? `<div class="flex items-center gap-1.5 flex-wrap mt-2">${g.winners.map((w) => `<span class="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full pl-1 pr-2 py-0.5 text-[10px] text-emerald-300 font-bold">${communityAvatarImg(w, 'w-4 h-4')}${escapeHtmlJs(w.username)}</span>`).join('')}</div>`
        : `<div class="text-[10px] text-slate-500 mt-2">No valid entries</div>`)
    : '';

  return `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 hover:border-amber-500/30 transition">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-black text-white truncate">${escapeHtmlJs(g.prize)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">#${g.gwId} · Hosted by ${escapeHtmlJs(g.host?.username || 'Unknown')}</div>
        </div>
        <span class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${isDone ? 'bg-slate-700/50 text-slate-400' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}">${isDone ? 'Ended' : 'Live'}</span>
      </div>
      <div class="flex items-center gap-3 mt-3 text-[10px] text-slate-400">
        <span class="flex items-center gap-1">${iconSpan('person', 'w-3 h-3')}<span>${g.entries} entered</span></span>
        <span class="flex items-center gap-1">${iconSpan('medal', 'w-3 h-3')}<span>${g.winnersCount} winner${g.winnersCount === 1 ? '' : 's'}</span></span>
        <span>${timeLabel}</span>
      </div>
      ${winnersLine}
    </div>
  `;
}

function renderLeaderboardRow({ rank, user, right, sub }) {
  const MEDALS = ['ic-medal-gold', 'ic-medal-silver', 'ic-medal-bronze'];
  const medal = rank >= 1 && rank <= 3
    ? `<svg class="w-5 h-5 inline-block align-middle" aria-hidden="true"><use href="#${MEDALS[rank - 1]}"></use></svg>`
    : `#${rank}`;
  return `
    <div class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90">
      <span class="w-7 text-center text-xs font-black text-slate-400 shrink-0">${medal}</span>
      ${communityAvatarImg(user)}
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-white truncate">${escapeHtmlJs(user.username)}</div>
        ${sub ? `<div class="text-[10px] text-slate-500 truncate">${sub}</div>` : ''}
      </div>
      <span class="shrink-0 text-xs font-black text-sky-400 font-mono">${right}</span>
    </div>
  `;
}

export async function loadCommunityData() {
  if (communityLoaded) return;
  communityLoaded = true;

  const offlineEl = document.getElementById('community-offline');
  const statPing = document.getElementById('community-stat-ping');
  const statMembers = document.getElementById('community-stat-members');
  const statGiveaways = document.getElementById('community-stat-giveaways');
  const statUptime = document.getElementById('community-stat-uptime');
  const activeGwEl = document.getElementById('community-active-giveaways');
  const recentGwEl = document.getElementById('community-recent-giveaways');
  const msgLbEl = document.getElementById('community-msg-leaderboard');
  const voiceLbEl = document.getElementById('community-voice-leaderboard');
  const inviteLbEl = document.getElementById('community-invite-leaderboard');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BOT_API_BASE}/api/community`, {
      headers: { Authorization: `Bearer ${BOT_API_KEY}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    offlineEl?.classList.add('hidden');

    if (statPing) statPing.textContent = `${data.stats?.ping ?? '–'}ms`;
    if (statMembers) statMembers.textContent = data.stats?.members ?? '–';
    if (statGiveaways) statGiveaways.textContent = data.giveaways?.active?.length ?? 0;
    if (statUptime) statUptime.textContent = fmtUptime(data.stats?.uptime);

    const active = data.giveaways?.active || [];
    if (activeGwEl) {
      activeGwEl.innerHTML = active.length
        ? active.map(renderGiveawayCard).join('')
        : emptyNote('No giveaways running right now.', 'box');
    }

    const recent = data.giveaways?.recent || [];
    if (recentGwEl) {
      recentGwEl.innerHTML = recent.length
        ? recent.map(renderGiveawayCard).join('')
        : emptyNote('No past giveaways yet.', 'clock');
    }

    const messages = data.leaderboard?.messages || [];
    if (msgLbEl) {
      msgLbEl.innerHTML = messages.length
        ? messages.map((m) => renderLeaderboardRow({ rank: m.rank, user: m.user, right: `Lv.${m.level}`, sub: `${m.messages.toLocaleString()} messages` })).join('')
        : emptyNote('No message activity yet.', 'chat');
    }

    const voice = data.leaderboard?.voice || [];
    if (voiceLbEl) {
      voiceLbEl.innerHTML = voice.length
        ? voice.map((v) => renderLeaderboardRow({ rank: v.rank, user: v.user, right: fmtDuration(v.seconds) })).join('')
        : emptyNote('No voice activity yet.', 'sound');
    }

    const invites = data.invites || [];
    if (inviteLbEl) {
      inviteLbEl.innerHTML = invites.length
        ? invites.map((v) => renderLeaderboardRow({ rank: v.rank, user: v.user, right: v.total, sub: `${v.regular} joined · ${v.left} left · ${v.fake} fake` })).join('')
        : emptyNote('No invite activity yet.', 'person');
    }
  } catch (err) {
    console.warn('Community API fetch failed:', err.message);
    offlineEl?.classList.remove('hidden');
    [activeGwEl, recentGwEl].forEach((el) => { if (el) el.innerHTML = emptyNote('Unavailable', 'alert'); });
    [msgLbEl, voiceLbEl, inviteLbEl].forEach((el) => { if (el) el.innerHTML = emptyNote('Unavailable', 'alert'); });
    communityLoaded = false; // allow a later manual retry
  }
}

// ============================================================
// MODERATION — live tickets & warns from the moderation bot's API
// ============================================================

const MOD_API_BASE = 'https://1gkm2xh7wx.apps.bot-hosting.cloud';
const MOD_API_KEY = 'sortofdev'; // Public-safe: read-only on the mod bot's /api endpoints.

let moderationLoaded = false;

function renderTicketCard(t, isClosed) {
  const statusLabel = isClosed ? 'Closed' : (t.status === 'claimed' ? 'Claimed' : 'Open');
  const statusClass = isClosed ? 'bg-slate-700/50 text-slate-400' : (t.status === 'claimed' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-sky-500/15 text-sky-300 border border-sky-500/30');
  const timeLabel = isClosed
    ? `Closed ${new Date(t.closedAt).toLocaleDateString()}`
    : `Opened ${new Date(t.createdAt).toLocaleDateString()}`;

  return `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 hover:border-sky-500/30 transition">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-black text-white truncate">#${t.ticketId} · ${escapeHtmlJs(t.categoryLabel)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Opened by ${escapeHtmlJs(t.opener.username)}</div>
        </div>
        <span class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${statusClass}">${statusLabel}</span>
      </div>
      ${t.reason ? `<div class="text-[10px] text-slate-500 mt-2 truncate">${escapeHtmlJs(t.reason)}</div>` : ''}
      <div class="flex items-center gap-3 mt-3 text-[10px] text-slate-400 flex-wrap">
        ${t.claimedBy ? `<span class="flex items-center gap-1">${iconSpan('person', 'w-3 h-3')}<span>Claimed by ${escapeHtmlJs(t.claimedBy.username)}</span></span>` : ''}
        ${isClosed && t.closedBy ? `<span class="flex items-center gap-1">${iconSpan('person', 'w-3 h-3')}<span>Closed by ${escapeHtmlJs(t.closedBy.username)}</span></span>` : ''}
        <span class="flex items-center gap-1">${iconSpan('chat', 'w-3 h-3')}<span>${t.messageCount} messages</span></span>
        <span>${timeLabel}</span>
      </div>
      ${isClosed && t.closeReason ? `<div class="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-800/70 truncate">Close reason: ${escapeHtmlJs(t.closeReason)}</div>` : ''}
    </div>
  `;
}

function renderWarnRow(w) {
  const ts = new Date(w.at).toLocaleDateString();
  return `
    <div class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90">
      ${communityAvatarImg(w.user)}
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-white truncate">${escapeHtmlJs(w.user.username)} <span class="text-slate-500 font-normal">#${w.id}</span></div>
        <div class="text-[10px] text-slate-500 truncate">${escapeHtmlJs(w.reason)} · by ${escapeHtmlJs(w.moderator.username)} · ${ts}</div>
      </div>
      <span class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${w.active ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-slate-700/50 text-slate-400'}">${w.active ? 'Active' : 'Removed'}</span>
    </div>
  `;
}

export async function loadModerationData() {
  if (moderationLoaded) return;
  moderationLoaded = true;

  const offlineEl = document.getElementById('moderation-offline');
  const statOpen = document.getElementById('moderation-stat-open');
  const statClosed = document.getElementById('moderation-stat-closed');
  const statWarns = document.getElementById('moderation-stat-warns');
  const statPing = document.getElementById('moderation-stat-ping');
  const openEl = document.getElementById('moderation-open-tickets');
  const closedEl = document.getElementById('moderation-closed-tickets');
  const warnsEl = document.getElementById('moderation-warns');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${MOD_API_BASE}/api/moderation`, {
      headers: { Authorization: `Bearer ${MOD_API_KEY}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    offlineEl?.classList.add('hidden');

    if (statOpen) statOpen.textContent = data.stats?.openTicketCount ?? 0;
    if (statClosed) statClosed.textContent = data.tickets?.closed?.length ?? 0;
    if (statWarns) statWarns.textContent = data.stats?.activeWarnCount ?? 0;
    if (statPing) statPing.textContent = `${data.stats?.ping ?? '–'}ms`;

    const open = data.tickets?.open || [];
    if (openEl) {
      openEl.innerHTML = open.length
        ? open.map((t) => renderTicketCard(t, false)).join('')
        : emptyNote('No open tickets right now.', 'chat');
    }

    const closed = data.tickets?.closed || [];
    if (closedEl) {
      closedEl.innerHTML = closed.length
        ? closed.map((t) => renderTicketCard(t, true)).join('')
        : emptyNote('No closed tickets yet.', 'clock');
    }

    const warnList = data.warns || [];
    if (warnsEl) {
      warnsEl.innerHTML = warnList.length
        ? warnList.map(renderWarnRow).join('')
        : emptyNote('No warns on record.', 'alert');
    }
  } catch (err) {
    console.warn('Moderation API fetch failed:', err.message);
    offlineEl?.classList.remove('hidden');
    [openEl, closedEl].forEach((el) => { if (el) el.innerHTML = emptyNote('Unavailable', 'alert'); });
    if (warnsEl) warnsEl.innerHTML = emptyNote('Unavailable', 'alert');
    moderationLoaded = false;
  }
}