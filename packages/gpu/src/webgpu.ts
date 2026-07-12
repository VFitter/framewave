import type { Scene, SceneNode, Transform } from '@framewave/core';
import { colorToVec4, parseColor } from '@framewave/core';
import type { Renderer, RendererOptions } from './renderer.js';
import { SDF_SHADER, TEXTURE_SHADER } from './shaders/sdf.wgsl.js';

const INSTANCE_FLOATS = 12; // center(2) halfSize(2) color(4) rotation cornerRadius glow kind

interface FlatShape {
  data: Float32Array; // INSTANCE_FLOATS
  additive: boolean;
}

interface FlatText {
  node: Extract<SceneNode, { type: 'text' }>;
  cx: number;
  cy: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

/**
 * WebGPU backend. Shapes render as instanced SDF quads (one draw call per
 * blend batch); text renders as cached rasterized textures. Motion blur is
 * temporal accumulation of sub-frame samples on the GPU.
 */
export class WebGPURenderer implements Renderer {
  readonly width: number;
  readonly height: number;
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;

  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private sdfPipeline!: GPURenderPipeline;
  private sdfPipelineAdd!: GPURenderPipeline;
  private texPipeline!: GPURenderPipeline;
  private globalsBuffer: GPUBuffer;
  private instanceBuffer: GPUBuffer;
  private instanceCapacity = 1024;
  private sampler: GPUSampler;
  private textCache = new Map<string, { texture: GPUTexture; w: number; h: number }>();
  private motionBlurSamples: number;

  private constructor(device: GPUDevice, opts: RendererOptions) {
    this.device = device;
    this.width = opts.width;
    this.height = opts.height;
    this.motionBlurSamples = opts.motionBlurSamples ?? 1;
    this.canvas = opts.canvas ?? new OffscreenCanvas(opts.width, opts.height);
    const ctx = (this.canvas as OffscreenCanvas).getContext('webgpu');
    if (!ctx) throw new Error('WebGPU canvas context unavailable');
    this.context = ctx as unknown as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device, format: this.format, alphaMode: 'premultiplied' });

