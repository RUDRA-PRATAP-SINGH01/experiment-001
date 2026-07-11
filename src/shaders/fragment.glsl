uniform float time;
uniform float progress;
uniform sampler2D uTexture;
uniform sampler2D uStreakEnv;
uniform vec4 resolution;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  float ndotv = clamp(dot(N, V), 0.0, 1.0);

  /* matcap — hottest ticks only, modulates the rim */
  vec2 matcapUV = N.xy * 0.5 + 0.5;
  float lum = dot(texture2D(uTexture, matcapUV).rgb, vec3(0.299, 0.587, 0.114));
  float texEdge = pow(smoothstep(0.85, 0.98, lum), 1.6);

  /* thin white rim on pure black body */
  float rim = pow(1.0 - ndotv, 5.5);
  float edge = rim * mix(0.85, 1.35, texEdge);

  /* crush fill to black; keep a crisp readable white line */
  float highlight = smoothstep(0.18, 0.42, edge);

  gl_FragColor = vec4(vec3(highlight), 1.0);
}
