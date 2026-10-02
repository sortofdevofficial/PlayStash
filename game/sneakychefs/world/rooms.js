/**
 * world/rooms.js — the room registry, and the builder that turns map/rooms.js into geometry.
 *
 * Every room in the house is one record here: its rect in the shared scene, the obstacles and
 * camera-collision meshes inside it, the doors out of it and the glass in its walls, its lights
 * and its restock rule. world/physics.js, core/areas.js and world/ingredients.js all ask this
 * registry what the room at a given point looks like, and nothing else in the game knows the
 * layout.
 *
 * buildRoom builds the parts a spec declares on its own — floor, furniture, lights — then calls
 * the spec's own `build` hook for the things only one room has (the kitchen's fridge, the base's
 * stash pile). The walls are different: rooms tile edge to edge, so two of them describe the
 * same stretch of masonry from opposite sides, and buildMasonry builds every wall in the house
 * once instead. A doorway is then a real gap cut through the merged run, so
 * the wall is not just how the house looks — it is what stops you, and the two rooms either side
 * of it are the two you can walk between.
 *
 * buildHouse also lays out the hunter's beat. map/rooms.js writes it as one ordered walk through
 * several rooms, so no single room spec can own it and this is where it becomes waypoints.
 *
 * Then it puts a roof on the house: buildRoofs caps every room whose spec asks for one with a
 * slab at the top of its own walls, buildGable pitches that slab with a shallow gable, and
 * updateRoofs drops whichever roofs stand between the mouse and the orbit lens, once the lens has
 * climbed above the slab's underside. The pitch is built as children of the slab, so the one flag
 * the cutaway flips takes the whole roof with it. That cutaway is not a nicety — the camera flies
 * above the wall heads by design, so a roof it could not see through would be a lid on the game —
 * and the height test is what keeps a room a room at the poses the game opens at. It is also why
 * the no-overlap rule matters twice over: because no two rects share a floor, two neighbours'
 * slabs can meet at a party wall at different heights without one passing through the other.
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
 * A window is the one opening that wants exactly that. It is cut on a wall line the same way a
 * doorway is, but on an exterior wall — the line only one room claims — and it is a view rather
 * than a way out: the band is left open to the eye and closed to a body by one undrawn column at
 * the wall's own height. Since the contract has no underside, keeping a window's span solid means
 * registering the whole span, which is the opposite of what a doorway does with the masonry over
 * it.
 */
const rooms = {};
const roomOrder = [];

const DOOR_W = 2.6;       // the gap a doorway cuts in a wall, unless its spec asks for a
                          // narrower one with `gap` — the mouse hole is a hole, not a door
const DOOR_H = 2.7;       // ... and the lintel that closes the wall off above it

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
        restock: spec.restock || null,
        deliveryTimer: 0,
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

    (spec.doors || []).forEach(d => {
        const alongX = d.side === 'north' || d.side === 'south';
        // A doorway stands on its room's own edge line, at `at` along it from the room's centre.
        // Two rooms that name each other put it on the same point, and the wall builder cuts one
        // gap there — that is the whole trick of tiling rooms instead of parking them apart.
        room.portals.push({
            id: room.id + '>' + d.to,
            to: d.to,
            side: d.side,
            x: room.ox + (alongX ? (d.at || 0) : (d.side === 'east' ? room.hx : -room.hx)),
            z: room.oz + (alongX ? (d.side === 'north' ? -room.hz : room.hz) : (d.at || 0)),
            // Width of the hole in the masonry. A door names the room it joins, so it always cuts
            // one; `gap` narrows it where the opening should read as a hole rather than a doorway.
            width: d.gap || DOOR_W
        });
    });

    room.windows = (spec.windows || []).map(w => {
        const alongX = w.side === 'north' || w.side === 'south';
        return {
            id: room.id + '@' + w.side + ':' + (w.at || 0),
            side: w.side,
            room: room.id,
            x: room.ox + (alongX ? (w.at || 0) : (w.side === 'east' ? room.hx : -room.hx)),
            z: room.oz + (alongX ? (w.side === 'north' ? -room.hz : room.hz) : (w.at || 0)),
            width: w.width || 4,
            sill: w.sill === undefined ? 1.6 : w.sill,
            head: w.head === undefined ? 3.6 : w.head
        };
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
    // On top of the masonry it just laid, and before the collection below because a roof is in
    // neither list it reads — see the roof section.
    buildRoofs();
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
        const alongX = p.side === 'north' || p.side === 'south';
        const axis = alongX ? 'x' : 'z';
        const line = round3(alongX ? p.z : p.x);
        const at = round3(alongX ? p.x : p.z);
        const key = axis + '|' + line;
        // Both halves of a pair land on the same key and the same point, so one opening is cut
        // once however many rooms name it.
        if (!doors.find(d => d.key === key && d.at === at))
            doors.push({ key, axis, line, at, width: p.width });
    }));
    return doors;
}

