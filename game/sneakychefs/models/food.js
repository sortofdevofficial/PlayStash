/**
 * models/food.js — ingredient geometry builders.
 *
 * Pure geometry. Each returned group stands on its own local origin at the base (y = 0 is
 * where it touches a surface) so the prop physics in world/ingredients.js can measure it
 * with a bounding box and reuse it for both the kitchen and the base stash. A builder may
 * publish group.userData.rollPivot = { y, radius } to say where it really makes contact.
 */

// Material Palette
const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.4, flatShading: true });
const cheeseRimMat = new THREE.MeshStandardMaterial({ color: 0xe6b800, roughness: 0.5, flatShading: true });
const appleMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.3, flatShading: true });
const appleStemMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8, flatShading: true });
const appleLeafMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.5, flatShading: true });
const bananaMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, roughness: 0.4, flatShading: true });
const bananaTipMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.7, flatShading: true });
const carrotMat = new THREE.MeshStandardMaterial({ color: 0xf57c1f, roughness: 0.45, flatShading: true });
const carrotTopMat = new THREE.MeshStandardMaterial({ color: 0x3f9142, roughness: 0.6, flatShading: true });
const butterMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, roughness: 0.35, flatShading: true });
const butterFoilMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd4, roughness: 0.25, metalness: 0.6, flatShading: true });
const milkCartonMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.4, flatShading: true });
const milkCapMat = new THREE.MeshStandardMaterial({ color: 0x2f7fd1, roughness: 0.4, flatShading: true });
const crustMat = new THREE.MeshStandardMaterial({ color: 0xc8873f, roughness: 0.75, flatShading: true });
const crumbMat = new THREE.MeshStandardMaterial({ color: 0xe8c083, roughness: 0.85, flatShading: true });
const jamGlassMat = new THREE.MeshStandardMaterial({ color: 0xb8243c, roughness: 0.15, metalness: 0.1, flatShading: true });
const jamLidMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.55, flatShading: true });
const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xd8402c, roughness: 0.3, flatShading: true });
const tomatoStemMat = new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.6, flatShading: true });

function createCheeseWheelModel() {
    const group = new THREE.Group();

    // Stands on its rim with the axle along local X: the prop physics rolls it about that
    // axle, and a wheel lying flat would instead tumble its faces through the floor.
    const R = 0.4, T = 0.26;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 12), cheeseMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = R;
    wheel.castShadow = wheel.receiveShadow = true;
    group.add(wheel);

    // Rind band around the middle of the wheel
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.01, R + 0.01, 0.1, 12), cheeseRimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.y = R;
    group.add(rim);

    // Marks set off-centre on each face, so the roll is legible instead of a spinning disc
    const markGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 6);
    [-1, 1].forEach(side => {
        const mark = new THREE.Mesh(markGeo, cheeseRimMat);
        mark.rotation.z = Math.PI / 2;
        mark.position.set(side * (T / 2), R + 0.21, 0);
        group.add(mark);
    });

    return group;
}

function createAppleModel() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), appleMat);
    body.position.y = 0.3;
    body.scale.set(1.0, 0.92, 1.0);
    body.castShadow = true;
    group.add(body);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.18, 5), appleStemMat);
    stem.position.set(0, 0.63, 0);
    stem.rotation.z = -0.15;
    group.add(stem);

    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), appleLeafMat);
    leaf.position.set(0.07, 0.66, 0);
    leaf.rotation.z = -Math.PI / 3;
    group.add(leaf);

    // Roll about the body, not about the box: the leaf above adds ~0.2 of height that has
    // nothing to do with where the apple touches a surface.
    group.userData.rollPivot = { y: 0.3, radius: 0.3 };

    return group;
}

function createBananaModel() {
    const group = new THREE.Group();

    // Curved low-poly banana lying on its side: five cylinder segments along an arc
    const segCount = 5;
    for (let i = 0; i < segCount; i++) {
        const t = i / (segCount - 1);
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.17, 5), bananaMat);
        seg.position.set(-0.28 + t * 0.56, 0.12 + Math.sin(t * Math.PI) * 0.1, 0);
        seg.rotation.z = Math.PI / 2 - (t - 0.5) * 0.7;
        seg.castShadow = true;
        group.add(seg);
    }

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.1, 5), bananaTipMat);
    stem.position.set(-0.34, 0.16, 0);
    stem.rotation.z = Math.PI / 2 + 0.5;
    group.add(stem);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), bananaTipMat);
    tip.position.set(0.33, 0.13, 0);
    group.add(tip);

    return group;
}

