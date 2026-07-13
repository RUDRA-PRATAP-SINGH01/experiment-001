# rewind.git 🟢✨

A highly immersive, premium 3D WebGL landing experience built using **Three.js**, custom **GLSL Shaders**, and **Vite**. The project renders a procedural emerald glass chamber featuring refraction, chromatic aberration post-processing, and interactive parallax feedback.

---

## 🎨 Visual Design & Tech Stack

This project is built using a modern, performant web graphics stack:
- **Core Engine**: [Three.js](https://threejs.org/) (WebGL 3D library)
- **Bundler & Dev Server**: [Vite](https://vite.dev/) with [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl) (for importing shaders directly as strings)
- **Geometry Compression**: [Draco Loader](https://threejs.org/docs/#examples/en/loaders/DRACOLoader) for highly compressed, fast-loading 3D assets
- **Post-Processing**: Custom multi-pass chromatic aberration and liquid glass refraction shaders
- **Aesthetic Direction**: Sleek dark-emerald color palette, film-grain texture, smooth lerp-based mouse interaction, and typographic styling (Poppins / Manrope)

---

## 📂 Project Structure

```bash
experiment-001/
├── public/                 # Static assets (3D models, textures, fonts)
│   ├── draco/              # Draco decoder files
│   ├── fonts/              # Local WOFF2 font resources (Poppins, Manrope)
│   ├── copilot.glb         # 3D model asset
│   ├── model@2x.jpg.webp   # Matcap texture mapping
│   └── gr-2@mob.jpg.webp   # Film grain overlay texture
├── src/
│   ├── app/
│   │   ├── three.js        # Main WebGL Sketch coordinator & lifecycle
│   │   └── effect2.js      # Post-processing shader definition (Aberration)
│   ├── shaders/            # Custom GLSL shaders
│   │   ├── vertex.glsl         # Common vertex shader mapping normals/positions
│   │   ├── fragment.glsl       # Matcap outline / rim shader for the 3D model
│   │   ├── chamberStreak.glsl  # Procedural emerald glass streaks generator
│   │   └── fragmentQuad.glsl   # Final composition, noise, and grain blend shader
│   ├── styles/
│   │   └── main.css        # Layout, custom fonts loading, and typography
│   └── main.js             # Javascript entry point & DOM initialization
├── index.html              # HTML shell & font definitions
├── vite.config.js          # Vite config & plugins
└── package.json            # Scripts & project dependencies
```

---

## ⚙️ Shaders & Rendering Pipeline

The sketch utilizes a **multi-pass rendering pipeline** to combine procedural background environments, matcap lighting, and screen-space distortion.

### 1. Procedural Emerald Chamber (`chamberStreak.glsl`)
Renders an ambient temporal-glass background.
* **Fractal Brownian Motion (FBM)**: Generates 4-octave value noise to create organically layered, stretched vertical glass streaks.
* **Density Gating**: Ensures ~70% negative space is kept for depth and clarity.
* **Spectral Splitting / Color Separation**: Restrained chromatic dispersion is computed along bright edge gradients (`dFdx` / `dFdy`).
* **Multi-Layer Rendering**: Bakes two distinct layers (`uLayer = 0` for sharp background, `uLayer = 1` for refractive haze) into a `streakTarget` WebGL Render Target.

### 2. Model Matcap Rim Shader (`fragment.glsl`)
Draws the focal 3D model with a glowing outline.
* **Matcap Mapping**: Maps the normal vectors of the model to UV coordinates to look up the matcap texture (`model@2x.jpg.webp`).
* **Rim Edge Highlight**: Uses the dot product of the surface normal and view direction vector ($\vec{N} \cdot \vec{V}$) to generate a thin, glowing silhouette highlight while keeping the model body dark.

### 3. Post-Processing RGB Shift (`effect2.js`)
* **AberrationShader**: Applies screen-space chromatic aberration (RGB shifting) to the rendered model texture using sine-based coordinate displacement before final composition.

### 4. Final Composition (`fragmentQuad.glsl`)
Composes the final image in a fullscreen shader quad:
* **Liquid Glass Distortion**: Warps the UV mapping near the center depending on the distance from center, creating a refractive look.
* **Foreground Bands**: Adds soft, noise-modulated foreground glass bands on the top and bottom of the viewport.
* **Film Grain Overlay**: Blends a high-frequency grain texture (`gr-2@mob.jpg.webp`) over the viewport to produce a premium cinematic texture.

---

## 🖱️ Interactive Features

* **Pointer Parallax**: The 3D model pivots in response to mouse movement.
* **Lerped Easing**: Smooth linear interpolation (`lerp`) ensures transitions are fluid and natural:
  $$\text{target} \leftarrow \text{lerp}(\text{target}, \text{mouse}, 0.1)$$
* **Automatic Layout updates**: Adapts aspect ratios, camera matrices, orthographic views, and render-target resolutions dynamically on window resize events.

---

## 🚀 Setup & Installation

Follow these steps to run the project locally.

### 1. Install Dependencies
Run the command below in the project directory to install all dependencies (Vite, Three.js, etc.):
```bash
npm install
```

### 2. Start Dev Server
Run the local development server:
```bash
npm run dev
```
By default, the application will be hosted at `http://localhost:5173`.

### 3. Build for Production
To bundle and optimize the project for deployment:
```bash
npm run build
```
The production bundle will be generated in the `dist/` directory.

### 4. Preview the Build
To serve and preview the compiled production assets locally:
```bash
npm run preview
```
