import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { presenceWho } from "./presence.js";

const resourceMap = {
  wo: { name: 'Wood', icon: '🪵' }, wood: { name: 'Wood', icon: '🪵' },
  wa: { name: 'Water', icon: '💧' }, water: { name: 'Water', icon: '💧' },
  w: { name: 'Wheat', icon: '🌾' }, wheat: { name: 'Wheat', icon: '🌾' },
  s: { name: 'Stone', icon: '🪨' }, stone: { name: 'Stone', icon: '🪨' },
  f: { name: 'Food', icon: '🍲' }, food: { name: 'Food', icon: '🍲' },
  g: { name: 'Gold', icon: '🪙' }, gold: { name: 'Gold', icon: '🪙' },
  i: { name: 'Iron', icon: '⚙️' }, iron: { name: 'Iron', icon: '⚙️' },
  m: { name: 'Meat', icon: '🥩' }, meat: { name: 'Meat', icon: '🥩' },
  fi: { name: 'Fish', icon: '🐟' }, fish: { name: 'Fish', icon: '🐟' }
};

export function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str || '';
  return temp.innerHTML;
}

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

export function renderDetailedResources(resourceObj, containerElement) {
  if (!containerElement) return;
  containerElement.innerHTML = '';

  const mappedResources = {};

  if (resourceObj && typeof resourceObj === 'object') {
    Object.entries(resourceObj).forEach(([key, val]) => {
      const lowerKey = key.toLowerCase();
      const meta = resourceMap[lowerKey] || { name: key.toUpperCase(), icon: '📦' };
      
      if (!mappedResources[meta.name]) {
        mappedResources[meta.name] = { amount: 0, icon: meta.icon };
      }
      mappedResources[meta.name].amount += Number(val || 0);
    });
  }

  const entries = Object.entries(mappedResources);
  if (entries.length === 0) {
    containerElement.innerHTML = '<span class="text-xs text-slate-400">No resources collected yet</span>';
    return;
  }

  entries.forEach(([name, data]) => {
    const itemCard = document.createElement('div');
    itemCard.className = 'bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs';
    itemCard.innerHTML = `
      <span class="text-slate-300 font-bold flex items-center gap-2">
        <span>${data.icon}</span>
        <span>${sanitizeHTML(name)}</span>
      </span>
      <span class="font-black text-sky-400 font-mono">${Number(data.amount)}</span>
    `;
    containerElement.appendChild(itemCard);
  });
}

export async function openUserModal(user, uid, rawGamesData, db) {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) return;

  const modalAvatar = document.getElementById('modal-avatar');
  const modalName = document.getElementById('modal-name');
  const modalEmail = document.getElementById('modal-email');
  const modalJoinedPs = document.getElementById('modal-joined-ps');
  const modalJoinedWf = document.getElementById('modal-joined-wf');
  const modalBuildings = document.getElementById('modal-buildings');
  const modalNpcs = document.getElementById('modal-npcs');
  const modalResources = document.getElementById('modal-resources');
  const modalResourcesList = document.getElementById('modal-resources-list');

  const gameSave = rawGamesData[uid] || {};
  const bCount = gameSave.b ? Object.keys(gameSave.b).length : 0;
  const nCount = gameSave.n ? Object.keys(gameSave.n).length : 0;
  const rSum = gameSave.r ? Object.values(gameSave.r).reduce((a, b) => a + Number(b || 0), 0) : 0;

  if (modalAvatar) modalAvatar.src = safeAvatarUrl(user.pe);
  if (modalName) modalName.textContent = user.dn || 'Player';
  if (modalEmail) modalEmail.textContent = user.e ? user.e.replace(/(?<=.{2}).(?=.*@)/g, "*") : 'PlayStash Member';

  const playstashJoined = formatDateDetailed(user.jt);
  let worldforgeJoined = 'Not played yet';

  if (gameSave.i && gameSave.i.jt) {
    worldforgeJoined = formatDateDetailed(gameSave.i.jt);
  } else {
    try {
      const snap = await get(ref(db, `G/1/${uid}/i/jt`));
      if (snap.exists()) worldforgeJoined = formatDateDetailed(snap.val());
    } catch(e) {}
  }

  if (modalJoinedPs) modalJoinedPs.textContent = `Joined PlayStash: ${playstashJoined}`;
  if (modalJoinedWf) modalJoinedWf.textContent = `Joined WorldForge: ${worldforgeJoined}`;

  if (modalBuildings) modalBuildings.textContent = bCount;
  if (modalNpcs) modalNpcs.textContent = nCount;
  if (modalResources) modalResources.textContent = rSum;

  renderDetailedResources(gameSave.r, modalResourcesList);
  profileModal.classList.remove('hidden');
}

let directoryAnimated = false;

