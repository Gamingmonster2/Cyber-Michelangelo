/**
 * Shared touch-control layout (logical 240×420 coordinates).
 * Both the renderer (drawing) and the input manager (hit-testing) use these.
 */
export const TOUCH = {
  transform: { x: 200, y: 372, r: 23, label: 'FORM' },
  nova: { x: 200, y: 316, r: 17, label: 'NOVA' },
  pause: { x: 224, y: 16, r: 9, label: 'P' },
  // The rest of the canvas is the relative-drag movement pad.
};

export function hitTestTouchButton(x, y) {
  for (const key of ['transform', 'nova', 'pause']) {
    const b = TOUCH[key];
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy <= (b.r + 6) * (b.r + 6)) return key;
  }
  return null;
}

/** Is this point inside the movement pad (everything except the buttons)? */
export function isMovePad(x, y) {
  return x < 166 || (x < 240 && y < 296);
}
