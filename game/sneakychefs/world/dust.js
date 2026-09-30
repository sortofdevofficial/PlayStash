/**
 * world/dust.js — footstep and landing puffs.
 *
 * One shared sphere geometry with a per-puff material, so stepping about does not churn
 * geometry buffers; the materials are disposed when a puff expires.
 */
const dustGeo = new THREE.SphereGeometry(0.06, 4, 4);
let footstepDust = [];

function spawnDust(pos, scale = 1.0) {
    const count = Math.ceil(3 * scale);
    for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xd8d0c0, transparent: true, opacity: 0.55 });
        const mesh = new THREE.Mesh(dustGeo, mat);
        mesh.position.set(
            pos.x + (Math.random() - 0.5) * 0.3,
            pos.y + 0.05,
            pos.z + (Math.random() - 0.5) * 0.3
        );
        scene.add(mesh);
        footstepDust.push({
            mesh,
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6),
            life: 0.5
        });
    }
}

function updateDust(dt) {
    for (let i = footstepDust.length - 1; i >= 0; i--) {
        const d = footstepDust[i];
        d.life -= dt;
        if (d.life <= 0) {
            scene.remove(d.mesh);
            d.mesh.material.dispose();
            footstepDust.splice(i, 1);
            continue;
        }
        d.vel.y -= dt * 1.2;
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.material.opacity = Math.max(0, d.life / 0.5) * 0.55;
        const s = 1 + (0.5 - d.life) * 1.5;
        d.mesh.scale.set(s, s, s);
    }
}
let lastDustTick = -1;
// Restart hook: puffs from the last run should not hang in the air over a fresh kitchen.
function clearDust() {
    footstepDust.forEach(d => {
        scene.remove(d.mesh);
        d.mesh.material.dispose();
    });
    footstepDust = [];
}
