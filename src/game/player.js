/**
 * The Alpha craft and its modular armour.
 *
 * Damage model (faithful to the original's "pieces act as shields"):
 *  - Any hit while modules are docked destroys the outermost module, not the ship.
 *  - Any hit while split in formation reverts the craft to a singular hull
 *    (all pieces are lost) but does not cost a life.
 *  - A hit with no modules attached costs a life.
 *  - The Phoenix transformation grants temporary invulnerability.
 */
import { PLAYER, MODULE_BY_ID, formationStyleForCount } from './config.js';
import { formationPositions } from './formations.js';
import { clamp } from '../core/math.js';

const TWO_PI = Math.PI * 2;

export class Player {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.x = PLAYER.spawnX;
    this.y = PLAYER.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.modules = []; // module ids, acquisition order (last = outermost)
    this.dockAnims = {}; // id -> seconds since docking (visual only)
    this.invuln = PLAYER.respawnInvuln;
    this.fireTimer = 0;
    this.moduleTimers = {};
    this.formationActive = false;
    this.formationTime = 0;
    this.formationCooldown = 0;
    this.phoenixActive = false;
    this.phoenixTime = 0;
    this.phoenixCooldown = 0;
    this.phoenixFlameTimer = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.tilt = 0;
    this.bob = 0;
    this.hitPulse = 0;
  }

  get moduleCount() {
    return this.modules.length;
  }

  get hasAllModules() {
    return this.modules.length === 4;
  }

  get isInvulnerable() {
    return this.invuln > 0 || this.phoenixActive || this.dead;
  }

  get formationStyle() {
    return formationStyleForCount(this.modules.length);
  }

  /** Slot position of a module relative to the ship centre. */
  slotFor(id) {
    const def = MODULE_BY_ID[id];
    return def ? def.slot : { x: 0, y: 0 };
  }

  /** World position of each docked module (formation aware). */
  moduleWorldPositions() {
    if (!this.modules.length) return [];
    if (this.formationActive) {
      const offsets = formationPositions(this.modules.length, this.formationStyle, this.formationTime);
      return this.modules.map((id, i) => ({
        id,
        x: this.x + (offsets[i] ? offsets[i].x : 0),
        y: this.y + (offsets[i] ? offsets[i].y : 0),
        angle: offsets[i] ? offsets[i].angle : 0,
        flying: true,
      }));
    }
    return this.modules.map((id) => {
      const slot = this.slotFor(id);
      const anim = this.dockAnims[id];
      const t = anim === undefined ? 1 : Math.min(1, anim / PLAYER.dockTime);
      // Pieces fly in from above when they dock.
      const ease = 1 - Math.pow(1 - t, 3);
      return {
        id,
        x: this.x + slot.x,
        y: this.y + slot.y - (1 - ease) * 14,
        angle: 0,
        flying: false,
        docking: t < 1,
      };
    });
  }

  /** Collision volumes: the core plus every docked module (ignored while split). */
  hitboxes() {
    const boxes = [{ type: 'core', x: this.x, y: this.y, r: PLAYER.coreR }];
    if (!this.formationActive) {
      for (const id of this.modules) {
        const slot = this.slotFor(id);
        boxes.push({ type: 'module', id, x: this.x + slot.x, y: this.y + slot.y, r: MODULE_BY_ID[id].hitR });
      }
    }
    return boxes;
  }

  /** Epsilon's rear force-field, only while docked (not during the Phoenix). */
  activeField() {
    const def = MODULE_BY_ID.epsilon;
    if (!this.modules.includes('epsilon') || this.dead) return null;
    if (this.formationActive || this.phoenixActive) return null;
    const slot = def.slot;
    return { x: this.x + slot.x, y: this.y + slot.y + 4, r: def.fieldRadius };
  }

  attachModule(id) {
    if (this.modules.includes(id) || this.modules.length >= 4) return false;
    this.modules.push(id);
    this.dockAnims[id] = 0;
    this.moduleTimers[id] = MODULE_BY_ID[id].fireInterval * 0.5;
    return true;
  }

  moduleIdsByOrder() {
    return this.modules.slice();
  }

  /* ---------------------------------------------------------------- */
  /* Update                                                           */
  /* ---------------------------------------------------------------- */

  update(dt, input, game) {
    if (this.dead) {
      this.deathTimer = Math.max(0, this.deathTimer - dt);
      return;
    }
    this.hitPulse = Math.max(0, this.hitPulse - dt * 3);
    this.bob += dt;

    // Timers.
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.formationCooldown > 0) this.formationCooldown = Math.max(0, this.formationCooldown - dt);
    if (this.phoenixCooldown > 0) this.phoenixCooldown = Math.max(0, this.phoenixCooldown - dt);
    for (const id of Object.keys(this.dockAnims)) {
      this.dockAnims[id] = Math.min(PLAYER.dockTime, (this.dockAnims[id] || 0) + dt);
    }

    // Movement — exponential approach for weighty, smooth handling.
    let mx = clamp(input.x || 0, -1, 1);
    let my = clamp(input.y || 0, -1, 1);
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const speed = PLAYER.speed * (this.phoenixActive ? PLAYER.phoenixSpeedMul : 1);
    const k = 1 - Math.exp(-PLAYER.accel * dt);
    this.vx += (mx * speed - this.vx) * k;
    this.vy += (my * speed - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const b = PLAYER.bounds;
    if (this.x < b.left) { this.x = b.left; this.vx = 0; }
    if (this.x > b.right) { this.x = b.right; this.vx = 0; }
    if (this.y < b.top) { this.y = b.top; this.vy = 0; }
    if (this.y > b.bottom) { this.y = b.bottom; this.vy = 0; }
    this.tilt = clamp(this.vx / (PLAYER.speed * 0.9), -1, 1);

    // Core cannons — fire button (or auto-fire setting).
    this.fireTimer -= dt;
    if ((input.fire || game.settings.autoFire) && this.fireTimer <= 0) {
      this.fireCore(game);
      this.fireTimer = PLAYER.fireInterval;
    }

    // Docked modules fire on their own (auxiliary units).
    const boost = this.formationActive ? PLAYER.formationFireBoost : 1;
    for (const id of this.modules) {
      const def = MODULE_BY_ID[id];
      if (!def.fireInterval) continue;
      this.moduleTimers[id] = (this.moduleTimers[id] || 0) - dt * boost;
      if (this.moduleTimers[id] <= 0) {
        this.fireModule(game, def);
        this.moduleTimers[id] = def.fireInterval;
      }
    }

    // Formation lifecycle.
    if (this.formationActive) {
      this.formationTime += dt;
      if (this.formationTime >= PLAYER.formationDuration) {
        this.endFormation(game);
      }
    }

    // Phoenix lifecycle.
    if (this.phoenixActive) {
      this.phoenixTime -= dt;
      this.phoenixFlameTimer -= dt;
      if (this.phoenixFlameTimer <= 0) {
        this.firePhoenixFlame(game);
        this.phoenixFlameTimer = PLAYER.phoenixFlameInterval;
      }
      if (this.phoenixTime <= 0) {
        this.endPhoenix(game);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Weapons                                                          */
  /* ---------------------------------------------------------------- */

  fireCore(game) {
    const y = this.y - 11;
    for (const off of [-3, 3]) {
      game.spawnPlayerBullet({
        x: this.x + off,
        y,
        vx: 0,
        vy: -PLAYER.bulletSpeed,
        dmg: PLAYER.bulletDamage,
        kind: 'bolt',
        color: 'cyan',
        r: 1.5,
        h: 6,
      });
    }
    game.hooks.sfx('laser');
    game.hooks.fx.muzzle(this.x, y, 'cyan');
  }

  fireModule(game, def) {
    const list = this.moduleWorldPositions();
    const pos = list.find((p) => p.id === def.id);
    if (!pos) return;
    if (def.id === 'beta') {
      for (const off of [-2, 2]) {
        game.spawnPlayerBullet({
          x: pos.x + off, y: pos.y - 3, vx: 0, vy: -def.bulletSpeed,
          dmg: def.bulletDamage, kind: 'module', color: 'cyan', r: 1.5, h: 5,
        });
      }
    } else if (def.id === 'gamma') {
      for (const dir of [-1, 1]) {
        const ang = Math.PI / 2 + dir * 0.42;
        game.spawnPlayerBullet({
          x: pos.x, y: pos.y + 3,
          vx: Math.cos(ang) * def.bulletSpeed * 0.8,
          vy: Math.abs(Math.sin(ang)) * def.bulletSpeed,
          dmg: def.bulletDamage, kind: 'module', color: 'magenta', r: 1.5, h: 4,
        });
      }
    } else if (def.id === 'delta') {
      game.spawnPlayerBullet({
        x: pos.x, y: pos.y - 4, vx: 0, vy: -def.bulletSpeed,
        dmg: def.bulletDamage, kind: 'lance', color: 'gold', r: 2.5, h: 12,
        pierce: def.pierce,
      });
      game.hooks.sfx('beam');
    }
  }

  firePhoenixFlame(game) {
    const spread = [-0.22, 0, 0.22];
    for (const a of spread) {
      game.spawnPlayerBullet({
        x: this.x + Math.sin(a) * 7,
        y: this.y - 10,
        vx: Math.sin(a) * 55,
        vy: -310,
        dmg: 2,
        kind: 'flame',
        color: 'orange',
        r: 2.5,
        h: 6,
        pierce: 4,
      });
    }
    game.hooks.fx.flame(this.x, this.y - 11);
  }

  /* ---------------------------------------------------------------- */
  /* Transform: formation split / Phoenix                              */
  /* ---------------------------------------------------------------- */

  /** Returns 'phoenix' | 'formation' | 'rejoin' | 'cooldown' | null. */
  tryTransform(game) {
    if (this.dead) return null;
    if (this.phoenixActive) return null;

    if (this.hasAllModules) {
      this.startPhoenix(game);
      return 'phoenix';
    }
    if (this.formationActive) {
      this.endFormation(game);
      return 'rejoin';
    }
    if (this.modules.length > 0) {
      if (this.formationCooldown > 0) return 'cooldown';
      this.startFormation(game);
      return 'formation';
    }
    return null;
  }

  startFormation(game) {
    this.formationActive = true;
    this.formationTime = 0;
    game.hooks.sfx('formation');
    game.hooks.fx.ring(this.x, this.y, 26, 'cyan');
    game.addPopup('FORMATION!', this.x, this.y - 26, 'cyan');
  }

  endFormation(game) {
    if (!this.formationActive) return;
    this.formationActive = false;
    this.formationCooldown = PLAYER.formationCooldown;
    game.hooks.sfx('rejoin');
    if (game && game.hooks) game.hooks.fx.ring(this.x, this.y, 20, 'cyan');
  }

  startPhoenix(game) {
    this.phoenixActive = true;
    this.phoenixTime = PLAYER.phoenixDuration;
    this.invuln = Math.max(this.invuln, PLAYER.phoenixDuration);
    this.formationActive = false;
    this.formationTime = 0;
    game.onPhoenixStart();
  }

  endPhoenix(game) {
    this.phoenixActive = false;
    this.phoenixCooldown = PLAYER.phoenixCooldown;
    this.invuln = Math.max(this.invuln, PLAYER.invulnTime + 0.6);
    game.onPhoenixEnd();
  }

  /* ---------------------------------------------------------------- */
  /* Damage                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * @returns {{kind:'none'|'module'|'revert'|'death', lost?:string|string[]}}
   */
  damage() {
    if (this.isInvulnerable) return { kind: 'none' };

    if (this.formationActive && this.modules.length > 0) {
      // Main ship is vulnerable while split: pieces are lost, life is kept.
      const lost = this.modules.slice();
      this.modules.length = 0;
      this.formationActive = false;
      this.formationCooldown = 0.5;
      this.invuln = PLAYER.invulnTime;
      return { kind: 'revert', lost };
    }

    if (this.modules.length > 0) {
      const lost = this.modules.pop();
      delete this.dockAnims[lost];
      this.hitPulse = 1;
      this.invuln = Math.max(this.invuln, PLAYER.invulnTime * 0.65);
      return { kind: 'module', lost };
    }

    return { kind: 'death' };
  }

  /** Kill the ship outright (life loss is handled by the game). */
  die() {
    this.dead = true;
    this.deathTimer = PLAYER.deathPause;
    this.phoenixActive = false;
    this.formationActive = false;
    this.modules.length = 0;
    this.vx = 0;
    this.vy = 0;
  }

  revive() {
    this.dead = false;
    this.x = PLAYER.spawnX;
    this.y = PLAYER.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.invuln = PLAYER.respawnInvuln;
    this.formationActive = false;
    this.formationCooldown = 0;
  }
}

export { TWO_PI };
