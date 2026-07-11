import gsap from 'gsap';
import * as THREE from 'three';
import GUI from 'lil-gui';
import VirtualScroll from 'virtual-scroll';

// Create container for application
const appEl = document.querySelector('#app');

// Create canvas
const canvas = document.createElement('canvas');
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.zIndex = '0'; // Fixed: zIndex 0 sits on top of body bg, but under z-10 info panel
canvas.style.pointerEvents = 'auto'; // Ensure we can interact with canvas
appEl.appendChild(canvas);

// Create Three.js Scene
const scene = new THREE.Scene();

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Add Lights to make a premium 3D look
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0x6366f1, 2.5); // Indigo light
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xec4899, 3, 10); // Pink point light
pointLight.position.set(-3, -3, 2);
scene.add(pointLight);

// Add a Cube with MeshStandardMaterial for premium lighting effects
const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
const material = new THREE.MeshStandardMaterial({ 
  color: 0x4f46e5, 
  roughness: 0.1,
  metalness: 0.8,
  wireframe: false
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Setup Clock
const clock = new THREE.Clock();

// Info overlay panel using Tailwind CSS classes
const info = document.createElement('div');
info.className = 'absolute top-5 left-5 font-mono text-sm pointer-events-none leading-relaxed select-none z-10 bg-slate-950/80 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-md shadow-2xl max-w-sm';
info.innerHTML = `
  <h1 class="text-lg font-bold mb-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">Vite + Three.js + GSAP</h1>
  <p class="text-slate-400 mb-4 text-xs">Scroll anywhere or drag controls in the top-right GUI to interact.</p>
  <div class="flex flex-col gap-1 text-xs text-slate-500">
    <div class="flex justify-between border-b border-slate-900 pb-1"><span>GSAP:</span><span class="text-indigo-400 font-semibold">${gsap.version}</span></div>
    <div class="flex justify-between border-b border-slate-900 pb-1"><span>Three.js:</span><span class="text-purple-400 font-semibold">r${THREE.REVISION}</span></div>
    <div class="flex justify-between"><span>Tailwind:</span><span class="text-emerald-400 font-semibold">v4.0</span></div>
  </div>
`;
appEl.appendChild(info);

// lil-gui setup
const gui = new GUI({ title: 'Controls' });
gui.add(cube.scale, 'x', 0.1, 3, 0.1).name('Scale X');
gui.add(cube.scale, 'y', 0.1, 3, 0.1).name('Scale Y');
gui.add(cube.scale, 'z', 0.1, 3, 0.1).name('Scale Z');
gui.add(material, 'wireframe').name('Wireframe');
gui.addColor({ color: '#4f46e5' }, 'color').onChange((value) => {
  material.color.set(value);
}).name('Cube Color');

// Virtual Scroll setup
const scroller = new VirtualScroll();
let targetRotationX = 0;
let targetRotationY = 0;

scroller.on(event => {
  // Update target rotation based on scroll delta
  targetRotationY += event.deltaY * 0.002;
  targetRotationX += event.deltaX * 0.002;
});

// Resize handler (Responsive design)
window.addEventListener('resize', () => {
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Get elapsed time from Clock
  const elapsedTime = clock.getElapsedTime();

  // Smoothly interpolate to scroll-based rotation and add constant clock-based rotation
  gsap.to(cube.rotation, {
    x: targetRotationX + (elapsedTime * 0.3),
    y: targetRotationY + (elapsedTime * 0.5),
    duration: 0.8,
    overwrite: 'auto'
  });

  // Render scene
  renderer.render(scene, camera);
}
animate();
