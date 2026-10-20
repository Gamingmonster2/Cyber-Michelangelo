/**
 * The stage boss — a colossal statue-mask of the hostile Null Court.
 * Two destructible hands plus the core head, three attack phases.
 */
import { BOSS } from './config.js';
import { clamp, angleTo, dist2 } from '../core/math.js';

export class Boss {
  constructor(plan, stage, loop) {
    this.plan = plan;
    this.stage = stage;
    this.loop = loop;
    this.name = plan.name;
    this.x = 120;
    this.y = -54;
    this.targetY = BOSS.entryY;
    this.r = BOSS.r;
    this.contactR = BOSS.contactR;
    this.maxHp = plan.hp;
    this.hp = plan.hp;
    this.hands = BOSS.hands.map((h) => ({
      id: h.id,
      xOff: h.x,
      yOff: h.y,
      x: 120 + h.x,
      y: -54 + h.y,
      hp: plan.handHp,
      maxHp: plan.handHp,
      alive: true,
      flash: 0,
      fireTimer: 1.2 + Math.random() * 1.8,
    }));
    this.t = 0;
    this.state = 'enter'; // enter | fight | dying | dead
    this.phase = 1;
    this.attackTimer = 1.6;
    this.coreFireTimer = 1.8;
    this.spiralTimer = 0;
    this.spiralAngle = 0;
    this.summonTimer = 5;
    this.flash = 0;
    this.hitPulse = 0;
    this.deathTimer = 0;
    this.drift = Math.random() * 6.28;
    this.score = plan.score;
    this.dead = false;
  }

  get hpFrac() {
    return clamp(this.hp / this.maxHp, 0, 1);
  }

  get totalHp() {
    return this.hp + this.hands.reduce((sum, h) => sum + (h.alive ? h.hp : 0), 0);
  }

  get totalMaxHp() {
    return this.maxHp + this.hands.length * this.plan.handHp;
  }

  updatePositions() {
    for (const h of this.hands) {
      h.x = this.x + h.xOff;
      h.y = this.y + h.yOff;
    }
  }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
    if (this.hitPulse > 0) this.hitPulse = Math.max(0, this.hitPulse - dt * 4);

    if (this.state === 'dying') {
      this.deathTimer -= dt;
      if (Math.random() < dt * 14) {
        game.hooks.fx.explosion(
          this.x + (Math.random() - 0.5) * 90,
          this.y + (Math.random() - 0.5) * 50,
          Math.random() < 0.3 ? 'big' : 'medium',
        );
        game.hooks.sfx('explosion');
      }
      if (this.deathTimer <= 0) {
        this.dead = true;
        game.hooks.fx.explosion(this.x, this.y, 'boss');
        game.hooks.fx.flash(0.9, 'white');
        game.hooks.shake(1);
      }
      return;
    }

    if (this.state === 'enter') {
      this.y += 72 * dt;
      this.updatePositions();
      if (this.y >= this.targetY) {
        this.y = this.targetY;
        this.state = 'fight';
      }
      return;
    }

    // Phase from core HP.
    const frac = this.hpFrac;
    this.phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;

    // Hover drift.
    this.drift += dt * 0.7;
    this.x = 120 + Math.sin(this.drift) * 26;
    this.y = this.targetY + Math.sin(this.drift * 1.3) * 7;
    this.updatePositions();

    const fireMul = game.scaling.fireRate;

    // Hands fire aimed bursts.
    for (const hand of this.hands) {
      if (!hand.alive) continue;
      if (hand.flash > 0) hand.flash = Math.max(0, hand.flash - dt * 4);
      hand.fireTimer -= dt;
      if (hand.fireTimer <= 0) {
        this.fireHand(game, hand);
        hand.fireTimer = Math.max(0.85, (1.7 - 0.22 * this.stage) / fireMul) + Math.random() * 0.4;
      }
    }

    // Core patterns.
    this.coreFireTimer -= dt;
    if (this.coreFireTimer <= 0) {
      this.fireCore(game);
      const base = [2.5, 2.0, 1.55][this.phase - 1];
      this.coreFireTimer = base / fireMul;
    }

    // Phase 2+: rotating spiral.
    if (this.phase >= 2) {
      this.spiralTimer -= dt;
      if (this.spiralTimer <= 0) {
        this.spiralAngle += 0.42;
        const arms = this.phase >= 3 ? 3 : 2;
        for (let i = 0; i < arms; i++) {
          const a = this.spiralAngle + (i / arms) * Math.PI * 2;
          game.spawnEnemyBullet({
            x: this.x,
            y: this.y + 18,
            vx: Math.cos(a) * 66,
            vy: Math.sin(a) * 66 + 22,
            r: 2,
            color: 'magenta',
          });
        }
        this.spiralTimer = 0.17 / Math.min(1.8, fireMul);
      }
    }

