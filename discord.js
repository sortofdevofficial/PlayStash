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