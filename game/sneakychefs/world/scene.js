/**
 * world/scene.js — the THREE.js stage: renderer, scene, fog, lights, resize.
 *
 * The three objects everyone reads (scene / camera / renderer) are declared in
 * core/state.js; this file only creates them. Fog density plus camera.far are what keep
 * the base, parked 400 units along x, out of the kitchen's frame entirely.
 */
let fillLight = null;

function initScene() {
    const canvas = document.getElementById('game-canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);
    scene.fog = new THREE.FogExp2(0x1a1a24, 0.025);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 10, 14);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // Lighting
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x4a3b34, 0.5));
    scene.add(new THREE.AmbientLight(0xffeedd, 0.22));

    fillLight = new THREE.DirectionalLight(0x8fa4ff, 0.3);
    fillLight.position.set(-14, 10, -12);
    scene.add(fillLight);

    const dirLight = new THREE.DirectionalLight(0xfff0dc, 1.0);
    dirLight.position.set(12, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    const d = 18;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.normalBias = 0.03;
    scene.add(dirLight);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