export function renderDirectory(rawUsersData, rawGamesData, auth, db) {
  const usersContainer = document.getElementById('users-container');
  const userCountEl = document.getElementById('user-count');
  const playerResultCountEl = document.getElementById('player-result-count');
  const playerSearchEl = document.getElementById('player-search');
  const playerSortEl = document.getElementById('player-sort');

  if (!usersContainer) return;

  const all = Object.entries(rawUsersData || {})
    .filter(([uid, u]) => u && u.i)
    .map(([uid, u]) => {
      const save = rawGamesData[uid] || {};
      return {
        uid, ...u.i,
        _b: save.b ? Object.keys(save.b).length : 0,
        _n: save.n ? Object.keys(save.n).length : 0,
        _online: presenceWho.get(uid) || null
      };
    });

  if (userCountEl) userCountEl.textContent = all.length;

  if (all.length === 0) {
    if (playerResultCountEl) playerResultCountEl.textContent = '0';
    usersContainer.replaceChildren(emptyMessage('Sign in to view registered players.', !auth.currentUser || auth.currentUser.isAnonymous));
    return;
  }

  const query = playerSearchEl ? playerSearchEl.value : '';
  const filtered = filterPlayers(all, query);
  const list = sortPlayers(filtered, playerSortEl ? playerSortEl.value : 'online');
  if (playerResultCountEl) playerResultCountEl.textContent = list.length;

  if (list.length === 0) {
    usersContainer.replaceChildren(emptyMessage(`No players match "${query.trim()}".`, false));
    return;
  }

  const animate = !directoryAnimated;
  directoryAnimated = true;

  usersContainer.replaceChildren(...list.map((u) => {
    const gameSave = rawGamesData[u.uid] || {};
    const res = gameSave.r || {};

    const wood = Number(res.wo || res.wood || 0);
    const water = Number(res.wa || res.water || 0);
    const wheat = Number(res.w || res.wheat || 0);
    const stone = Number(res.s || res.stone || 0);

    const wfJoinedDate = gameSave.i && gameSave.i.jt ? formatDateDetailed(gameSave.i.jt) : 'Not played yet';

    const card = document.createElement('div');
    card.className = 'card-box rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:-translate-y-0.5' + (animate ? ' fade-in' : '');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View ${u.dn || 'Player'}`);
    card.addEventListener('click', () => openUserModal(u, u.uid, rawGamesData, db));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUserModal(u, u.uid, rawGamesData, db); }
    });

    const top = document.createElement('div');
    top.className = 'flex items-center gap-3.5 min-w-0';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'relative shrink-0';
    const img = document.createElement('img');
    img.src = safeAvatarUrl(u.pe);
    img.className = 'w-12 h-12 rounded-full border object-cover shadow-md ' + (u._online ? 'border-emerald-400/70' : 'border-sky-400/40');
    img.alt = '';
    avatarWrap.appendChild(img);
    const dot = document.createElement('span');
    dot.className = 'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0b1220] ' + (u._online ? 'bg-emerald-400 dot-online' : 'bg-slate-600');
    avatarWrap.appendChild(dot);

    const details = document.createElement('div');
    details.className = 'flex flex-col min-w-0';

    const name = document.createElement('span');
    name.className = 'font-bold text-sm text-white truncate';
    name.textContent = u.dn || 'Player';

    const status = document.createElement('span');
    status.className = 'text-[10px] font-extrabold uppercase tracking-wider mt-0.5 ' + (u._online ? 'text-emerald-400' : 'text-slate-500');
    status.textContent = u._online ? (u._online === 'worldforge' ? 'Online · WorldForge' : 'Online · Hub') : 'Offline';

    const psJoined = document.createElement('span');
    psJoined.className = 'text-[10px] text-sky-400/90 font-medium truncate mt-0.5';
    psJoined.textContent = `Joined PlayStash: ${formatDateDetailed(u.jt)}`;

    const wfJoined = document.createElement('span');
    wfJoined.className = 'text-[10px] text-emerald-400/90 font-medium truncate';
    wfJoined.textContent = `Joined WorldForge: ${wfJoinedDate}`;

    details.append(name, status, psJoined, wfJoined);
    top.append(avatarWrap, details);

    const chips = document.createElement('div');
    chips.className = 'flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-slate-300 font-mono';
    const chipData = [`🧱 ${u._b}`, `👤 ${u._n}`, `🪵 ${wood}`, `💧 ${water}`, `🌾 ${wheat}`, `🪨 ${stone}`];
    chipData.forEach((t) => {
      const c = document.createElement('span');
      c.className = 'bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800';
      c.textContent = t;
      chips.appendChild(c);
    });

    card.append(top, chips);
    return card;
  }));
}

function filterPlayers(list, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((p) => String(p.dn || 'Player').toLowerCase().includes(q));
}

function sortPlayers(list, mode) {
  const byNewest = (a, b) => (b.jt || 0) - (a.jt || 0);
  const cmp = {
    online: (a, b) => (Number(!!b._online) - Number(!!a._online)) || byNewest(a, b),
    newest: byNewest,
    buildings: (a, b) => (b._b - a._b) || byNewest(a, b),
    villagers: (a, b) => (b._n - a._n) || byNewest(a, b),
    name: (a, b) => String(a.dn || '').localeCompare(String(b.dn || ''), undefined, { sensitivity: 'base' })
  }[mode] || byNewest;
  return [...list].sort(cmp);
}

function emptyMessage(text, withSignIn) {
  const box = document.createElement('div');
  box.className = 'col-span-full glass-box rounded-2xl p-8 text-center text-slate-400 text-xs font-medium flex flex-col items-center gap-4';
  const p = document.createElement('span');
  p.textContent = text;
  box.appendChild(p);
  if (withSignIn) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-main text-white font-black px-6 py-3 rounded-full text-xs uppercase tracking-wider active:scale-95';
    btn.textContent = 'Sign in with Google';
    btn.addEventListener('click', () => document.getElementById('login-btn')?.click());
    box.appendChild(btn);
  }
  return box;
}