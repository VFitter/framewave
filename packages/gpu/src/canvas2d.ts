import type { Scene, SceneNode, Transform } from '@framewave/core';
import type { Renderer, RendererOptions } from './renderer.js';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Canvas2D backend — runs everywhere today (including headless via
 * OffscreenCanvas in workers), pixel-compatible with the scene graph.
 * The WebGPU backend is the fast path; this is the universal path.
 */
export class Canvas2DRenderer implements Renderer {
  readonly width: number;
  readonly height: number;
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: Ctx2D;

  constructor(opts: RendererOptions) {
    this.width = opts.width;
    this.height = opts.height;
    this.canvas = opts.canvas ?? createCanvas(opts.width, opts.height);
    const ctx = (this.canvas as HTMLCanvasElement).getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx as Ctx2D;
  }

  render(scene: Scene): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (scene.background) {
      ctx.fillStyle = scene.background;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      ctx.clearRect(0, 0, this.width, this.height);
    }
    for (const node of scene.nodes) this.drawNode(node, 1);
  }

  private drawNode(node: SceneNode, parentAlpha: number): void {
    const { ctx } = this;
    const alpha = parentAlpha * (node.opacity ?? 1);
    if (alpha <= 0) return;

    ctx.save();
    applyTransform(ctx, node.transform, boundsOf(node));
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = blendToComposite(node.blend);

    switch (node.type) {
      case 'group':
        for (const child of node.children) this.drawNode(child, alpha);
        break;
      case 'rect': {
        if (node.glow) {
          ctx.shadowColor = node.fill ?? '#fff';
          ctx.shadowBlur = node.glow;
        }
        ctx.fillStyle = node.fill ?? '#fff';
        const r = Math.min(node.cornerRadius ?? 0, node.width / 2, node.height / 2);
        roundRect(ctx, -node.width / 2, -node.height / 2, node.width, node.height, r);
        ctx.fill();
        break;
      }
      case 'ellipse': {
        if (node.glow) {
          ctx.shadowColor = node.fill ?? '#fff';
          ctx.shadowBlur = node.glow;
        }
        ctx.fillStyle = node.fill ?? '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, node.rx, node.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'line': {
        ctx.strokeStyle = node.stroke ?? '#fff';
        ctx.lineWidth = node.strokeWidth ?? 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(node.x1, node.y1);
        ctx.lineTo(node.x2, node.y2);
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.fillStyle = node.fill ?? '#fff';
        const weight = node.fontWeight ?? 700;
        ctx.font = `${weight} ${node.fontSize}px ${node.fontFamily ?? 'system-ui, sans-serif'}`;
        ctx.textAlign = node.align ?? 'center';
        ctx.textBaseline = 'middle';
        if (node.letterSpacing && 'letterSpacing' in ctx) {
          (ctx as CanvasRenderingContext2D).letterSpacing = `${node.letterSpacing}px`;
        }
        ctx.fillText(node.text, 0, 0);
        break;
      }
    }
    ctx.restore();
  }

  dispose(): void {
    // 2D context has no explicit teardown.
  }
}

function boundsOf(node: SceneNode): { w: number; h: number } {
  switch (node.type) {
    case 'rect': return { w: node.width, h: node.height };
    case 'ellipse': return { w: node.rx * 2, h: node.ry * 2 };
    default: return { w: 0, h: 0 };
  }
}

function applyTransform(ctx: Ctx2D, t: Transform | undefined, bounds: { w: number; h: number }): void {
  const x = t?.x ?? 0;
  const y = t?.y ?? 0;
  ctx.translate(x, y);
  if (t?.rotation) ctx.rotate(t.rotation);
  const sx = t?.scaleX ?? t?.scale ?? 1;
  const sy = t?.scaleY ?? t?.scale ?? 1;
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  const ax = (t?.anchorX ?? 0.5) - 0.5;
  const ay = (t?.anchorY ?? 0.5) - 0.5;
  if (ax !== 0 || ay !== 0) ctx.translate(-ax * bounds.w, -ay * bounds.h);
}

function blendToComposite(blend: string | undefined): GlobalCompositeOperation {
  switch (blend) {
    case 'add': return 'lighter';
    case 'multiply': return 'multiply';
    case 'screen': return 'screen';
    default: return 'source-over';
  }
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}
