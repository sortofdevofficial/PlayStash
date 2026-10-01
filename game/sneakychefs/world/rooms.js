/**
 * world/rooms.js — the room registry, and the builder that turns map/rooms.js into geometry.
 *
 * Every room in the house is one record here: its rect in the shared scene, the obstacles and
 * camera-collision meshes inside it, the doors out of it, its lights and its restock rule.
 * world/physics.js, core/areas.js, world/ingredients.js and core/minimap.js all ask this
 * registry what the room the player is standing in looks like, and nothing else in the game
 * knows the layout.
 *
 * buildRoom builds the parts a spec declares — floor, walls (with real gaps where the doors
 * are), furniture, door dressing and lights — then calls the spec's own `build` hook for the
 * things only one room has: the kitchen's fridge and mouse hole, the base's cutaway shell.
 *
 * Furniture kinds, and what each blocks:
 *   counter  box plus a lighter slab overhanging it — an obstacle and camera geometry
 *   solid    a column from its base up to y + h    — an obstacle and camera geometry
 *   visual   camera geometry only: the mouse walks under it (shelves, mantels, table tops)
 *   deco     nothing at all (rugs, books, flowers)
 * In map data `y` is always the BASE of a piece, so a floating shelf is a `visual` whose y is
 * its underside. The obstacle contract has no underside — it is a column topped at `h` — which
 * is exactly why anything you can walk under has to be `visual`.
 */
const rooms = {};
const roomOrder = [];

const WALL_PAD = 0.15;    // walls sit this far proud of the clamp rect, so the corners meet
const DOOR_W = 2.6;       // the gap a doorway cuts in a wall
const DOOR_H = 2.7;       // ... and the lintel closes it off above this
const DOOR_RADIUS = 1.05; // how close you have to get to a doorway to go through it
// Props fall through the mouse hole's painted mouth; the player gets a wider circle so walking
// into a doorway reads as an obvious door rather than a coincidence.
const PORTAL_ENTER_MARGIN = 0.4;
// How far inside a door you appear. It has to be more than the trigger radius plus the margin
// above, or arriving would cross you straight back.
const ARRIVE_INSET = 2.2;
const INWARD = { north: [0, 1], south: [0, -1], east: [-1, 0], west: [1, 0] };

function roomById(id) {
    return rooms[id];
}

function activeRoom() {
    return rooms[currentArea];
}

