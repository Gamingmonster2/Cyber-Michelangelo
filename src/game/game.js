/**
 * Cyber Michelangelo — central game state machine.
 *
 * The Game owns all simulation state and is completely DOM-free, so the
 * whole run loop can be unit-tested under Node. Rendering and audio are
 * injected through small hook interfaces (`fx`, `audio`).
 */
import {
  GAME, PLAYER, FIELD, STAGE, SCORING, PODS, PICKUPS, BOSS,
  MODULE_DEFS, MODULE_BY_ID, MODULE_ORDER, DIFFICULTY,
  ENEMY_TYPES, stageInfo, formationStyleForCount,
} from './config.js';
import { Player } from './player.js';
import { createEnemy, updateEnemy, onEnemyDeath } from './enemies.js';
import { Boss } from './boss.js';
import { createStage, expandPattern, nextMissingModule } from './waves.js';
import { RNG, hashSeed, clamp, dist2, formatScore } from '../core/math.js';
import { loadSettings, saveSettings, recordRun, getItem, setItem, KEYS } from '../core/storage.js';

const DT_EPSILON = 1e-9;

const NOOP_FX = {
  explosion() {}, ring() {}, muzzle() {}, flame() {}, spark() {},
  shake() {}, flash() {}, nova() {}, beamHit() {},
};

export const TITLE_ITEMS = ['START MISSION', 'HOW TO PLAY', 'CREDITS', 'OPTIONS'];
export const PAUSE_ITEMS = ['RESUME', 'RESTART', 'QUIT TO TITLE'];
export const OPTION_ITEMS = [
  { key: 'music', label: 'MUSIC', type: 'volume' },
  { key: 'sfx', label: 'SFX', type: 'volume' },
  { key: 'autoFire', label: 'AUTO FIRE', type: 'bool' },
  { key: 'shake', label: 'SCREEN SHAKE', type: 'bool' },
  { key: 'scanlines', label: 'SCANLINES', type: 'bool' },
  { key: 'back', label: 'BACK', type: 'back' },
];

export class Game {
  constructor(opts = {}) {
    this.fx = opts.fx || NOOP_FX;
    this.audio = opts.audio || null;
    this.hooks = {
      sfx: (name, options) => {
        if (this.audio && typeof this.audio.sfx === 'function') this.audio.sfx(name, options);
      },
      fx: this.fx,
      shake: (amount) => this.fx.shake(amount),
      music: (track) => {
        if (this.audio && typeof this.audio.music === 'function') this.audio.music(track);
      },
    };
    this.settings = opts.settings || loadSettings();
    this.seed = opts.seed || GAME.seed;
    this.rng = new RNG(hashSeed(this.seed, 'session'));
    this.hiScore = Number(getItem(KEYS.hiScore)) || 0;
    this.stats = null;
    this.time = 0;
    this.sceneTime = 0;
    this.scene = 'title';
    this.menuIndex = 0;
    this.pauseIndex = 0;
    this.optionIndex = 0;
    this.howtoPage = 0;
    this.gameoverPhase = 'continue';
    this.gameoverIndex = 0;
    this.continueTimer = 0;
    this.continueUsed = false;
    this.fps = 0;

    // Run state (populated by startRun).
    this.score = 0;
    this.lives = GAME.startingLives;
    this.novas = GAME.startingNovas;
    this.stage = 1;
    this.loop = 1;
    this.theme = null;
    this.runTime = 0;
    this.chain = 0;
    this.comboTimer = 0;
    this.extraLifeIndex = 0;
    this.phoenixesThisRun = 0;
    this.continuedThisRun = false;

    this.player = new Player(this);
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.podCluster = null;
    this.pickups = [];
    this.popups = [];
    this.boss = null;
    this.banner = null;
    this.stagePlan = null;
    this.stageState = 'intro';
    this.stateTimer = 0;
    this.waveIndex = 0;
    this.waveTime = 0;
    this.pendingSpawns = [];
    this.scaling = { hpMul: 1, bulletSpeed: 1, density: 1, fireRate: 1 };
    this.lastNova = 0;

    this.applyVolumes();
    this.hooks.music('title');
  }

  /* ================================================================ */
  /* Global update                                                    */
  /* ================================================================ */

  update(dt, input = {}) {
    const step = Math.min(0.05, Math.max(0, dt));
    this.time += step;
    this.sceneTime += step;
    this.comboTimer = Math.max(0, this.comboTimer - step);
    if (this.comboTimer <= 0 && this.chain > 0) this.chain = 0;

    switch (this.scene) {
      case 'title':
        this.updateTitle(input);
        break;
      case 'howto':
        this.updateHowto(input);
        break;
      case 'credits':
        this.updateCredits(input);
        break;
      case 'options':
        this.updateOptions(input);
        break;
      case 'playing':
        this.updatePlaying(step, input);
        break;
      case 'paused':
        this.updatePaused(input);
        break;
      case 'gameover':
        this.updateGameover(step, input);
        break;
      default:
        break;
    }

    // Decay transient UI bits in every scene.
    for (const p of this.popups) p.t += step;
    if (this.popups.length > 24) this.popups.splice(0, this.popups.length - 24);
    this.popups = this.popups.filter((p) => p.t < p.life);
    if (this.banner) {
      this.banner.t += step;
      if (this.banner.t > this.banner.life) this.banner = null;
    }
  }

