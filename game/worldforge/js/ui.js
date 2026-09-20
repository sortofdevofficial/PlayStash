export const RESOURCE_BASE_CAP = 200;
export const STORAGE_CAP_BONUS = 150;

// Mapping technical keys to friendly names for UI notifications
export const RESOURCE_NAMES = {
  wh: "Wood",
  stone: "Stone",
  food: "Food",
  water: "Water"
};

// Export the state object
export const state = {
  mode: "none",
  buildType: null,
  buildRotation: 0,
  isNight: false,
  isSpectating: false,
  resources: { wh: 100, stone: 80, food: 30, water: 20 },
  BUILD_COSTS: {
    hut: { wh: 20, stone: 10, food: 0, water: 0 },
    campfire: { wh: 10, stone: 10, food: 0, water: 0 },
    farm: { wh: 15, stone: 5, food: 0, water: 5 },
    tower: { wh: 30, stone: 25, food: 10, water: 0 },
    well: { wh: 15, stone: 15, food: 0, water: 0 },
    storage: { wh: 25, stone: 10, food: 0, water: 0 },
    market: { wh: 20, stone: 20, food: 0, water: 0 }
  }
};

/**
 * Calculate the resource cap based on placed objects.
 * Includes bonus capacity from storage objects.
 */
export function getResourceCap(placedObjects) {
  let storageCount = 0;
  if (placedObjects) {
    placedObjects.forEach((o) => {
      if (o.type === "storage") storageCount++;
    });
  }
  return RESOURCE_BASE_CAP + storageCount * STORAGE_CAP_BONUS;
}

/**
 * Add a clamped amount of a resource to the state.
 * Ensures the value never goes below 0 or above the cap.
 */
export function addResourceClamped(key, amount, placedObjects) {
  if (!(key in state.resources)) return 0;
  const cap = getResourceCap(placedObjects);
  const before = state.resources[key] || 0;
  const newAmount = Math.max(0, Math.min(cap, before + amount));
  state.resources[key] = newAmount;
  return state.resources[key] - before;
}

function setResourceText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove("value-pop");
  void el.offsetWidth;
  el.classList.add("value-pop");
}

/**
 * Update the resource counters in the UI.
 */
export function updateResourceUI(activeNPCsLength, maxCap, placedObjects) {
  const cap = getResourceCap(placedObjects);
  setResourceText("whCount", `${state.resources.wh}/${cap}`);
  setResourceText("stoneCount", `${state.resources.stone}/${cap}`);
  setResourceText("foodCount", `${state.resources.food}/${cap}`);
  setResourceText("waterCount", `${state.resources.water}/${cap}`);
  if (document.getElementById("storageCap")) {
    document.getElementById("storageCap").textContent = cap;
  }
  if (document.getElementById("popCount")) {
    document.getElementById("popCount").textContent = `${activeNPCsLength}/${maxCap}`;
  }
}

/**
 * Show a notification in the notifContainer.
 * Gracefully handles missing container.
 */
export function showNotif(msg, type = "success", duration = 1600) {
  const container = document.getElementById("notifContainer");
  if (!container) {
    console.warn("Notification container not found.");
    return;
  }
  while (container.children.length >= 2) {
    container.removeChild(container.firstChild);
  }

  const notif = document.createElement("div");
  notif.className = "mobile-notif";
  const badge = document.createElement("div");
  badge.className = `notif-badge ${type === "warn" ? "warn" : type === "info" ? "info" : ""}`;
  const text = document.createElement("span");
  text.textContent = msg;
  notif.append(badge, text);

  container.appendChild(notif);
  requestAnimationFrame(() => {
    notif.classList.add("show");
    if (type === "warn") notif.classList.add("warn-shake");
  });
  setTimeout(() => notif.remove(), duration);
}

/**
 * Display floating text at a world position.
 * Requires BABYLON to be available.
 */
export function showFloatingText(text, worldPos, color = "#81C784", scene, camera, engine) {
  if (!window.BABYLON) {
    console.error("BABYLON library not loaded.");
    return;
  }

  if (!worldPos || !scene || !camera || !engine) return;

  const projected = window.BABYLON.Vector3.Project(
    worldPos,
    window.BABYLON.Matrix.Identity(),
    scene.getTransformMatrix(),
    camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
  );

  const popup = document.createElement("div");
  popup.textContent = text;
  popup.style.cssText = `
    position: absolute; left: ${projected.x}px; top: ${projected.y}px;
    color: ${color}; font-weight: bold; font-size: 15px; font-family: sans-serif;
    pointer-events: none; transition: transform 0.8s ease-out, opacity 0.8s ease-out;
    transform: translate(-50%, -100%); z-index: 1000; text-shadow: 0px 2px 4px rgba(0,0,0,0.8);
  `;
  document.body.appendChild(popup);

  requestAnimationFrame(() => {
    popup.style.transform = "translate(-50%, -180%)";
    popup.style.opacity = "0";
  });
  setTimeout(() => popup.remove(), 800);
}

