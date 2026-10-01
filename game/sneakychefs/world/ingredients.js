/**
 * world/ingredients.js — the hoard: what the mouse steals and how it moves.
 *
 * Owns the spawn table, the ingredient spec (which types roll), and the prop physics:
 * body-weight pushing and carrying live in actors/mouse.js, everything after the shove
 * happens here — friction, gravity, obstacle collisions, prop-vs-prop contact, rolling, and
 * the drop into the mouse hole. A prop in the paws is skipped by all of it, and `stowCarried`
 * is what turns a load carried through the hole into part of the pile.
 */
const PROP_FRICTION = 1.6;
const PROP_MAX_SPEED = 9.0;
const PROP_STASH_TIME = 0.45;
const ROLL_AXIS = new THREE.Vector3(1, 0, 0); // a rolling prop turns about the carrier's X

// The kitchen restocks itself. There is no goal and no clock, so an empty floor would mean
// the game had quietly ended; once the goods still in play fall below DELIVERY_FLOOR, one
// sunk item is re-delivered every DELIVERY_GAP seconds, dropping in from above. Sunk items
// are reused rather than duplicated, so the scene never holds a second copy of a prop.
const DELIVERY_FLOOR = 5;
const DELIVERY_GAP = 9.0;
const DELIVERY_DROP_Y = 5.2;   // over open floor — an enclosed spawn sets its own dropY
let deliveryTimer = 0;

// Round enough to roll believably; the rest slide and tumble.
const INGREDIENT_SPEC = {
    cheese: { label: 'Cheese', roll: true },
    apple: { label: 'Apple', roll: true },
    banana: { label: 'Banana', roll: false },
    carrot: { label: 'Carrot', roll: false },
    butter: { label: 'Butter', roll: false },
    milk: { label: 'Milk', roll: false }
};

// Where the hoard starts. Everything on open floor or inside the fridge: the mouse's jump
// apex (~1.6) can't clear a 2.2 counter, and a prop up there can't be shoved down from the
// ground, so anything spawned on a worktop would be unobtainable. The chilled trio stands
// on the fridge's interior lip and has to be shoved out through the doorway.
const INGREDIENT_SPAWNS = [
    { type: 'cheese', x: 0, z: -6 },
    { type: 'cheese', x: 6, z: -8 },
    { type: 'cheese', x: -6, z: -8 },
    { type: 'apple', x: 0, z: 6.5 },
    { type: 'banana', x: -11, z: 2 },
    { type: 'banana', x: 11, z: 4 },
    { type: 'carrot', x: 4, z: 11 },
    // Inside the cavity: the freezer shelf and ceiling sit above these, so a re-delivery
    // has to start below them and fall the last stretch onto the lip.
    { type: 'apple', x: -13.5, z: -13.6, dropY: 1.6 },
    { type: 'butter', x: -12.5, z: -14.5, dropY: 1.6 },
    { type: 'milk', x: -11.5, z: -13.6, dropY: 1.6 }
];

function spawnIngredients() {
    ingredients = [];

    INGREDIENT_SPAWNS.forEach(spawn => {
        const model = buildIngredientModel(spawn.type);

        // Models stand on their own origin, so the box gives the size used for pushing and
        // rolling, and the centroid gives the offset needed to spin the prop about itself.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const radius = Math.max(size.x, size.z) / 2;

        // A model may name its own contact pivot (the apple's body, not its leaf).
        const pivot = model.userData.rollPivot;
        const pivotY = pivot ? pivot.y : size.y / 2;
        const height = pivot ? pivot.y + radius : size.y;

        model.position.set(-center.x, -box.min.y - pivotY, -center.z);
        // Two levels on purpose: the carrier yaws to face the direction of travel, the
        // spinner inside it accumulates the roll. A wheel then always turns about its own
        // axle instead of tumbling across whatever axis the shove happened to point along.
        const spinner = new THREE.Group();
        spinner.add(model);
        const carrier = new THREE.Group();
        carrier.position.y = pivotY;
        carrier.add(spinner);

        const group = new THREE.Group();
        group.add(carrier);
        group.position.set(spawn.x, getFloorY(spawn.x, spawn.z, Infinity, kitchenObstacles), spawn.z);
        scene.add(group);

        ingredients.push({
            type: spawn.type,
            label: INGREDIENT_SPEC[spawn.type].label,
            roll: INGREDIENT_SPEC[spawn.type].roll,
            radius,
            rollRadius: pivot ? pivot.radius : radius,
            height,
            group, carrier, spinner,
            vel: new THREE.Vector3(),
            velY: 0,
            grounded: true,
            spawn,
            stashing: false,
            sunk: false,
            delivering: false,
            carried: false,
            stashT: 0,
            stashFrom: new THREE.Vector3()
        });
    });
}

