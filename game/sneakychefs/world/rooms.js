/**
 * world/rooms.js — the room registry, and the builder that turns map/rooms.js into geometry.
 *
 * Every room in the house is one record here: its rect in the shared scene, the obstacles and
 * camera-collision meshes inside it, the doors out of it, its lights and its restock rule.
 * world/physics.js, core/areas.js, world/ingredients.js and core/minimap.js all ask this
 * registry what the room at a given point looks like, and nothing else in the game knows the
 * layout.
 *
 * buildRoom builds the parts a spec declares on its own — floor, furniture, lights — then calls
 * the spec's own `build` hook for the things only one room has (the kitchen's fridge and mouse
 * hole, the base's cutaway shell). The walls are different: rooms tile edge to edge, so two of
 * them describe the same stretch of masonry from opposite sides, and buildMasonry builds every
 * wall in the house once instead. A doorway is then a real gap cut through the merged run, so
 * the wall is not just how the house looks — it is what stops you, and the two rooms either side
 * of it are the two you can walk between.
 *
 * buildHouse also lays out the hunter's beat. map/rooms.js writes it as one ordered walk through
 * several rooms, so no single room spec can own it and this is where it becomes waypoints.
 *
 * Furniture kinds, and what each blocks:
 *   counter  box plus a lighter slab overhanging it — an obstacle and camera geometry
 *   solid    a column from its base up to y + h    — an obstacle and camera geometry
 *   visual   camera geometry only: the mouse walks under it (shelves, mantels, table tops)
 *   deco     nothing at all (rugs, books, flowers)
 * In map data `y` is always the BASE of a piece, so a floating shelf is a `visual` whose y is
 * its underside. The obstacle contract has no underside — it is a column topped at `h` — which
 * is exactly why anything you can walk under has to be `visual`, and why a doorway's lintel is
 * geometry only: registering the column over an opening would seal the opening.
 */
const rooms = {};
const roomOrder = [];

const DOOR_W = 2.6;       // the gap a doorway cuts in a wall
const DOOR_H = 2.7;       // ... and the lintel that closes the wall off above it
// Two gates in this house still jump rather than walk — the mouse hole's chute and the base's
// exit arch, because the den sits 400 units away in the same scene rather than next door. Those
// are the only portals that need a trigger circle, and the inset has to be wider than the
// circle plus the margin or arriving would cross you straight back through it.
const PORTAL_ENTER_MARGIN = 0.4;
const ARRIVE_INSET = 2.2;
const INWARD = { north: [0, 1], south: [0, -1], east: [-1, 0], west: [1, 0] };

function roomById(id) {
    return rooms[id];
}

function activeRoom() {
    return rooms[currentArea];
}

// Which room a point stands in. Rooms tile the plan edge to edge, so this is the question the
// frame loop asks to know where the player is — and the same question a prop asks to know which
// floor it is resting on. A point in the masonry itself (which is where a doorway puts you
// part-way through) belongs to whichever rect is nearest, so this never returns nothing.
function roomAt(x, z) {
    for (const r of roomOrder) {
        if (Math.abs(x - r.ox) <= r.hx && Math.abs(z - r.oz) <= r.hz) return r;
    }
    let best = roomOrder[0], bestD = Infinity;
    roomOrder.forEach(r => {
        const dx = Math.max(Math.abs(x - r.ox) - r.hx, 0);
        const dz = Math.max(Math.abs(z - r.oz) - r.hz, 0);
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = r; }
    });
    return best;
}

