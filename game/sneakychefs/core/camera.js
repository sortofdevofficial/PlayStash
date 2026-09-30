/**
 * core/camera.js — the orbit camera that follows the mouse.
 *
 * Right-drag yaws and pitches, the wheel zooms (both handled in core/input.js), and a
 * raycast against activeCollision() pulls the camera in before it clips through geometry.
 * core/areas.js snaps it straight to its orbit position on a room change instead of
 * letting it lerp 400 units across empty scene.
 */
let isRightMouseDown = false;
let camYaw = 0;
let camPitch = 0.55;
const CAM_DIST_MIN = 4.0;
const CAM_DIST_MAX = 24.0;
const CAM_ZOOM_STEP = 1.2;
let camDist = 13.0;
let camDistTarget = 13.0;
const cameraRaycaster = new THREE.Raycaster();
const CAM_COLLISION_MARGIN = 0.4;
function updateCamera(dt) {
    const lookFrom = new THREE.Vector3(mouseGroup.position.x, mouseGroup.position.y + 0.5, mouseGroup.position.z);
    const desiredDir = new THREE.Vector3(
        Math.sin(camYaw) * Math.cos(camPitch),
        Math.sin(camPitch),
        Math.cos(camYaw) * Math.cos(camPitch)
    ).normalize();

    // Ease the zoom toward its target so wheel notches feel smooth, not steppy
    camDist = THREE.MathUtils.lerp(camDist, camDistTarget, Math.min(1, dt * 10));

    let allowedDist = camDist;
    const collision = activeCollision();
    if (collision.length > 0) {
        cameraRaycaster.set(lookFrom, desiredDir);
        cameraRaycaster.far = camDist;
        const hits = cameraRaycaster.intersectObjects(collision, false);
        if (hits.length > 0) {
            allowedDist = Math.max(1.5, hits[0].distance - CAM_COLLISION_MARGIN);
        }
    }

    const targetCamPos = new THREE.Vector3().copy(lookFrom).addScaledVector(desiredDir, allowedDist);
    // Snap in quickly when a wall pushes the camera closer, ease out slowly when it's free again,
    // so the camera doesn't visibly clip through a wall for a frame while lerping back out.
    const closingIn = allowedDist < camera.position.distanceTo(lookFrom);
    camera.position.lerp(targetCamPos, dt * (closingIn ? 16 : 8));
    camera.lookAt(mouseGroup.position.x, mouseGroup.position.y + 0.5, mouseGroup.position.z);
}

// ---- Mouse body/leg/tail animation: diagonal trot gait with real hip+knee joints,
// spine bounce driven by footfall, lean into turns, and tail lag behind body rotation ----
