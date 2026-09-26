// The lumbermill's staffing popover. Clicking a mill outside build/remove mode
// opens it; it is the only place the player says how many villagers work a
// given building, so it stays open while they watch the crew fill up.
import { MAX_WORKERS, WOODLOT_CAP, setMillWorkers, woodlotRegrowSeconds } from "./world.js";
import { state } from "./ui.js";

let panelEl = null;
let refreshTimer = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function closeMillPanel() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  if (panelEl) { panelEl.remove(); panelEl = null; }
}

function body(mill, crewNames, activeNPCs) {
  const head = el("div", "mill-panel-head");
  head.append(el("span", "mill-panel-title", "Lumbermill"));
  const close = el("button", "mill-panel-close", "✕");
  close.onclick = closeMillPanel;
  head.append(close);

  const crewRow = el("div", "mill-crew-row");
  crewRow.append(el("span", "mill-crew-label", "Workers"));
  const minus = el("button", "mill-step", "−");
  minus.onclick = () => { setMillWorkers(mill, mill.workers - 1); redraw(mill, activeNPCs); };
  const plus = el("button", "mill-step", "+");
  plus.onclick = () => { setMillWorkers(mill, mill.workers + 1); redraw(mill, activeNPCs); };
  crewRow.append(minus, el("span", "mill-crew-count", `${mill.workers} / ${MAX_WORKERS}`), plus);

  const names = el("div", "mill-crew-names",
    crewNames.length ? crewNames.join(" · ") : "Waiting for an idle villager to take the shift");

  const lot = el("div", "mill-stat", `Woodlot ${mill.lot ? mill.lot.size : 0} / ${WOODLOT_CAP} trees`);
  const rate = el("div", "mill-stat", `New tree every ${woodlotRegrowSeconds(mill).toFixed(0)}s`);
  const cut = el("div", "mill-stat", `Timber cut ${mill.chopped || 0}`);

  const frag = document.createDocumentFragment();
  frag.append(head, crewRow, names, lot, rate, cut,
    el("div", "mill-hint", "More workers fell trees faster, and the lot regrows faster to match."));
  return frag;
}

function namesFor(mill, activeNPCs) {
  if (!mill.crew) return [];
  return Array.from(mill.crew)
    .map((id) => activeNPCs.find((n) => n.id === id))
    .filter(Boolean)
    .map((n) => n.name);
}

function redraw(mill, activeNPCs) {
  if (panelEl) panelEl.replaceChildren(body(mill, namesFor(mill, activeNPCs), activeNPCs));
}

/**
 * Opens the staffing popover for one mill. The panel docks in one fixed area
 * on the left of the screen (see .mill-panel in panels.css) instead of chasing
 * the cursor, so it opens in the same place no matter which part of the mill
 * was clicked. A second click on the same mill closes it, matching the other
 * HUD toggles.
 */
export function openMillPanel(mill, placedObjects, activeNPCs) {
  if (!mill || mill.type !== "lumbermill" || state.isSpectating) return;

  if (panelEl && panelEl.dataset.millId === mill.id) return closeMillPanel();
  closeMillPanel();

  panelEl = document.createElement("div");
  panelEl.className = "mill-panel";
  panelEl.dataset.millId = mill.id;
  panelEl.append(body(mill, namesFor(mill, activeNPCs), activeNPCs));
  document.body.appendChild(panelEl);

  // Cheap enough to keep the numbers honest while a crew is chopping, and it
  // closes itself if the mill is removed from under the panel.
  refreshTimer = setInterval(() => {
    const current = placedObjects.get(mill.id);
    if (!current || current.type !== "lumbermill") return closeMillPanel();
    redraw(current, activeNPCs);
  }, 400);
}