function registerRoom(spec) {
    const room = {
        id: spec.id,
        label: spec.label,
        spec,
        ox: spec.ox, oz: spec.oz, hx: spec.hx, hz: spec.hz,
        spawn: { x: spec.ox + spec.spawn.x, z: spec.oz + spec.spawn.z },
        arrive: spec.arrive,
        restock: spec.restock || null,
        deliveryTimer: 0,
        // Masonry contains every room in the plan. The base is the exception: its cutaway shell
        // is drawn by world/burrow.js and never registered, so it keeps the invisible rect.
        clamp: !!spec.clamp,
        // The kitchen and the base predate the registry and keep their own global arrays,
        // which half the game already reads by name (kitchenObstacles, cameraCollisionMeshes,
        // burrowObstacles, burrowCollision). A spec hands those arrays over so they ARE the
        // room's lists rather than copies of them; rooms built purely from data get fresh ones.
        obstacles: spec.obstacles || [],
        collision: spec.collision || [],
        lights: [],
        portals: [],
        group: null
    };
    room.obstacles.length = 0;
    room.collision.length = 0;

    (spec.doors || []).forEach((d, i) => {
        const own = d.hole || d.exit;
        const inward = INWARD[d.side];
        const alongX = d.side === 'north' || d.side === 'south';
        // A doorway stands on its room's own edge line, at `at` along it from the room's centre.
        // Two rooms that name each other put it on the same point, and the wall builder cuts one
        // gap there — that is the whole trick of tiling rooms instead of parking them apart.
        const x = own ? own.x : room.ox + (alongX ? (d.at || 0) : (d.side === 'east' ? room.hx : -room.hx));
        const z = own ? own.z : room.oz + (alongX ? (d.side === 'north' ? -room.hz : room.hz) : (d.at || 0));
        room.portals.push({
            id: room.id + '>' + d.to,
            to: d.to,
            side: d.side,
            at: d.at || 0,
            x, z,
            // Width of the hole in the masonry. A bespoke portal cuts none unless its spec asks
            // for it: the mouse hole is a chute big enough for a cheese wheel, the base's exit
            // is an arch world/burrow.js painted into a wall of its own.
            width: own ? (d.gap || 0) : DOOR_W,
            radius: own ? own.radius : 0,
            enter: own ? { x: x + inward[0] * ARRIVE_INSET, z: z + inward[1] * ARRIVE_INSET } : null,
            bespoke: !!own,
            glow: null,
            phase: i * 1.7
        });
    });

    rooms[spec.id] = room;
    roomOrder.push(room);
    return room;
}

function buildHouse() {
    ROOMS.forEach(spec => {
        const room = registerRoom(spec);
        buildRoom(room);
        if (spec.build) window[spec.build](room);
    });
    // After every room exists: a wall two rooms share has to be built once, for both of them.
    buildMasonry();
    collectSolidGeometry();
    // Once, here: actors/chef.js only ever walks this list, and the beat is authored in world
    // coordinates so it can cross a doorway without two room specs having to agree on a join.
    chefWaypoints = CHEF_BEAT.map(p => new THREE.Vector3(p[0], 0, p[1]));
    lightActiveRoom(true);
    // Raycasts read matrixWorld without refreshing it, and every wall and counter now lives
    // inside a group rather than the scene root. Refresh once so the chef's line of sight and
    // the camera's collision test see real world positions from the first frame.
    scene.updateMatrixWorld(true);
}

function buildRoom(room) {
    const spec = room.spec;
    room.group = new THREE.Group();
    scene.add(room.group);

    if (spec.floor) buildRoomFloor(room);
    (spec.furniture || []).forEach(f => buildRoomPiece(room, f));

    (spec.lights || []).forEach(l => {
        const light = new THREE.PointLight(l.color, l.intensity, l.distance, l.decay === undefined ? 2 : l.decay);
        light.position.set(room.ox + l.x, l.y, room.oz + l.z);
        room.group.add(light);
        room.lights.push(light);
    });
}

