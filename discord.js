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

/**
 * Renders Discord stats, server invite link, and live members embed.
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
  const statOnlineEl = document.getElementById('discord-stat-online');
  const statMembersEl = document.getElementById('discord-stat-members');

  if (!data || data.code) {
    if (countEl) countEl.textContent = '0';
    if (memberBadgeEl) memberBadgeEl.textContent = '0 online';
    if (memberBadgeFullEl) memberBadgeFullEl.textContent = '0 online';
    if (statOnlineEl) statOnlineEl.textContent = '0';
    if (statMembersEl) statMembersEl.textContent = '0';
    if (membersContainer) {
      membersContainer.innerHTML = `
        <div class="col-span-full p-6 text-center text-slate-400 text-xs">
          Discord Widget is disabled or unreachable. Enable "Server Widget" in Discord Server Settings.
        </div>
      `;
    }
    return;
  }

  const onlineCount = data.presence_count ?? (data.members ? data.members.length : 0);
  const shownMembers = data.members ? data.members.length : 0;

  if (countEl) {
    countEl.textContent = onlineCount;
    countEl.classList.remove('bump');
    void countEl.offsetWidth;
    countEl.classList.add('bump');
  }

  if (memberBadgeEl) memberBadgeEl.textContent = `${onlineCount} online`;
  if (serverNameEl) serverNameEl.textContent = data.name || 'Discord Community';

  if (memberBadgeFullEl) memberBadgeFullEl.textContent = `${onlineCount} online`;
  if (serverNameFullEl) serverNameFullEl.textContent = data.name || 'Discord Community';
  if (statOnlineEl) {
    statOnlineEl.textContent = onlineCount;
    statOnlineEl.classList.remove('bump');
    void statOnlineEl.offsetWidth;
    statOnlineEl.classList.add('bump');
  }
  if (statMembersEl) statMembersEl.textContent = shownMembers;

  if (inviteBtn && data.instant_invite) {
    inviteBtn.href = data.instant_invite;
    inviteBtn.classList.remove('pointer-events-none', 'opacity-50');
  }
  if (inviteBtnFullEl && data.instant_invite) {
    inviteBtnFullEl.href = data.instant_invite;
    inviteBtnFullEl.classList.remove('pointer-events-none', 'opacity-50');
  }

  if (membersContainer) {
    if (!data.members || data.members.length === 0) {
      membersContainer.innerHTML = `
        <div class="col-span-full p-6 text-center text-slate-400 text-xs">
          No online members currently visible in the widget.
        </div>
      `;
      return;
    }

    membersContainer.innerHTML = data.members.map((m) => {
      const statusBg = m.status === 'online' ? 'bg-emerald-400' 
        : m.status === 'idle' ? 'bg-amber-400' 
        : m.status === 'dnd' ? 'bg-red-500' 
        : 'bg-slate-500';

      const activity = m.game && m.game.name ? m.game.name : null;
      const avatarUrl = m.avatar_url || 'favicon.png';

      return `
        <div class="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-indigo-500/40 transition">
          <div class="relative shrink-0">
            <img src="${avatarUrl}" class="w-9 h-9 rounded-full object-cover border border-slate-700/80" alt="${m.username}" onerror="this.src='favicon.png'" />
            <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#030712] ${statusBg}"></span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-bold text-white truncate">${m.username}</div>
            <div class="text-[10px] text-slate-400 truncate">${activity ? `🎮 ${activity}` : m.status}</div>
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