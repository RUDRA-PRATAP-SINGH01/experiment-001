import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import fragment from '../shaders/fragment.glsl';
import fragmentQuad from '../shaders/fragmentQuad.glsl';
import vertex from '../shaders/vertex.glsl';
import { AberrationShader } from './effect2.js';

const model = '/gdn8-logo-v3.glb';
const modelTexture = '/model@2x.jpg.webp';
const grain = '/gr-2@mob.jpg.webp';

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene();

    this.container = options.dom;
    this.width = this.container.offsetWidth || window.innerWidth;
    this.height = this.container.offsetHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setClearAlpha(0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / Math.max(this.height, 1),
      0.01,
      100
    );

    this.target = new THREE.Vector2(0, 0);
    this.mouse = new THREE.Vector2(0, 0);
    this.pointerActive = false;

    this.baseCameraZ = 1.85;
    this.camera.position.set(0, 0, this.baseCameraZ);
    this.camera.lookAt(0, 0, 0);
    this.time = 0;

    // Parallax moves this group only — model stays face-on at local origin
    this.modelPivot = new THREE.Group();
    this.scene.add(this.modelPivot);

    const rt = this.getRTSize();
    this.renderTarget = new THREE.WebGLRenderTarget(rt.w, rt.h);

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('/draco/gltf/');
    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.dracoLoader);

    this.isPlaying = true;
    this.mouseEvents();
    this.initFinalScene();
    this.addObjects();
    this.resize();
    this.initPost();
    this.render();
    this.setupResize();
  }

  initFinalScene() {
    this.finalScene = new THREE.Scene();
    this.finalCamera = new THREE.OrthographicCamera(
      -1 * this.camera.aspect,
      1 * this.camera.aspect,
      1,
      -1,
      -100,
      100
    );

    const grainTexture = new THREE.TextureLoader().load(grain);

    this.materialQuad = new THREE.ShaderMaterial({
      extensions: {
        derivatives: '#extension GL_OES_standard_derivatives : enable'
      },
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector4() },
        uTexture: { value: null },
        uGrain: { value: grainTexture }
      },
      transparent: true,
      depthWrite: false,
      vertexShader: vertex,
      fragmentShader: fragmentQuad
    });

    this.dummy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.materialQuad);
    this.finalScene.add(this.dummy);
    this.updatePlaneScale();
  }

  setupResize() {
    window.addEventListener('resize', this.resize.bind(this));
  }

  mouseEvents() {
    // Track mouse over the full window so parallax always follows cursor direction
    window.addEventListener('pointermove', (e) => {
      const rect = this.container.getBoundingClientRect();
      const w = Math.max(rect.width, 1);
      const h = Math.max(rect.height, 1);
      // -1..+1, same direction as screen (right = +, up = +)
      this.mouse.x = ((e.clientX - rect.left) / w) * 2 - 1;
      this.mouse.y = -(((e.clientY - rect.top) / h) * 2 - 1);
      this.pointerActive = true;
    });

    window.addEventListener('pointerleave', () => {
      this.pointerActive = false;
      this.mouse.set(0, 0);
    });

    document.addEventListener('mouseleave', () => {
      this.pointerActive = false;
      this.mouse.set(0, 0);
    });
  }

  getRTSize() {
    const aspect = Math.max(this.width, 1) / Math.max(this.height, 1);
    const base = 1024;
    if (aspect >= 1) {
      return { w: Math.floor(base * aspect), h: base };
    }
    return { w: base, h: Math.floor(base / aspect) };
  }

  resize() {
    this.width = this.container.offsetWidth || window.innerWidth;
    this.height = this.container.offsetHeight || window.innerHeight;
    this.renderer.setSize(this.width, this.height);

    const aspect = this.width / Math.max(this.height, 1);
    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, this.baseCameraZ);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const rt = this.getRTSize();
    if (this.renderTarget) this.renderTarget.setSize(rt.w, rt.h);
    if (this.aberratedTarget) this.aberratedTarget.setSize(rt.w, rt.h);

    if (this.finalCamera) {
      this.finalCamera.left = -aspect;
      this.finalCamera.right = aspect;
      this.finalCamera.updateProjectionMatrix();
    }

    this.updatePlaneScale();

    if (this.materialQuad?.uniforms?.resolution) {
      this.materialQuad.uniforms.resolution.value.set(this.width, this.height, aspect, 1 / aspect);
    }
    if (this.material?.uniforms?.resolution) {
      this.material.uniforms.resolution.value.set(this.width, this.height, aspect, 1 / aspect);
    }
  }

  updatePlaneScale() {
    if (!this.dummy) return;
    const aspect = this.width / Math.max(this.height, 1);
    this.dummy.scale.set(aspect, 1, 1);
  }

  initPost() {
    const rt = this.getRTSize();
    this.aberratedTarget = new THREE.WebGLRenderTarget(rt.w, rt.h);

    this.effectPass1 = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        distort: { value: 0.01 },
        time: { value: 0 }
      },
      vertexShader: AberrationShader.vertexShader,
      fragmentShader: AberrationShader.fragmentShader
    });

    const aberrationQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.effectPass1);
    this.aberrationScene = new THREE.Scene();
    this.aberrationScene.add(aberrationQuad);
    this.aberrationCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  }

  /** Place object so its world AABB center is at the origin. */
  centerObject(object) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= center.z;
    object.updateMatrixWorld(true);
  }

  addObjects() {
    this.material = new THREE.ShaderMaterial({
      extensions: {
        derivatives: '#extension GL_OES_standard_derivatives : enable'
      },
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        progress: { value: 0 },
        resolution: { value: new THREE.Vector4() },
        uTexture: { value: new THREE.TextureLoader().load(modelTexture) }
      },
      vertexShader: vertex,
      fragmentShader: fragment
    });

    this.gltf.load(
      model,
      (gltf) => {
        // Use the mesh directly (same as landing page) for predictable centering
        const root = gltf.scene.children[0] || gltf.scene;
        root.scale.setScalar(0.0105);
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);

        // Bake geometry so the mesh origin is the visual AABB center
        root.traverse((child) => {
          if (!child.isMesh || !child.geometry) return;
          child.geometry.computeBoundingBox();
          child.geometry.center();
          child.geometry.computeBoundingSphere();
        });

        this.modelPivot.clear();
        this.modelPivot.add(root);

        // Final world-space nudge in case of nested transforms
        this.centerObject(root);
        this.centerObject(root);

        // Optical Y: AABB center sits below the visual head mass
        root.position.y += 0.28;

        root.traverse((child) => {
          if (!child.isMesh) return;
          child.material = this.material;
          const uvAttr = child.geometry?.attributes?.uv;
          if (!uvAttr) return;
          const uv = uvAttr.array;
          for (let i = 0; i < uv.length; i += 4) {
            uv[i] = 0;
            uv[i + 1] = 0;
            uv[i + 2] = 1;
            uv[i + 3] = 0;
          }
          uvAttr.needsUpdate = true;
        });

        this.mesh = root;
        this.modelPivot.position.set(0, 0, 0);
        this.scene.position.set(0, 0, 0);
        this.mouse.set(0, 0);
        this.target.set(0, 0);
      },
      undefined,
      (error) => {
        console.error('An error occurred loading the model:', error);
      }
    );
  }

  stop() {
    this.isPlaying = false;
  }

  play() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.render();
    }
  }

  render() {
    if (!this.isPlaying) return;
    this.time += 0.05;
    requestAnimationFrame(this.render.bind(this));

    if (this.material) this.material.uniforms.time.value = this.time;
    if (this.materialQuad) this.materialQuad.uniforms.time.value = this.time;

    // Face-on framing: camera looks straight at world origin
    this.camera.position.set(0, 0, this.baseCameraZ);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);

    // Soft parallax — same direction as the mouse (right → right, up → up)
    if (!this.pointerActive) this.mouse.set(0, 0);
    this.target.lerp(this.mouse, 0.1);
    if (this.modelPivot) {
      this.modelPivot.position.x = this.target.x / 6;
      this.modelPivot.position.y = this.target.y / 6;
    }
    this.scene.position.set(0, 0, 0);
    this.finalScene.position.set(0, 0, 0);

    if (!this.effectPass1 || !this.aberrationScene || !this.aberrationCamera) return;

    // 1) Model → RT
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // 2) Aberration
    this.effectPass1.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.renderer.setRenderTarget(this.aberratedTarget);
    this.renderer.clear();
    this.renderer.render(this.aberrationScene, this.aberrationCamera);

    // 3) Compose to screen
    this.materialQuad.uniforms.uTexture.value = this.aberratedTarget.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.finalScene, this.finalCamera);
  }
}