function registerRoom(spec) {
    const room = {
        id: spec.id,
        label: spec.label,
        spec,
        ox: spec.ox, oz: spec.oz, hx: spec.hx, hz: spec.hz,
        spawn: { x: spec.ox + spec.spawn.x, z: spec.oz + spec.spawn.z },
        arrive: spec.arrive,
        brain: spec.brain || null,
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

    (spec.doors || []).forEach((d, i) => {
        // A bespoke portal is one another module already drew — the mouse hole's arch, the
        // base's exit — so its circle comes from that module and the wall keeps its solid run.
        const own = d.hole || d.exit;
        const inward = INWARD[d.side];
        const x = own ? own.x : room.ox + (d.side === 'east' ? room.hx : d.side === 'west' ? -room.hx : d.at || 0);
        const z = own ? own.z : room.oz + (d.side === 'south' ? room.hz : d.side === 'north' ? -room.hz : d.at || 0);
        room.portals.push({
            id: room.id + '>' + d.to,
            to: d.to,
            side: d.side,
            at: d.at || 0,
            label: d.label || d.to.toUpperCase(),
            x, z,
            radius: own ? own.radius : (d.radius || DOOR_RADIUS),
            enter: { x: x + inward[0] * ARRIVE_INSET, z: z + inward[1] * ARRIVE_INSET },
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
    lightActiveRoom();
    // Raycasts read matrixWorld without refreshing it, and every wall and counter now lives
    // inside a room group rather than the scene root. Refresh once so the chef's line of
    // sight and the camera's collision test see real world positions from the first frame.
    scene.updateMatrixWorld(true);
}

function buildRoom(room) {
    const spec = room.spec;
    room.group = new THREE.Group();
    scene.add(room.group);

    if (spec.floor) buildRoomFloor(room);
    if (spec.wall) buildRoomWalls(room);
    (spec.furniture || []).forEach(f => buildRoomPiece(room, f));
    room.portals.forEach(p => { if (!p.bespoke) buildRoomDoor(room, p); });

    (spec.lights || []).forEach(l => {
        const light = new THREE.PointLight(l.color, l.intensity, l.distance, l.decay === undefined ? 2 : l.decay);
        light.position.set(room.ox + l.x, l.y, room.oz + l.z);
        room.group.add(light);
        room.lights.push(light);
    });
}

// A room's floor runs out to the middle of its own walls, which is what makes the walls read
// as the edge of the world instead of boxes dropped onto a bigger sheet.
function roomPad(room) {
    const wall = room.spec.wall;
    return (wall ? wall.thickness / 2 : 0.5) + WALL_PAD;
}

function buildRoomFloor(room) {
    const f = room.spec.floor;
    const pad = roomPad(room);
    const sx = 2 * (room.hx + pad), sz = 2 * (room.hz + pad);

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

// Walls are camera geometry, not obstacles: the clamp in world/physics.js is what contains the
// player. Each side is built as runs with a gap wherever a door is, plus a lintel over it, so
// a doorway is a real opening you can see through rather than a decal on a solid wall.
function buildRoomWalls(room) {
    const w = room.spec.wall;
    const t = w.thickness, h = w.height;
    const mat = new THREE.MeshStandardMaterial({ color: w.color, roughness: w.rough === undefined ? 0.8 : w.rough });
    const pad = roomPad(room);
    const halfX = room.hx + pad, halfZ = room.hz + pad;

    const sides = [
        { key: 'north', along: 'x', half: halfX, cx: room.ox, cz: room.oz - halfZ },
        { key: 'south', along: 'x', half: halfX, cx: room.ox, cz: room.oz + halfZ },
        { key: 'west', along: 'z', half: halfZ, cx: room.ox - halfX, cz: room.oz },
        { key: 'east', along: 'z', half: halfZ, cx: room.ox + halfX, cz: room.oz }
    ];

    sides.forEach(side => {
        const run = (a, b) => {
            const len = b - a;
            if (len < 0.02) return;
            const mid = (a + b) / 2;
            const geo = side.along === 'x'
                ? new THREE.BoxGeometry(len, h, t)
                : new THREE.BoxGeometry(t, h, len);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                side.along === 'x' ? side.cx + mid : side.cx,
                h / 2,
                side.along === 'x' ? side.cz : side.cz + mid);
            mesh.receiveShadow = true;
            room.group.add(mesh);
            room.collision.push(mesh);
        };

        const gaps = room.portals.filter(p => !p.bespoke && p.side === side.key)
            .map(p => p.at).sort((a, b) => a - b);

        let cursor = -side.half;
        gaps.forEach(at => {
            const a = Math.max(-side.half, at - DOOR_W / 2);
            const b = Math.min(side.half, at + DOOR_W / 2);
            run(cursor, a);
            // Lintel over the opening: keeps the wall a wall above head height.
            const over = h - DOOR_H;
            if (over > 0.02) {
                const geo = side.along === 'x'
                    ? new THREE.BoxGeometry(b - a, over, t)
                    : new THREE.BoxGeometry(t, over, b - a);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(
                    side.along === 'x' ? side.cx + (a + b) / 2 : side.cx,
                    DOOR_H + over / 2,
                    side.along === 'x' ? side.cz : side.cz + (a + b) / 2);
                mesh.receiveShadow = true;
                room.group.add(mesh);
                room.collision.push(mesh);
            }
            cursor = b;
        });
        run(cursor, side.half);
    });
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

// A doorway's dressing: darkness behind the opening so it reads as a way out rather than a
// window onto nothing, a frame around it, and a floor marker that pulses like the mouse hole.
function buildRoomDoor(room, p) {
    const w = room.spec.wall;
    const t = w.thickness;
    const trim = w.trim || 0x8a6a45;
    const inward = INWARD[p.side];
    const out = t / 2 + WALL_PAD;                 // door line to the wall's centre
    const wx = p.x - inward[0] * out, wz = p.z - inward[1] * out;
    const alongX = p.side === 'north' || p.side === 'south';

    const dark = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.3) : new THREE.BoxGeometry(0.3, DOOR_H, DOOR_W),
        new THREE.MeshBasicMaterial({ color: 0x07070b }));
    dark.position.set(wx - inward[0] * (t / 2 + 0.16), DOOR_H / 2, wz - inward[1] * (t / 2 + 0.16));
    room.group.add(dark);

    const trimMat = new THREE.MeshStandardMaterial({ color: trim, flatShading: true, roughness: 0.6 });
    const jamb = (side) => {
        const off = side * (DOOR_W / 2 + 0.11);
        const mesh = new THREE.Mesh(
            alongX ? new THREE.BoxGeometry(0.22, DOOR_H + 0.22, t + 0.24) : new THREE.BoxGeometry(t + 0.24, DOOR_H + 0.22, 0.22),
            trimMat);
        mesh.position.set(alongX ? wx + off : wx, (DOOR_H + 0.22) / 2, alongX ? wz : wz + off);
        mesh.castShadow = true;
        room.group.add(mesh);
    };
    jamb(-1); jamb(1);
    const head = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(DOOR_W + 0.44, 0.24, t + 0.24) : new THREE.BoxGeometry(t + 0.24, 0.24, DOOR_W + 0.44),
        trimMat);
    head.position.set(wx, DOOR_H + 0.24, wz);
    head.castShadow = true;
    room.group.add(head);

    // The marker bulges into the room: a half ring, spun about Y to face whichever way the
    // door faces. The parent group carries the spin so neither mesh needs a compound rotation.
    const spin = new THREE.Group();
    spin.position.set(p.x, 0.02, p.z);
    spin.rotation.y = Math.atan2(-inward[0], -inward[1]);
    const glow = new THREE.Mesh(
        new THREE.RingGeometry(p.radius, p.radius + 0.85, 26, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({
            color: p.glowColor || room.spec.doorGlow || 0x7fd4ff,
            transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false
        }));
    glow.rotation.x = -Math.PI / 2;
    spin.add(glow);
    room.group.add(spin);
    p.glow = glow;
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

// Where you appear when you come through a door: just inside it, clear of its own trigger.
// Falls back to the room's spawn for a room with no door back (which the ?qa rig treats as a
// map bug, so it should not happen).
function arrivalFor(room, fromId) {
    const back = room.portals.find(p => p.to === fromId);
    return back ? back.enter : room.spawn;
}

// One key light serves the whole house, so it moves with the player: its shadow frustum is
// only ever as wide as the room being lit, and only that room's own lamps are switched on.
// Seven rooms of point lights in every fragment shader is the difference between this and a
// slideshow on a phone.
function lightActiveRoom() {
    const room = activeRoom();
    roomOrder.forEach(r => r.lights.forEach(l => { l.visible = r === room; }));
    if (!keyLight) return;

    keyLight.position.set(room.ox + 12, 20, room.oz + 10);
    keyLight.target.position.set(room.ox, 0, room.oz);
    keyLight.target.updateMatrixWorld();

    const d = Math.max(room.hx, room.hz) + 6;
    const shadow = keyLight.shadow.camera;
    shadow.left = -d; shadow.right = d; shadow.top = d; shadow.bottom = -d;
    shadow.updateProjectionMatrix();
}