function buildRoomFloor(room) {
    const f = room.spec.floor;
    // Exactly to the rect edge, no further: the wall is built ON that edge and straddles it, so
    // two neighbouring floors meet under its centre instead of overlapping each other — coplanar
    // sheets in one place is the z-fighting that makes a floor crawl.
    const sx = room.hx * 2, sz = room.hz * 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = f.a; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = f.b; ctx.fillRect(0, 0, 32, 32); ctx.fillRect(32, 32, 32, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    // Tiles stay square in every room because the repeat follows the room's own size.
    tex.repeat.set(sx / f.tile, sz / f.tile);
    tex.magFilter = THREE.NearestFilter;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz),
        new THREE.MeshStandardMaterial({ map: tex, roughness: f.rough === undefined ? 0.5 : f.rough, flatShading: true }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(room.ox, 0, room.oz);
    floor.receiveShadow = true;
    room.group.add(floor);
}

// ---- masonry -----------------------------------------------------------------
// Walls used to be scenery the clamp behind them made solid, drawn once per room. That stops
// working the moment rooms share an edge: the two copies land a hair apart, the mouse wedges
// between two coplanar slabs, the camera's raycast gets two hits at the same distance, and a
// "doorway" is a decal on a wall you cannot walk through. So the whole house's walls are built
// here instead, once, as obstacles with real gaps cut where the doors are.
const wallBoxes = [];        // { x, z, w, d, h } for every merged run
const wallMeshes = [];       // ... and every mesh the orbit camera must not pass through
let houseStructure = null;   // one group, because the masonry belongs to no single room

const round3 = n => +n.toFixed(3);

// Every room edge laid onto the line it falls on: { axis, line, from, to, spec }. `axis` is the
// direction the run extends along, so a north or south edge is an 'x' line at its z.
function houseWallLines() {
    const lines = {};
    roomOrder.forEach(room => {
        const w = room.spec.wall;
        if (!w) return;
        [{ axis: 'x', line: room.oz - room.hz, from: room.ox - room.hx, to: room.ox + room.hx },
        { axis: 'x', line: room.oz + room.hz, from: room.ox - room.hx, to: room.ox + room.hx },
        { axis: 'z', line: room.ox - room.hx, from: room.oz - room.hz, to: room.oz + room.hz },
        { axis: 'z', line: room.ox + room.hx, from: room.oz - room.hz, to: room.oz + room.hz }]
            .forEach(e => {
                // Rounded, because two rooms can reach the same edge by different arithmetic:
                // the pantry puts its east face at -25.35 + 10, the kitchen its west at -15.35.
                const line = round3(e.line), from = round3(e.from), to = round3(e.to);
                const key = e.axis + '|' + line;
                const l = lines[key] || (lines[key] = { key, axis: e.axis, line, from, to, spec: w, rooms: [] });
                l.from = Math.min(l.from, from);
                l.to = Math.max(l.to, to);
                // Two rooms that share this wall may want different heights: the taller wins the
                // whole line, so neither of them can see over a wall the other one leaned on.
                if (w.height > l.spec.height) l.spec = w;
                l.rooms.push(room.id);
            });
    });
    return lines;
}

// One record per real opening in the masonry, both halves of a pair folded into it.
function houseDoorways() {
    const doors = [];
    roomOrder.forEach(room => room.portals.forEach(p => {
        if (!p.width) return;            // an arch another module drew into its own wall
        const alongX = p.side === 'north' || p.side === 'south';
        const axis = alongX ? 'x' : 'z';
        const line = round3(alongX ? p.z : p.x);
        const at = round3(alongX ? p.x : p.z);
        const key = axis + '|' + line;
        let d = doors.find(o => o.key === key && o.at === at);
        if (!d) doors.push(d = { key, axis, line, at, width: p.width, bespoke: p.bespoke, sides: [] });
        d.sides.push({ portal: p, room });
    }));
    return doors;
}

function buildMasonry() {
    houseStructure = new THREE.Group();
    scene.add(houseStructure);

    const lines = houseWallLines();
    const doors = houseDoorways();

    Object.keys(lines).forEach(key => {
        const l = lines[key];
        l.mat = new THREE.MeshStandardMaterial({
            color: l.spec.color, roughness: l.spec.rough === undefined ? 0.8 : l.spec.rough
        });
        const t = l.spec.thickness;
        // Stretch the span by half its own thickness at each end, so where two walls meet at a
        // corner they overlap instead of leaving a see-through sliver at the joint.
        const from = l.from - t / 2, to = l.to + t / 2;
        const gaps = doors.filter(d => d.key === key).sort((a, b) => a.at - b.at);

        let cursor = from;
        gaps.forEach(d => {
            const a = Math.max(from, d.at - d.width / 2);
            const b = Math.min(to, d.at + d.width / 2);
            wallPanel(l, cursor, a, 0, l.spec.height, true);
            wallPanel(l, a, b, DOOR_H, l.spec.height, false);   // lintel over the opening
            cursor = b;
        });
        wallPanel(l, cursor, to, 0, l.spec.height, true);
    });

    doors.forEach(d => {
        const wall = lines[d.key].spec;
        buildThreshold(d, wall);
        if (!d.bespoke) buildDoorway(d, wall);
    });
}

// Each room's floor stops at its own rect edge and the masonry is built on that line, so the
// band of wall an opening cuts through has no floor under it. A threshold slab fills it — the
// strip of stone you step over to get from one room to the next. Camera geometry only: it
// stands a few centimetres proud, which is nothing to a mouse, and registering it would give
// every doorway a lip to snag a rolling wheel on.
function buildThreshold(d, wall) {
    const alongX = d.axis === 'x';
    const slab = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(d.width, 0.04, wall.thickness + 0.02)
            : new THREE.BoxGeometry(wall.thickness + 0.02, 0.04, d.width),
        new THREE.MeshStandardMaterial({
            color: new THREE.Color(wall.trim || 0x8a6a45).lerp(new THREE.Color(0xffffff), 0.25),
            flatShading: true, roughness: 0.7
        }));
    slab.position.set(alongX ? d.at : d.line, 0.01, alongX ? d.line : d.at);
    slab.receiveShadow = true;
    houseStructure.add(slab);
    wallMeshes.push(slab);
}

