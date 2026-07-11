import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import fragment from '../shaders/fragment.glsl';
import fragmentQuad from '../shaders/fragmentQuad.glsl';
import vertex from '../shaders/vertex.glsl';
import { AberrationShader } from './effect2.js';

const model = '/gdn8-logo-v3.glb';
const modelTexture = '/model@2x.jpg.webp';
const grain = '/gr-2@mob.jpg.webp';

// const scroller = new VirtualScroll();

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene();

    this.container = options.dom;
    this.width = this.container.offsetWidth || window.innerWidth;
    this.height = this.container.offsetHeight || window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true
      // alpha: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 100);

    // Mouse parallax tracking
    this.target = new THREE.Vector2(0, 0);
    this.mouse = new THREE.Vector2(0, 0);

    this.camera.position.set(0, 0, 1.25);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;

    // Offscreen render target — always square so model is never squished
    this.renderTarget = new THREE.WebGLRenderTarget(1024, 1024);

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
    // this.setUpSettings();
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
      transparent: false,
      vertexShader: vertex,
      fragmentShader: fragmentQuad
    });

    this.dummy = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), this.materialQuad);
    this.finalScene.add(this.dummy);

    this.blackBackground = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ color: '#000000' })
    );
    this.blackBackground.position.z = -1;
    this.finalScene.add(this.blackBackground);

    // scroller.on((event) => {
    //   console.log(event);
    //   this.finalScene.position.y = event.y / 1000;
    // });
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
    globalThis.addEventListener('mousemove', (e) => {
      // Normalize to -1..+1 — same output as simple-input-events uv
      this.mouse.x = (e.clientX / this.width) * 2 - 1;
      this.mouse.y = -((e.clientY / this.height) * 2 - 1);
    });
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);

    // Offscreen camera — square aspect so model is never squished
    this.camera.aspect = 1;
    this.camera.position.set(0, 0, 1.25);
    this.camera.updateProjectionMatrix();

    // Render target stays square
    if (this.renderTarget) {
      this.renderTarget.setSize(1024, 1024);
    }

    // Final ortho camera adjusts for window aspect so the quad fills correctly
    const windowAspect = this.width / this.height;
    if (this.finalCamera) {
      this.finalCamera.left = -1 * windowAspect;
      this.finalCamera.right = 1 * windowAspect;
      this.finalCamera.updateProjectionMatrix();
    }

    console.log('resize calculations - width: ' + this.width + ' height: ' + this.height);

    if (this.materialQuad && this.materialQuad.uniforms.resolution) {
      this.materialQuad.uniforms.resolution.value.set(this.width, this.height, 1, 1);
    }
    if (this.material && this.material.uniforms.resolution) {
      this.material.uniforms.resolution.value.set(this.width, this.height, 1, 1);
    }
  }

  initPost() {
    // Separate square target for aberrated model output (same size as renderTarget)
    this.aberratedTarget = new THREE.WebGLRenderTarget(1024, 1024);

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
        console.log('GLTF loaded successfully:', gltf);
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            console.log('Found mesh in GLTF:', child.name, child);
            console.log('Geometry attributes:', Object.keys(child.geometry.attributes));
          }
        });
        let mesh = gltf.scene.children[0];

        if (mesh) {
          // 1. Scale and zero position first
          mesh.scale.set(0.01, 0.01, 0.01);
          mesh.position.set(0, 0, 0);
          mesh.rotation.set(0, 0, 0);

          // 2. Add to scene so world matrix can be computed
          this.scene.add(mesh);
          mesh.updateMatrixWorld(true);

          // 3. Compute the actual bounding box in world space after scaling
          const box = new THREE.Box3().setFromObject(mesh);
          const center = box.getCenter(new THREE.Vector3());

          // 4. Offset position so bounding box center lands at world origin
          mesh.position.x -= center.x;
          mesh.position.y -= center.y;
          mesh.position.z -= center.z;

          // 5. Nudge model diagonally up-right
          mesh.position.y += 0.08;
          mesh.position.x += 0.07;

          // 5. Apply material to all child meshes
          mesh.traverse((child) => {
            if (child.isMesh) {
              child.material = this.material;
            }
          });

          this.mesh = mesh;
        }
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
    this.material.uniforms.time.value = this.time;
    requestAnimationFrame(this.render.bind(this));

    // Step 1: Render 3D model to square renderTarget (1024x1024)
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);

    // Step 2: Apply aberration — renderTarget → aberratedTarget
    // Aberration is on the MODEL only, not the circle border
    this.effectPass1.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.renderer.setRenderTarget(this.aberratedTarget);
    this.renderer.render(this.aberrationScene, this.aberrationCamera);

    // Step 3: Feed aberrated model into the circle/grain materialQuad
    this.materialQuad.uniforms.uTexture.value = this.aberratedTarget.texture;
    this.renderer.setRenderTarget(null);

    // Step 4: Render circle/grain finalScene to screen
    this.renderer.render(this.finalScene, this.finalCamera);

    this.target.lerp(this.mouse, 0.05);

    this.finalScene.position.y = this.target.y / 5;
    this.finalScene.position.x = this.target.x / 5;

    this.scene.position.x = -this.target.x / 3;
    this.scene.position.y = -this.target.y / 3;
  }
}
