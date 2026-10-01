/**
 * core/minimap.js — the house map in the corner of the screen.
 *
 * Seven rooms in one scene means the player can be anywhere, and a doorway you walked
 * through ten seconds ago is not a landmark you can see from here. So the whole house is
 * drawn to scale: every room from the registry, a line through each pair of matching doors,
 * the goods still loose in the room you are standing in, the chef if he shares it, and you.
 *
 * Nothing here is authored — the view is fitted to the registry at boot, so adding a room
 * to map/rooms.js rescales the map around it.
 */
const MAP_W = 210;
// The house is two rows of rooms: ~938 units across and only ~335 deep, so the card is wide
// and short. The fit below is uniform, which is what makes a square room look square.
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

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    roomOrder.forEach(r => {
        minX = Math.min(minX, r.ox - r.hx); maxX = Math.max(maxX, r.ox + r.hx);
        minZ = Math.min(minZ, r.oz - r.hz); maxZ = Math.max(maxZ, r.oz + r.hz);
    });
    const scale = Math.min((MAP_W - MAP_PAD * 2) / (maxX - minX), (MAP_H - MAP_PAD * 2) / (maxZ - minZ));
    mapView = { scale, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

// World to map. Screen Y runs down and world +Z runs "south", so no flip is needed: north
// (the kitchen's mouse-hole wall) is the top of the card, which is how the house is laid out.
function mapPoint(x, z) {
    return [
        MAP_W / 2 + (x - mapView.cx) * mapView.scale,
        MAP_H / 2 + (z - mapView.cz) * mapView.scale
    ];
}

function drawMinimap() {
    if (!mapCtx || !mapView) return;
    const ctx = mapCtx;
    const room = activeRoom();
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    // Doorways first, so each room is drawn over the ends of the lines meeting it. Both
    // halves of a pair are in the registry, so a link is drawn once and only if the far door
    // exists — a door to a room that was never registered would show up as a stub.
    const linked = {};
    roomOrder.forEach(r => r.portals.forEach(p => {
        const key = r.id < p.to ? r.id + '|' + p.to : p.to + '|' + r.id;
        if (linked[key]) return;
        linked[key] = true;
        const back = roomById(p.to) && roomById(p.to).portals.find(q => q.to === r.id);
        if (!back) return;
        const [ax, ay] = mapPoint(p.x, p.z);
        const [bx, by] = mapPoint(back.x, back.z);
        const live = r === room || roomById(p.to) === room;
        ctx.strokeStyle = live ? 'rgba(255,190,0,0.75)' : 'rgba(200,210,230,0.22)';
        ctx.lineWidth = live ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
    }));

    roomOrder.forEach(r => {
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
