/**
 * world/burrow.js — the mouse base: the den behind the kitchen's hole.
 *
 * The room itself is data in map/rooms.js — rect, dirt floor, walls, furniture, lamps — and
 * world/rooms.js builds it before this hook runs. So the base is walled and lit exactly like the
 * pantry is, the chef's sight stops at its walls, and the mouse gets in through the mouse hole on
 * his own feet rather than being carried there. What lives here is the one thing only the den
 * has: the hoard. `burrowGroup` is what every delivered ingredient is cloned into, and the pile
 * is capped because the house restocks forever. The residents live in actors/residents.js, and
 * world/ingredients.js is what decides a prop has arrived.
 */
let burrowGroup = null;
// Handed to the registry by the burrow's spec, which fills them with the den's own furniture.
// actors/residents.js and addToStash both read them by name.
let burrowObstacles = [];
let burrowCollision = [];
const stashedIngredients = [];   // the hoard: one entry per ingredient carried or rolled in

// The hoard is decoration, and the kitchen restocks forever, so the pile is capped: past
// this many the oldest item leaves it rather than the base growing without end.
const STASH_PILE_CAP = 26;

function buildBurrow() {
    burrowGroup = new THREE.Group();
    scene.add(burrowGroup);
    spawnBurrowMice();
}

// Delivered ingredients reappear here so the hoard you have built is visible.
function addToStash(ingredient) {
    const den = roomById('burrow');
    const slot = stashedIngredients.length;
    const angle = slot * 2.39996; // golden angle, so the pile spreads instead of lining up
    const radius = 0.85 + Math.sqrt(slot) * 0.62;
    const x = den.ox - 4.5 + Math.cos(angle) * radius;
    const z = den.oz - 3.5 + Math.sin(angle) * radius;

    const prop = ingredient.group.clone(true);
    prop.visible = true;
    prop.scale.set(1, 1, 1);
    prop.position.set(x, getFloorY(x, z, Infinity, burrowObstacles) + 0.02, z);
    prop.rotation.set(0, Math.random() * Math.PI * 2, 0);
    burrowGroup.add(prop);
    stashedIngredients.push(prop);
    if (stashedIngredients.length > STASH_PILE_CAP) {
        // Detach only: a clone shares its source's geometry and material, so disposing here
        // would gut the very props still sitting on the kitchen floor.
        burrowGroup.remove(stashedIngredients.shift());
    }
}
