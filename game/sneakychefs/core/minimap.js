/**
 * core/minimap.js — the house map in the corner of the screen.
 *
 * A connected floorplan is easy to get lost in, and a doorway you walked through ten seconds
 * ago is not a landmark you can see from here. So the plan is drawn to scale: every room from
 * the registry, a tick in the wall wherever a pair of doors faces through, one long line for
 * the gate that still jumps, the goods loose in the room you are standing in, the chef if he
 * shares it, and you.
 *
 * Nothing here is authored — the view is fitted to the registry at boot, so adding a room to
 * map/rooms.js rescales the map around it.
 */
const MAP_W = 210;
// The plan is two rows of rooms about 150 units across and 60 deep, so the card is wide and
// short. The fit below is uniform, which is what makes a square room look square.
const MAP_H = 96;
const MAP_PAD = 12;      // breathing room between the outermost wall and the card's edge

let mapCtx = null;
let mapView = null;      // { scale, cx, cz } — one uniform scale, so a square room is square

function initMinimap() {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;

    // Backing store at device resolution, CSS size at logical pixels: a 1px dot stays 1px.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;
    canvas.style.width = MAP_W + 'px';
    canvas.style.height = MAP_H + 'px';
    mapCtx = canvas.getContext('2d');
    mapCtx.scale(dpr, dpr);

    // Only the rooms you can walk between are fitted. The base keeps a rect clamp precisely
    // because it is not part of the plan — it sits hundreds of units off to one side, and if it
    // were in these bounds the whole house would shrink to a smear to make room for it.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    roomOrder.forEach(r => {
        if (r.clamp) return;
        minX = Math.min(minX, r.ox - r.hx); maxX = Math.max(maxX, r.ox + r.hx);
        minZ = Math.min(minZ, r.oz - r.hz); maxZ = Math.max(maxZ, r.oz + r.hz);
    });
    const scale = Math.min((MAP_W - MAP_PAD * 2) / (maxX - minX), (MAP_H - MAP_PAD * 2) / (maxZ - minZ));
    mapView = { scale, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

// World to map, pinned to the card. Screen Y runs down and world +Z runs "south", so no flip
// is needed: north (the kitchen's mouse-hole wall) is the top of the card, which is how the
// house is laid out. Anything off the fitted plan — the base, for one — lands on the edge,
// which reads as "somewhere that way, past the map" instead of vanishing.
function mapPoint(x, z) {
    return [
        THREE.MathUtils.clamp(MAP_W / 2 + (x - mapView.cx) * mapView.scale, 3, MAP_W - 3),
        THREE.MathUtils.clamp(MAP_H / 2 + (z - mapView.cz) * mapView.scale, 3, MAP_H - 3)
    ];
}

// Each pair of doors that face each other, once rather than once per side. A pair between the
// same two rooms at two different points is two links, which is why the dedupe is per portal
// and not per room pair.
function houseLinks() {
    const out = [];
    roomOrder.forEach(r => r.portals.forEach(p => {
        if (r.id >= p.to) return;                    // ... and only from one of the two sides
        const far = roomById(p.to);
        const back = far && far.portals.find(q => q.to === r.id);
        if (back) out.push({ a: p, b: back, from: r, to: far });
    }));
    return out;
}

function drawMinimap() {
    if (!mapCtx || !mapView) return;
    const ctx = mapCtx;
    const room = activeRoom();
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    const links = houseLinks();
    const isLive = l => l.from === room || l.to === room;

    // The gate that jumps: its two doors are hundreds of units apart, so it is the only link
    // with a line to draw. It goes under the rooms, and ends in a dot at the edge of the card —
    // the base is off this map, and that is the way to it.
    links.forEach(l => {
        if (Math.hypot(l.b.x - l.a.x, l.b.z - l.a.z) < 1) return;
        const out = l.from.clamp ? l.a : l.b;        // ... and the end that is not on the plan
        const [ax, ay] = mapPoint(l.a.x, l.a.z);
        const [bx, by] = mapPoint(l.b.x, l.b.z);
        const [ox, oy] = mapPoint(out.x, out.z);
        const live = isLive(l);
        ctx.strokeStyle = live ? 'rgba(255,190,0,0.75)' : 'rgba(200,210,230,0.22)';
        ctx.lineWidth = live ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.fillStyle = live ? 'rgba(255,190,0,0.9)' : 'rgba(200,210,230,0.35)';
        ctx.beginPath();
        ctx.arc(ox, oy, 2.6, 0, Math.PI * 2);
        ctx.fill();
    });

    roomOrder.forEach(r => {
        if (r.clamp) return;                 // the base is not on the plan; see the link above
        const [x, z] = mapPoint(r.ox - r.hx, r.oz - r.hz);
        const w = r.hx * 2 * mapView.scale, h = r.hz * 2 * mapView.scale;
        const here = r === room;

        // Each room keeps its own floor colour, so the map reads as a plan of the house
        // rather than seven identical boxes.
        ctx.globalAlpha = here ? 0.55 : 0.2;
        ctx.fillStyle = (r.spec.floor && r.spec.floor.a) || '#4a4a5a';
        ctx.fillRect(x, z, w, h);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = here ? '#ffbe00' : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = here ? 1.6 : 1;
        ctx.strokeRect(x + 0.5, z + 0.5, w - 1, h - 1);
    });

    // Doorways last, over the walls they cut: a pair of doors that face each other at the same
    // point is an opening, so it gets a tick drawn across the masonry it goes through.
    links.forEach(l => {
        if (Math.hypot(l.b.x - l.a.x, l.b.z - l.a.z) >= 1) return;
        const [x, y] = mapPoint(l.a.x, l.a.z);
        const wallRunsX = l.a.side === 'north' || l.a.side === 'south';
        ctx.strokeStyle = isLive(l) ? 'rgba(255,190,0,0.95)' : 'rgba(226,236,252,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wallRunsX ? x : x - 2.2, wallRunsX ? y - 2.2 : y);
        ctx.lineTo(wallRunsX ? x : x + 2.2, wallRunsX ? y + 2.2 : y);
        ctx.stroke();
    });

    // Only the room being stood in gets its goods drawn: at this scale the whole house's
    // loot would be a smear, and what you actually want to know is what is left in here.
    ctx.fillStyle = '#ffd76a';
    ingredients.forEach(i => {
        if (i.sunk || i.stashing || i.room !== room.id) return;
        const [x, z] = mapPoint(i.group.position.x, i.group.position.z);
        ctx.fillRect(x - 0.75, z - 0.75, 1.5, 1.5);
    });

    // The hunter, but only in his own kitchen — he cannot follow you through a doorway, and
    // a red dot sitting in an empty room three doors away would say otherwise.
    if (room.brain === 'chef' && chefGroup) {
        const [x, z] = mapPoint(chefGroup.position.x, chefGroup.position.z);
        if (chefIsChasing) {
            ctx.strokeStyle = 'rgba(255,71,87,0.85)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x, z, 4.5, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(x, z, 2.4, 0, Math.PI * 2);
        ctx.fill();
    }

    // The player, with a tick along the way he is facing so the map turns with him.
    const [px, pz] = mapPoint(mouseGroup.position.x, mouseGroup.position.z);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, pz);
    ctx.lineTo(px - Math.sin(mouseAngle) * 4.5, pz - Math.cos(mouseAngle) * 4.5);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, pz, 2.2, 0, Math.PI * 2);
    ctx.fill();
}