  /* ================================================================ */
  /* Scene helpers                                                    */
  /* ================================================================ */

  goToScene(scene, musicTrack) {
    this.scene = scene;
    this.sceneTime = 0;
    if (musicTrack) this.hooks.music(musicTrack);
  }

  updateTitle(input) {
    if (input.down) this.moveMenu(1, TITLE_ITEMS.length);
    if (input.up) this.moveMenu(-1, TITLE_ITEMS.length);
    if (input.pause || input.back) return;
    if (input.confirm || input.transform) {
      const item = TITLE_ITEMS[this.menuIndex];
      if (item === 'START MISSION') this.startRun();
      else if (item === 'HOW TO PLAY') { this.goToScene('howto'); this.howtoPage = 0; }
      else if (item === 'CREDITS') this.goToScene('credits');
      else if (item === 'OPTIONS') { this.goToScene('options'); this.optionIndex = 0; }
      this.hooks.sfx('select');
    }
  }

  moveMenu(dir, length) {
    const next = (this.menuIndex + dir + length) % length;
    if (next !== this.menuIndex) {
      this.menuIndex = next;
      this.hooks.sfx('move');
    }
  }

  updateHowto(input) {
    if (input.back || input.pause) {
      this.goToScene('title');
      this.hooks.sfx('back');
      return;
    }
    if (input.left) { this.howtoPage = Math.max(0, this.howtoPage - 1); this.hooks.sfx('move'); }
    if (input.right || input.confirm) {
      if (this.howtoPage >= 1) { this.goToScene('title'); this.hooks.sfx('back'); }
      else { this.howtoPage += 1; this.hooks.sfx('select'); }
    }
  }

  updateCredits(input) {
    if (input.confirm || input.back || input.pause) {
      this.goToScene('title');
      this.hooks.sfx('back');
    }
  }

  updateOptions(input) {
    const count = OPTION_ITEMS.length;
    if (input.back || input.pause) {
      this.goToScene('title');
      saveSettings(this.settings);
      this.hooks.sfx('back');
      return;
    }
    if (input.down) { this.optionIndex = (this.optionIndex + 1) % count; this.hooks.sfx('move'); }
    if (input.up) { this.optionIndex = (this.optionIndex - 1 + count) % count; this.hooks.sfx('move'); }
    const item = OPTION_ITEMS[this.optionIndex];
    if (item.type === 'back') {
      if (input.confirm) {
        this.goToScene('title');
        saveSettings(this.settings);
        this.hooks.sfx('back');
      }
      return;
    }
    let dir = 0;
    if (input.left) dir = -1;
    if (input.right) dir = 1;
    if (input.confirm) dir = 1;
    if (dir !== 0) {
      if (item.type === 'volume') {
        this.settings[item.key] = (this.settings[item.key] + dir + 11) % 11;
      } else if (item.type === 'bool') {
        this.settings[item.key] = !this.settings[item.key];
      }
      this.hooks.sfx('select');
      this.applyVolumes();
      saveSettings(this.settings);
    }
  }

  applyVolumes() {
    if (this.audio && typeof this.audio.setVolumes === 'function') {
      this.audio.setVolumes({ music: this.settings.music / 10, sfx: this.settings.sfx / 10 });
    }
  }

  updatePaused(input) {
    if (input.pause) {
      this.resume();
      return;
    }
    if (input.down) { this.pauseIndex = (this.pauseIndex + 1) % PAUSE_ITEMS.length; this.hooks.sfx('move'); }
    if (input.up) { this.pauseIndex = (this.pauseIndex - 1 + PAUSE_ITEMS.length) % PAUSE_ITEMS.length; this.hooks.sfx('move'); }
    if (input.confirm) {
      const choice = PAUSE_ITEMS[this.pauseIndex];
      if (choice === 'RESUME') this.resume();
      else if (choice === 'RESTART') this.startRun();
      else this.abandonRun();
    }
  }

  resume() {
    this.goToScene('playing');
    this.sceneTime = 0;
    this.hooks.fx.shake(0);
  }

  abandonRun() {
    this.recordRun();
    this.goToScene('title', 'title');
  }

  /* ================================================================ */
  /* Run lifecycle                                                    */
  /* ================================================================ */

  startRun() {
    this.score = 0;
    this.lives = GAME.startingLives;
    this.novas = GAME.startingNovas;
    this.stage = 1;
    this.loop = 1;
    this.runTime = 0;
    this.chain = 0;
    this.comboTimer = 0;
    this.extraLifeIndex = 0;
    this.phoenixesThisRun = 0;
    this.continueUsed = false;
    this.continuedThisRun = false;
    this.player = new Player(this);
    this.player.reset();
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.pickups = [];
    this.podCluster = null;
    this.boss = null;
    this.popups = [];
    this.banner = null;
    this.gameoverPhase = 'continue';
    this.rng = new RNG(hashSeed(this.seed, 'run', Date.now ? 1 : 0));
    this.startStage(1);
    this.goToScene('playing', 'stage');
    this.showBanner('STAGE 1', this.stagePlan.name, 'gold');
  }

