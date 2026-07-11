/**
 * Dot screen shader
 * based on glsl.js sepia shader
 * https://github.com/evanw/glsl.js
 */

export let AberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    distort: { value: 0.5 },
    time: { value: 0 }
  },

  vertexShader: `varying vec2 vUv;void main() {vUv = uv;gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );}`,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float distort;
    uniform float time;
    varying vec2 vUv;

    const float max_distort = 1.5;
    const int num_iter = 12;
    const float reci_num_iter_f = 1.0 / float(num_iter);

    // chromatic aberration
    vec2 barrelDistortion(vec2 coord, float amt) {
      vec2 cc = coord - 0.5;
      float dist = dot(cc, cc);
      return coord + cc * dist * amt;
    }

    float sat( float t )
    {
      return clamp( t, 0.0, 1.0 );
    }

    float linterp( float t ) {
      return sat( 1.0 - abs( 2.0*t - 1.0 ) );
    }

    float remap( float t, float a, float b ) {
      return sat( (t - a) / (b - a) );
    }

    vec4 spectrum_offset( float t ) {
      vec4 ret;
      float lo = step(t,0.5);
      float hi = 1.0-lo;
      float w = linterp( remap( t, 1.0/6.0, 5.0/6.0 ) );
      ret = vec4(lo,1.0,hi, 1.) * vec4(1.0-w, w, 1.0-w, 1.);

      return pow( ret, vec4(1.0/2.2) );
    }

    void main() {
      vec4 final = texture2D(tDiffuse, vUv);
      float rgbshift = 0.018;
      vec2 uv = vUv;

      vec2 r_uv = vec2(
        uv.x + sin(uv.x-0.5)*rgbshift*1.0,
        uv.y + sin(uv.y-0.5)*rgbshift*3.0
      );

      vec2 g_uv = vec2(
        uv.x + sin(uv.x-0.5)*rgbshift*2.0,
        uv.y + sin(uv.y-0.5)*rgbshift*2.0
      );

      vec2 b_uv = vec2(
        uv.x + sin(uv.x-0.5)*rgbshift*3.0,
        uv.y + sin(uv.y-0.5)*rgbshift*1.0
      );

      float r = texture2D(tDiffuse, r_uv).r;
      float g = texture2D(tDiffuse, g_uv).g;
      float b = texture2D(tDiffuse, b_uv).b;

      gl_FragColor = vec4(r,g,b,final.a);
      // gl_FragColor = texture2D(tDiffuse, b_uv);
    }
  `
};