function wallPanel(line, from, to, y0, y1, isRun) {
    const len = to - from, h = y1 - y0;
    if (len < 0.02 || h < 0.02) return;
    const t = line.spec.thickness, mid = (from + to) / 2;
    const alongX = line.axis === 'x';
    const mesh = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(len, h, t) : new THREE.BoxGeometry(t, h, len), line.mat);
    mesh.position.set(alongX ? mid : line.line, y0 + h / 2, alongX ? line.line : mid);
    mesh.receiveShadow = true;
    houseStructure.add(mesh);
    wallMeshes.push(mesh);
    // Only the run from the floor up is an obstacle. The lintel over a doorway is not: the
    // contract has no underside, so registering it would fill the opening it stands above.
    if (isRun) {
        wallBoxes.push(alongX
            ? { x: mid, z: line.line, w: len, d: t, h: y1 }
            : { x: line.line, z: mid, w: t, d: len, h: y1 });
    }
}

// A doorway's dressing, built once for the pair: a frame around the opening and a floor marker
// bulging into each of the two rooms it joins. No dark backing panel — with the next room now
// genuinely on the other side, a panel there would be a wall with a picture of a door on it.
function buildDoorway(d, wall) {
    const alongX = d.axis === 'x';
    const t = wall.thickness;
    const cx = alongX ? d.at : d.line, cz = alongX ? d.line : d.at;
    const trimMat = new THREE.MeshStandardMaterial({ color: wall.trim || 0x8a6a45, flatShading: true, roughness: 0.6 });
    // A hedge is shorter than a door arch, and a frame standing over it would read as a floating
    // shelf — so the opening tops out wherever the masonry does.
    const archH = Math.min(DOOR_H, wall.height);

    const jamb = (s) => {
        const off = s * (d.width / 2 + 0.11);
        const mesh = new THREE.Mesh(alongX
            ? new THREE.BoxGeometry(0.22, archH + 0.22, t + 0.24)
            : new THREE.BoxGeometry(t + 0.24, archH + 0.22, 0.22), trimMat);
        mesh.position.set(alongX ? cx + off : cx, (archH + 0.22) / 2, alongX ? cz : cz + off);
        mesh.castShadow = true;
        houseStructure.add(mesh);
    };
    jamb(-1); jamb(1);

    if (wall.height > archH + 0.02) {
        const head = new THREE.Mesh(alongX
            ? new THREE.BoxGeometry(d.width + 0.44, 0.24, t + 0.24)
            : new THREE.BoxGeometry(t + 0.24, 0.24, d.width + 0.44), trimMat);
        head.position.set(cx, archH + 0.24, cz);
        head.castShadow = true;
        houseStructure.add(head);
    }

    d.sides.forEach(({ portal, room }) => {
        const inward = INWARD[portal.side];
        const spin = new THREE.Group();
        spin.position.set(cx, 0.02, cz);
        spin.rotation.y = Math.atan2(-inward[0], -inward[1]);
        const glow = new THREE.Mesh(
            new THREE.RingGeometry(d.width / 2, d.width / 2 + 0.85, 26, 1, 0, Math.PI),
            new THREE.MeshBasicMaterial({
                color: portal.glowColor || room.spec.doorGlow || 0x7fd4ff,
                transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false
            }));
        glow.rotation.x = -Math.PI / 2;
        spin.add(glow);
        room.group.add(spin);
        portal.glow = glow;
    });
}

