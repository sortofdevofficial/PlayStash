/**
 * world/ingredients.js — the hoard: what the mouse steals and how it moves.
 *
 * Owns the spawn table, the ingredient spec (which types roll), and the prop physics:
 * body-weight pushing lives in actors/mouse.js, everything after the shove happens here —
 * friction, gravity, obstacle collisions, rolling, and the drop into the mouse hole.
 */
const PROP_FRICTION = 1.6;
const PROP_MAX_SPEED = 9.0;
const PROP_STASH_TIME = 0.45;
const ROLL_AXIS = new THREE.Vector3(1, 0, 0); // a rolling prop turns about the carrier's X

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
    { type: 'apple', x: -12.5, z: -14.1 },
    { type: 'butter', x: -13.2, z: -14.1 },
    { type: 'milk', x: -11.7, z: -14.1 }
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
            stashT: 0,
            stashFrom: new THREE.Vector3()
        });
    });
}

function updateIngredientProps(dt) {
    ingredients.forEach(item => {
        const pos = item.group.position;

        if (item.stashing || item.sunk) { animateIngredientStash(item, dt); return; }

        if (item.grounded && item.vel.lengthSq() > 0) {
            item.vel.multiplyScalar(Math.max(0, 1 - PROP_FRICTION * dt));
            if (item.vel.length() < 0.03) item.vel.set(0, 0, 0);
        }
        if (item.vel.lengthSq() > PROP_MAX_SPEED * PROP_MAX_SPEED) item.vel.setLength(PROP_MAX_SPEED);

        const prevX = pos.x, prevZ = pos.z;
        pos.x += item.vel.x * dt;
        pos.z += item.vel.z * dt;
        clampToRect(pos, 0, KITCHEN_BOUND);
        solveObstacleCollision(pos, item.radius, kitchenObstacles);

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
    ingredients.forEach(item => {
        // Once it is home it stays home — respawning it here would put a second copy in
        // the kitchen while its clone is still sitting in the base pile.
        if (item.sunk) return;
        item.stashing = false;
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
}


// Called by the ingredient physics the moment a prop drops into the hole.
function onIngredientStashed(item) {
    addToStash(item);
    updateStashHud();
    playSound('collect');
    showToast(item.label + ' stashed (' + stashedIngredients.length + ') — it is waiting in the base');
}
