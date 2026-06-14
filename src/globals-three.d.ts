/**
 * Ambient declaration for the `THREE` (Three.js) global, loaded from a CDN at
 * runtime (see `RobotViewer`) rather than bundled.
 *
 * `RobotViewer` drives a large slice of the Three.js r128 UMD build plus its
 * example loaders (`GLTFLoader`) and controls (`OrbitControls`), which the CDN
 * build attaches onto the `THREE` namespace. We deliberately do NOT install
 * `@types/three`: the example loaders/controls are not part of the typed npm
 * package, the CDN build pins an old revision, and only a handful of components
 * touch this surface. A single documented `any` handle keeps the boundary
 * honest (everything past `window.THREE` is untyped third-party CDN code)
 * without dragging an entire type package in for one file.
 */

declare global {
  interface Window {
    // reason: untyped Three.js r128 UMD CDN global (incl. example GLTFLoader /
    // OrbitControls, which aren't covered by @types/three).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    THREE?: any;
  }
}

export {}