function updateIngredientProps(dt) {
    collideProps();

    ingredients.forEach(item => {
        const pos = item.group.position;

        if (item.stashing || item.sunk) { animateIngredientStash(item, dt); return; }
        // In the paws: actors/mouse.js moves it, so no gravity, no contact and no chute.
        if (item.carried) return;

        if (item.grounded && item.vel.lengthSq() > 0) {
            item.vel.multiplyScalar(Math.max(0, 1 - PROP_FRICTION * dt));
            if (item.vel.length() < 0.03) item.vel.set(0, 0, 0);
        }
        if (item.vel.lengthSq() > PROP_MAX_SPEED * PROP_MAX_SPEED) item.vel.setLength(PROP_MAX_SPEED);

        const prevX = pos.x, prevZ = pos.z;
        pos.x += item.vel.x * dt;
        pos.z += item.vel.z * dt;
        clampPropToRect(pos, item.vel, 0, KITCHEN_BOUND);
        solvePropCollision(pos, item.vel, item.radius, kitchenObstacles);

        const restY = getFloorY(pos.x, pos.z, pos.y + 0.05, kitchenObstacles);
        if (pos.y > restY + 0.001) {
            item.grounded = false;
            item.velY -= GRAVITY * dt;
            pos.y += item.velY * dt;
            if (pos.y <= restY) { pos.y = restY; item.velY = 0; item.grounded = true; }
        } else {
            pos.y = restY;
            item.velY = 0;
            item.grounded = true;
        }

        const dx = pos.x - prevX, dz = pos.z - prevZ;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.0001) {
            if (item.roll) {
                // atan2(dx, dz) puts the carrier's local X exactly along the old
                // (dz, 0, -dx) roll axis, so the spin direction is unchanged and the
                // wheel turns about its own axle rather than across it.
                item.carrier.rotation.y = Math.atan2(dx, dz);
                item.spinner.rotateOnAxis(ROLL_AXIS, dist / item.rollRadius);
            } else {
                // A carrot doesn't roll — it wobbles along in the direction it is shoved
                item.carrier.rotation.y += dist * 2.2;
                item.carrier.rotation.z = THREE.MathUtils.lerp(
                    item.carrier.rotation.z, Math.min(0.35, dist * 4), Math.min(1, dt * 10));
            }
        }

        if (item.grounded && kitchenHoleDistance(pos.x, pos.z) < MOUSE_HOLE.radius) {
            item.stashing = true;
            item.stashT = 0;
            item.vel.set(0, 0, 0);
            item.stashFrom.copy(pos);
            onIngredientStashed(item);
        }
    });

    updateDeliveries(dt);
}

// Round things that touch, push each other. Without this two wheels passed straight through
// one another and then both ended up pinned to the same counter face, which is the other way
// a shove reads as "stuck".
function collideProps() {
    for (let i = 0; i < ingredients.length; i++) {
        const a = ingredients[i];
        if (a.sunk || a.stashing || a.carried) continue;
        for (let j = i + 1; j < ingredients.length; j++) {
            const b = ingredients[j];
            if (b.sunk || b.stashing || b.carried) continue;

            const pa = a.group.position, pb = b.group.position;
            // Only things standing on the same surface can touch: the chilled goods are a
            // shelf above the floor, and a delivery still falling is nowhere near either.
            if (Math.abs(pa.y - pb.y) > 0.4) continue;

            const dx = pb.x - pa.x, dz = pb.z - pa.z;
            const reach = a.radius + b.radius;
            const dist = Math.hypot(dx, dz);
            if (dist >= reach || dist < 1e-4) continue;

            const nx = dx / dist, nz = dz / dist;
            const half = (reach - dist) / 2;
            pa.x -= nx * half; pa.z -= nz * half;
            pb.x += nx * half; pb.z += nz * half;

            // Equal masses, so only the closing speed changes hands: a wheel that runs into
            // a parked one hands over the shove and the parked one rolls off.
            const closing = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
            if (closing < 0) {
                const k = closing * 0.5 * (1 + BODY_BOUNCE);
                a.vel.x += nx * k; a.vel.z += nz * k;
                b.vel.x -= nx * k; b.vel.z -= nz * k;
            }
        }
    }
}

