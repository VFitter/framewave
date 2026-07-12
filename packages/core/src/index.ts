// Time
export { Composition, Sequence, remapTime, framesToSeconds, secondsToFrames } from './time/timeline.js';
export type { CompositionConfig, FrameContext, SequenceConfig } from './time/timeline.js';

// Animation
export * from './animation/easing.js';
export { interpolate, interpolateColors } from './animation/interpolate.js';
export type { InterpolateOptions, ExtrapolateMode } from './animation/interpolate.js';
export { spring, springVelocity, springDuration, springPresets } from './animation/spring.js';
export type { SpringConfig, SpringOptions } from './animation/spring.js';
export { track, tracks } from './animation/keyframes.js';
export type { Keyframe } from './animation/keyframes.js';
export { stagger, staggerDuration } from './animation/stagger.js';
export type { StaggerOptions, StaggerOrigin } from './animation/stagger.js';
export { wiggle, valueNoise1D } from './animation/noise.js';
export type { WiggleOptions } from './animation/noise.js';

// Paths
export { MotionPath } from './path/path.js';
export type { Vec2, PathSample } from './path/path.js';

// Scene graph
export { group } from './scene/node.js';
export type {
  Scene, SceneNode, SceneBuilder, NodeBase, Transform, BlendMode,
  RectNode, EllipseNode, LineNode, TextNode, GroupNode,
} from './scene/node.js';

// Text
export { splitText, textAnimator } from './text/animator.js';
export type { TextSplit, TextUnit, TextAnimatorOptions } from './text/animator.js';

// Audio
export { amplitudeEnvelope, bandEnvelope, detectOnsets } from './audio/analysis.js';
export type { AudioFeatureOptions } from './audio/analysis.js';

// Color
export { parseColor, mixColors, formatRgba, colorToVec4, rgbaToOklab, oklabToRgba } from './color/color.js';
export type { RGBA, OKLab } from './color/color.js';

// Random
export { createRandom, randomAt, hashString } from './random.js';
