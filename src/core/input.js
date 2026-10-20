/**
 * Input manager — keyboard, gamepad and touch (relative drag + action buttons).
 *
 * Produces a per-frame snapshot consumed by the Game:
 *   { x, y, fire, up, down, left, right, confirm, back, pause,
 *     transform, nova, mute, fullscreen }
 *
 * `x`/`y` are analog -1..1; every other field is an edge-triggered boolean
 * (true only on the frame the action was pressed).
 */
import { hitTestTouchButton, isMovePad, TOUCH } from '../ui/touch.js';
import { PIX_W, PIX_H } from '../render/pixel.js';

const KEY_MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Enter: 'confirm', NumpadEnter: 'confirm',
  Space: 'fire',
  KeyZ: 'fire', KeyJ: 'fire',
  KeyX: 'transform', KeyK: 'transform', ShiftLeft: 'transform', ShiftRight: 'transform',
  KeyB: 'nova', KeyL: 'nova',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  KeyF: 'fullscreen',
  Backspace: 'back',
  KeyR: 'restart',
};

export class InputManager {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.onFirstInput = opts.onFirstInput || null;
    this.onAction = opts.onAction || null;

    this.keys = new Set();
    this.prev = {};
    this.current = {};
    this.x = 0;
    this.y = 0;
    this.padIndex = -1;
    this.touchMode = false;
    this.suppressMouseUntil = 0;

    // Touch state (logical coords).
    this.touchPad = { active: false, pointerId: null, originX: 0, originY: 0, dx: 0, dy: 0 };
    this.touchQueue = [];
    this.pointerDown = false;

