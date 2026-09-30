/**
 * models/mice.js — mouse rig builders, shared by the player and the base residents.
 *
 * createLowPolyMouse returns the group plus the tail/spine/leg joints that actors/mouse.js
 * and actors/residents.js animate. Geometry only — no behaviour lives here.
 */
/**
 * Low-Poly Mouse Model Construction (v6 — faceted materials, white gradient chef hat)
 */
// Shared with chef.js (loaded after this file): paints a bottom->top colour gradient onto a
// geometry as vertex colours. Pair it with a material that has vertexColors: true.
function applyVerticalGradient(geometry, bottomHex, topHex) {
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    const pos = geometry.attributes.position;
    const bottom = new THREE.Color(bottomHex), top = new THREE.Color(topHex), c = new THREE.Color();
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        c.copy(bottom).lerp(top, (pos.getY(i) - min.y) / ((max.y - min.y) || 1));
        colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function createLowPolyMouse() {
    const mouseGroup = new THREE.Group();
    const tailSegments = [];

    const furMat = new THREE.MeshStandardMaterial({ color: 0xe8d9c8, flatShading: true, roughness: 0.65 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffa8bc, flatShading: true, roughness: 0.45 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x171417, flatShading: true, roughness: 0.15 });
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffbe00, flatShading: true, roughness: 0.4 });
    const whiskerMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    // Hat: vertex-colour gradient (cool grey-blue at the rim -> bright white on top) plus a faint
    // emissive lift, so it stays readable against the cream fur and the dark kitchen.
    const hatMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, emissive: 0x2a2a32 });

    // Master scale: every dimension below is multiplied by S, so this one number resizes the mouse.
    const S = 0.34; // reduced from 0.45 -> smaller mouse

    const rig = new THREE.Group();
    mouseGroup.add(rig);
    const spine = new THREE.Group();
    rig.add(spine);

    // ---- Body: single low-poly blob (icosahedron detail 0 = 20 tris) ----
    // Body faces -Z as "forward" so that with the default chase camera (positioned behind
    // the mouse along +Z) the head points away from camera and the tail trails toward it —
    // i.e. the tail reads as being behind the mouse, not sticking out in front.
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 * S, 0), furMat);
    body.scale.set(0.85, 0.75, 1.2);
    body.position.set(0, 0.46 * S, 0.04 * S);
    body.castShadow = true;
    spine.add(body);

    // Rump: rounder hindquarters so the silhouette isn't a single egg
    const rump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 * S, 0), furMat);
    rump.scale.set(1.0, 0.85, 1.0);
    rump.position.set(0, 0.44 * S, 0.42 * S);
    rump.castShadow = true;
    spine.add(rump);

    // ---- Head: single low-poly blob doubling as cranium+snout (no separate cone) ----
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.62 * S, -0.4 * S);
    spine.add(headGroup);

    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 * S, 0), furMat);
    head.scale.set(0.9, 0.85, 1.15);
    head.castShadow = true;
    headGroup.add(head);

    // Snout: a pointed cone (tip toward -Z) instead of a bare blob
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.13 * S, 0.3 * S, 6), furMat);
    snout.rotation.x = -Math.PI / 2;
    snout.position.set(0, -0.03 * S, -0.24 * S);
    snout.castShadow = true;
    headGroup.add(snout);

    // Pink nose on the tip
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.05 * S, 5, 4), pinkMat);
    noseTip.position.set(0, -0.025 * S, -0.4 * S);
    headGroup.add(noseTip);

    // Cheek fluff for a rounder face
    const cheekGeo = new THREE.IcosahedronGeometry(0.1 * S, 0);
    const cheekL = new THREE.Mesh(cheekGeo, furMat);
    cheekL.position.set(-0.17 * S, -0.06 * S, -0.16 * S);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.17 * S;
    headGroup.add(cheekL, cheekR);

    // Eyes with a tiny white shine dot so they read as alive
    const eyeGeo = new THREE.SphereGeometry(0.055 * S, 5, 4);
    const shineGeo = new THREE.SphereGeometry(0.018 * S, 4, 4);
    [-1, 1].forEach(side => {
        const eye = new THREE.Mesh(eyeGeo, darkMat);
        eye.position.set(side * 0.13 * S, 0.04 * S, -0.24 * S);
        const shine = new THREE.Mesh(shineGeo, shineMat);
        shine.position.set(side * 0.115 * S, 0.06 * S, -0.285 * S);
        headGroup.add(eye, shine);
    });

    // Buck teeth under the nose
    const toothGeo = new THREE.BoxGeometry(0.03 * S, 0.05 * S, 0.02 * S);
    [-1, 1].forEach(side => {
        const tooth = new THREE.Mesh(toothGeo, whiskerMat);
        tooth.position.set(side * 0.02 * S, -0.09 * S, -0.36 * S);
        headGroup.add(tooth);
    });

    // Whiskers: three thin bars per side, fanned out
    const whiskerGeo = new THREE.BoxGeometry(0.24 * S, 0.008 * S, 0.008 * S);
    [-1, 1].forEach(side => {
        [-0.22, 0, 0.22].forEach(tilt => {
            const w = new THREE.Mesh(whiskerGeo, whiskerMat);
            w.position.set(side * 0.2 * S, -0.045 * S, -0.3 * S);
            w.rotation.z = side * tilt;
            w.rotation.y = side * -0.25;
            headGroup.add(w);
        });
    });

    // Ears: fur-coloured outer disc with a smaller pink inner disc on the outward face
    const earOuterGeo = new THREE.CylinderGeometry(0.17 * S, 0.17 * S, 0.03 * S, 8);
    const earInnerGeo = new THREE.CylinderGeometry(0.11 * S, 0.11 * S, 0.03 * S, 8);
    const earL = new THREE.Group();
    earL.add(new THREE.Mesh(earOuterGeo, furMat));
    const innerL = new THREE.Mesh(earInnerGeo, pinkMat);
    innerL.position.y = -0.02 * S;
    earL.add(innerL);
    earL.rotation.set(0.15, -0.55, -0.75);
    earL.position.set(-0.25 * S, 0.2 * S, -0.06 * S);

    const earR = earL.clone();
    earR.rotation.y *= -1;
    earR.rotation.z *= -1;
    earR.position.x = 0.25 * S;
    headGroup.add(earL, earR);

    // ---- Chef hat: seated on the measured head surface ----
    // The head blob's surface under the hat rim (radius 0.17 S) bottoms out at ~0.104 S and
    // peaks at ~0.20 S at the centre, so the base sits with its bottom at 0.09 S: the whole
    // rim is sunk slightly into the head (no gap anywhere) and the head's crown is hidden
    // inside the base. The puff is stacked on the base's top with a small overlap.
    const HAT_BASE_H = 0.14 * S;
    const HAT_BOTTOM = 0.09 * S;
    const HAT_Z = -0.06 * S;
    const hatBase = new THREE.Mesh(applyVerticalGradient(new THREE.CylinderGeometry(0.15 * S, 0.17 * S, HAT_BASE_H, 8), 0xaab6d4, 0xeef1fb), hatMat);
    hatBase.position.set(0, HAT_BOTTOM + HAT_BASE_H / 2, HAT_Z);
    const hatTop = new THREE.Mesh(applyVerticalGradient(new THREE.IcosahedronGeometry(0.22 * S, 0), 0xeef1fb, 0xffffff), hatMat);
    hatTop.scale.set(1, 0.85, 1);
    hatTop.position.set(0, HAT_BOTTOM + HAT_BASE_H + 0.14 * S, HAT_Z);
    hatBase.castShadow = hatTop.castShadow = true;
    // Grouped so the hat can be hidden as one unit — NPC mice in the burrow wear no hat,
    // and picking the meshes out of headGroup by geometry type would also catch the head.
    const hatGroup = new THREE.Group();
    hatGroup.add(hatBase, hatTop);
    headGroup.add(hatGroup);

    // ---- Legs: jointed hip+knee, kept simple (single cylinder per segment, no joint spheres) ----
    function makeJointedLeg(upperLen, lowerLen, thickness) {
        const hipPivot = new THREE.Group();

        const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness * 0.8, upperLen, 5), furMat);
        upperLeg.position.y = -upperLen / 2;
        upperLeg.castShadow = true;
        hipPivot.add(upperLeg);

        const kneePivot = new THREE.Group();
        kneePivot.position.y = -upperLen;
        hipPivot.add(kneePivot);

        const lowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.75, thickness * 0.5, lowerLen, 5), furMat);
        lowerLeg.position.y = -lowerLen / 2;
        lowerLeg.castShadow = true;
        kneePivot.add(lowerLeg);

        const paw = new THREE.Mesh(new THREE.BoxGeometry(thickness * 2.2, 0.035 * S, thickness * 2.6), pinkMat);
        paw.position.set(0, -lowerLen - 0.015 * S, thickness);
        kneePivot.add(paw);

        return { hipPivot, kneePivot };
    }

    const legUpperLen = 0.15 * S, legLowerLen = 0.14 * S, legThin = 0.065 * S;
    const legUpperLenR = 0.18 * S, legLowerLenR = 0.17 * S, legThinR = 0.09 * S;

    const flData = makeJointedLeg(legUpperLen, legLowerLen, legThin);
    flData.hipPivot.position.set(-0.17 * S, 0.46 * S, -0.28 * S);
    const frData = makeJointedLeg(legUpperLen, legLowerLen, legThin);
    frData.hipPivot.position.set(0.17 * S, 0.46 * S, -0.28 * S);
    const rlData = makeJointedLeg(legUpperLenR, legLowerLenR, legThinR);
    rlData.hipPivot.position.set(-0.25 * S, 0.44 * S, 0.28 * S);
    const rrData = makeJointedLeg(legUpperLenR, legLowerLenR, legThinR);
    rrData.hipPivot.position.set(0.25 * S, 0.44 * S, 0.28 * S);

    spine.add(flData.hipPivot, frData.hipPivot, rlData.hipPivot, rrData.hipPivot);

    const legJoints = [
        { hip: flData.hipPivot, knee: flData.kneePivot },
        { hip: frData.hipPivot, knee: frData.kneePivot },
        { hip: rlData.hipPivot, knee: rlData.kneePivot },
        { hip: rrData.hipPivot, knee: rrData.kneePivot }
    ];

    // ---- Tail: 6 tapered segments; animated per-segment in actors/mouse.js
    // (rotation.z = side-to-side sway, rotation.x = lift/droop). Segment 0 lies
    // horizontal (rotation.x = -PI/2) pointing straight back from the rump. ----
    let parentPivot = spine;
    const TAIL_SEGMENTS = 6;
    const segLength = 0.15 * S;

    for (let i = 0; i < TAIL_SEGMENTS; i++) {
        const pivot = new THREE.Group();

        if (i === 0) {
            pivot.position.set(0, 0.28 * S, 0.62 * S);
            pivot.rotation.x = -Math.PI / 2;
        } else {
            pivot.position.set(0, -segLength, 0);
        }

        const topRadius = 0.06 * S * (1 - i * 0.13);
        const bottomRadius = 0.06 * S * (1 - (i + 1) * 0.13);

        const segGeo = new THREE.CylinderGeometry(Math.max(topRadius, 0.012), Math.max(bottomRadius, 0.009), segLength, 5);
        segGeo.translate(0, -segLength / 2, 0);
        const segMesh = new THREE.Mesh(segGeo, pinkMat);
        segMesh.castShadow = true;

        pivot.add(segMesh);
        parentPivot.add(pivot);

        tailSegments.push(pivot);
        parentPivot = pivot;
    }

    mouseGroup.position.set(0, 0, 11);

    mouseGroup.userData.spine = spine;
    mouseGroup.userData.headGroup = headGroup;
    mouseGroup.userData.hatGroup = hatGroup;
    mouseGroup.userData.legJoints = legJoints;
    mouseGroup.userData.scaleFactor = S;

    return { mouseGroup, tailSegments, headGroup, hatGroup, spine, legJoints, scaleFactor: S };
}