// The same fold for the glass: a window is an opening on a wall line like a door is, and it has
// to be cut by the builder that owns that line rather than by the room that asked for it. Unlike
// a door it does not reach the floor, so it carries a sill and a head as well as a width.
function houseWindows() {
    const wins = [];
    roomOrder.forEach(room => (room.windows || []).forEach(w => {
        const alongX = w.side === 'north' || w.side === 'south';
        const axis = alongX ? 'x' : 'z';
        const line = round3(alongX ? w.z : w.x);
        const at = round3(alongX ? w.x : w.z);
        wins.push({ key: axis + '|' + line, axis, line, at, width: w.width, sill: w.sill, head: w.head, room: w.room, id: w.id });
    }));
    return wins;
}

function buildMasonry() {
    houseStructure = new THREE.Group();
    scene.add(houseStructure);

    const lines = houseWallLines();
    const doors = houseDoorways();
    const wins = houseWindows();

    Object.keys(lines).forEach(key => {
        const l = lines[key];
        l.mat = new THREE.MeshStandardMaterial({
            color: l.spec.color, roughness: l.spec.rough === undefined ? 0.8 : l.spec.rough
        });
        const t = l.spec.thickness;
        // Stretch the span by half its own thickness at each end, so where two walls meet at a
        // corner they overlap instead of leaving a see-through sliver at the joint.
        const from = l.from - t / 2, to = l.to + t / 2;
        const openings = [
            ...doors.filter(d => d.key === key).map(d => ({ kind: 'door', at: d.at, width: d.width })),
            ...wins.filter(w => w.key === key).map(w => ({
                kind: 'window', at: w.at, width: w.width,
                sill: w.sill, head: Math.min(w.head, l.spec.height - 0.4)
            }))
        ].sort((a, b) => a.at - b.at);

        let cursor = from;
        openings.forEach(o => {
            const a = Math.max(from, o.at - o.width / 2);
            const b = Math.min(to, o.at + o.width / 2);
            wallPanel(l, cursor, a, 0, l.spec.height, true);
            if (o.kind === 'door') {
                wallPanel(l, a, b, DOOR_H, l.spec.height, false);   // lintel over the opening
            } else {
                // Glass does not reach the floor, so the masonry below and above it is drawn and
                // the band between is left open — and windowBlocker puts the wall back for the
                // only thing that has to care: a body.
                wallPanel(l, a, b, 0, o.sill, false);
                wallPanel(l, a, b, o.head, l.spec.height, false);
                windowBlocker(l, a, b);
            }
            cursor = b;
        });
        wallPanel(l, cursor, to, 0, l.spec.height, true);
    });

    doors.forEach(d => {
        const wall = lines[d.key].spec;
        buildThreshold(d, wall);
        buildDoorway(d, wall);
    });
    wins.forEach(w => buildWindow(w, lines[w.key]));
}

// A window is a hole the mouse cannot use. The obstacle contract is a column from the floor to
// `h` with no underside, so the whole span gets one column at the wall's own height: the view
// out is real and the way out is not. It is deliberately not drawn — the sill and head panels
// above it are the visible masonry, and this is the part that only physics ever sees.
function windowBlocker(line, from, to) {
    const t = line.spec.thickness, mid = (from + to) / 2;
    const alongX = line.axis === 'x';
    wallBoxes.push(alongX
        ? { x: mid, z: line.line, w: to - from, d: t, h: line.spec.height }
        : { x: line.line, z: mid, w: t, d: to - from, h: line.spec.height });
}

// The glass and its one cross bar. The pane is registered as camera geometry, which is what
// keeps the orbit camera inside the room while still letting it press right up to the window,
// and it is a real mesh rather than an invisible one because a mouse at a sill should see a
// window and not an opening onto a six-lane road.
function buildWindow(w, line) {
    const alongX = line.axis === 'x';
    const t = line.spec.thickness;
    const cx = alongX ? w.at : w.line, cz = alongX ? w.line : w.at;
    const band = Math.min(w.head, line.spec.height - 0.4) - w.sill;

    const pane = new THREE.Mesh(alongX
        ? new THREE.BoxGeometry(w.width, band, t * 0.25)
        : new THREE.BoxGeometry(t * 0.25, band, w.width),
        new THREE.MeshStandardMaterial({
            color: 0xa8c8e8, transparent: true, opacity: 0.13, roughness: 0.08, metalness: 0
        }));
    pane.position.set(cx, w.sill + band / 2, cz);
    houseStructure.add(pane);
    wallMeshes.push(pane);

    const mullion = new THREE.Mesh(alongX
        ? new THREE.BoxGeometry(0.18, band, t + 0.1)
        : new THREE.BoxGeometry(t + 0.1, band, 0.18),
        new THREE.MeshStandardMaterial({ color: line.spec.trim || 0x8a6a45, flatShading: true, roughness: 0.6 }));
    mullion.position.set(cx, w.sill + band / 2, cz);
    houseStructure.add(mullion);
    wallMeshes.push(mullion);
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

// A doorway's dressing, built once for the pair: a frame around the opening. No dark backing
// panel — with the next room genuinely on the other side, a panel there would be a wall with a
// picture of a door on it — and no marker on the floor, because a doorway is only a hole in the
// masonry and anything that drew the eye to it would promise a gate that is not there.
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
}

