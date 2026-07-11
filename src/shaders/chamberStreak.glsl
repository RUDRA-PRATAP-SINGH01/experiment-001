uniform float time;
uniform float uLayer;
uniform vec4 resolution;
varying vec2 vUv;
varying vec3 vPosition;

/* Procedural emerald temporal-glass streak field.
   uLayer: 0 = back (sharp), 1 = mid (haze), 2 = foreground soft bands */

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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

/* Vertically stretched sampling — keeps structure tall */
float noiseV(vec2 p, float time) {
  return fbm(vec2(p.x * 1.15, p.y * 0.18 + time));
}

float bandCore(float x, float center, float halfWidth) {
  float d = abs(x - center);
  float core = 1.0 - smoothstep(0.0, halfWidth * 0.35, d);
  float halo = 1.0 - smoothstep(0.0, halfWidth, d);
  return core * 0.75 + halo * 0.25;
}

vec4 streakColor(vec2 uv, float time, float layer) {
  float t = time * 0.018;

  /* 1–2. Low-frequency warp of horizontal coordinate */
  float warp =
    noiseV(vec2(uv.y * 2.1, 0.0), t * 0.7) * 0.085 +
    noiseV(vec2(uv.y * 5.4 + 2.3, 1.7), t * 0.55 + 1.1) * 0.045 +
    noiseV(vec2(uv.y * 11.0, 4.0), t * 0.35 + 2.7) * 0.02;

  float warpedX = uv.x + (warp - 0.075);
  /* subtle horizontal displacement along height */
  warpedX += (noiseV(vec2(uv.y * 3.0, 8.0), t * 0.4) - 0.5) * 0.03;

  float field = 0.0;
  float highlight = 0.0;

  /* 3–6. Several irregular vertical band systems (non-uniform widths) */
  const int BANDS = 7;
  for (int i = 0; i < BANDS; i++) {
    float fi = float(i);
    float seed = fi * 17.13 + 3.7;
    float freq = 4.5 + fi * 1.35 + noiseV(vec2(seed, 0.2), 0.0) * 2.2;
    float phase = noiseV(vec2(seed * 0.4, 2.1), t * 0.2) * 2.0;
    float local = fract(warpedX * freq + phase);

    /* secondary noise breaks uniformity */
    float breakN = noiseV(vec2(warpedX * 6.0 + seed, uv.y * 0.35 + fi), t * 0.25);
    float halfW = mix(0.04, 0.14, breakN) * mix(0.7, 1.35, fract(seed * 0.13));

    /* density gate — keep ~70% negative space overall */
    float presence = smoothstep(0.42, 0.78, breakN + noiseV(vec2(fi, uv.y * 0.2), t * 0.15) * 0.25);
    presence *= mix(0.55, 1.0, layer == 1.0 ? 0.35 : 1.0);

    float b = bandCore(local, 0.5, halfW) * presence;
    /* depth variation along Y */
    b *= mix(0.65, 1.0, noiseV(vec2(warpedX * 2.0, uv.y * 0.5 + fi), t * 0.1));

    field += b * mix(0.55, 1.0, fract(seed));
    highlight += pow(b, 3.0) * presence;
  }

  field = clamp(field * 0.55, 0.0, 1.0);
  highlight = clamp(highlight * 0.9, 0.0, 1.0);

  /* sparse mid / bright / specular distribution */
  float midMask = smoothstep(0.12, 0.45, field) * (1.0 - smoothstep(0.45, 0.85, field));
  float brightMask = smoothstep(0.55, 0.9, field);
  float specular = smoothstep(0.82, 0.98, highlight) * brightMask;

  vec3 darkEmerald = vec3(0.02, 0.07, 0.05);
  vec3 midGreen = vec3(0.08, 0.32, 0.18);
  vec3 brightGreen = vec3(0.18, 0.55, 0.32);
  vec3 cyanGreen = vec3(0.12, 0.48, 0.38);
  vec3 yellowGreen = vec3(0.55, 0.72, 0.22);

  vec3 col = darkEmerald;
  col = mix(col, midGreen, midMask * 0.85);
  col = mix(col, mix(brightGreen, cyanGreen, 0.35), brightMask * 0.9);
  col = mix(col, yellowGreen, specular * 0.75);

  /* soft internal reflections */
  float internal = noiseV(vec2(warpedX * 8.0, uv.y * 0.4), t * 0.3) * field;
  col += cyanGreen * internal * 0.12;

  /* restrained chromatic separation along bright edges */
  float edge = abs(dFdx(field)) * 18.0 + abs(dFdy(field)) * 4.0;
  edge = clamp(edge, 0.0, 1.0);
  col.r += edge * brightMask * 0.04;
  col.b += edge * brightMask * 0.03;

  float alpha = 0.0;
  if (layer < 0.5) {
    /* BACK — sharper, medium opacity, visible behind model */
    alpha = field * 0.42 + midMask * 0.08;
    col *= 1.05;
  } else if (layer < 1.5) {
    /* MID — refractive haze, lower contrast */
    alpha = (field * 0.18 + midMask * 0.12) * 0.55;
    col = mix(darkEmerald, col, 0.55);
  } else {
    /* FOREGROUND — broad soft bands near top/bottom only */
    float topBand = smoothstep(0.62, 0.92, uv.y) * smoothstep(1.05, 0.78, uv.y);
    float botBand = smoothstep(0.38, 0.08, uv.y) * smoothstep(-0.05, 0.22, uv.y);
    float zone = max(topBand, botBand);
    float soft = fbm(vec2(uv.x * 2.5 + warp * 2.0, uv.y * 0.6 + t * 0.2));
    float band = smoothstep(0.35, 0.75, soft) * zone;
    /* keep center of frame clear */
    float centerClear = 1.0 - smoothstep(0.15, 0.42, abs(uv.y - 0.5));
    band *= (1.0 - centerClear * 0.95);
    col = mix(midGreen, brightGreen, soft * 0.4);
    col = mix(col, yellowGreen, specular * band * 0.2);
    alpha = band * 0.22;
  }

  /* dark transparent negative space between streaks */
  alpha *= mix(0.15, 1.0, smoothstep(0.05, 0.35, field + (layer > 1.5 ? 1.0 : 0.0)));

  return vec4(col, clamp(alpha, 0.0, 0.65));
}

void main() {
  vec4 c = streakColor(vUv, time, uLayer);
  if (c.a < 0.01) discard;
  gl_FragColor = c;
}
