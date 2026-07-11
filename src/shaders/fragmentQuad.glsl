uniform sampler2D uGrain;
uniform sampler2D uTexture;
uniform vec4 resolution;
varying vec2 vUv;
varying vec3 vPosition;
float PI = 3.141592653589793238;

void main() {
  // vec2 newUV = (vUv - vec2(0.5))*resolution.zw + vec2(0.5);

  vec4 c = texture2D(uTexture, vUv);
  vec4 grain = texture2D(uGrain, vUv);

  float dist = length(vUv - vec2(0.5));
  if (dist > 0.5) discard;
  float r = 0.49;
  // out edge
  float g_out = pow(dist / r, 110.);
  float mag_out = 0.5 - cos(g_out - 1.);
  vec2 uvOut = dist < r ? vUv + mag_out * (vUv - vec2(0.5)) : vUv;

  // in edge
  float g_in = pow(max(dist, 0.15) / r, -7.);
  vec2 g_in_power = vec2(sin(vUv.x - 0.5), sin(vUv.y - 0.5));
  float mag_in = 0.5 - cos(g_in - 1.);
  vec2 uvIn = dist > r ? vUv : (vUv - vec2(0.5)) * mag_in * g_in_power;

  gl_FragColor = vec4(0., 1., 0., 1.);
  gl_FragColor = c;
  gl_FragColor = grain;

  vec2 uv_display = vUv + uvOut * 0.1 + uvIn * .1 + (grain.rg - vec2(0.5)) * 0.1;

  vec4 cc = texture2D(uTexture, uv_display);

  if (dist > 0.493) {
    cc = vec4(1.0, 1.0, 1.0, 1.0);
  }

  gl_FragColor = cc;
}
