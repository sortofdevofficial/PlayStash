/**
 * Sneaky Chefs: Kitchen Escape - Low-Poly Mouse Model (Optimized Rig)
 */
function createLowPolyMouse() {
    const mouseGroup = new THREE.Group();
    const tailSegments = [];

    // Shared Lightweight Materials (Low GPU Overhead)
    const furMat = new THREE.MeshStandardMaterial({ color: 0xdfcaa7, flatShading: true, roughness: 0.6 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffa0b4, flatShading: true, roughness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, flatShading: true, roughness: 0.3 });
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffb800, flatShading: true, roughness: 0.3 });

    const S = 0.45;

    const rig = new THREE.Group();
    mouseGroup.add(rig);

    const spine = new THREE.Group();
    rig.add(spine);

    // Body & Rump (0-Detail Low-Poly Icosahedrons = ~20 faces each)
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48 * S, 0), furMat);
    body.scale.set(0.85, 0.75, 1.2);
    body.position.set(0, 0.46 * S, 0.04 * S);
    body.castShadow = true;
    spine.add(body);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.62 * S, -0.4 * S);
    spine.add(headGroup);

    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 * S, 0), furMat);
    head.scale.set(0.9, 0.85, 1.15);
    head.castShadow = true;
    headGroup.add(head);

    // Snout & Nose
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12 * S, 0.28 * S, 4), furMat);
    snout.rotation.x = -Math.PI / 2;
    snout.position.set(0, -0.03 * S, -0.24 * S);
    headGroup.add(snout);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06 * S, 0.06 * S, 0.06 * S), pinkMat);
    nose.position.set(0, -0.025 * S, -0.38 * S);
    headGroup.add(nose);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.08 * S, 0.08 * S, 0.08 * S);
    [-1, 1].forEach(side => {
        const eye = new THREE.Mesh(eyeGeo, darkMat);
        eye.position.set(side * 0.14 * S, 0.05 * S, -0.22 * S);
        headGroup.add(eye);
    });

    // Ears (Low-Poly 5-sided Cylinders)
    const earGeo = new THREE.CylinderGeometry(0.16 * S, 0.16 * S, 0.02 * S, 5);
    const earInnerGeo = new THREE.CylinderGeometry(0.1 * S, 0.1 * S, 0.025 * S, 5);
    
    [-1, 1].forEach(side => {
        const ear = new THREE.Group();
        const outer = new THREE.Mesh(earGeo, furMat);
        const inner = new THREE.Mesh(earInnerGeo, pinkMat);
        ear.add(outer, inner);
        ear.rotation.set(0.15, side * -0.5, side * -0.7);
        ear.position.set(side * 0.24 * S, 0.2 * S, -0.06 * S);
        headGroup.add(ear);
    });

    // Tiny Chef Hat
    const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * S, 0.16 * S, 0.12 * S, 6), hatMat);
    hatBase.position.set(0, 0.22 * S, -0.06 * S);
    const hatTop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 * S, 0), hatMat);
    hatTop.position.set(0, 0.34 * S, -0.06 * S);
    headGroup.add(hatBase, hatTop);

    // Simplified Jointed Legs
    function makeLeg(upperLen, lowerLen, thick) {
        const hipPivot = new THREE.Group();
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick * 0.8, upperLen, 4), furMat);
        upper.position.y = -upperLen / 2;
        hipPivot.add(upper);

        const kneePivot = new THREE.Group();
        kneePivot.position.y = -upperLen;
        hipPivot.add(kneePivot);

        const lower = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.75, thick * 0.5, lowerLen, 4), furMat);
        lower.position.y = -lowerLen / 2;
        kneePivot.add(lower);

        const paw = new THREE.Mesh(new THREE.BoxGeometry(thick * 2.0, 0.03 * S, thick * 2.4), pinkMat);
        paw.position.set(0, -lowerLen, thick * 0.8);
        kneePivot.add(paw);

        return { hipPivot, kneePivot };
    }

    const legLen = 0.15 * S;
    const fl = makeLeg(legLen, legLen, 0.06 * S);
    fl.hipPivot.position.set(-0.16 * S, 0.44 * S, -0.26 * S);
    const fr = makeLeg(legLen, legLen, 0.06 * S);
    fr.hipPivot.position.set(0.16 * S, 0.44 * S, -0.26 * S);
    const rl = makeLeg(legLen * 1.1, legLen * 1.1, 0.08 * S);
    rl.hipPivot.position.set(-0.22 * S, 0.42 * S, 0.26 * S);
    const rr = makeLeg(legLen * 1.1, legLen * 1.1, 0.08 * S);
    rr.hipPivot.position.set(0.22 * S, 0.42 * S, 0.26 * S);

    spine.add(fl.hipPivot, fr.hipPivot, rl.hipPivot, rr.hipPivot);

    const legJoints = [
        { hip: fl.hipPivot, knee: fl.kneePivot },
        { hip: fr.hipPivot, knee: fr.kneePivot },
        { hip: rl.hipPivot, knee: rl.kneePivot },
        { hip: rr.hipPivot, knee: rr.kneePivot }
    ];

    // Lightweight 3-Segment Tail
    let parentPivot = spine;
    const TAIL_SEGMENTS = 3;
    const segLen = 0.28 * S;

    for (let i = 0; i < TAIL_SEGMENTS; i++) {
        const pivot = new THREE.Group();
        if (i === 0) {
            pivot.position.set(0, 0.28 * S, 0.55 * S);
            pivot.rotation.x = -Math.PI / 2.2;
        } else {
            pivot.position.set(0, -segLen, 0);
        }

        const r = 0.055 * S * (1 - i * 0.25);
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, segLen, 4), pinkMat);
        seg.position.y = -segLen / 2;
        pivot.add(seg);

        parentPivot.add(pivot);
        tailSegments.push(pivot);
        parentPivot = pivot;
    }

    // Carried Items Stack
    const carriedCheeseGroup = new THREE.Group();
    carriedCheeseGroup.position.set(0, 0.82 * S, 0.1 * S);
    spine.add(carriedCheeseGroup);
    const carriedWedges = [];

    function addCarriedCheeseWedge() {
        if (carriedWedges.length >= 6) return null;
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * S, 0.18 * S, 0.12 * S, 3), cheeseMat);
        w.position.y = carriedWedges.length * 0.11 * S;
        w.rotation.y = carriedWedges.length * 0.5;
        carriedCheeseGroup.add(w);
        carriedWedges.push(w);
        return w;
    }

    function clearCarriedCheeseStack() {
        carriedWedges.forEach(w => carriedCheeseGroup.remove(w));
        carriedWedges.length = 0;
    }

    mouseGroup.position.set(0, 0, 11);

    return {
        mouseGroup,
        tailSegments,
        headGroup,
        spine,
        legJoints,
        scaleFactor: S,
        addCarriedCheeseWedge,
        clearCarriedCheeseStack
    };
}