// Everything in the house that stops a body or a raycast: every room's own furniture plus the
// merged masonry. Physics and the camera read these rather than one room's list, because the
// rooms are connected now — a wheel shoved out of the pantry has to stop in the kitchen's
// doorway, not roll through the wall it came out of.
function collectSolidGeometry() {
    worldObstacles.length = 0;
    worldCollisionMeshes.length = 0;
    roomOrder.forEach(r => {
        worldObstacles.push(...r.obstacles);
        worldCollisionMeshes.push(...r.collision);
    });
    worldObstacles.push(...wallBoxes);
    worldCollisionMeshes.push(...wallMeshes);
}

function roomGeometry(f) {
    if (f.shape === 'cyl') {
        const rt = f.rt === undefined ? f.w / 2 : f.rt;
        const rb = f.rb === undefined ? f.w / 2 : f.rb;
        return new THREE.CylinderGeometry(rt, rb, f.h, f.segments || 10);
    }
    if (f.shape === 'sphere') return new THREE.SphereGeometry(f.r, f.segments || 8, (f.segments || 8) - 2);
    return new THREE.BoxGeometry(f.w, f.h, f.d);
}

function roomMaterial(f) {
    return new THREE.MeshStandardMaterial({
        color: f.color,
        flatShading: f.flat !== false,
        roughness: f.rough === undefined ? 0.5 : f.rough,
        metalness: f.metal || 0
    });
}

function roomFootprint(f) {
    if (f.shape === 'sphere') return f.r * 2;
    if (f.shape === 'cyl') {
        const rt = f.rt === undefined ? f.w / 2 : f.rt;
        const rb = f.rb === undefined ? f.w / 2 : f.rb;
        return Math.max(rt, rb) * 2;
    }
    return null;
}

// One mesh out of a furniture spec. `blocks` makes it an obstacle (so it also becomes a
// surface things can rest on), `hitsCamera` makes it stop the orbit camera.
function addRoomShape(room, f, x, z, blocks, hitsCamera) {
    const y = f.y || 0;
    const mesh = new THREE.Mesh(roomGeometry(f), roomMaterial(f));
    mesh.position.set(x, f.shape === 'sphere' ? y + f.r : y + f.h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    room.group.add(mesh);
    if (hitsCamera) room.collision.push(mesh);
    if (blocks) {
        const round = roomFootprint(f);
        room.obstacles.push({ x, z, w: round === null ? f.w : round * 0.9, d: round === null ? f.d : round * 0.9, h: y + (f.shape === 'sphere' ? f.r * 2 : f.h) });
    }
    return mesh;
}

function buildRoomPiece(room, f) {
    const x = room.ox + f.x, z = room.oz + f.z;
    if (f.kind === 'counter') return addRoomBlock(room, f.w, f.h, f.d, x, z, f.color);
    if (f.kind === 'solid') return addRoomShape(room, f, x, z, true, true);
    if (f.kind === 'visual') return addRoomShape(room, f, x, z, false, true);
    return addRoomShape(room, f, x, z, false, false);
}

// A worktop: the box plus a lighter slab overhanging it on all four sides.
function addRoomBlock(room, w, h, d, x, z, color) {
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.5 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.02, d), mat);
    mesh.position.set(x, (h - 0.02) / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    room.group.add(mesh);

    const slabMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4),
        flatShading: true, roughness: 0.4
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.12, d + 0.12), slabMat);
    slab.position.set(x, h - 0.06, z);
    slab.castShadow = slab.receiveShadow = true;
    room.group.add(slab);

    room.obstacles.push({ x, z, w, d, h });
    room.collision.push(mesh, slab);
    return mesh;
}

