/**
 * SDF shape shader. Every rect/ellipse/line is an instanced quad whose
 * fragment evaluates a signed distance field — resolution-independent
 * antialiasing and free glow, no tessellation ever.
 */
export const SDF_SHADER = /* wgsl */ `
struct Globals {
  viewport: vec2<f32>,
  _pad: vec2<f32>,
};

struct Instance {
  center: vec2<f32>,
  halfSize: vec2<f32>,
  color: vec4<f32>,
  rotation: f32,
  cornerRadius: f32,
  glow: f32,
  kind: f32, // 0 = rect, 1 = ellipse
};

@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) @interpolate(flat) idx: u32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  var corners = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
  );
  let inst = instances[ii];
  let pad = inst.glow * 2.0 + 2.0; // AA + glow margin
  let ext = inst.halfSize + vec2(pad, pad);
  let corner = corners[vi] * ext;

  let c = cos(inst.rotation);
  let s = sin(inst.rotation);
  let rotated = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  let world = inst.center + rotated;
  let ndc = vec2(
    world.x / globals.viewport.x * 2.0 - 1.0,
    1.0 - world.y / globals.viewport.y * 2.0,
  );

  var out: VSOut;
  out.position = vec4(ndc, 0.0, 1.0);
  out.local = corner;
  out.idx = ii;
  return out;
}

fn sdRoundRect(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
  let q = abs(p) - b + vec2(r, r);
  return length(max(q, vec2(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - r;
}

fn sdEllipse(p: vec2<f32>, ab: vec2<f32>) -> f32 {
  // Scaled-distance approximation, exact enough at pixel scale with AA.
  let k0 = length(p / ab);
  let k1 = length(p / (ab * ab));
  return k0 * (k0 - 1.0) / max(k1, 1e-6);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let inst = instances[in.idx];
  var d: f32;
  if (inst.kind < 0.5) {
    d = sdRoundRect(in.local, inst.halfSize, min(inst.cornerRadius, min(inst.halfSize.x, inst.halfSize.y)));
  } else {
    d = sdEllipse(in.local, inst.halfSize);
  }

  let aa = fwidth(d);
  var alpha = 1.0 - smoothstep(-aa, aa, d);

  if (inst.glow > 0.0 && d > 0.0) {
    alpha = max(alpha, exp(-d / max(inst.glow, 1e-3)) * 0.9);
  }

  let a = inst.color.a * alpha;
  return vec4(inst.color.rgb * a, a); // premultiplied
}
`;

export const TEXTURE_SHADER = /* wgsl */ `
struct Globals {
  viewport: vec2<f32>,
  _pad: vec2<f32>,
};

struct Quad {
  center: vec2<f32>,
  halfSize: vec2<f32>,
  rotation: f32,
  opacity: f32,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> quad: Quad;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var corners = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
  );
  let corner = corners[vi] * quad.halfSize;
  let c = cos(quad.rotation);
  let s = sin(quad.rotation);
  let rotated = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  let world = quad.center + rotated;
  let ndc = vec2(
    world.x / globals.viewport.x * 2.0 - 1.0,
    1.0 - world.y / globals.viewport.y * 2.0,
  );
  var out: VSOut;
  out.position = vec4(ndc, 0.0, 1.0);
  out.uv = corners[vi] * 0.5 + vec2(0.5, 0.5);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let t = textureSample(tex, samp, in.uv);
  let a = t.a * quad.opacity;
  return vec4(t.rgb * quad.opacity, a); // canvas textures are premultiplied
}
`;