// How many goods are still in play on the kitchen floor.
function liveProps() {
    return ingredients.filter(i => !i.sunk && !i.stashing).length;
}

function updateDeliveries(dt) {
    // A delivery is done the moment it settles on the tiles: dust, a knock, and it is back
    // in play as an ordinary prop.
    ingredients.forEach(item => {
        if (item.delivering && item.grounded) {
            item.delivering = false;
            spawnDust(item.group.position, 1.6);
            playSound('thud');
        }
    });

    if (deliveryTimer > 0) { deliveryTimer -= dt; return; }
    // No point dropping groceries where the player cannot see them land.
    if (currentArea !== 'kitchen' || liveProps() >= DELIVERY_FLOOR) return;

    const gone = ingredients.filter(i => i.sunk);
    if (!gone.length) return;
    deliver(gone[Math.floor(Math.random() * gone.length)]);
    deliveryTimer = DELIVERY_GAP;
}

function deliver(item) {
    item.sunk = false;
    item.stashing = false;
    item.stashT = 0;
    item.delivering = true;
    item.group.visible = true;
    item.group.scale.set(1, 1, 1);
    item.group.position.set(item.spawn.x, item.spawn.dropY || DELIVERY_DROP_Y, item.spawn.z);
    item.carrier.rotation.set(0, 0, 0);
    item.spinner.rotation.set(0, 0, 0);
    item.vel.set(0, 0, 0);
    item.velY = 0;
    item.grounded = false;
    showToast(item.label + ' delivered — the chef restocked');
}

function animateIngredientStash(item, dt) {
    if (item.sunk) return;
    item.stashT += dt;
    const k = Math.min(1, item.stashT / PROP_STASH_TIME);
    const pos = item.group.position;
    pos.x = THREE.MathUtils.lerp(item.stashFrom.x, MOUSE_HOLE.x, k * k);
    pos.z = THREE.MathUtils.lerp(item.stashFrom.z, MOUSE_HOLE.z, k * k);
    pos.y = THREE.MathUtils.lerp(item.stashFrom.y, -item.height, k);
    const s = 1 - k;
    item.group.scale.set(s, s, s);
    if (k >= 1) {
        item.sunk = true;
        item.group.visible = false;
    }
}

function resetIngredients() {
    deliveryTimer = 0;
    carriedItem = null;
    ingredients.forEach(item => {
        // A caught mouse keeps his hoard: the clone stays in the base pile, so restarting
        // must not put a second copy in the kitchen. The restock loop is what brings a
        // hoarded prop back, and it does that one delivery at a time.
        if (item.sunk) return;
        item.stashing = false;
        item.delivering = false;
        item.carried = false;
        item.stashT = 0;
        item.group.visible = true;
        item.group.scale.set(1, 1, 1);
        item.group.position.set(
            item.spawn.x,
            getFloorY(item.spawn.x, item.spawn.z, Infinity, kitchenObstacles),
            item.spawn.z
        );
        item.carrier.rotation.set(0, 0, 0);
        item.spinner.rotation.set(0, 0, 0);
        item.vel.set(0, 0, 0);
        item.velY = 0;
        item.grounded = true;
    });
    updateCarryHud();
}


// Called by the ingredient physics the moment a prop drops into the hole.
function onIngredientStashed(item) {
    addToStash(item);
    updateStashHud();
    playSound('collect');
    showToast(item.label + ' stashed (' + stashedIngredients.length + ') — it is waiting in the base');
}

// Called by the portal when the mouse walks home carrying something. The load goes straight
// into the pile — that is the payoff for the trip, and the reason to hoist a wheel that was
// too wedged to roll.
function stowCarried() {
    const item = carriedItem;
    if (!item) return;
    carriedItem = null;
    item.carried = false;
    item.sunk = true;
    item.group.visible = false;
    onIngredientStashed(item);
    updateCarryHud();
}