  startStage(stageNumber) {
    this.stage = Math.max(1, stageNumber);
    const info = stageInfo(this.stage);
    this.loop = info.loop;
    this.theme = info.theme;
    this.stagePlan = createStage(this.stage, this.seed);
    this.scaling = {
      hpMul: DIFFICULTY.enemyHp(this.stage, this.loop),
      bulletSpeed: DIFFICULTY.bulletSpeed(this.stage, this.loop),
      density: DIFFICULTY.density(this.stage, this.loop),
      fireRate: DIFFICULTY.fireRate(this.stage, this.loop),
    };
    this.stageState = 'intro';
    this.stateTimer = STAGE.introTime;
    this.waveIndex = 0;
    this.waveTime = 0;
    this.pendingSpawns = [];
    this.enemies.length = 0;
    this.enemyBullets.length = 0;
    this.playerBullets.length = 0;
    this.podCluster = null;
    this.boss = null;
    this.pickups.length = 0;
    if (this.player && !this.player.dead) {
      this.player.x = PLAYER.spawnX;
      this.player.y = PLAYER.spawnY;
      this.player.invuln = Math.max(this.player.invuln, PLAYER.invulnTime);
      this.player.formationActive = false;
    }
  }

  beginWave(index) {
    this.waveIndex = index;
    this.waveTime = 0;
    const wave = this.stagePlan.waves[index];
    if (!wave) return;
    this.pendingSpawns = wave.spawns.map((s) => ({ ...s, spawned: false }));
    if (wave.pods) this.spawnPodCluster();
    this.stageState = 'waves';
  }

  /* ================================================================ */
  /* Playing update                                                   */
  /* ================================================================ */

  updatePlaying(dt, input) {
    this.runTime += dt;

    if (input.pause) {
      this.goToScene('paused', null);
      this.pauseIndex = 0;
      this.hooks.sfx('pause');
      return;
    }
    if (input.mute) {
      this.hooks.sfx('select');
    }
    if (input.transform && !this.player.dead) {
      const result = this.player.tryTransform(this);
      if (result === 'cooldown') this.addPopup('FORM COOLING', this.player.x, this.player.y - 24, 'steel');
    }
    if (input.nova && !this.player.dead) this.useNova();

    this.updateStageFlow(dt);
    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updatePlayerBullets(dt);
    this.updateEnemyBullets(dt);
    this.updatePods(dt);
    this.updatePickups(dt);
    this.updateCollisions(dt);
    this.updateCombo();
    this.checkDeathState(dt);

    if (this.stageState === 'clear' && this.stateTimer <= 0) {
      this.startStage(this.stage + 1);
      this.goToScene('playing', 'stage');
      this.showBanner(`STAGE ${this.stage}`, this.stagePlan.name, 'gold');
    }
  }

