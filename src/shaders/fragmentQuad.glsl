uniform sampler2D uGrain;
uniform sampler2D uTexture;
uniform sampler2D uStreakEnv;
uniform float time;
uniform vec4 resolution;
varying vec2 vUv;
varying vec3 vPosition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec4 grain = texture2D(uGrain, vUv);
  vec2 centered = vUv - vec2(0.5);
  float dist = length(centered);
  float r = 0.49;

  /* Substantially reduced liquid / glitch displacement (~7% of prior aggression) */
  float g_out = pow(dist / r, 110.);
  float mag_out = 0.5 - cos(g_out - 1.);
  vec2 uvOut = dist < r ? vUv + mag_out * centered : vUv;

  float g_in = pow(max(dist, 0.15) / r, -7.);
  vec2 g_in_power = vec2(sin(centered.x), sin(centered.y));
  float mag_in = 0.5 - cos(g_in - 1.);
  vec2 uvIn = dist > r ? vUv : centered * mag_in * g_in_power;

  float warpAmt = 0.028;
  float grainAmt = 0.085;
  vec2 uv_display = vUv
    + (uvOut - vUv) * warpAmt
    + uvIn * warpAmt
    + (grain.rg - vec2(0.5)) * grainAmt;

  /* stronger horizontal grain push at edges */
  uv_display.x += (grain.r - 0.5) * 0.04 * smoothstep(0.2, 0.5, abs(centered.x));

  vec4 model = texture2D(uTexture, uv_display);

  /* Background: dark emerald chamber streaks (already include back+mid) */
  vec3 streak = texture2D(uStreakEnv, vUv).rgb;
  float streakA = texture2D(uStreakEnv, vUv).a;

  /* Foreground soft glass bands — upper / lower only, center clear */
  float t = time * 0.015;
  float topZone = smoothstep(0.68, 0.95, vUv.y);
  float botZone = smoothstep(0.32, 0.05, vUv.y);
  float zone = max(topZone, botZone);
  float soft = valueNoise(vec2(vUv.x * 3.0 + t, vUv.y * 1.2));
  soft = smoothstep(0.4, 0.8, soft);
  float centerClear = 1.0 - smoothstep(0.12, 0.4, abs(vUv.y - 0.5));
  float fg = soft * zone * (1.0 - centerClear * 0.92) * 0.2;
  vec3 fgCol = mix(vec3(0.03, 0.1, 0.06), vec3(0.08, 0.2, 0.12), soft);

  /* Match page bg #358107 */
  vec3 darkBase = vec3(0.208, 0.506, 0.027);
  vec3 bg = mix(darkBase, streak, clamp(streakA * 1.2, 0.0, 1.0));
  bg = mix(bg, fgCol, fg);

  /* Composite: model remains focal (~75%) */
  float m = smoothstep(0.02, 0.12, model.a);
  vec3 col = mix(bg, model.rgb, m);

  /* stronger film-grain overlay on the final image */
  float gLum = dot(grain.rgb, vec3(0.299, 0.587, 0.114));
  col += (gLum - 0.5) * 0.14;
  col *= mix(0.92, 1.08, gLum);

  float alpha = max(m, max(streakA * 0.85, fg));
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
