/**
 * core/ui.js — the DOM the player reads.
 *
 * Two counters and the room label, nothing else: the game has no transient messages, so the
 * only text that appears is the text that stays up. main.js, world/ingredients.js and
 * actors/mouse.js are the only callers, so the DOM stays out of the simulation.
 */
// Hoard bookkeeping: every ingredient pushed down the hole turns up in the base.
function updateStashHud() {
    document.getElementById('stash-count').textContent = stashedIngredients.length;
}

// What is in the paws right now. One label, because paws hold one thing.
function updateCarryHud() {
    document.getElementById('carry-name').textContent = carriedItem ? carriedItem.label : 'empty';
}

// Movement, area containment, jumping/gravity, obstacle collision, footstep dust,
// ingredient pushing
