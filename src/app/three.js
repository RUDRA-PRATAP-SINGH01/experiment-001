import GUI from 'lil-gui';
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

    this.camera = new THREE.PerspectiveCamera(70, this.width / Math.max(this.height, 1), 0.01, 100);

    // Mouse parallax tracking — starts centered
    this.target = new THREE.Vector2(0, 0);
    this.mouse = new THREE.Vector2(0, 0);
    this.pointerActive = false;

    this.baseCameraZ = 1.75;
    this.camera.position.set(0, 0, this.baseCameraZ);
    this.camera.lookAt(0, 0, 0);
    this.time = 0;

    // Pivot keeps the model centered; parallax moves this group only
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

    // Full-screen transparent plane — green comes from the page behind the canvas
    this.dummy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.materialQuad);
    this.finalScene.add(this.dummy);
    this.updatePlaneScale();
  }

  settings() {
    this.settings = {
      progress: 0
    };
    this.gui = new GUI();
    this.gui.add(this.settings, 'progress', 0, 1, 0.01).onChange((val) => {
      this.material.uniforms.progress.value = val;
    });
  }

  setupResize() {
    window.addEventListener('resize', this.resize.bind(this));
  }

  mouseEvents() {
    const el = this.renderer.domElement;

    el.addEventListener('pointerenter', () => {
      this.pointerActive = true;
    });

    el.addEventListener('pointerleave', () => {
      this.pointerActive = false;
      // Return model to exact center when pointer leaves
      this.mouse.set(0, 0);
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(rect.width, 1);
      const y = (e.clientY - rect.top) / Math.max(rect.height, 1);
      this.mouse.x = x * 2 - 1;
      this.mouse.y = -(y * 2 - 1);
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
    if (this.renderTarget) {
      this.renderTarget.setSize(rt.w, rt.h);
    }
    if (this.aberratedTarget) {
      this.aberratedTarget.setSize(rt.w, rt.h);
    }

    if (this.finalCamera) {
      this.finalCamera.left = -1 * aspect;
      this.finalCamera.right = 1 * aspect;
      this.finalCamera.updateProjectionMatrix();
    }

    this.updatePlaneScale();

    if (this.materialQuad && this.materialQuad.uniforms.resolution) {
      this.materialQuad.uniforms.resolution.value.set(this.width, this.height, aspect, 1 / aspect);
    }
    if (this.material && this.material.uniforms.resolution) {
      this.material.uniforms.resolution.value.set(this.width, this.height, aspect, 1 / aspect);
    }
  }

  updatePlaneScale() {
    if (!this.dummy) return;
    const aspect = this.width / Math.max(this.height, 1);
    // Ortho frustum is (-aspect..aspect) x (-1..1); 2x2 plane → scale X by aspect
    this.dummy.scale.set(aspect, 1, 1);
  }

  initPost() {
    const rt = this.getRTSize();
    this.aberratedTarget = new THREE.WebGLRenderTarget(rt.w, rt.h);

    // Aberration applied as a full-screen quad BEFORE the circle/grain finalScene
    // This ensures aberration is only on the model, NOT the white circle border
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
        const root = gltf.scene;
        root.scale.setScalar(0.0105);
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);

        this.modelPivot.add(root);
        root.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        root.position.set(-center.x, -center.y, -center.z);

        // Second pass to absorb nested GLTF offsets
        root.updateMatrixWorld(true);
        box.setFromObject(root);
        box.getCenter(center);
        root.position.x -= center.x;
        root.position.y -= center.y;
        root.position.z -= center.z;

        // Push into the open center-right so the left title doesn't pin it visually left
        root.position.x += 0.4;
        root.position.y += 0.06;

        root.traverse((child) => {
          if (child.isMesh) {
            child.material = this.material;
            if (child.geometry && child.geometry.attributes.uv) {
              const uv = child.geometry.attributes.uv.array;
              for (let i = 0; i < uv.length; i += 4) {
                uv[i] = 0;
                uv[i + 1] = 0;
                uv[i + 2] = 1;
                uv[i + 3] = 0;
              }
              child.geometry.attributes.uv.needsUpdate = true;
            }
          }
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
    if (this.material) this.material.uniforms.time.value = this.time;
    requestAnimationFrame(this.render.bind(this));

    // Lock camera to viewport center every frame
    this.camera.position.set(0, 0, this.baseCameraZ);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);

    this.target.lerp(this.mouse, 0.08);
    if (this.modelPivot) {
      // Opposite of cursor (landing page); softer so resting pose stays centered
      this.modelPivot.position.x = -this.target.x / 5;
      this.modelPivot.position.y = -this.target.y / 5;
    }
    this.scene.position.set(0, 0, 0);

    // Step 1: Render 3D model to renderTarget
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Step 2: Apply aberration
    this.effectPass1.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.renderer.setRenderTarget(this.aberratedTarget);
    this.renderer.clear();
    this.renderer.render(this.aberrationScene, this.aberrationCamera);

    // Step 3: Feed aberrated model into the fullscreen materialQuad
    this.materialQuad.uniforms.uTexture.value = this.aberratedTarget.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.clear();

    this.finalScene.position.set(0, 0, 0);

    // Step 4: Render finalScene to screen
    this.renderer.render(this.finalScene, this.finalCamera);
  }
}
