/**
 * Enemy behaviours. Each enemy is a plain object driven by a `switch` on kind,
 * so the whole roster is data + a few movement routines.
 */
import { ENEMY_TYPES, ENEMY_NAMES, DIFFICULTY, PODS } from './config.js';
import { clamp, angleTo, dist2 } from '../core/math.js';

let enemySerial = 0;

export function createEnemy(kind, x, y, opts = {}) {
  const def = ENEMY_TYPES[kind];
  if (!def) throw new Error('Unknown enemy kind: ' + kind);
  const scale = opts.scale || 1;
  enemySerial += 1;
  return {
    uid: enemySerial,
    kind,
    def,
    name: ENEMY_NAMES[kind] || kind.toUpperCase(),
    x,
    y,
    sx: x, // spawn x, used by sine movers
    sy: y,
    vx: 0,
    vy: 0,
    t: 0,
    phase: opts.phase !== undefined ? opts.phase : Math.random() * 6.283,
    hp: Math.max(1, Math.ceil(def.hp * (opts.hpMul || 1))),
    maxHp: Math.max(1, Math.ceil(def.hp * (opts.hpMul || 1))),
    r: def.r,
    score: def.score,
    speed: (opts.speedMul ? def.speed * opts.speedMul : def.speed) * scale,
    fireInterval: def.fireInterval || 0,
    fireTimer: def.fireInterval ? def.fireInterval * (0.5 + Math.random() * 0.6) : 0,
    bulletSpeed: (def.bulletSpeed || 90) * (opts.bulletSpeedMul || 1),
    state: 'enter',
    targetY: opts.targetY !== undefined ? opts.targetY : 0,
    dir: opts.dir || (Math.random() < 0.5 ? -1 : 1),
    charging: 0,
    flash: 0,
    dead: false,
    damageTaken: 0,
    shielded: Boolean(def.shielded),
  };
}

function fireAimed(game, e, spread = 0, count = 1, speedMul = 1) {
  const p = game.player;
  const base = angleTo(e.x, e.y, p.x, p.y);
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * spread;
    game.spawnEnemyBullet({
      x: e.x + Math.cos(a) * 5,
      y: e.y + Math.sin(a) * 5,
      vx: Math.cos(a) * e.bulletSpeed * speedMul,
      vy: Math.sin(a) * e.bulletSpeed * speedMul,
      r: 2,
      color: e.def.shielded ? 'cyan' : 'magenta',
    });
  }
}

function fireRadial(game, e, count, speed, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * Math.PI * 2;
    game.spawnEnemyBullet({
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: 2,
      color: 'magenta',
    });
  }
}

/**
 * Advance one enemy. Handles movement, firing and screen exit.
 * @returns {boolean} false when the enemy should be removed
 */
export function updateEnemy(e, dt, game) {
  e.t += dt;
  if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);

  const p = game.player;

  switch (e.kind) {
    case 'striker': {
      e.y += e.speed * dt;
      e.x = e.sx + Math.sin(e.t * 2.4 + e.phase) * 14;
      break;
    }
    case 'wraith': {
      if (e.y < 72) {
        e.y += e.speed * dt * 1.4;
      } else {
        e.y += Math.sin(e.t * 1.2) * 4 * dt + e.speed * 0.08 * dt;
        e.x = e.sx + Math.sin(e.t * 1.6 + e.phase) * 22;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.y > 60) {
          fireAimed(game, e, 0.12, 1);
          e.fireTimer = e.fireInterval / game.scaling.fireRate;
          e.flash = 0.6;
        }
      }
      break;
    }
    case 'sentinel': {
      // Ground pod: scrolls with the terrain, fires upward spread.
      e.y += PODS.scrollSpeed * dt;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.y < 330 && e.y > 40) {
        fireAimed(game, e, 0.18, 2);
        e.fireTimer = e.fireInterval / game.scaling.fireRate;
        e.flash = 0.6;
      }
      break;
    }
    case 'goliath': {
      const stopY = e.targetY || 96;
      if (e.y < stopY) {
        e.y += e.speed * dt;
      } else {
        e.state = 'fight';
        e.x += e.dir * 26 * dt;
        if (e.x < 48) { e.x = 48; e.dir = 1; }
        if (e.x > 192) { e.x = 192; e.dir = -1; }
        e.y = stopY + Math.sin(e.t * 1.4) * 8;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          fireAimed(game, e, 0.22, 3, 0.95);
          e.fireTimer = e.fireInterval / game.scaling.fireRate;
          e.flash = 0.7;
        }
      }
      break;
    }
    case 'seraph': {
      e.y += e.speed * dt;
      e.x = e.sx + Math.cos(e.t * 1.8 + e.phase) * 12;
      break;
    }
    case 'vesper': {
      if (e.state === 'enter') {
        // Lock a dive vector toward the player's current lane.
        const a = angleTo(e.x, e.y, clamp(p.x, 30, 210), p.y);
        e.vx = Math.cos(a) * e.speed;
        e.vy = Math.max(40, Math.sin(a) * e.speed);
        e.state = 'dive';
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      break;
    }
    case 'lance': {
      if (e.y < 64) {
        e.y += e.speed * dt;
      } else {
        e.x += clamp(p.x - e.x, -22, 22) * dt;
        e.y += Math.sin(e.t * 1.1) * 3 * dt;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          // Telegraph, then a fast aimed lance shot.
          if (e.charging <= 0) {
            e.charging = 0.55;
          } else {
            e.charging -= dt;
            if (e.charging <= 0) {
              fireAimed(game, e, 0, 1, 1.9);
              e.fireTimer = e.fireInterval / game.scaling.fireRate;
              e.flash = 1;
            }
          }
        }
      }
      break;
    }
    case 'aegis': {
      if (e.y < 90) {
        e.y += e.speed * dt;
      } else {
        e.x = e.sx + Math.sin(e.t * 0.9 + e.phase) * 30;
        e.y += Math.sin(e.t * 1.7) * 5 * dt;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          fireAimed(game, e, 0.26, 2);
          e.fireTimer = e.fireInterval / game.scaling.fireRate;
          e.flash = 0.6;
        }
      }
      break;
    }
    default:
      e.y += e.speed * dt;
  }

  // Screen exit — return false to cull.
  if (e.y > 442 || e.y < -104) return false;
  if (e.x < -70 || e.x > 310) return false;
  return true;
}

/** Called by the game when an enemy dies. Spawns on-death payloads. */
export function onEnemyDeath(e, game) {
  if (e.def.deathRing) {
    fireRadial(game, e, e.def.deathRing, e.def.ringSpeed || 70);
    game.hooks.fx.explosion(e.x, e.y, 'small');
  }
}

export { dist2 };