// Positional wrappers, because world/fridge.js builds the appliance out of them.
function addRoomSolid(room, w, h, d, x, z, color, y = 0) {
    return addRoomShape(room, { kind: 'solid', w, h, d, color, y }, x, z, true, true);
}

function addRoomVisual(room, w, h, d, x, y, z, color) {
    // Here y is the centre of the box, which is how the fridge authors its shelves.
    return addRoomShape(room, { kind: 'visual', w, h, d, color, y: y - h / 2 }, x, z, false, true);
}

// A bespoke portal drew its own floor marker; hand it over so one loop pulses every door.
function linkPortalGlow(roomId, toId, mesh) {
    const portal = roomById(roomId).portals.find(p => p.to === toId);
    if (portal) portal.glow = mesh;
}

function updatePortalGlows(time) {
    roomOrder.forEach(room => room.portals.forEach(p => {
        if (!p.glow) return;
        p.glow.material.opacity = 0.13 + Math.abs(Math.sin(time * 0.0022 + p.phase)) * 0.16;
    }));
}

// Where you appear when a portal that jumps carries you through it: just inside, clear of its
// own trigger circle. Ordinary doorways have no arrival point at all — you walk through those
// and never leave the floor you were on. Falls back to the room's spawn for anything else,
// including a restart.
function arrivalFor(room, fromId) {
    const back = room.portals.find(p => p.to === fromId);
    return (back && back.enter) || room.spawn;
}

// One key light serves the whole house, so it moves with the player: its shadow frustum is
// only ever as wide as the room being lit, and only that room's own lamps are switched on.
// Seven rooms of point lights in every fragment shader is the difference between this and a
// slideshow on a phone.
//
// Which room it stands over is a goal rather than a jump. The rooms are next door to each
// other now, so putting the light straight on the new room's centre used to move it 23 units
// in one frame at a doorway — and everything the frustum left behind stopped casting at all,
// which read as the room behind you letting go of its shadows. `updateKeyLight` walks it there
// over about half a second instead, at roughly the pace of the doorway you are crossing. The two
// gates that fade still snap, because the black cover is what hides the cut there.
const keyGoal = { x: 12, y: 20, z: 10, tx: 0, tz: 0, d: 24 };

function lightActiveRoom(snap) {
    const room = activeRoom();
    roomOrder.forEach(r => r.lights.forEach(l => { l.visible = r === room; }));
    if (!keyLight) return;

    keyGoal.x = room.ox + 12; keyGoal.y = 20; keyGoal.z = room.oz + 10;
    keyGoal.tx = room.ox; keyGoal.tz = room.oz;
    keyGoal.d = Math.max(room.hx, room.hz) + 6;
    if (snap) placeKeyLight(1);
}

// Called every frame from main.js, and with dt = 1 by the snap above.
function updateKeyLight(dt) {
    placeKeyLight(Math.min(1, dt * 6));
}

function placeKeyLight(k) {
    const shadow = keyLight.shadow.camera;
    const pos = keyLight.position, aim = keyLight.target.position;
    const gap = Math.max(Math.abs(keyGoal.x - pos.x), Math.abs(keyGoal.z - pos.z),
        Math.abs(keyGoal.tx - aim.x), Math.abs(keyGoal.tz - aim.z), Math.abs(keyGoal.d - shadow.right));
    if (gap < 0.004) return;                 // parked over the room it belongs to

    const to = (from, goal) => gap < 0.02 ? goal : from + (goal - from) * k;
    pos.set(to(pos.x, keyGoal.x), keyGoal.y, to(pos.z, keyGoal.z));
    aim.set(to(aim.x, keyGoal.tx), 0, to(aim.z, keyGoal.tz));
    keyLight.target.updateMatrixWorld();

    const d = to(shadow.right, keyGoal.d);
    shadow.left = -d; shadow.right = d; shadow.top = d; shadow.bottom = -d;
    shadow.updateProjectionMatrix();
}