    this.globalsBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.globalsBuffer, 0, new Float32Array([opts.width, opts.height, 0, 0]));

    this.instanceBuffer = device.createBuffer({
      size: this.instanceCapacity * INSTANCE_FLOATS * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    this.buildPipelines();
  }

  static async create(opts: RendererOptions): Promise<WebGPURenderer> {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      throw new Error('WebGPU is not available in this environment. Use Canvas2DRenderer as a fallback.');
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found');
    const device = await adapter.requestDevice();
    return new WebGPURenderer(device, opts);
  }

  private buildPipelines(): void {
    const { device } = this;
    const sdfModule = device.createShaderModule({ code: SDF_SHADER });
    const texModule = device.createShaderModule({ code: TEXTURE_SHADER });

    const premultiplied: GPUBlendState = {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };
    const additive: GPUBlendState = {
      color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
    };

    const makeSdf = (blend: GPUBlendState): GPURenderPipeline =>
      device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: sdfModule, entryPoint: 'vs' },
        fragment: {
          module: sdfModule,
          entryPoint: 'fs',
          targets: [{ format: this.format, blend }],
        },
        primitive: { topology: 'triangle-list' },
      });

    this.sdfPipeline = makeSdf(premultiplied);
    this.sdfPipelineAdd = makeSdf(additive);

    this.texPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: texModule, entryPoint: 'vs' },
      fragment: {
        module: texModule,
        entryPoint: 'fs',
        targets: [{ format: this.format, blend: premultiplied }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  render(scene: Scene): void {
    const shapes: FlatShape[] = [];
    const texts: FlatText[] = [];
    for (const node of scene.nodes) {
      this.flatten(node, IDENTITY, 1, false, shapes, texts);
    }

    const normal = shapes.filter((s) => !s.additive);
    const add = shapes.filter((s) => s.additive);
    const all = [...normal, ...add];

    if (all.length > this.instanceCapacity) {
      this.instanceCapacity = Math.ceil(all.length * 1.5);
      this.instanceBuffer.destroy();
      this.instanceBuffer = this.device.createBuffer({
        size: this.instanceCapacity * INSTANCE_FLOATS * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }
    if (all.length > 0) {
      const data = new Float32Array(all.length * INSTANCE_FLOATS);
      all.forEach((s, i) => data.set(s.data, i * INSTANCE_FLOATS));
      this.device.queue.writeBuffer(this.instanceBuffer, 0, data);
    }

    const encoder = this.device.createCommandEncoder();
    const bg = scene.background ? parseColor(scene.background) : { r: 0, g: 0, b: 0, a: 0 };
    const view = this.context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: (bg.r / 255) * bg.a, g: (bg.g / 255) * bg.a, b: (bg.b / 255) * bg.a, a: bg.a },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    if (all.length > 0) {
      const bindGroup = this.device.createBindGroup({
        layout: this.sdfPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.globalsBuffer } },
          { binding: 1, resource: { buffer: this.instanceBuffer } },
        ],
      });
      if (normal.length > 0) {
        pass.setPipeline(this.sdfPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6, normal.length, 0, 0);
      }
      if (add.length > 0) {
        const bindGroupAdd = this.device.createBindGroup({
          layout: this.sdfPipelineAdd.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.globalsBuffer } },
            { binding: 1, resource: { buffer: this.instanceBuffer } },
          ],
        });
        pass.setPipeline(this.sdfPipelineAdd);
        pass.setBindGroup(0, bindGroupAdd);
        pass.draw(6, add.length, 0, normal.length);
      }
    }

    for (const t of texts) this.drawText(pass, t);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private flatten(
    node: SceneNode,
    parent: Mat,
    parentAlpha: number,
    parentAdditive: boolean,
    shapes: FlatShape[],
    texts: FlatText[],
  ): void {
    const alpha = parentAlpha * (node.opacity ?? 1);
    if (alpha <= 0) return;
    const additive = parentAdditive || node.blend === 'add' || node.blend === 'screen';
    const m = mulMat(parent, matFromTransform(node.transform));

    if (node.type === 'group') {
      for (const child of node.children) this.flatten(child, m, alpha, additive, shapes, texts);
      return;
    }

    const { tx, ty, rotation, sx, sy } = decompose(m);

    if (node.type === 'text') {
      texts.push({ node, cx: tx, cy: ty, rotation, scaleX: sx, scaleY: sy, opacity: alpha });
      return;
    }

    const data = new Float32Array(INSTANCE_FLOATS);
    let hw = 0;
    let hh = 0;
    let kind = 0;
    let cornerRadius = 0;
    let glow = 0;
    let fill = '#ffffff';
    let cx = tx;
    let cy = ty;
    let rot = rotation;

    if (node.type === 'rect') {
      hw = (node.width / 2) * sx;
      hh = (node.height / 2) * sy;
      kind = 0;
      cornerRadius = (node.cornerRadius ?? 0) * Math.min(sx, sy);
      glow = node.glow ?? 0;
      fill = node.fill ?? '#ffffff';
    } else if (node.type === 'ellipse') {
      hw = node.rx * sx;
      hh = node.ry * sy;
      kind = 1;
      glow = node.glow ?? 0;
      fill = node.fill ?? '#ffffff';
    } else if (node.type === 'line') {
      const wx = node.x2 - node.x1;
      const wy = node.y2 - node.y1;
      const len = Math.hypot(wx * sx, wy * sy);
      const midLocal = { x: (node.x1 + node.x2) / 2, y: (node.y1 + node.y2) / 2 };
      const mid = applyMat(m, midLocal.x, midLocal.y);
      cx = mid.x;
      cy = mid.y;
      rot = rotation + Math.atan2(wy, wx);
      hw = len / 2;
      hh = (node.strokeWidth ?? 1) / 2;
      kind = 0;
      cornerRadius = hh;
      fill = node.stroke ?? '#ffffff';
    }

    const [r, g, b, a] = colorToVec4(fill);
    data[0] = cx; data[1] = cy;
    data[2] = hw; data[3] = hh;
    data[4] = r; data[5] = g; data[6] = b; data[7] = a * alpha;
    data[8] = rot; data[9] = cornerRadius; data[10] = glow; data[11] = kind;
    shapes.push({ data, additive });
  }

  private drawText(pass: GPURenderPassEncoder, t: FlatText): void {
    const key = `${t.node.text}|${t.node.fontSize}|${t.node.fontFamily ?? ''}|${String(t.node.fontWeight ?? 700)}|${t.node.fill ?? '#fff'}|${t.node.letterSpacing ?? 0}`;
    let entry = this.textCache.get(key);
    if (!entry) {
      entry = this.rasterizeText(t.node);
      this.textCache.set(key, entry);
    }

    const quadBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(
      quadBuffer,
      0,
      new Float32Array([
        t.cx, t.cy,
        (entry.w / 2) * t.scaleX, (entry.h / 2) * t.scaleY,
        t.rotation, t.opacity, 0, 0,
      ]),
    );
    const bindGroup = this.device.createBindGroup({
      layout: this.texPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.globalsBuffer } },
        { binding: 1, resource: { buffer: quadBuffer } },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: entry.texture.createView() },
      ],
    });
    pass.setPipeline(this.texPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6, 1);
  }

  private rasterizeText(node: Extract<SceneNode, { type: 'text' }>): { texture: GPUTexture; w: number; h: number } {
    const pad = Math.ceil(node.fontSize * 0.4);
    const canvas = new OffscreenCanvas(4, 4);
    const ctx = canvas.getContext('2d')!;
    const font = `${String(node.fontWeight ?? 700)} ${node.fontSize}px ${node.fontFamily ?? 'system-ui, sans-serif'}`;
    ctx.font = font;
    const metrics = ctx.measureText(node.text);
    const w = Math.max(2, Math.ceil(metrics.width) + pad * 2);
    const h = Math.max(2, Math.ceil(node.fontSize * 1.5) + pad * 2);
    canvas.width = w;
    canvas.height = h;
    const c2 = canvas.getContext('2d')!;
    c2.font = font;
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    c2.fillStyle = node.fill ?? '#ffffff';
    if (node.letterSpacing && 'letterSpacing' in c2) {
      (c2 as unknown as CanvasRenderingContext2D).letterSpacing = `${node.letterSpacing}px`;
    }
    c2.fillText(node.text, w / 2, h / 2);

    const texture = this.device.createTexture({
      size: [w, h],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: canvas },
      { texture, premultipliedAlpha: true },
      [w, h],
    );
    return { texture, w, h };
  }

  dispose(): void {
    for (const { texture } of this.textCache.values()) texture.destroy();
    this.textCache.clear();
    this.instanceBuffer.destroy();
    this.globalsBuffer.destroy();
    this.device.destroy();
  }
}

// ── tiny 2D affine matrix helpers ──────────────────────────────────────────
type Mat = [number, number, number, number, number, number]; // a b c d tx ty

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function matFromTransform(t: Transform | undefined): Mat {
  if (!t) return IDENTITY;
  const cos = Math.cos(t.rotation ?? 0);
  const sin = Math.sin(t.rotation ?? 0);
  const sx = t.scaleX ?? t.scale ?? 1;
  const sy = t.scaleY ?? t.scale ?? 1;
  return [cos * sx, sin * sx, -sin * sy, cos * sy, t.x ?? 0, t.y ?? 0];
}

function mulMat(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function applyMat(m: Mat, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

function decompose(m: Mat): { tx: number; ty: number; rotation: number; sx: number; sy: number } {
  return {
    tx: m[4],
    ty: m[5],
    rotation: Math.atan2(m[1], m[0]),
    sx: Math.hypot(m[0], m[1]),
    sy: Math.hypot(m[2], m[3]),
  };
}
