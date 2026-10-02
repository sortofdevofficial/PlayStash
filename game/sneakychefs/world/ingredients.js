/**
 * world/ingredients.js — the hoard: what the mouse steals and how it moves.
 *
 * Owns the ingredient spec (which types roll), the prop physics and the per-room restock
 * loop. Where the goods start is data: map/rooms.js authors each room's `loot` and its
 * `restock` rule. Body-weight pushing and carrying live in actors/mouse.js; everything
 * after the shove happens here — friction, gravity, obstacle collisions, prop-vs-prop
 * contact, rolling, and the delivery into the base.
 *
 * The house is one connected floorplan, so a prop is measured against `worldObstacles` —
 * every wall and counter in it — and the room it belongs to is derived from where it is
 * standing each frame rather than from wherever it was spawned. That tag is not containment,
 * it is bookkeeping: it decides which room's restock loop counts it, and whose authored spot a
 * restart returns it to. Shove a wheel through a doorway and it becomes that room's problem,
 * walls and all — including the base's, which is the one room a prop disappears into.
 *
 * `stowCarried` is what turns a load carried through the mouse hole into part of the pile.
 */
const PROP_FRICTION = 1.6;
const PROP_MAX_SPEED = 9.0;
const PROP_STASH_TIME = 0.45;
const ROLL_AXIS = new THREE.Vector3(1, 0, 0); // a rolling prop turns about the carrier's X

// Every room with a `restock` rule in map/rooms.js refills itself. There is no goal and no
// clock, so a bare floor would mean the game had quietly ended; once the goods still in play
// in that room fall below its floor, one sunk item is re-delivered every `gap` seconds,
// dropping in from above. Sunk items are reused rather than duplicated, so the scene never
// holds a second copy of a prop. The timer lives on the room record, not here, because each
// room counts down independently and only the one you are standing in ever pays out.
const DELIVERY_DROP_Y = 5.2;   // over open floor — an enclosed spawn sets its own dropY

// Round enough to roll believably; the rest slide and tumble.
const INGREDIENT_SPEC = {
    cheese: { label: 'Cheese', roll: true },
    apple: { label: 'Apple', roll: true },
    tomato: { label: 'Tomato', roll: true },
    banana: { label: 'Banana', roll: false },
    carrot: { label: 'Carrot', roll: false },
    butter: { label: 'Butter', roll: false },
    milk: { label: 'Milk', roll: false },
    bread: { label: 'Bread', roll: false },
    jam: { label: 'Jam jar', roll: false }
};

// Where the hoard starts comes from map/rooms.js: each room authors its own `loot` in local
// coordinates and this resolves it to the scene. Two records per prop, because they answer
// different questions — `home` is the authored spot a restart returns to and never changes,
// while `spawn` is where the next delivery drops and `room` is whose floor it belongs to, both
// of which follow the prop through a doorway however it got there — hoisted or shoved.
function spawnIngredients() {
    ingredients = [];

    roomOrder.forEach(room => (room.spec.loot || []).forEach(l => {
        const spawn = {
            type: l.type,
            x: room.ox + l.x,
            z: room.oz + l.z,
            dropY: l.dropY,
            room: room.id
        };
        ingredients.push(buildIngredient(spawn));
    }));
}

function buildIngredient(spawn) {
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
    group.position.set(spawn.x, getFloorY(spawn.x, spawn.z, Infinity), spawn.z);
    scene.add(group);

    return {
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
        home: { ...spawn },
        spawn,
        room: spawn.room,
        stashing: false,
        sunk: false,
        delivering: false,
        carried: false,
        stashT: 0,
        stashFrom: new THREE.Vector3()
    };
}

