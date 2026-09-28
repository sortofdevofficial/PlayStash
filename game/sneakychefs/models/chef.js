/**
 * Sneaky Chefs: Kitchen Escape - Chef AI & Warning Ring System
 */

var warningRingMesh = null;
var chefAttackState = 'idle';
var chefAttackTimer = 0;
var chefSmashSequence = [];
var chefSmashIndex = 0;
var chefLoseTimer = 0;
var chefRealertTimer = 0;

function createWarningRing() {
    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff2200,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
    });
    warningRingMesh = new THREE.Mesh(ringGeo, ringMat);
    warningRingMesh.rotation.x = -Math.PI / 2;
    warningRingMesh.position.y = 0.03;
    warningRingMesh.visible = false;
    scene.add(warningRingMesh);
}

function hideAllWarningRings() {
    if (warningRingMesh) {
        warningRingMesh.visible = false;
    }
}

function showWarningRing(pos, radius = 1.8) {
    if (!warningRingMesh) return;
    warningRingMesh.position.set(pos.x, 0.03, pos.z);
    warningRingMesh.scale.set(radius, radius, 1);
    warningRingMesh.visible = true;
}

/**
 * Low-Poly Chef AI Enemy Model Construction
 */
function createLowPolyChef() {
    const chefGroup = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcca8, flatShading: true, roughness: 0.5 });
    const coatMat = new THREE.MeshStandardMaterial({ color: 0xfcfcfc, flatShading: true, roughness: 0.3 });
    const apronMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, flatShading: true, roughness: 0.4 });
    const tieMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, flatShading: true, roughness: 0.3 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: true, roughness: 0.8 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x171417, roughness: 0.1 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3a3a48, flatShading: true, roughness: 0.6 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x141414, flatShading: true, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, flatShading: true, roughness: 0.4 });
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.2 });

    // Body Coat Tunic
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.98, 1.8, 8), coatMat);
    body.position.y = 1.35;
    body.castShadow = true;
    chefGroup.add(body);

    // Apron
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.3, 0.06), apronMat);
    apron.position.set(0, 1.1, 0.72);
    chefGroup.add(apron);

    // Buttons
    for (let i = 0; i < 3; i++) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), buttonMat);
        btn.position.set(0, 1.85 - i * 0.28, 0.68);
        chefGroup.add(btn);
    }

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.25, 8), skinMat);
    neck.position.y = 2.25;
    chefGroup.add(neck);

    // Head
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.44, 1), skinMat);
    head.scale.set(1.0, 1.05, 0.95);
    head.position.y = 2.62;
    head.castShadow = true;
    chefGroup.add(head);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.position.set(-0.42, 2.6, 0);
    earL.scale.set(0.7, 1, 0.6);
    const earR = earL.clone();
    earR.position.x = 0.42;
    chefGroup.add(earL, earR);

    // Angry Eyes
    const eyeGeo = new THREE.BoxGeometry(0.16, 0.045, 0.05);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.17, 2.64, 0.4);
    eyeL.rotation.z = -0.3;
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.17, 2.64, 0.4);
    eyeR.rotation.z = 0.3;
    chefGroup.add(eyeL, eyeR);

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.26, 0.075, 0.07);
    const browL = new THREE.Mesh(browGeo, hairMat);
    browL.position.set(-0.17, 2.71, 0.42);
    browL.rotation.z = 0.6;
    const browR = new THREE.Mesh(browGeo, hairMat);
    browR.position.set(0.17, 2.71, 0.42);
    browR.rotation.z = -0.6;
    chefGroup.add(browL, browR);

    // Frown & Mustache
    const mouthGeo = new THREE.BoxGeometry(0.2, 0.07, 0.06);
    const mouthL = new THREE.Mesh(mouthGeo, hairMat);
    mouthL.position.set(-0.09, 2.28, 0.44);
    mouthL.rotation.z = -0.45;
    const mouthR = new THREE.Mesh(mouthGeo, hairMat);
    mouthR.position.set(0.09, 2.28, 0.44);
    mouthR.rotation.z = 0.45;
    chefGroup.add(mouthL, mouthR);

    const mustacheL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.12), hairMat);
    mustacheL.position.set(-0.14, 2.46, 0.42);
    mustacheL.rotation.z = 0.25;
    const mustacheR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.12), hairMat);
    mustacheR.position.set(0.14, 2.46, 0.42);
    mustacheR.rotation.z = -0.25;
    chefGroup.add(mustacheL, mustacheR);

    // Red Scarf
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.18), tieMat);
    scarf.position.set(0, 2.22, 0.4);
    scarf.rotation.z = Math.PI / 4;
    chefGroup.add(scarf);

    // Chef Hat
    const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.32, 8), coatMat);
    hatBase.position.y = 3.02;
    const hatTop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), coatMat);
    hatTop.position.y = 3.48;
    hatTop.scale.set(1, 1.1, 1);
    hatBase.castShadow = hatTop.castShadow = true;
    chefGroup.add(hatBase, hatTop);

    // Arms & Rolling Pin Weapon
    const armGeo = new THREE.CylinderGeometry(0.12, 0.095, 0.85, 6);
    const handGeo = new THREE.SphereGeometry(0.11, 6, 6);
    const SHOULDER_Y = 2.15;
    const SHOULDER_X = 0.82;

    const shoulderL = new THREE.Group();
    shoulderL.position.set(-SHOULDER_X, SHOULDER_Y, 0);
    chefGroup.add(shoulderL);

    const armL = new THREE.Mesh(armGeo, coatMat);
    armL.position.y = -0.42;
    armL.castShadow = true;
    shoulderL.add(armL);

    const handL = new THREE.Mesh(handGeo, skinMat);
    handL.position.y = -0.88;
    shoulderL.add(handL);

    shoulderL.rotation.z = 0.12;
    shoulderL.rotation.x = -0.1;

    const shoulderR = new THREE.Group();
    shoulderR.position.set(SHOULDER_X, SHOULDER_Y, 0);
    chefGroup.add(shoulderR);

    const armR = new THREE.Mesh(armGeo, coatMat);
    armR.position.y = -0.42;
    armR.castShadow = true;
    shoulderR.add(armR);

    const handR = new THREE.Mesh(handGeo, skinMat);
    handR.position.y = -0.88;
    shoulderR.add(handR);

    const pinWrist = new THREE.Group();
    pinWrist.position.y = -0.88;
    shoulderR.add(pinWrist);

    const PIN_LENGTH = 1.1;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, PIN_LENGTH, 8), woodMat);
    pin.rotation.set(Math.PI / 2.15, 0, Math.PI / 10);
    const pinDir = new THREE.Vector3(0, 1, 0).applyEuler(pin.rotation).normalize();
    pin.position.copy(pinDir).multiplyScalar(PIN_LENGTH * 0.32);
    pin.castShadow = true;
    pinWrist.add(pin);

    const capGeo = new THREE.SphereGeometry(0.09, 6, 6);
    const capA = new THREE.Mesh(capGeo, woodMat);
    capA.position.copy(pinDir).multiplyScalar(PIN_LENGTH * 0.32 + PIN_LENGTH / 2);
    const capB = new THREE.Mesh(capGeo, woodMat);
    capB.position.copy(pinDir).multiplyScalar(PIN_LENGTH * 0.32 - PIN_LENGTH / 2);
    pinWrist.add(capA, capB);

    shoulderR.rotation.z = -0.12;
    shoulderR.rotation.x = -0.1;

    // Legs
    function makeChefLeg(xSide) {
        const UPPER = 0.3, LOWER = 0.3;
        const hip = new THREE.Group();
        hip.position.set(xSide * 0.38, 0.62, 0);

        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, UPPER, 6), pantsMat);
        upper.position.y = -UPPER / 2;
        upper.castShadow = true;
        hip.add(upper);

        const knee = new THREE.Group();
        knee.position.y = -UPPER;
        hip.add(knee);

        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.115, LOWER, 6), pantsMat);
        lower.position.y = -LOWER / 2;
        lower.castShadow = true;
        knee.add(lower);

        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.46), bootMat);
        boot.position.set(0, -LOWER + 0.05, 0.08);
        boot.castShadow = true;
        knee.add(boot);

        chefGroup.add(hip);
        return { hip, knee };
    }

    const legL = makeChefLeg(-1);
    const legR = makeChefLeg(1);

    chefGroup.position.set(-8, 0, -8);

    chefGroup.userData.legL = legL;
    chefGroup.userData.legR = legR;
    chefGroup.userData.pinWrist = pinWrist;
    chefGroup.userData.shoulderL = shoulderL;
    chefGroup.userData.shoulderR = shoulderR;

    return chefGroup;
}