    this._bind();
  }

  /* ---------------------------------------------------------------- */
  /* Setup                                                            */
  /* ---------------------------------------------------------------- */

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        // Still swallow scrolling/space while playing.
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        return;
      }
      const action = KEY_MAP[e.code];
      if (action) {
        this.keys.add(action);
        // Some keys act as two actions at once (e.g. Space fire + confirm).
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') this.keys.add('confirm');
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        this._firstInput();
      }
    });
    window.addEventListener('keyup', (e) => {
      const action = KEY_MAP[e.code];
      if (action) {
        this.keys.delete(action);
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') this.keys.delete('confirm');
      }
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touchQueue.length = 0;
      this.touchPad.active = false;
      this.x = 0;
      this.y = 0;
    });

    const canvas = this.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && this.touchMode) return;
      canvas.setPointerCapture?.(e.pointerId);
      const { x, y } = this.toLogical(e);
      this._firstInput();
      if (e.pointerType !== 'mouse') this.touchMode = true;

      const btn = hitTestTouchButton(x, y);
      if (btn) {
        this._pressButton(btn);
        e.preventDefault();
        return;
      }
      if (isMovePad(x, y)) {
        this.touchPad = { active: true, pointerId: e.pointerId, originX: x, originY: y, dx: 0, dy: 0 };
        this.pointerDown = true;
        e.preventDefault();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.touchPad.active || e.pointerId !== this.touchPad.pointerId) return;
      const { x, y } = this.toLogical(e);
      // Relative drag: 16 logical pixels of finger travel = full speed.
      const max = 16;
      const dx = (x - this.touchPad.originX) / max;
      const dy = (y - this.touchPad.originY) / max;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        this.touchPad.dx = dx / len;
        this.touchPad.dy = dy / len;
      } else {
        this.touchPad.dx = dx;
        this.touchPad.dy = dy;
      }
      e.preventDefault?.();
    }, { passive: false });

    const endPointer = (e) => {
      if (this.touchPad.pointerId === e.pointerId) {
        this.touchPad.active = false;
        this.touchPad.pointerId = null;
        this.touchPad.dx = 0;
        this.touchPad.dy = 0;
      }
      this.pointerDown = false;
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    window.addEventListener('pointerup', endPointer);
  }

  _firstInput() {
    if (this._hadFirstInput) return;
    this._hadFirstInput = true;
    if (this.onFirstInput) this.onFirstInput();
  }

  _pressButton(btn) {
    // Buttons are momentary: queue an edge for the next poll.
    this.touchQueue.push(btn);
    if (this.onAction) this.onAction(btn);
    this._firstInput();
  }

  toLogical(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PIX_W;
    const y = ((e.clientY - rect.top) / rect.height) * PIX_H;
    return { x, y };
  }

  /* ---------------------------------------------------------------- */
  /* Polling                                                          */
  /* ---------------------------------------------------------------- */

  _pollGamepad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }
    if (!pad) {
      this.padIndex = -1;
      return;
    }
    this.padIndex = pad.index;
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    const dead = 0.18;
    const px = Math.abs(ax) > dead ? ax : 0;
    const py = Math.abs(ay) > dead ? ay : 0;
    const btn = (i) => Boolean(pad.buttons[i] && pad.buttons[i].pressed);
    if (px || py) {
      this._padX = px;
      this._padY = py;
    } else {
      this._padX = 0;
      this._padY = 0;
    }
    if (btn(0)) this.keys.add('fire');
    else this.keys.delete('fire');
    if (btn(2)) this.keys.add('transform');
    else if (this._padTransform) this.keys.delete('transform');
    if (btn(1)) this.keys.add('nova');
    else if (this._padNova) this.keys.delete('nova');
    if (btn(9)) this.keys.add('pause');
    else if (this._padPause) this.keys.delete('pause');
    if (btn(12)) this.keys.add('up');
    if (btn(13)) this.keys.add('down');
    if (btn(14)) this.keys.add('left');
    if (btn(15)) this.keys.add('right');
    if (!btn(12)) this.keys.delete('up');
    if (!btn(13)) this.keys.delete('down');
    if (!btn(14)) this.keys.delete('left');
    if (!btn(15)) this.keys.delete('right');
    this._padTransform = btn(2);
    this._padNova = btn(1);
    this._padPause = btn(9);
    if (btn(0) && !this._padFire) this.keys.add('confirm');
    if (!btn(0)) this.keys.delete('confirm');
    this._padFire = btn(0);
    if (btn(0) || btn(2) || btn(1) || btn(9)) this._firstInput();
  }

  /** Build this frame's input snapshot. Call once per animation frame. */
  poll() {
    this._pollGamepad();

    // Direction.
    let x = this.touchPad.active ? this.touchPad.dx : 0;
    let y = this.touchPad.active ? this.touchPad.dy : 0;
    if (this._padX || this._padY) {
      x = this._padX;
      y = this._padY;
    }
    if (this.keys.has('left')) x -= 1;
    if (this.keys.has('right')) x += 1;
    if (this.keys.has('up')) y -= 1;
    if (this.keys.has('down')) y += 1;
    if (Math.hypot(x, y) > 1) {
      const l = Math.hypot(x, y);
      x /= l;
      y /= l;
    }
    this.x = x;
    this.y = y;

    // Fire: keyboard/gamepad button, OR always-on for touch players.
    const fire = this.keys.has('fire') || (this.touchMode && this.touchPad.active) || this._padFire;

    const fireActions = { fire, confirm: this.keys.has('confirm') || fire };
    const actions = [
      'up', 'down', 'left', 'right', 'confirm', 'back', 'pause',
      'transform', 'nova', 'mute', 'fullscreen', 'restart',
    ];

    const snapshot = { x, y, fire };
    for (const action of actions) {
      const now = Boolean(this.keys.has(action)) || Boolean(fireActions[action]);
      const edge = now && !this.prev[action];
      this.prev[action] = now;
      snapshot[action] = edge;
    }
    snapshot.fire = fire;

    // Touch buttons queued since the last poll become one-frame edges.
    for (const btn of this.touchQueue) {
      if (btn === 'transform') snapshot.transform = true;
      else if (btn === 'nova') snapshot.nova = true;
      else if (btn === 'pause') snapshot.pause = true;
    }
    this.touchQueue.length = 0;
    return snapshot;
  }

  /** True when the last input came from touch; renderer draws on-screen controls. */
  get isTouch() {
    return this.touchMode;
  }

  clearEdges() {
    this.prev = {};
  }
}

export { TOUCH };