// ---- roofs ------------------------------------------------------------------
// Open-topped rooms were fine while the house was the only thing in the scene. With a street and
// a skyline outside it, the plan reads from the road as a pile of quarried pits, so every room
// now gets capped at the top of its own walls.
//
// A roof is drawn and nothing else. It joins neither `worldObstacles` nor `worldCollisionMeshes`,
// for two reasons: an obstacle is a column from the floor to `h` with no underside, so a slab
// registered as one would fill the room it covers; and the camera's raycast reads the mesh list
// without skipping the meshes that are currently hidden, so a registered roof would go on
// pulling the lens in after the cutaway below had already made it invisible. That is the one
// thing that would make a roof unplayable here — the orbit camera lives above the wall heads.
const roofMeshes = [];

// Does another roofed room's rect reach this one's edge along the line it lies on? Rooms tile
// edge to edge, so the test is exact rather than a proximity check: the neighbour's far edge is
// on the same line and its run down that line overlaps ours. A room with no roof of its own does
// not count, which is what lets the sitting room overhang the garden.
function roofEdgeHasNeighbour(room, side) {
    const alongX = side === 'north' || side === 'south';
    const line = round3(alongX ? (side === 'north' ? room.oz - room.hz : room.oz + room.hz)
        : (side === 'west' ? room.ox - room.hx : room.ox + room.hx));
    const a0 = alongX ? room.ox - room.hx : room.oz - room.hz;
    const a1 = alongX ? room.ox + room.hx : room.oz + room.hz;
    return roomOrder.some(o => {
        if (o === room || o.spec.roof === false) return false;
        const far = round3(alongX ? (side === 'north' ? o.oz + o.hz : o.oz - o.hz)
            : (side === 'west' ? o.ox + o.hx : o.ox - o.hx));
        if (far !== line) return false;
        const b0 = alongX ? o.ox - o.hx : o.oz - o.hz;
        const b1 = alongX ? o.ox + o.hx : o.oz + o.hz;
        return Math.min(a1, b1) - Math.max(a0, b0) > 1e-6;
    });
}

function buildRoofs() {
    roomOrder.forEach(room => {
        if (room.spec.roof === false) return;          // open to the sky
        const r = room.spec.roof || {};
        const t = r.thickness === undefined ? 0.8 : r.thickness;
        const y0 = room.spec.wall.height;
        // An eaves only where the edge faces the outside. Past a party wall the slab would stick
        // into the next room's ceiling — and where the two rooms are different heights, which
        // most of them are, it would stick through the other one's roof as well.
        const over = side => (roofEdgeHasNeighbour(room, side) ? 0 : (r.overhang === undefined ? 1.2 : r.overhang));
        const n = over('north'), s = over('south'), w = over('west'), e = over('east');
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(room.hx * 2 + w + e, t, room.hz * 2 + n + s),
            new THREE.MeshStandardMaterial({
                color: r.color === undefined ? 0x2b2f3a : r.color,
                roughness: r.rough === undefined ? 0.95 : r.rough
            }));
        mesh.position.set(room.ox + (e - w) / 2, y0 + t / 2, room.oz + (s - n) / 2);
        // The key light is the only shadow caster in the game and it shines down from above, so
        // a roof that cast shadows would black out the room under it — which is always the one
        // the player is standing in.
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.rect = {
            x0: room.ox - room.hx - w, x1: room.ox + room.hx + e,
            z0: room.oz - room.hz - n, z1: room.oz + room.hz + s
        };
        mesh.userData.y0 = y0;
        room.group.add(mesh);
        room.roof = mesh;
        roofMeshes.push(mesh);
        buildGable(room, mesh, t);
    });
}

