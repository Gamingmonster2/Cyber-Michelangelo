/**
 * Shared touch-control layout (logical 240×420 coordinates).
 * Both the renderer (drawing) and the input manager (hit-testing) use these.
 *
 * Mobile layout — designed for two thumbs:
 *   • left side / upper area  → drag to move (relative, high sensitivity)
 *   • bottom-right FIRE       → hold to shoot
 *   • FORM / NOVA             → one-tap specials
 */
export const TOUCH = {
  fire: { x: 201, y: 379, r: 26, label: 'FIRE' },
  transform: { x: 202, y: 326, r: 16, label: 'FORM' },
  nova: { x: 148, y: 349, r: 15, label: 'NOVA' },
  pause: { x: 224, y: 16, r: 9, label: 'P' },
  moveBase: { x: 52, y: 371, r: 28 },
  moveRange: 20,
};

export function hitTestTouchButton(x, y) {
  for (const key of ['fire', 'transform', 'nova', 'pause']) {
    const b = TOUCH[key];
    const dx = x - b.x;
    const dy = y - b.y;
    const pad = key === 'fire' ? 10 : 6;
    if (dx * dx + dy * dy <= (b.r + pad) * (b.r + pad)) return key;
  }
  return null;
}

/**
 * Is this point inside the movement pad?
 * Movement lives on the left side and the upper area; the bottom-right corner
 * belongs to the fire/special buttons so right-thumb presses never move the ship.
 */
export function isMovePad(x, y) {
  if (hitTestTouchButton(x, y)) return false;
  return x < 172 || y < 264;
}
