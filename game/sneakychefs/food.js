/**
 * Sneaky Chefs: Kitchen Escape - Food Models & Spawning Manager
 */

let foodItems = [];

// Material Palette
const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.4, flatShading: true });
const cheeseHoleMat = new THREE.MeshStandardMaterial({ color: 0xe6b800, roughness: 0.5, flatShading: true });
const appleMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.3, flatShading: true });
const appleStemMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8, flatShading: true });
const appleLeafMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.5, flatShading: true });
const bananaMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, roughness: 0.4, flatShading: true });
const bananaTipMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.7, flatShading: true });

function createCheeseModel() {
    const group = new THREE.Group();
    
    // Wedge Base
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.6, 0);
    shape.lineTo(0, 0.8);
    shape.closePath();

    const extrudeSettings = { depth: 0.5, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const mesh = new THREE.Mesh(geo, cheeseMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(-0.3, 0.25, 0.25);
    group.add(mesh);

    // Decorative Holes
    const hole1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), cheeseHoleMat);
    hole1.position.set(0.0, 0.15, 0.1);
    const hole2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), cheeseHoleMat);
    hole2.position.set(-0.1, 0.2, -0.1);
    group.add(hole1, hole2);

    return group;
}

function createAppleModel() {
    const group = new THREE.Group();

    // Low poly apple body
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), appleMat);
    body.position.y = 0.35;
    body.scale.set(1.0, 0.9, 1.0);
    group.add(body);

    // Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.18, 5), appleStemMat);
    stem.position.set(0, 0.65, 0);
    stem.rotation.z = -0.15;
    group.add(stem);

    // Leaf
    const leafGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
    const leaf = new THREE.Mesh(leafGeo, appleLeafMat);
    leaf.position.set(0.06, 0.68, 0);
    leaf.rotation.z = -Math.PI / 3;
    group.add(leaf);

    return group;
}

function createBananaModel() {
    const group = new THREE.Group();

    // Curved low-poly banana using cylinder segments
    const bGroup = new THREE.Group();
    const segCount = 5;
    for (let i = 0; i < segCount; i++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 5), bananaMat);
        const t = i / (segCount - 1);
        seg.position.set(Math.sin(t * 1.2) * 0.25, i * 0.16 + 0.1, 0);
        seg.rotation.z = -t * 0.5;
        bGroup.add(seg);
    }

    // Stem & Tip
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 5), bananaTipMat);
    stem.position.set(-0.02, 0.02, 0);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.08, 5), bananaTipMat);
    tip.position.set(0.32, 0.78, 0);

    group.add(bGroup, stem, tip);
    group.rotation.x = Math.PI / 2;
    group.position.y = 0.1;
    return group;
}

function spawnFoodItems(sceneRef) {
    foodItems = [];

    const spawns = [
        { type: 'cheese', name: 'Cheese Wedge', x: -2.0, y: 2.3, z: 0.0 },
        { type: 'apple', name: 'Red Apple', x: 2.0, y: 2.3, z: -0.5 },
        { type: 'banana', name: 'Banana', x: -7.5, y: 2.3, z: -2.0 },
        { type: 'cheese', name: 'Cheese Wedge', x: 8.5, y: 2.3, z: -1.5 },
        { type: 'apple', name: 'Red Apple', x: -11.5, y: 2.4, z: -11.5 },
        { type: 'banana', name: 'Banana', x: 3.5, y: 0.0, z: 5.0 }
    ];

    spawns.forEach((s, idx) => {
        let model;
        if (s.type === 'cheese') model = createCheeseModel();
        else if (s.type === 'apple') model = createAppleModel();
        else if (s.type === 'banana') model = createBananaModel();

        model.position.set(s.x, s.y, s.z);
        sceneRef.add(model);

        foodItems.push({
            id: idx,
            type: s.type,
            name: s.name,
            group: model,
            collected: false,
            baseY: s.y
        });
    });
}

function updateFoodAnimations(time) {
    foodItems.forEach(item => {
        if (item.collected) return;
        item.group.rotation.y = time * 1.5;
        item.group.position.y = item.baseY + Math.sin(time * 3.0 + item.id) * 0.06;
    });
}

function collectFoodItem(item) {
    if (item.collected) return;
    item.collected = true;
    if (item.group && item.group.parent) {
        item.group.parent.remove(item.group);
    }

    if (typeof inventory !== 'undefined') {
        inventory[item.type] = (inventory[item.type] || 0) + 1;
    }

    if (typeof updateInventoryUI === 'function') {
        updateInventoryUI(item.type);
    }

    // Stack a visible wedge on the mouse's back for cheese specifically.
    // Stack a small mesh of whatever was picked up on the mouse's back.
    if (typeof addCarriedItem === 'function') {
        addCarriedItem(item.type);
    }

    if (typeof playSound === 'function') playSound('collect');

    // Alert chef if close enough when taking food
    if (typeof chefGroup !== 'undefined' && typeof mouseGroup !== 'undefined') {
        const distToChef = mouseGroup.position.distanceTo(chefGroup.position);
        if (distToChef < 10.0 && typeof chefIsChasing !== 'undefined') {
            chefIsChasing = true;
            if (typeof playSound === 'function') playSound('alert');
        }
    }
}