/**
 * Highlight card elements based on the current building mode.
 */
export function updateCardHighlights() {
  ["hut", "campfire", "farm", "tower", "well", "storage", "market"].forEach((type) => {
    const el = document.getElementById(`card${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (el) el.classList.toggle("active", state.mode === "plant" && state.buildType === type);
  });
}

/**
 * Deselect all modes and reset the state.
 */
export function deselectAllModes(ghosts, removeGhostBox) {
  state.mode = "none";
  state.buildType = null;
  Object.values(ghosts).forEach((g) => g && g.setEnabled && g.setEnabled(false));
  if (removeGhostBox) removeGhostBox.isVisible = false;
  const rBtn = document.getElementById("removeBtn");
  if (rBtn) rBtn.classList.remove("danger");
  updateCardHighlights();
}

// ---------------------------------------------------------------------------
// REWARDED ADS - "Free Resources"
//
// The button stays HIDDEN until a real ad provider is set up (or you open the game with ?adtest=1,
// which runs a fake 5-second "test ad" so you can try the whole flow without any real ads).
// Resources are ONLY given when the provider reports the ad was completed.
//
// Providers:
//   test    - ?adtest=1 in the URL. Fake ad, no revenue. For testing the UI/limits.
//   monetag - Monetag Rewarded Interstitial. Their SDK only works INSIDE a Telegram Mini App.
//             Paste the main zone ID below and add Monetag's SDK tag to index.html.
//   google  - Google Ad Placement API (AdSense "H5 Games Ads"). Works on normal websites once
//             Google approves your site. Set google: true and add Google's snippet to index.html.
// ---------------------------------------------------------------------------
export const REWARDS = {
  cooldownMs: 2 * 60 * 1000,   // wait between rewarded ads
  dailyCap: 10,                // max rewarded ads per player per day
  testAdMs: 5000,              // length of the fake test ad
  monetagZone: "",             // e.g. "1234567" (Telegram Mini App only)
  google: false,               // true once the Ad Placement API snippet is in index.html
  packs: [
    { id: "builder", icon: "🧱", name: "Builder Pack", give: { wh: 80, stone: 60 } },
    { id: "harvest", icon: "🌾", name: "Harvest Pack", give: { food: 70, water: 60 } },
    { id: "mixed", icon: "🎁", name: "Mixed Pack", give: { wh: 40, stone: 30, food: 30, water: 30 } }
  ]
};

const REWARD_ICON = { wh: "🪵", stone: "🪨", food: "🌽", water: "💧" };
const REWARD_STORE_KEY = "wf_rewards_v1";
let rewardMemState = null;

function rewardDayKey() {
  const d = new Date(Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadRewardState() {
  const day = rewardDayKey();
  let raw = rewardMemState || {};
  try { raw = JSON.parse(localStorage.getItem(REWARD_STORE_KEY) || "{}") || {}; } catch (e) {}
  return { day, count: raw.day === day ? Number(raw.count) || 0 : 0, last: Number(raw.last) || 0 };
}

function saveRewardState(s) {
  rewardMemState = s;
  try { localStorage.setItem(REWARD_STORE_KEY, JSON.stringify(s)); } catch (e) {}
}

function fmtWait(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => { t = setTimeout(() => reject(new Error("timeout")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function makeRewardProviders() {
  const test = {
    name: "test",
    configured: () => { try { return new URLSearchParams(location.search).get("adtest") === "1"; } catch (e) { return false; } },
    prepare: async () => true,
    show: () => new Promise((resolve, reject) => {
      const overlay = document.createElement("div");
      overlay.className = "test-ad-overlay";
      const box = document.createElement("div");
      box.className = "test-ad-box";
      const tag = document.createElement("div");
      tag.className = "test-ad-tag";
      tag.textContent = "TEST AD";
      const msg = document.createElement("p");
      msg.textContent = "This is a fake ad for testing the reward flow. No real ad is shown and no revenue is earned.";
      const count = document.createElement("div");
      count.className = "test-ad-count";
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "test-ad-skip";
      skip.textContent = "Close (no reward)";
      box.append(tag, msg, count, skip);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      let left = Math.max(1, Math.ceil(REWARDS.testAdMs / 1000));
      count.textContent = left;
      const tick = setInterval(() => { left = Math.max(0, left - 1); count.textContent = left; }, 1000);
      const finish = (ok) => {
        clearInterval(tick);
        clearTimeout(done);
        overlay.remove();
        ok ? resolve() : reject(new Error("dismissed"));
      };
      const done = setTimeout(() => finish(true), REWARDS.testAdMs);
      skip.addEventListener("click", () => finish(false));
    })
  };

  const monetag = {
    name: "monetag",
    configured: () => !!REWARDS.monetagZone,
    prepare: async () => typeof window["show_" + REWARDS.monetagZone] === "function",
    show: () => new Promise((resolve, reject) => {
      const fn = window["show_" + REWARDS.monetagZone];
      if (typeof fn !== "function") return reject(new Error("unavailable"));
      // Monetag: resolves when the ad was watched, rejects if it failed or was skipped.
      Promise.resolve(fn()).then(resolve, () => reject(new Error("dismissed")));
    })
  };

  const g = { showAdFn: null, resolveShow: null, rejectShow: null };
  const google = {
    name: "google",
    configured: () => !!REWARDS.google,
    // Google needs a fresh adBreak() per opportunity; beforeReward fires only if a rewarded ad is available.
    prepare: () => new Promise((resolve) => {
      g.showAdFn = null;
      if (typeof window.adBreak !== "function") return resolve(false);
      let settled = false;
      const settle = (v) => { if (!settled) { settled = true; resolve(v); } };
      try {
        window.adBreak({
          type: "reward",
          name: "free-resources",
          beforeReward: (showAdFn) => { g.showAdFn = showAdFn; settle(true); },
          adViewed: () => { if (g.resolveShow) g.resolveShow(); },
          adDismissed: () => { if (g.rejectShow) g.rejectShow(new Error("dismissed")); },
          adBreakDone: () => settle(false)
        });
      } catch (e) { settle(false); }
      setTimeout(() => settle(false), 4000);
    }),
    // showAdFn must run inside the player's click, so it is called straight from the button handler.
    show: () => new Promise((resolve, reject) => {
      if (!g.showAdFn) return reject(new Error("unavailable"));
      g.resolveShow = resolve;
      g.rejectShow = reject;
      const fn = g.showAdFn;
      g.showAdFn = null;
      try { fn(); } catch (e) { reject(new Error("unavailable")); }
    })
  };

  return [test, monetag, google];
}

export function initRewards({ getPlacedObjects, onChanged, markDirty, isSpectating }) {
  const btn = document.getElementById("rewardsBtn");
  const modal = document.getElementById("rewardsModal");
  const closeBtn = document.getElementById("closeRewardsBtn");
  const packsEl = document.getElementById("rewardPacks");
  const statusEl = document.getElementById("rewardsStatus");
  const leftEl = document.getElementById("rewardsLeft");
  if (!btn || !modal || !packsEl) return;

  const providers = makeRewardProviders().filter((p) => p.configured());
  if (providers.length === 0) return; // nothing to offer yet: the button stays hidden

  let provider = null;
  let preparing = false;
  let busy = false;
  let tickTimer = null;

  const isOpen = () => !modal.classList.contains("hidden");
  const placed = () => (getPlacedObjects ? getPlacedObjects() : null);

  function setStatus(text, cls = "") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "reward-status" + (cls ? " " + cls : "");
  }

  function gate() {
    const s = loadRewardState();
    if (s.count >= REWARDS.dailyCap) return { ok: false, limit: true, wait: 0 };
    const wait = s.last + REWARDS.cooldownMs - Date.now();
    if (wait > 0) return { ok: false, limit: false, wait };
    return { ok: true, wait: 0 };
  }

  function previewGain(pack) {
    const cap = getResourceCap(placed());
    let total = 0, nominal = 0;
    for (const [key, amount] of Object.entries(pack.give)) {
      nominal += amount;
      total += Math.max(0, Math.min(amount, cap - (state.resources[key] || 0)));
    }
    return { total, nominal };
  }

  // Build the pack buttons once; render() only updates them in place so clicks are never swallowed.
  const refs = REWARDS.packs.map((pack) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reward-pack";
    const icon = document.createElement("span");
    icon.className = "reward-pack-icon";
    icon.textContent = pack.icon;
    const info = document.createElement("div");
    info.className = "reward-pack-info";
    const name = document.createElement("div");
    name.className = "reward-pack-name";
    name.textContent = pack.name;
    const give = document.createElement("div");
    give.className = "reward-pack-give";
    give.textContent = Object.entries(pack.give).map(([k, a]) => `+${a} ${REWARD_ICON[k] || ""}`).join("  ");
    const note = document.createElement("div");
    note.className = "reward-pack-note";
    info.append(name, give, note);
    const cta = document.createElement("span");
    cta.className = "reward-pack-cta";
    b.append(icon, info, cta);
    b.addEventListener("click", () => claim(pack));
    packsEl.appendChild(b);
    return { pack, b, note, cta };
  });

  function render() {
    const g = gate();
    const s = loadRewardState();
    if (leftEl) {
      leftEl.textContent = `Today: ${s.count}/${REWARDS.dailyCap}` +
        (g.wait ? ` · next ad in ${fmtWait(g.wait)}` : "") +
        (g.limit ? " · daily limit reached, come back tomorrow" : "");
    }
    for (const r of refs) {
      const pv = previewGain(r.pack);
      let disabled = false, note = "", cta = "▶ Watch ad";
      if (busy) { disabled = true; cta = "…"; }
      else if (preparing) { disabled = true; cta = "Checking…"; }
      else if (!g.ok) { disabled = true; cta = g.limit ? "Limit" : fmtWait(g.wait); }
      else if (!provider) { disabled = true; cta = "No ad"; }
      if (pv.total === 0) { disabled = true; cta = "Full"; note = "Storage is full - spend some first, or build Storage."; }
      else if (pv.total < pv.nominal) note = `Only +${pv.total} fits - build Storage for more room.`;
      r.b.disabled = disabled;
      r.cta.textContent = cta;
      r.note.textContent = note;
    }
  }

  async function pickProvider() {
    for (const p of providers) {
      try { if (await p.prepare()) return p; } catch (e) {}
    }
    return null;
  }

  async function refreshProvider() {
    provider = null;
    preparing = true;
    setStatus("Checking for an ad…");
    render();
    const found = await pickProvider();
    preparing = false;
    provider = found;
    setStatus(found ? "" : "No ad available right now. Try again in a minute.", found ? "" : "err");
    render();
  }

  function maybePrepare() {
    if (isOpen() && !provider && !preparing && !busy && gate().ok) refreshProvider();
  }

  function grant(pack) {
    const gained = [];
    for (const [key, amount] of Object.entries(pack.give)) {
      const got = addResourceClamped(key, amount, placed());
      if (got > 0) gained.push(`+${got} ${REWARD_ICON[key] || ""}`);
    }
    const s = loadRewardState();
    saveRewardState({ day: s.day, count: s.count + 1, last: Date.now() });
    const msg = gained.length ? `Reward: ${gained.join(" ")}` : "Reward claimed";
    setStatus(msg, "ok");
    // The reward is already given - a display/save hiccup must never look like a failed ad.
    const safe = (fn) => { try { fn(); } catch (e) { console.warn("[rewards]", e); } };
    safe(() => { if (onChanged) onChanged(); });
    safe(() => { if (markDirty && !(isSpectating && isSpectating())) markDirty(); });
    safe(() => showNotif(msg, "success", 3500));
  }

  async function claim(pack) {
    if (busy || preparing || !provider) return;
    if (isSpectating && isSpectating()) return;
    if (!gate().ok || previewGain(pack).total === 0) { render(); return; }

    busy = true;
    setStatus("Loading ad…");
    render();
    const p = provider;
    let completed = false;
    try {
      try {
        await withTimeout(p.show(), 5 * 60 * 1000);
        completed = true;
      } catch (err) {
        const dismissed = err && err.message === "dismissed";
        setStatus(dismissed ? "Ad closed early - no reward this time." : "No ad available right now. Try again in a minute.", "err");
      }
      if (completed) grant(pack);
    } finally {
      busy = false;
      provider = null; // a fresh ad is prepared for the next claim
      render();
    }
  }

  function open() {
    if (isSpectating && isSpectating()) { showNotif("Not available while viewing another world", "warn", 2500); return; }
    modal.classList.remove("hidden");
    setStatus("");
    render();
    maybePrepare();
    if (!tickTimer) tickTimer = setInterval(() => { render(); maybePrepare(); }, 1000);
  }

  function close() {
    modal.classList.add("hidden");
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  btn.style.display = "";
  btn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) close(); });
}