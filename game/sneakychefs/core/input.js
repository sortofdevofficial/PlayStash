/**
 * core/input.js — every human input, converted to state that other modules read.
 *
 * WASD/arrows write `keys`, right-drag writes camYaw/camPitch/camDistTarget, the wheel
 * zooms, Space jumps, and the on-screen dpad feeds the same `keys`. Nothing here moves the
 * player; that happens in actors/mouse.js on the next frame. Also blocks the browser's
 * dev-tools and context-menu shortcuts, since the game is meant to be played, not poked.
 */
const keys = { forward: false, backward: false, left: false, right: false };
// Disable Right-Click Menu & Developer Console Shortcuts
function setupSecurityRestrictions() {
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
        const k = e.key.toUpperCase();
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(k)) ||
            (e.ctrlKey && k === 'U')
        ) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });
}

function setupInputListeners() {
    const handleKey = (e, isDown) => {
        const k = e.key.toLowerCase();
        // Stop Space/Enter from activating a focused button (e.g. PLAY AGAIN) mid-game
        if (k === ' ' || k === 'enter') e.preventDefault();
        if (k === 'w' || k === 'arrowup') keys.forward = isDown;
        if (k === 's' || k === 'arrowdown') keys.backward = isDown;
        if (k === 'a' || k === 'arrowleft') keys.left = isDown;
        if (k === 'd' || k === 'arrowright') keys.right = isDown;
        if (k === ' ' && isDown && isGrounded) triggerJump();
    };

    window.addEventListener('keydown', e => handleKey(e, true));
    window.addEventListener('keyup', e => handleKey(e, false));

    // Right-Click Camera Drag Listeners
    window.addEventListener('mousedown', (e) => {
        if (e.button === 2) isRightMouseDown = true;
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 2) isRightMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (isRightMouseDown) {
            camYaw -= e.movementX * 0.006;
            camPitch += e.movementY * 0.006;
            // Clamp pitch to prevent camera flip
            camPitch = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, camPitch));
        }
    });

    // Zoom: mouse wheel, +/- keys, and two-finger pinch on touch screens
    const zoomBy = d => { camDistTarget = THREE.MathUtils.clamp(camDistTarget + d, CAM_DIST_MIN, CAM_DIST_MAX); };
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomBy(Math.sign(e.deltaY) * CAM_ZOOM_STEP);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
        if (e.key === '=' || e.key === '+') zoomBy(-CAM_ZOOM_STEP);
        if (e.key === '-' || e.key === '_') zoomBy(CAM_ZOOM_STEP);
    });
    let pinchStart = 0, pinchStartDist = 0;
    const touchGap = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    window.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) { pinchStart = touchGap(e); pinchStartDist = camDistTarget; }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinchStart > 0) {
            // fingers apart = zoom in (smaller distance)
            camDistTarget = THREE.MathUtils.clamp(pinchStartDist * pinchStart / touchGap(e), CAM_DIST_MIN, CAM_DIST_MAX);
        }
    }, { passive: true });
    window.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinchStart = 0; }, { passive: true });

    // Mobile Touch
    const bindTouch = (id, action) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => { e.preventDefault(); action(true); });
        el.addEventListener('touchend', (e) => { e.preventDefault(); action(false); });
    };

    bindTouch('btn-up', v => keys.forward = v);
    bindTouch('btn-down', v => keys.backward = v);
    bindTouch('btn-left', v => keys.left = v);
    bindTouch('btn-right', v => keys.right = v);
    bindTouch('btn-jump', v => { if (v && isGrounded) triggerJump(); });

    const restartBtn = document.getElementById('restart-btn');
    restartBtn.setAttribute('tabindex', '-1');
    restartBtn.addEventListener('click', () => {
        restartBtn.blur();
        restartGame();
    });
}