    // Phase 3: summon escorts.
    if (this.phase >= 3) {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        game.summonMinions(this);
        this.summonTimer = 5.5;
      }
    }
  }

  fireHand(game, hand) {
    const phase = this.phase;
    const p = game.player;
    const base = angleTo(hand.x, hand.y, p.x, p.y);
    const count = phase >= 3 ? 3 : 2;
    const spread = 0.2;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread;
      const speed = 96 * game.scaling.bulletSpeed;
      game.spawnEnemyBullet({
        x: hand.x, y: hand.y + 8,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 2,
        color: 'magenta',
      });
    }
    hand.flash = 1;
    game.hooks.sfx('enemyShot');
  }

  fireCore(game) {
    const p = game.player;
    if (this.phase === 1) {
      // Radial ring.
      const count = 12;
      const offset = Math.random() * Math.PI;
      for (let i = 0; i < count; i++) {
        const a = offset + (i / count) * Math.PI * 2;
        const speed = 70 * game.scaling.bulletSpeed;
        game.spawnEnemyBullet({
          x: this.x, y: this.y + 16,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          r: 2, color: 'cyan',
        });
      }
    } else if (this.phase === 2) {
      // Bullet wall with a drifting gap.
      const gapCenter = 70 + Math.sin(this.t * 0.9) * 60;
      for (let i = 0; i < 9; i++) {
        const x = 16 + i * 26;
        if (Math.abs(x - gapCenter) < 34) continue;
        const speed = 88 * game.scaling.bulletSpeed;
        game.spawnEnemyBullet({ x, y: this.y + 24, vx: 0, vy: speed, r: 2, color: 'magenta' });
      }
      // Plus aimed trio.
      const base = angleTo(this.x, this.y, p.x, p.y);
      for (let i = -1; i <= 1; i++) {
        const a = base + i * 0.22;
        const speed = 92 * game.scaling.bulletSpeed;
        game.spawnEnemyBullet({
          x: this.x, y: this.y + 16,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 2, color: 'cyan',
        });
      }
    } else {
      // Enraged: dense ring + aimed stream.
      const count = 16;
      for (let i = 0; i < count; i++) {
        const a = this.t * 1.6 + (i / count) * Math.PI * 2;
        const speed = 82 * game.scaling.bulletSpeed;
        game.spawnEnemyBullet({
          x: this.x, y: this.y + 16,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 2, color: 'orange',
        });
      }
      const base = angleTo(this.x, this.y, p.x, p.y);
      for (let i = 0; i < 3; i++) {
        const a = base + (i - 1) * 0.18;
        const speed = 112 * game.scaling.bulletSpeed;
        game.spawnEnemyBullet({
          x: this.x, y: this.y + 16,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 2, color: 'red',
        });
      }
    }
    this.hitPulse = 1;
    game.hooks.sfx('enemyShot');
  }

  /**
   * Apply damage at a point. Hands absorb hits first; the core is always hittable.
   * @returns {{hit:boolean, part?:string, killedHand?:string, died?:boolean}}
   */
  damageAt(x, y, dmg) {
    if (this.state !== 'fight') return { hit: false };
    // Hands.
    for (const h of this.hands) {
      if (!h.alive) continue;
      if (dist2(x, y, h.x, h.y) <= (12 + 3) * (12 + 3)) {
        h.hp -= dmg;
        h.flash = 1;
        if (h.hp <= 0) {
          h.alive = false;
          return { hit: true, part: 'hand', killedHand: h.id, died: false };
        }
        return { hit: true, part: 'hand' };
      }
    }
    // Core.
    if (dist2(x, y, this.x, this.y) <= (this.r + 2) * (this.r + 2)) {
      this.hp -= dmg;
      this.flash = 1;
      if (this.hp <= 0) {
        this.startDying();
        return { hit: true, part: 'core', died: true };
      }
      return { hit: true, part: 'core' };
    }
    return { hit: false };
  }

  startDying() {
    this.hp = 0;
    this.state = 'dying';
    this.deathTimer = BOSS.clearTime;
  }

  /** Circle volumes for player contact / collision checks. */
  hittableCircles() {
    const out = [{ id: 'core', x: this.x, y: this.y, r: this.r }];
    for (const h of this.hands) if (h.alive) out.push({ id: h.id, x: h.x, y: h.y, r: 11 });
    return out;
  }
}

export { dist2 };
