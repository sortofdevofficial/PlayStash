/**
 * core/ui.js — the DOM the player reads.
 *
 * HUD counters, the area label, transient toasts. Only main.js and world/ingredients.js
 * call in here, so the DOM stays out of the simulation.
 */
// Hoard bookkeeping: every ingredient pushed down the hole turns up in the base.
function updateStashHud() {
    document.getElementById('stash-count').textContent = stashedIngredients.length;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Movement, area containment, jumping/gravity, obstacle collision, footstep dust,
// ingredient pushing
