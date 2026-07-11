import gsap from 'gsap';
import * as THREE from 'three';
import GUI from 'lil-gui';
import VirtualScroll from 'virtual-scroll';

console.log('Libraries loaded successfully!');
console.log('GSAP version:', gsap.version);
console.log('Three.js REVISION:', THREE.REVISION);
console.log('lil-gui GUI:', GUI);
console.log('VirtualScroll:', VirtualScroll);

// Create container
const appEl = document.querySelector('#app');
const canvas = document.createElement('canvas');
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.zIndex = '-1';
appEl.appendChild(canvas);

// Create Three.js Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Add a Cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x4f46e5, wireframe: true });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 3;

// GSAP Animation example
gsap.to(cube.rotation, {
  y: Math.PI * 2,
  duration: 8,
  repeat: -1,
  ease: "none"
});

// lil-gui setup
const gui = new GUI({ title: 'Controls' });
gui.add(cube.rotation, 'x', 0, Math.PI * 2, 0.01).name('Rotate X');
gui.addColor({ color: '#4f46e5' }, 'color').onChange((value) => {
  material.color.set(value);
}).name('Cube Color');

// Add info panel
const info = document.createElement('div');
info.style.position = 'absolute';
info.style.top = '20px';
info.style.left = '20px';
info.style.fontFamily = 'monospace';
info.style.fontSize = '14px';
info.style.pointerEvents = 'none';
info.style.lineHeight = '1.6';
info.innerHTML = `
  <h1>Vite + Three.js + GSAP boilerplate</h1>
  <p>Scroll or drag controls to see interaction.</p>
  <p>GSAP Version: ${gsap.version}</p>
  <p>Three.js Version: r${THREE.REVISION}</p>
`;
appEl.appendChild(info);

// Virtual Scroll setup
const scroller = new VirtualScroll();
scroller.on(event => {
  // Smoothly rotate cube based on scroll
  gsap.to(cube.rotation, {
    x: cube.rotation.x + event.deltaY * 0.005,
    duration: 0.5,
    overwrite: 'auto'
  });
});

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