function updateChefAI(dt, time) {
    if (typeof chefGroup === 'undefined' || !chefGroup || typeof mouseGroup === 'undefined' || !mouseGroup) return;

    const distToMouse = chefGroup.position.distanceTo(mouseGroup.position);
    const playerHiding = (typeof isHiding !== 'undefined' && isHiding);

    // Perception & Chase Toggle
    if (!playerHiding) {
        if (distToMouse < 9.0) {
            const dirToMouse = mouseGroup.position.clone().sub(chefGroup.position).normalize();
            const chefForward = new THREE.Vector3(Math.sin(chefGroup.rotation.y), 0, Math.cos(chefGroup.rotation.y));
            const dot = chefForward.dot(dirToMouse);

            if (distToMouse < 4.0 || dot > 0.2) {
                if (typeof chefIsChasing !== 'undefined' && !chefIsChasing) {
                    chefIsChasing = true;
                    if (typeof playSound === 'function') playSound('alert');
                }
                chefLoseTimer = 0;
            }
        }
    } else {
        if (typeof chefIsChasing !== 'undefined' && chefIsChasing) {
            chefLoseTimer += dt;
            if (chefLoseTimer > 1.8) {
                chefIsChasing = false;
                chefLoseTimer = 0;
            }
        }
    }

    // Attack State Machine
    if (chefAttackState === 'telegraph') {
        chefAttackTimer -= dt;
        showWarningRing(mouseGroup.position, 2.0);
        if (typeof chefShoulderR !== 'undefined' && chefShoulderR) {
            chefShoulderR.rotation.x = -1.8;
        }
        if (chefAttackTimer <= 0) {
            chefAttackState = 'smash';
            chefAttackTimer = 0.2;
        }
    } else if (chefAttackState === 'smash') {
        chefAttackTimer -= dt;
        if (typeof chefShoulderR !== 'undefined' && chefShoulderR) {
            chefShoulderR.rotation.x = 1.2;
        }
        if (distToMouse < 2.2 && !playerHiding) {
            if (typeof triggerGameOver === 'function') triggerGameOver();
        }
        if (chefAttackTimer <= 0) {
            chefAttackState = 'recover';
            chefAttackTimer = 0.4;
            hideAllWarningRings();
        }
    } else if (chefAttackState === 'recover') {
        chefAttackTimer -= dt;
        if (typeof chefShoulderR !== 'undefined' && chefShoulderR) {
            chefShoulderR.rotation.x = THREE.MathUtils.lerp(chefShoulderR.rotation.x, -0.1, dt * 8.0);
        }
        if (chefAttackTimer <= 0) {
            chefAttackState = 'idle';
        }
    } else { // 'idle' state
        if (typeof chefIsChasing !== 'undefined' && chefIsChasing && distToMouse < 2.5 && !playerHiding) {
            chefAttackState = 'telegraph';
            chefAttackTimer = 0.45;
            showWarningRing(mouseGroup.position, 2.0);
            if (typeof playSound === 'function') playSound('alert');
        }
    }

    // Pathfinding & Movement
    if (chefAttackState === 'idle' || chefAttackState === 'recover') {
        let targetPos = null;
        if (typeof chefIsChasing !== 'undefined' && chefIsChasing && !playerHiding) {
            targetPos = mouseGroup.position.clone();
        } else if (typeof chefWaypoints !== 'undefined' && chefWaypoints.length > 0) {
            if (typeof currentWaypointIdx === 'undefined') currentWaypointIdx = 0;
            targetPos = chefWaypoints[currentWaypointIdx];
        }

        if (targetPos) {
            const diff = targetPos.clone().sub(chefGroup.position);
            diff.y = 0;
            const distToTarget = diff.length();

            if (typeof chefIsChasing !== 'undefined' && !chefIsChasing && distToTarget < 1.0) {
                if (typeof chefWaypoints !== 'undefined' && chefWaypoints.length > 0) {
                    currentWaypointIdx = (currentWaypointIdx + 1) % chefWaypoints.length;
                }
            }

            if (distToTarget > 0.1) {
                const targetAngle = Math.atan2(diff.x, diff.z);
                let angleDiff = targetAngle - chefGroup.rotation.y;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

                chefGroup.rotation.y += angleDiff * Math.min(1.0, dt * 6.0);

                const moveSpeed = (typeof chefIsChasing !== 'undefined' && chefIsChasing) ? 5.2 : 3.0;
                chefGroup.position.x += Math.sin(chefGroup.rotation.y) * moveSpeed * dt;
                chefGroup.position.z += Math.cos(chefGroup.rotation.y) * moveSpeed * dt;

                chefGroup.position.x = Math.max(-14.5, Math.min(14.5, chefGroup.position.x));
                chefGroup.position.z = Math.max(-14.5, Math.min(14.5, chefGroup.position.z));
            }
        }
    }

    chefGroup.position.y = 0;

    if (typeof solveObstacleCollision === 'function') {
        solveObstacleCollision(chefGroup.position, 0.7);
    }

    // Animation updates
    const isMoving = (chefAttackState === 'idle' || chefAttackState === 'recover');
    if (isMoving) {
        if (typeof chefGaitPhase === 'undefined') chefGaitPhase = 0;
        chefGaitPhase += dt * ((typeof chefIsChasing !== 'undefined' && chefIsChasing) ? 11.0 : 6.5);
        const swing = Math.sin(chefGaitPhase) * 0.5;

        if (typeof chefLegL !== 'undefined' && chefLegL && chefLegL.hip) chefLegL.hip.rotation.x = swing;
        if (typeof chefLegR !== 'undefined' && chefLegR && chefLegR.hip) chefLegR.hip.rotation.x = -swing;
        if (typeof chefShoulderL !== 'undefined' && chefShoulderL) chefShoulderL.rotation.x = -swing * 0.5;
        if (chefAttackState === 'idle' && typeof chefShoulderR !== 'undefined' && chefShoulderR) {
            chefShoulderR.rotation.x = swing * 0.5;
        }
    }

    // Direct Catch Check
    if (distToMouse < 0.9 && !playerHiding) {
        if (typeof triggerGameOver === 'function') triggerGameOver();
    }

    // Spotlight position target
    if (typeof chefSpotlight !== 'undefined' && chefSpotlight && chefSpotlight.target) {
        chefSpotlight.target.position.set(
            Math.sin(chefGroup.rotation.y) * 2.5,
            0,
            Math.cos(chefGroup.rotation.y) * 2.5
        );
    }
}