uniform float time;
uniform float progress;
uniform sampler2D uTexture;
uniform vec4 resolution;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vViewPosition;
float PI = 3.141592653589793238;

void main() {
  // Matcap — only the bright line detail from model@2x should show
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  vec3 r = reflect(viewDir, n);
  float m = 2.8284271247461903 * sqrt(r.z + 1.0);
  vec2 matcapUV = r.xy / m + 0.5;

  vec4 tex = texture2D(uTexture, matcapUV);
  float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));

  // Solid black base; isolate & boost only bright line pixels
  float lines = smoothstep(0.55, 0.85, luma);
  lines = pow(lines, 0.7);

  vec3 color = vec3(0.0);
  color = mix(color, vec3(1.0), lines * 0.7);

  gl_FragColor = vec4(color, 1.0);
}