function createCarrotModel() {
    const group = new THREE.Group();

    // Lying on its side along X, tip forward: a carrot standing on end would balance on
    // its own point, and upright it reads as a traffic cone.
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.62, 7), carrotMat);
    root.rotation.z = -Math.PI / 2;
    root.position.set(0.06, 0.16, 0);
    root.castShadow = true;
    group.add(root);

    [-0.09, 0, 0.09].forEach(offset => {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 4), carrotTopMat);
        frond.rotation.set(offset * 2, 0, Math.PI / 2);
        frond.position.set(-0.37, 0.16, offset);
        group.add(frond);
    });

    return group;
}

// Fridge goods. Neither is round, so both slide and wobble when shoved instead of rolling.
function createButterModel() {
    const group = new THREE.Group();

    const block = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.28), butterMat);
    block.position.y = 0.11;
    block.castShadow = block.receiveShadow = true;
    group.add(block);

    // A foil sleeve over the lower half so the block reads as wrapped dairy.
    const foil = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.3), butterFoilMat);
    foil.position.y = 0.06;
    group.add(foil);

    return group;
}

function createMilkCarton() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.24), milkCartonMat);
    body.position.y = 0.22;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.26, 3), milkCartonMat);
    roof.rotation.z = Math.PI / 2;
    roof.scale.set(1, 0.9, 0.9);
    roof.position.y = 0.55;
    roof.castShadow = true;
    group.add(roof);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), milkCapMat);
    cap.position.set(0.08, 0.68, 0);
    group.add(cap);

    return group;
}

// Pantry and garden goods. The loaf and the jar are squat and flat-bottomed, so both slide;
// the tomato is round and rolls about its own body.
function createBreadModel() {
    const group = new THREE.Group();

    // A cob: one squashed ball for the crust, a paler one sunk into the top for the scored
    // crumb, so it reads as bread rather than a brown pebble.
    const crust = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), crustMat);
    crust.scale.set(1.5, 0.82, 1.05);
    crust.position.y = 0.24;
    crust.castShadow = crust.receiveShadow = true;
    group.add(crust);

    const crumb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 5), crumbMat);
    crumb.scale.set(1.35, 0.4, 0.8);
    crumb.position.y = 0.4;
    group.add(crumb);

    // Two slashes across the top, the way a loaf is proved before it goes in the oven.
    [-0.14, 0.14].forEach(dx => {
        const slash = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.34), crustMat);
        slash.position.set(dx, 0.45, 0);
        slash.rotation.y = 0.35;
        group.add(slash);
    });

    return group;
}

function createJamJar() {
    const group = new THREE.Group();

    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.4, 9), jamGlassMat);
    glass.position.y = 0.2;
    glass.castShadow = glass.receiveShadow = true;
    group.add(glass);

    // A neck and a lid: the lid is the only bright metal in the house, so a jar glints.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.07, 9), jamGlassMat);
    neck.position.y = 0.43;
    group.add(neck);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.07, 9), jamLidMat);
    lid.position.y = 0.49;
    lid.castShadow = true;
    group.add(lid);

    // A paper label round the middle so it is a jar of something, not a red cylinder.
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.2, 0.17, 9),
        new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.9, flatShading: true }));
    label.position.y = 0.19;
    group.add(label);

    return group;
}

function createTomatoModel() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), tomatoMat);
    body.scale.set(1.0, 0.86, 1.0);
    body.position.y = 0.22;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    // A star of leaves at the top, plus the stub of a stem.
    for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), tomatoStemMat);
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.09, 0.42, Math.sin(a) * 0.09);
        leaf.rotation.set(Math.PI / 2 + 0.5, 0, -a);
        group.add(leaf);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.1, 5), tomatoStemMat);
    stem.position.y = 0.47;
    group.add(stem);

    // Roll about the fruit, not the box: the star above adds height that has nothing to do
    // with where a tomato touches a surface.
    group.userData.rollPivot = { y: 0.22, radius: 0.25 };

    return group;
}

function buildIngredientModel(type) {
    if (type === 'apple') return createAppleModel();
    if (type === 'banana') return createBananaModel();
    if (type === 'carrot') return createCarrotModel();
    if (type === 'butter') return createButterModel();
    if (type === 'milk') return createMilkCarton();
    if (type === 'bread') return createBreadModel();
    if (type === 'jam') return createJamJar();
    if (type === 'tomato') return createTomatoModel();
    return createCheeseWheelModel();
}