function updateIngredientProps(dt) {
    collideProps();

    ingredients.forEach(item => {
        const pos = item.group.position;

        if (item.stashing || item.sunk) { animateIngredientStash(item, dt); return; }
        // In the paws: actors/mouse.js moves it, so no gravity, no contact and no stash check.
        if (item.carried) return;

        if (item.grounded && item.vel.lengthSq() > 0) {
            item.vel.multiplyScalar(Math.max(0, 1 - PROP_FRICTION * dt));
            if (item.vel.length() < 0.03) item.vel.set(0, 0, 0);
        }
        if (item.vel.lengthSq() > PROP_MAX_SPEED * PROP_MAX_SPEED) item.vel.setLength(PROP_MAX_SPEED);

        const prevX = pos.x, prevZ = pos.z;
        pos.x += item.vel.x * dt;
        pos.z += item.vel.z * dt;

        // Whichever room it has ended up in is the one it belongs to now, and the masonry is
        // the only thing that stops it: every room in the plan is walled, so a wheel cannot
        // leave the house through a wall, only through a doorway.
        solvePropCollision(pos, item.vel, item.radius);
        const room = roomAt(pos.x, pos.z);
        item.room = room.id;

        const restY = getFloorY(pos.x, pos.z, pos.y + 0.05);
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

        // Through the hole and into the pile: the base is the one room that is the score rather
        // than the supply, so a prop that gets in there is delivered and leaves the floor.
        if (item.grounded && item.room === 'burrow') {
            item.stashing = true;
            item.stashT = 0;
            item.vel.set(0, 0, 0);
            item.stashFrom.copy(pos);
            // Back to the room it grew in: a delivery is picked out of the sunk props standing in
            // the room being refilled, so a wheel that stayed "in the base" would never return.
            item.room = item.home.room;
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
            // The house is connected now, so every live prop is a candidate and this runs on
            // all of them — reject on squared distance and only take the root for a real hit.
            const dd = dx * dx + dz * dz;
            if (dd >= reach * reach || dd < 1e-8) continue;
            const dist = Math.sqrt(dd);

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

// How many goods are still in play on one room's floor.
function liveProps(roomId) {
    return ingredients.filter(i => !i.sunk && !i.stashing && i.room === roomId).length;
}

function updateDeliveries(dt) {
    // A delivery is done the moment it settles: dust, a knock, and it is back in play as an
    // ordinary prop.
    ingredients.forEach(item => {
        if (item.delivering && item.grounded) {
            item.delivering = false;
            spawnDust(item.group.position, 1.6);
            playSound('thud');
        }
    });

    // No point dropping groceries where the player cannot see them land, so only the room
    // being stood in counts down — and the base has no restock rule at all, because the
    // pile in there is the score, not the supply.
    const room = activeRoom();
    if (!room.restock) return;
    if (room.deliveryTimer > 0) { room.deliveryTimer -= dt; return; }
    if (liveProps(room.id) >= room.restock.floor) return;

    // Re-use a prop that sank from this room, so it lands back on its own authored spot —
    // the fridge trio has to fall onto the interior lip, not through the freezer shelf.
    const gone = ingredients.filter(i => i.sunk && i.room === room.id);
    if (!gone.length) return;
    deliver(gone[Math.floor(Math.random() * gone.length)]);
    room.deliveryTimer = room.restock.gap;
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
}

function animateIngredientStash(item, dt) {
    if (item.sunk) return;
    item.stashT += dt;
    const k = Math.min(1, item.stashT / PROP_STASH_TIME);
    const pos = item.group.position;
    // Sinks where it stopped — the clone in the base's pile is what represents it now.
    pos.y = THREE.MathUtils.lerp(item.stashFrom.y, -item.height, k);
    const s = 1 - k;
    item.group.scale.set(s, s, s);
    if (k >= 1) {
        item.sunk = true;
        item.group.visible = false;
    }
}

function resetIngredients() {
    roomOrder.forEach(room => { room.deliveryTimer = 0; });
    carriedItem = null;
    ingredients.forEach(item => {
        // A caught mouse keeps his hoard: the clone stays in the base pile, so restarting
        // must not put a second copy in the house. The restock loop is what brings a
        // hoarded prop back, and it does that one delivery at a time.
        if (item.sunk) return;
        // Back to the authored spot, in the authored room: hauling a wheel out of the garden
        // and getting caught must not leave it stranded in the kitchen for good.
        item.room = item.home.room;
        item.spawn = item.home;
        item.stashing = false;
        item.delivering = false;
        item.carried = false;
        item.stashT = 0;
        item.group.visible = true;
        item.group.scale.set(1, 1, 1);
        item.group.position.set(
            item.spawn.x,
            getFloorY(item.spawn.x, item.spawn.z, Infinity),
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


// A load the mouse hauls through a doorway belongs to the room it is put down in from then
// on. `home` stays the authored spot, so a restart still puts the whole house back as
// map/rooms.js wrote it; only the working room and the next delivery point move. A prop set
// back down in its own room is left alone — hoisting something and putting it down again
// should not quietly rewrite where the restock loop drops it next.
function rehomeIngredient(item) {
    const p = item.group.position;
    const here = roomAt(p.x, p.z);
    if (item.room === here.id) return;
    item.room = here.id;
    item.spawn = { type: item.type, x: p.x, z: p.z, room: item.room };
}

// Called by the ingredient physics the moment a prop drops into the hole.
function onIngredientStashed(item) {
    addToStash(item);
    updateStashHud();
    playSound('collect');
}

// Called when the mouse stands in the hole's mouth with a load. It goes straight into the pile —
// that is the payoff for the hoist, and the reason to lift a wheel that was too wedged to roll.
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