// The pitch: two panels, the triangles that close their ends, and a ridge cap, all of them
// CHILDREN of the slab. That is the whole trick — the cutaway flips one `visible` flag and the
// roof goes with it, so a pitched roof cannot strand a floating ridge over the player's head.
// It also means every piece has to stay inside the slab's own rect, because the occlusion test
// is a plan-view crossing of that rect and nothing else: a gable that stuck past the eaves
// would need a rule of its own. A neighbour's taller wall does come up through the pitch, which
// is what a party wall looks like where a row house's roofline steps.
function buildGable(room, slab, thickness) {
    const r = room.spec.roof || {};
    const rise = r.gable === undefined ? 1.6 : r.gable;
    if (rise <= 0.05) return;
    const rect = slab.userData.rect;
    const dX = rect.x1 - rect.x0, dZ = rect.z1 - rect.z0;
    const alongX = dX >= dZ;                    // the ridge runs down the longer axis
    const len = alongX ? dX : dZ;
    const half = (alongX ? dZ : dX) / 2 - 0.08;  // inset so the sloped thickness stays in the rect
    const L = Math.hypot(half, rise);
    const theta = Math.atan2(rise, half);
    const base = thickness / 2;                  // the slab's top face, in the slab's own frame
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r.color === undefined ? 0x2b2f3a : r.color).lerp(new THREE.Color(0xffffff), 0.1),
        roughness: 0.92, side: THREE.DoubleSide
    });
    const dress = mesh => {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        slab.add(mesh);
    };

    for (const s of [-1, 1]) {
        const panel = new THREE.Mesh(alongX
            ? new THREE.BoxGeometry(len, 0.22, L)
            : new THREE.BoxGeometry(L, 0.22, len), mat);
        if (alongX) {
            panel.rotation.x = s * theta;
            panel.position.set(0, base + rise / 2, s * half / 2);
        } else {
            panel.rotation.z = -s * theta;
            panel.position.set(s * half / 2, base + rise / 2, 0);
        }
        dress(panel);
    }

    // The gable ends: a triangle in the plane the ridge runs out of, closed by the slab under it.
    for (const s of [-1, 1]) {
        const at = s * len / 2;
        const [v1, v2, apex] = alongX
            ? [[at, base, -half], [at, base, half], [at, base + rise, 0]]
            : [[-half, base, at], [half, base, at], [0, base + rise, at]];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(
            [...v1, ...v2, ...apex], 3));
        g.computeVertexNormals();
        dress(new THREE.Mesh(g, mat));
    }

    const cap = new THREE.Mesh(alongX
        ? new THREE.BoxGeometry(len, 0.26, 0.36)
        : new THREE.BoxGeometry(0.36, 0.26, len), mat);
    cap.position.set(0, base + rise, 0);
    dress(cap);
    // The cap and the panels' top corners both sit proud of the nominal ridge by half their own
    // thickness, so this is the roof's highest point rather than the line it peaks on.
    slab.userData.apex = room.spec.wall.height + thickness + rise + 0.13;
}

// The cutaway: any roof the line from the mouse's feet to the lens passes over is off — but only
// once the lens has climbed above that slab's underside. Both halves are needed. The crossing
// covers the two ways a roof could break the game: it cannot hide the player, because his own
// room is always on that line, and the camera cannot end up inside it, because whatever the lens
// is hovering over is on it too. The height test is what leaves a ceiling standing when the lens
// is under it — at the default pose it is, and a mouse in his own house should be indoors. A
// lens below a slab cannot be occluded by it anyway: the segment runs from his feet, which are
// lower still, so both ends and every point between are under the underside.
function updateRoofs() {
    const px = mouseGroup.position.x, pz = mouseGroup.position.z;
    for (let i = 0; i < roofMeshes.length; i++) {
        const roof = roofMeshes[i];
        const rect = roof.userData.rect;
        roof.visible = !(camera.position.y > roof.userData.y0
            && segmentCrossesRect(px, pz, camera.position.x, camera.position.z, rect));
    }
}

// Segment against an axis-aligned rect, by clipping the segment's own t-range against each pair
// of slabs and seeing whether anything survives.
function segmentCrossesRect(ax, az, bx, bz, r) {
    let lo = 0, hi = 1;
    const clip = (a, b, min, max) => {
        const d = b - a;
        if (Math.abs(d) < 1e-9) return a >= min && a <= max;
        let t0 = (min - a) / d, t1 = (max - a) / d;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        lo = Math.max(lo, t0);
        hi = Math.min(hi, t1);
        return hi > lo;
    };
    return clip(ax, bx, r.x0, r.x1) && clip(az, bz, r.z0, r.z1);
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

// One key light serves the whole house, so it moves with the player: its shadow frustum is
// only ever as wide as the room being lit, and only that room's own lamps are switched on.
// Seven rooms of point lights in every fragment shader is the difference between this and a
// slideshow on a phone.
//
// Which room it stands over is a goal rather than a jump. The rooms are next door to each
// other now, so putting the light straight on the new room's centre used to move it 23 units
// in one frame at a doorway — and everything the frustum left behind stopped casting at all,
// which read as the room behind you letting go of its shadows. `updateKeyLight` walks it there
// over about half a second instead, at roughly the pace of the doorway you are crossing. A
// restart is the one thing that still snaps it, because a restart moves the player outright.
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
