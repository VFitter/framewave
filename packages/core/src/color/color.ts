/**
 * Color parsing + perceptual interpolation in OKLab.
 *
 * Naive RGB lerps travel through muddy grays (blue→yellow passes gray-green).
 * OKLab (Björn Ottosson, 2020) is perceptually uniform, so Framewave blends
 * colors the way film titles do — clean hue transitions, stable lightness.
 */
export interface RGBA {
  r: number; // 0..255
  g: number;
  b: number;
  a: number; // 0..1
}

export interface OKLab {
  L: number;
  a: number;
  b: number;
  alpha: number;
}

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', gray: '#808080',
  grey: '#808080', gold: '#ffd700', transparent: '#00000000',
};

export function parseColor(input: string): RGBA {
  let s = input.trim().toLowerCase();
  const named = NAMED[s];
  if (named !== undefined) s = named;

  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      const a = hex.length === 4 ? parseInt(hex[3]! + hex[3]!, 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    throw new Error(`Invalid hex color: ${input}`);
  }

  const fn = s.match(/^(rgba?|hsla?)\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[2]!.split(/[,/\s]+/).filter(Boolean).map((p) => parseFloat(p));
    const [p0 = 0, p1 = 0, p2 = 0, p3 = 1] = parts;
    if (fn[1]!.startsWith('rgb')) return { r: p0, g: p1, b: p2, a: p3 };
    return { ...hslToRgb(p0, p1 / 100, p2 / 100), a: p3 };
  }
  throw new Error(`Unsupported color: ${input}`);
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

const srgbToLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const linearToSrgb = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
};

export function rgbaToOklab(c: RGBA): OKLab {
  const r = srgbToLinear(c.r), g = srgbToLinear(c.g), b = srgbToLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    alpha: c.a,
  };
}

export function oklabToRgba(c: OKLab): RGBA {
  const l = Math.pow(c.L + 0.3963377774 * c.a + 0.2158037573 * c.b, 3);
  const m = Math.pow(c.L - 0.1055613458 * c.a - 0.0638541728 * c.b, 3);
  const s = Math.pow(c.L - 0.0894841775 * c.a - 1.291485548 * c.b, 3);
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: c.alpha,
  };
}

/** Perceptual color mix. t ∈ [0,1]. Returns rgba() string. */
export function mixColors(from: string, to: string, t: number): string {
  const a = rgbaToOklab(parseColor(from));
  const b = rgbaToOklab(parseColor(to));
  const out = oklabToRgba({
    L: a.L + (b.L - a.L) * t,
    a: a.a + (b.a - a.a) * t,
    b: a.b + (b.b - a.b) * t,
    alpha: a.alpha + (b.alpha - a.alpha) * t,
  });
  return formatRgba(out);
}

export function formatRgba(c: RGBA): string {
  const a = Math.round(c.a * 1000) / 1000;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

/** RGBA → normalized [r,g,b,a] in 0..1 for GPU uniforms. */
export function colorToVec4(input: string): [number, number, number, number] {
  const c = parseColor(input);
  return [c.r / 255, c.g / 255, c.b / 255, c.a];
}
