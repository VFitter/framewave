/**
 * Renderer-agnostic scene graph. @framewave/gpu consumes this; a Canvas2D
 * fallback consumes the same tree. Keeping the description separate from the
 * renderer is what lets Framewave swap backends without touching user code.
 */
export interface Transform {
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  /** Radians. */
  rotation?: number;
  /** Anchor point 0..1 within the node's bounds. Default center (0.5, 0.5). */
  anchorX?: number;
  anchorY?: number;
}

export type BlendMode = 'normal' | 'add' | 'multiply' | 'screen';

export interface NodeBase {
  transform?: Transform;
  opacity?: number;
  blend?: BlendMode;
}

export interface RectNode extends NodeBase {
  type: 'rect';
  width: number;
  height: number;
  fill?: string;
  cornerRadius?: number;
  /** Soft-edge glow radius in px (SDF-based in the GPU backend). */
  glow?: number;
}

export interface EllipseNode extends NodeBase {
  type: 'ellipse';
  rx: number;
  ry: number;
  fill?: string;
  glow?: number;
}

export interface LineNode extends NodeBase {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface TextNode extends NodeBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number | string;
  fill?: string;
  letterSpacing?: number;
  align?: 'left' | 'center' | 'right';
}

export interface GroupNode extends NodeBase {
  type: 'group';
  children: SceneNode[];
}

export type SceneNode = RectNode | EllipseNode | LineNode | TextNode | GroupNode;

export interface Scene {
  background?: string;
  nodes: SceneNode[];
}

/** A frame-pure scene builder: (ctx) → Scene. The heart of a Framewave comp. */
export type SceneBuilder<Ctx> = (ctx: Ctx) => Scene;

export const group = (children: SceneNode[], base: NodeBase = {}): GroupNode => ({
  type: 'group',
  children,
  ...base,
});