  updateStageFlow(dt) {
    switch (this.stageState) {
      case 'intro':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.beginWave(0);
          this.showBanner('WAVE 1', '', 'cyan', 1.1);
        }
        break;
      case 'waves': {
        this.waveTime += dt;
        for (const spawn of this.pendingSpawns) {
          if (!spawn.spawned && this.waveTime >= spawn.at) {
            spawn.spawned = true;
            this.spawnEnemyGroup(spawn);
          }
        }
        const wave = this.stagePlan.waves[this.waveIndex];
        const done = wave && this.waveTime >= wave.duration && this.enemies.length === 0;
        if (done) {
          const bonus = SCORING.waveClear + this.stage * 50;
          this.addScore(bonus, { ignoreCombo: true });
          this.addPopup(`WAVE CLEAR  +${bonus}`, 120, 180, 'gold', 1.6);
          this.hooks.sfx('waveClear');
          this.waveIndex += 1;
          if (this.waveIndex >= this.stagePlan.waves.length) {
            this.stageState = 'bossWarn';
            this.stateTimer = BOSS.warnTime;
            this.showBanner('WARNING', 'COLOSSAL SIGNATURE DETECTED', 'red', BOSS.warnTime);
            this.hooks.sfx('warning');
            this.hooks.music('boss');
          } else {
            this.stageState = 'waveGap';
            this.stateTimer = STAGE.waveGap;
          }
        }
        break;
      }
      case 'waveGap':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.beginWave(this.waveIndex);
          this.showBanner(`WAVE ${this.waveIndex + 1}`, this.stagePlan.waves[this.waveIndex]?.tag || '', 'cyan', 1.1);
        }
        break;
      case 'bossWarn':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.spawnBoss();
          this.stageState = 'boss';
        }
        break;
      case 'boss':
        if (this.boss && this.boss.dead) {
          this.onBossDefeated();
        }
        break;
      case 'clear':
        this.stateTimer -= dt;
        break;
      default:
        break;
    }
  }

  updatePlayer(dt, input) {
    this.player.update(dt, input, this);
  }

  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        this.enemies.splice(i, 1);
        continue;
      }
      const alive = updateEnemy(e, dt, this);
      if (!alive) this.enemies.splice(i, 1);
    }
  }

  updateBoss(dt) {
    if (this.boss) this.boss.update(dt, this);
  }

  updatePlayerBullets(dt) {
    const out = [];
    for (const b of this.playerBullets) {
      b.x += (b.vx || 0) * dt;
      b.y += (b.vy || 0) * dt;
      b.t = (b.t || 0) + dt;
      if (b.y < -20 || b.y > 440 || b.x < -20 || b.x > 260) continue;
      out.push(b);
    }
    this.playerBullets = out;
    if (this.playerBullets.length > 260) this.playerBullets.splice(0, this.playerBullets.length - 260);
  }

  updateEnemyBullets(dt) {
    const out = [];
    const p = this.player;
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.y > 460 || b.x < -30 || b.x > 280) continue;
      out.push(b);
    }
    this.enemyBullets = out;
    if (this.enemyBullets.length > 260) this.enemyBullets.splice(0, this.enemyBullets.length - 260);
    // Epsilon force field erases bullets that enter its bubble.
    const field = p.activeField();
    if (field && !p.dead) {
      const r2 = field.r * field.r;
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        if (dist2(b.x, b.y, field.x, field.y) <= r2) {
          this.enemyBullets.splice(i, 1);
          this.fx.spark(b.x, b.y, 'green');
          if (Math.random() < 0.25) this.hooks.sfx('field');
        }
      }
    }
  }

  updatePods(dt) {
    if (!this.podCluster) return;
    const cluster = this.podCluster;
    for (const pod of cluster.pods) {
      if (pod.dead) continue;
      pod.y += PODS.scrollSpeed * dt;
      if (pod.flash > 0) pod.flash -= dt * 4;
      if (pod.y > FIELD.bottom + 24) {
        pod.dead = true;
        pod.missed = true;
        cluster.missed += 1;
      }
    }
    // Cluster resolved when everything is gone.
    if (cluster.destroyed + cluster.missed >= cluster.pods.length) {
      if (cluster.destroyed === cluster.pods.length && !cluster.awarded) {
        cluster.awarded = true;
        this.awardPodCluster(cluster);
      }
      this.podCluster = null;
    }
  }

  updatePickups(dt) {
    const p = this.player;
    for (const item of this.pickups) {
      item.t += dt;
      if (item.kind === 'module') {
        // Homing module capsule.
        const dx = p.x - item.x;
        const dy = p.y - item.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = Math.min(PODS.pickupSpeed * 2.2, 40 + item.t * 130);
        item.x += (dx / d) * speed * dt;
        item.y += (dy / d) * speed * dt;
        if (d < 9) this.collectModule(item);
      } else if (item.kind === 'gem' || item.kind === 'nova' || item.kind === 'heart') {
        item.y += (item.vy || PICKUPS.gemSpeed) * dt;
        item.x += Math.sin(item.t * 2.2 + item.x * 0.1) * 6 * dt;
        if (d2(item, p) < 100 && !p.dead) this.collectPickup(item);
      }
    }
    this.pickups = this.pickups.filter((item) => {
      if (item.collected) return false;
      if (item.t > PICKUPS.lifetime) return false;
      if (item.y > 440) return false;
      return true;
    });
  }

  updateCollisions() {
    const p = this.player;

    /* --- player bullets → enemies --- */
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      let consumed = false;

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist2(b.x, b.y, e.x, e.y) > (e.r + (b.r || 1.5)) ** 2) continue;
        // Aegis front shield: bullets are deflected unless they hit the centre gap.
        if (e.shielded && Math.abs(b.x - e.x) > 3.5) {
          this.fx.spark(b.x, b.y, 'cyan');
          consumed = true;
          break;
        }
        this.damageEnemy(e, b.dmg || 1, b.kind);
        if (b.pierce && b.pierce > 0) {
          b.pierce -= 1;
        } else {
          consumed = true;
        }
        break;
      }

      if (!consumed && this.boss && this.boss.state === 'fight') {
        const res = this.boss.damageAt(b.x, b.y, b.dmg || 1);
        if (res.hit) {
          this.fx.spark(b.x, b.y, 'white');
          if (res.killedHand) {
            const bonus = 600 * this.stage;
            this.addScore(bonus, { ignoreCombo: true });
            this.addPopup(`HAND SEVERED +${bonus}`, this.boss.x, this.boss.y + 30, 'gold', 1.6);
            this.fx.explosion(b.x, b.y, 'big');
            this.hooks.sfx('bossHit');
          }
          if (res.died) {
            this.addScore(this.boss.score, { ignoreCombo: true });
            this.addPopup(`COLOSSUS DOWN +${this.boss.score}`, this.boss.x, this.boss.y, 'gold', 2.4);
          }
          if (b.pierce && b.pierce > 0) b.pierce -= 1;
          else consumed = true;
        }
      }

      if (!consumed && this.podCluster) {
        for (const pod of this.podCluster.pods) {
          if (pod.dead) continue;
          if (dist2(b.x, b.y, pod.x, pod.y) > (PODS.r + (b.r || 1.5)) ** 2) continue;
          this.damagePod(pod, b.dmg || 1);
          if (b.pierce && b.pierce > 0) b.pierce -= 1;
          else consumed = true;
          break;
        }
      }

      if (consumed) this.playerBullets.splice(i, 1);
    }

    if (p.dead) return;

    /* --- enemy bullets → player --- */
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      let hit = false;
      for (const box of p.hitboxes()) {
        if (dist2(b.x, b.y, box.x, box.y) <= (box.r + (b.r || 2)) ** 2) {
          hit = true;
          break;
        }
      }
      if (hit) {
        this.enemyBullets.splice(i, 1);
        this.applyPlayerDamage();
        if (p.dead) return;
      }
    }

    /* --- player contact: enemies / boss --- */
    for (const e of this.enemies) {
      if (e.dead) continue;
      for (const box of p.hitboxes()) {
        if (dist2(box.x, box.y, e.x, e.y) > (box.r + e.r) ** 2) continue;
        if (p.phoenixActive) {
          this.damageEnemy(e, 99, 'phoenix');
        } else {
          this.applyPlayerDamage();
          if (p.dead) return;
        }
        break;
      }
    }

    if (this.boss && this.boss.state === 'fight') {
      for (const circle of this.boss.hittableCircles()) {
        for (const box of p.hitboxes()) {
          if (dist2(box.x, box.y, circle.x, circle.y) > (box.r + circle.r) ** 2) continue;
          if (!p.phoenixActive) {
            this.applyPlayerDamage();
            if (p.dead) return;
          }
          break;
        }
      }
    }

    /* --- pickups --- */
    for (const item of this.pickups) {
      if (item.collected) continue;
      if (item.kind !== 'module' && d2(item, p) < 110) this.collectPickup(item);
    }
  }

  d2Pickup(item) {
    return d2(item, this.player);
  }

  updateCombo() {
    if (this.comboTimer <= 0 && this.chain > 0) {
      this.chain = 0;
    }
  }

  checkDeathState(dt) {
    const p = this.player;
    if (!p.dead) return;
    p.deathTimer = Math.max(0, p.deathTimer - dt);
    if (p.deathTimer <= 0) {
      if (this.lives > 0) {
        p.revive();
        this.enemyBullets.length = 0;
      } else {
        this.enterGameover();
      }
    }
  }

  /* ================================================================ */
  /* Combat                                                           */
  /* ================================================================ */

  spawnPlayerBullet(props) {
    this.playerBullets.push({ t: 0, ...props });
  }

  spawnEnemyBullet(props) {
    this.enemyBullets.push({ r: 2, ...props });
  }

  spawnEnemyGroup(spawn) {
    const offsets = expandPattern(spawn.pattern, spawn.count, spawn.gap);
    for (const off of offsets) {
      const x = clamp(spawn.x + off.dx, 16, 224);
      const y = -14 - Math.max(0, -off.dy) - (off.delay || 0) * 90;
      const e = createEnemy(spawn.type, x, y, {
        hpMul: this.scaling.hpMul,
        bulletSpeedMul: this.scaling.bulletSpeed,
        scale: 1,
        phase: this.rng.range(0, 6.28),
        targetY: 78 + this.rng.range(0, 46),
        dir: this.rng.sign(),
      });
      this.enemies.push(e);
    }
  }

  damageEnemy(e, dmg, source) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 1;
    if (e.hp <= 0) this.killEnemy(e, source);
  }

  killEnemy(e, source) {
    if (e.dead) return;
    e.dead = true;
    const base = e.score;
    const multiplier = this.multiplier;
    let gained = Math.round(base * multiplier * (this.player.phoenixActive ? SCORING.phoenixScoreMul : 1));
    this.score += gained;
    this.chain += 1;
    this.comboTimer = SCORING.comboWindow;
    this.fx.explosion(e.x, e.y, e.maxHp > 4 ? 'big' : 'medium');
    this.hooks.sfx('explosion');
    const size = e.maxHp > 4 ? 'big' : e.r > 5 ? 'medium' : 'small';
    this.fx.shake(size === 'big' ? 0.22 : size === 'medium' ? 0.12 : 0.05);
    if (e.def.deathRing) onEnemyDeath(e, this);
    this.rollDrops(e);
    this.checkExtraLife();
    if (e.maxHp > 4) this.addPopup(`+${gained}`, e.x, e.y, 'gold');
  }

  rollDrops(e) {
    const chance = e.def.drops || 0;
    const r = Math.random();
    let kind = null;
    if (e.def.novaDrop && Math.random() < e.def.novaDrop) kind = 'nova';
    else if (Math.random() < PICKUPS.dropChances.heart) kind = 'heart';
    else if (r < chance) kind = 'gem';
    if (!kind) return;
    this.spawnPickup(kind, e.x, e.y);
  }

  spawnPickup(kind, x, y, extra = {}) {
    const r = kind === 'module' ? PODS.pickupR : kind === 'nova' ? PICKUPS.novaR : kind === 'heart' ? PICKUPS.heartR : PICKUPS.gemR;
    this.pickups.push({ kind, x, y, vx: 0, vy: kind === 'gem' ? PICKUPS.gemSpeed : 26, r, t: 0, ...extra });
  }

  collectPickup(item) {
    if (item.collected) return;
    item.collected = true;
    if (item.kind === 'gem') {
      this.addScore(PICKUPS.gemScore, { ignoreCombo: true });
      this.fx.spark(item.x, item.y, 'gold');
      this.hooks.sfx('pickup');
    } else if (item.kind === 'nova') {
      this.novas = Math.min(GAME.maxNovas, this.novas + 1);
      this.addPopup('NOVA +1', item.x, item.y, 'orange');
      this.fx.ring(item.x, item.y, 14, 'orange');
      this.hooks.sfx('powerup');
    } else if (item.kind === 'heart') {
      this.lives = Math.min(GAME.maxLives, this.lives + 1);
      this.addPopup('EXTRA LIFE', item.x, item.y, 'red');
      this.hooks.sfx('extraLife');
    }
  }

  collectModule(item) {
    if (item.collected) return;
    const def = MODULE_DEFS.find((m) => m.num === item.num);
    if (!def) return;
    if (!this.player.attachModule(def.id)) {
      this.addScore(PODS.relicScore, { ignoreCombo: true });
      item.collected = true;
      return;
    }
    item.collected = true;
    this.addScore(PODS.pickupValue, { ignoreCombo: true });
    this.addPopup(`${def.name} DOCKED`, this.player.x, this.player.y - 26, 'gold', 1.6);
    this.fx.ring(this.player.x, this.player.y, 22, 'gold');
    this.fx.shake(0.1);
    this.hooks.sfx('dock');
    this.checkExtraLife();
    if (this.player.hasAllModules) {
      this.addPopup('PHOENIX READY · PRESS X', 120, 150, 'orange', 2.6);
      this.hooks.sfx('ready');
    }
  }

  applyPlayerDamage() {
    const result = this.player.damage();
    if (result.kind === 'none') return;
    if (result.kind === 'module') {
      const def = MODULE_BY_ID[result.lost];
      this.fx.explosion(this.player.x, this.player.y, 'medium');
      this.fx.shake(0.25);
      this.hooks.sfx('moduleLost');
      this.addPopup(`${def ? def.name : 'MODULE'} LOST`, this.player.x, this.player.y - 22, 'red', 1.4);
      this.chain = 0;
      this.comboTimer = 0;
    } else if (result.kind === 'revert') {
      for (const id of result.lost) {
        this.fx.explosion(this.player.x + (Math.random() - 0.5) * 22, this.player.y + (Math.random() - 0.5) * 18, 'medium');
      }
      this.fx.shake(0.35);
      this.hooks.sfx('moduleLost');
      this.addPopup('HULL REVERTED', this.player.x, this.player.y - 22, 'red', 1.6);
      this.chain = 0;
      this.comboTimer = 0;
    } else if (result.kind === 'death') {
      this.loseLife();
    }
  }

  loseLife() {
    this.lives -= 1;
    this.player.die();
    this.chain = 0;
    this.comboTimer = 0;
    this.fx.explosion(this.player.x, this.player.y, 'big');
    this.fx.explosion(this.player.x, this.player.y, 'boss');
    this.fx.flash(0.55, 'white');
    this.fx.shake(1);
    this.hooks.sfx('playerDeath');
    this.enemyBullets.length = 0;
  }

  checkExtraLife() {
    const thresholds = SCORING.extraLivesAt;
    while (this.extraLifeIndex < thresholds.length && this.score >= thresholds[this.extraLifeIndex]) {
      this.extraLifeIndex += 1;
      if (this.lives < GAME.maxLives) {
        this.lives += 1;
        this.addPopup('EXTRA LIFE', this.player.x, this.player.y - 30, 'red', 2);
        this.hooks.sfx('extraLife');
      }
    }
  }

  get multiplier() {
    return Math.min(SCORING.maxMultiplier, 1 + Math.floor(this.chain / SCORING.comboStep));
  }

  addScore(base, opts = {}) {
    const mult = opts.ignoreCombo ? 1 : this.multiplier;
    const val = Math.round(base * mult);
    this.score += val;
    this.checkExtraLife();
    return val;
  }

  /* ================================================================ */
  /* Pods & boss                                                      */
  /* ================================================================ */

  spawnPodCluster() {
    const docked = this.player.modules.map((id) => MODULE_BY_ID[id].num);
    const num = nextMissingModule(docked);
    const count = PODS.count;
    const startX = 120 - ((count - 1) * PODS.spacing) / 2;
    const pods = [];
    for (let i = 0; i < count; i++) {
      pods.push({
        uid: `${num ?? 'relic'}-${i}`,
        x: startX + i * PODS.spacing,
        y: PODS.spawnY - Math.abs(i - (count - 1) / 2) * 8,
        num,
        hp: PODS.hp,
        maxHp: PODS.hp,
        dead: false,
        missed: false,
        flash: 0,
      });
    }
    this.podCluster = { num, pods, destroyed: 0, missed: 0, awarded: false };
  }

  damagePod(pod, dmg) {
    if (pod.dead) return;
    pod.hp -= dmg;
    pod.flash = 1;
    this.fx.spark(pod.x, pod.y - 4, 'cyan');
    this.hooks.sfx('podHit');
    if (pod.hp <= 0) {
      pod.dead = true;
      if (this.podCluster) this.podCluster.destroyed += 1;
      this.fx.explosion(pod.x, pod.y, 'medium');
      this.hooks.sfx('podBreak');
      this.addScore(PODS.score, { ignoreCombo: true });
    }
  }

  awardPodCluster(cluster) {
    const num = cluster.num;
    if (num == null) {
      // All modules already owned: rich relic bonus.
      this.spawnPickup('gem', 120, 90, { relic: true, vy: 20 });
      this.addScore(PODS.relicScore, { ignoreCombo: true });
      this.addPopup(`RELIC +${PODS.relicScore}`, 120, 96, 'gold', 1.8);
      this.hooks.sfx('relic');
      return;
    }
    const def = MODULE_DEFS.find((m) => m.num === num);
    this.spawnPickup('module', 120, 60, { num, def });
    this.addPopup(`${def ? def.name : 'MODULE'} RELEASED`, 120, 54, 'cyan', 1.8);
    this.hooks.sfx('moduleRelease');
  }

  spawnBoss() {
    this.boss = new Boss(this.stagePlan.boss, this.stage, this.loop);
    this.hooks.fx.flash(0.35, 'red');
    this.fx.shake(0.6);
  }

  summonMinions(boss) {
    for (const side of [-1, 1]) {
      const e = createEnemy('striker', boss.x + side * 52, boss.y + 20, {
        hpMul: this.scaling.hpMul,
        bulletSpeedMul: this.scaling.bulletSpeed,
      });
      this.enemies.push(e);
    }
    this.hooks.sfx('summon');
  }

  onBossDefeated() {
    this.stageState = 'clear';
    this.stateTimer = BOSS.clearTime;
    const bonus = SCORING.stageClear * this.stage;
    this.addScore(bonus, { ignoreCombo: true });
    this.addPopup(`STAGE CLEAR +${bonus}`, 120, 170, 'gold', 2.4);
    this.enemyBullets.length = 0;
    this.novas = Math.min(GAME.maxNovas, this.novas + 1);
    this.pickups.push({ kind: 'nova', x: 110, y: 120, vx: 0, vy: 22, r: PICKUPS.novaR, t: 0 });
    this.pickups.push({ kind: 'heart', x: 132, y: 130, vx: 0, vy: 20, r: PICKUPS.heartR, t: 0 });
    this.fx.flash(0.5, 'gold');
    this.hooks.sfx('stageClear');
    this.hooks.music('stage');
    this.boss = null;
  }

  useNova() {
    if (this.novas <= 0) {
      this.addPopup('NO NOVA', this.player.x, this.player.y - 24, 'steel', 0.9);
      return false;
    }
    this.novas -= 1;
    this.lastNova = this.time;
    this.enemyBullets.length = 0;
    this.player.invuln = Math.max(this.player.invuln, PLAYER.novaInvuln);
    this.fx.nova(this.player.x, this.player.y);
    this.fx.flash(0.75, 'white');
    this.fx.shake(0.9);
    this.hooks.sfx('nova');
    let killed = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist2(e.x, e.y, this.player.x, this.player.y);
      if (d < PLAYER.novaRadius ** 2) {
        this.damageEnemy(e, 30 + this.stage * 2, 'nova');
        killed += 1;
      }
    }
    if (this.boss && this.boss.state === 'fight') {
      this.boss.damageAt(this.boss.x, this.boss.y, 60);
    }
    if (killed > 0) this.addPopup(`NOVA ×${killed}`, this.player.x, this.player.y - 34, 'orange', 1.5);
    return true;
  }

  onPhoenixStart() {
    this.phoenixesThisRun += 1;
    this.enemyBullets.length = 0;
    this.addScore(SCORING.phoenixBonus, { ignoreCombo: true });
    this.addPopup('PHOENIX!', this.player.x, this.player.y - 40, 'orange', 2.2);
    this.fx.flash(0.85, 'orange');
    this.fx.shake(0.8);
    this.fx.nova(this.player.x, this.player.y);
    this.hooks.sfx('phoenix');
    // Clear nearby enemies with a fiery burst.
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (dist2(e.x, e.y, this.player.x, this.player.y) < 120 * 120) {
        this.damageEnemy(e, 99, 'phoenix');
      }
    }
  }

  onPhoenixEnd() {
    const p = this.player;
    for (const id of p.modules.slice()) {
      const slot = p.slotFor(id);
      this.fx.explosion(p.x + slot.x, p.y + slot.y, 'medium');
    }
    p.modules.length = 0;
    this.fx.flash(0.3, 'orange');
    this.fx.shake(0.4);
    this.addPopup('PIECES LOST', p.x, p.y - 24, 'red', 1.6);
    this.hooks.sfx('moduleLost');
  }

  /* ================================================================ */
  /* Game over / continue                                             */
  /* ================================================================ */

  enterGameover() {
    this.goToScene('gameover', 'gameover');
    this.gameoverPhase = this.continueUsed ? 'menu' : 'continue';
    this.continueTimer = GAME.continueWindow;
    this.gameoverIndex = 0;
    this.hooks.sfx('gameOver');
    this.recordRun();
  }

  updateGameover(dt, input) {
    if (this.gameoverPhase === 'continue') {
      this.continueTimer = Math.max(0, this.continueTimer - dt);
      if (input.confirm) {
        this.useContinue();
        return;
      }
      if (this.continueTimer <= 0) {
        this.gameoverPhase = 'menu';
        this.gameoverIndex = 0;
      }
      return;
    }
    // Menu: RETRY / TITLE
    if (input.down) this.gameoverIndex = (this.gameoverIndex + 1) % 2;
    if (input.up) this.gameoverIndex = (this.gameoverIndex - 1 + 2) % 2;
    if (input.confirm) {
      if (this.gameoverIndex === 0) this.startRun();
      else { this.goToScene('title', 'title'); this.hiScore = Number(getItem(KEYS.hiScore)) || this.hiScore; }
    }
  }

  useContinue() {
    if (this.continueUsed) return;
    this.continueUsed = true;
    this.continuedThisRun = true;
    this.lives = GAME.continueLives;
    this.player.revive();
    this.player.invuln = PLAYER.respawnInvuln + 1;
    this.enemyBullets.length = 0;
    this.popups.length = 0;
    this.goToScene('playing', this.stageState === 'boss' ? 'boss' : 'stage');
    this.addPopup('CONTINUE', 120, 180, 'cyan', 1.8);
    this.hooks.sfx('continue');
  }

  recordRun() {
    const updated = recordRun({
      score: this.score,
      stage: this.stage,
      loop: this.loop,
      seconds: this.runTime,
      phoenixesThisRun: this.phoenixesThisRun,
    });
    this.hiScore = Math.max(this.hiScore, updated || 0);
  }

  /* ================================================================ */
  /* UI helpers                                                       */
  /* ================================================================ */

  addPopup(text, x, y, color = 'white', life = 1.1) {
    this.popups.push({ text, x, y, color, t: 0, life });
  }

  showBanner(text, sub = '', color = 'gold', life = STAGE.introTime) {
    this.banner = { text, sub, color, t: 0, life };
  }

  /* ================================================================ */
  /* Headless helpers (tests / screenshots)                           */
  /* ================================================================ */

  /** Advance the simulation deterministically. `inputFn(t)` returns input. */
  advance(seconds, inputFn = null) {
    const step = 1 / 60;
    const steps = Math.max(0, Math.round(seconds / step));
    for (let i = 0; i < steps; i++) {
      const input = inputFn ? inputFn(i * step) : {};
      this.update(step, input);
    }
  }

  /** Jump directly to a representative situation for screenshots/tests. */
  debugScene(name, options = {}) {
    if (name === 'game' || name === 'boss' || name === 'phoenix' || name === 'gameover' || name === 'formation' || name === 'catacombs' || name === 'cathedral') {
      this.startRun();
      this.scene = 'playing';
      this.sceneTime = 0;
      if (name === 'formation') {
        this.stageState = 'waves';
        this.beginWave(0);
        this.player.invuln = 999;
        this.player.attachModule('beta');
        this.player.attachModule('gamma');
        this.player.attachModule('delta');
        this.player.startFormation(this);
        this.advance(options.sim || 1.2, () => ({ x: Math.sin(performanceNowLike(options) * 2) * 0.5, y: 0, fire: true }));
      } else if (name === 'catacombs' || name === 'cathedral') {
        this.startStage(name === 'catacombs' ? 2 : 3);
        this.player.invuln = 999;
        this.advance(options.sim || 5, () => ({ x: Math.sin(performanceNowLike(options) * 0.8) * 0.5, y: 0, fire: true }));
      } else if (name === 'game') {
        this.stageState = 'waves';
        this.beginWave(0);
        this.player.invuln = 99;
        this.player.attachModule('beta');
        this.player.attachModule('gamma');
        this.advance(options.sim || 6, () => ({ x: Math.sin(performanceNowLike(options) * 1.2) * 0, y: 0, fire: true }));
      } else if (name === 'boss') {
        this.player.invuln = 99;
        for (const id of MODULE_ORDER) this.player.attachModule(id);
        this.enemies.length = 0;
        this.enemyBullets.length = 0;
        this.stageState = 'bossWarn';
        this.stateTimer = 0;
        this.update(1 / 60, {});
        this.boss.state = 'fight';
        this.boss.y = BOSS.entryY;
        this.boss.updatePositions();
        this.advance(options.sim || 3.5, () => ({ x: 0, y: 0, fire: true }));
      } else if (name === 'phoenix') {
        for (const id of MODULE_ORDER) this.player.attachModule(id);
        this.player.startPhoenix(this);
        this.stageState = 'waves';
        this.beginWave(0);
        this.advance(options.sim || 1.6, () => ({ x: Math.sin(performanceNowLike(options) * 1.5) * 0.4, y: 0, fire: true }));
        if (this.player.hasAllModules) this.player.phoenixTime = Math.max(this.player.phoenixTime, 5);
      } else if (name === 'gameover') {
        this.score = options.score || 745320;
        this.startStage(options.stage || 3);
        this.lives = 0;
        this.goToScene('gameover', 'gameover');
        this.gameoverPhase = 'continue';
        this.continueTimer = GAME.continueWindow;
      }
      this.banner = null;
      this.popups.length = 0;
    }
    return this;
  }

  /** Snapshot for tests / debugging. */
  snapshot() {
    return {
      scene: this.scene,
      stage: this.stage,
      loop: this.loop,
      stageState: this.stageState,
      waveIndex: this.waveIndex,
      score: this.score,
      lives: this.lives,
      novas: this.novas,
      chain: this.chain,
      multiplier: this.multiplier,
      modules: this.player.modules.slice(),
      phoenixActive: this.player.phoenixActive,
      formationActive: this.player.formationActive,
      enemies: this.enemies.length,
      playerBullets: this.playerBullets.length,
      enemyBullets: this.enemyBullets.length,
      pickups: this.pickups.length,
      playerX: Math.round(this.player.x * 10) / 10,
      playerY: Math.round(this.player.y * 10) / 10,
      bossHp: this.boss ? this.boss.hp : null,
      hiScore: this.hiScore,
    };
  }
}

function d2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function performanceNowLike(options) {
  return typeof performance !== 'undefined' ? performance.now() / 1000 : (options.sim || 0);
}

export { formatScore, formationStyleForCount };
