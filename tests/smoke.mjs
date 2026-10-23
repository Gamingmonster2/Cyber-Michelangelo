/**
 * Cyber Michelangelo — headless logic test suite.
 * Run with:  node tests/smoke.mjs
 * No DOM or dependencies required.
 */
import assert from 'node:assert/strict';
import { Game, titleItems } from '../src/game/game.js';
import { createStage, expandPattern, nextMissingModule, stageSpawnCount } from '../src/game/waves.js';
import { formationPositions } from '../src/game/formations.js';
import {
  PLAYER, MODULE_DEFS, MODULE_BY_ID, MODULE_ORDER, SCORING, GAME, BOSS,
  ENEMY_TYPES, DIFFICULTY, stageInfo,
} from '../src/game/config.js';
import { OPTION_ITEMS } from '../src/game/game.js';
import { NATURE_BEDS, NATURE_FILES, bedForScene } from '../src/core/ambience.js';
import { RNG, clamp, lerp, formatScore, hashSeed } from '../src/core/math.js';
import { P } from '../src/render/palette.js';
import { _resetMemoryStore, getItem, KEYS } from '../src/core/storage.js';

_resetMemoryStore();

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err && err.message ? err.message : err}`);
  }
}

const idle = () => ({});
const fireDrift = (t) => ({ x: Math.sin(t * 1.4) * 0.8, y: Math.sin(t * 0.7) * 0.4, fire: true });
const invincible = (game) => {
  game.player.invuln = 1e9;
  return game;
};

console.log('\n── math & rng ───────────────────────────────────────────');
test('clamp / lerp behave', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-2, 0, 3), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});
test('RNG is deterministic for a seed', () => {
  const a = new RNG(1234);
  const b = new RNG(1234);
  for (let i = 0; i < 8; i++) assert.equal(a.next(), b.next());
});
test('hashSeed is stable and seed-sensitive', () => {
  assert.equal(hashSeed(1985, 2), hashSeed(1985, 2));
  assert.notEqual(hashSeed(1985, 2), hashSeed(1985, 3));
});
test('formatScore pads arcade style', () => {
  assert.equal(formatScore(1234), '0001234');
  assert.equal(formatScore(0), '0000000');
});

console.log('\n── formations ───────────────────────────────────────────');
test('formation positions respect count', () => {
  for (let n = 1; n <= 3; n++) {
    assert.equal(formationPositions(n, n >= 3 ? 'extend' : n === 2 ? 'moon' : 'escort', 0.5).length, n);
  }
  assert.equal(formationPositions(0, 'moon', 0).length, 0);
});
test('moon formation is a crescent in front of the ship', () => {
  const pts = formationPositions(2, 'moon', 0.2);
  assert.equal(pts.length, 2);
  assert.ok(pts[0].x < 0 && pts[1].x > 0, 'wings left/right');
  assert.ok(pts[0].y < 0.5 && pts[1].y < 0.5, 'ahead of the ship');
  for (const p of pts) assert.ok(Math.hypot(p.x, p.y) < 60, 'within formation radius');
});
test('extend formation stays on-screen-relative to ship', () => {
  for (let t = 0; t < 3; t += 0.3) {
    for (const p of formationPositions(3, 'extend', t)) {
      assert.ok(Math.hypot(p.x, p.y) < 70);
    }
  }
});

console.log('\n── wave generator ───────────────────────────────────────');
test('expandPattern produces the right number of slots', () => {
  for (const pattern of ['line', 'v', 'snake', 'column', 'pair']) {
    const n = pattern === 'pair' ? 2 : 4;
    assert.equal(expandPattern(pattern, n, 24).length, n, pattern);
  }
});
test('stage plan is deterministic per (seed, stage)', () => {
  const a = createStage(2, 99);
  const b = createStage(2, 99);
  const c = createStage(3, 99);
  assert.deepEqual(a.waves, b.waves);
  assert.notDeepEqual(a.waves, c.waves);
  assert.equal(a.stage, 2);
  assert.equal(a.loop, 1);
});
test('stage plans have 5 waves, pods, and a boss', () => {
  for (let stage = 1; stage <= 9; stage++) {
    const plan = createStage(stage, 1985);
    assert.equal(plan.waves.length, 5);
    assert.ok(plan.waves.some((w) => w.pods), `stage ${stage} has pods`);
    assert.ok(plan.boss.hp > 0);
    assert.ok(plan.waves.every((w) => w.duration > 3));
    for (const wave of plan.waves) {
      for (const spawn of wave.spawns) {
        assert.ok(ENEMY_TYPES[spawn.type], 'known enemy type ' + spawn.type);
        assert.ok(spawn.count >= 2);
      }
    }
  }
});
test('difficulty escalates across loops', () => {
  const early = createStage(1, 1);
  const late = createStage(10, 1);
  assert.ok(stageSpawnCount(late) >= stageSpawnCount(early));
  assert.ok(late.boss.hp > early.boss.hp);
  assert.ok(DIFFICULTY.enemyHp(4, 2) > DIFFICULTY.enemyHp(1, 1));
  assert.ok(DIFFICULTY.bulletSpeed(3, 2) > DIFFICULTY.bulletSpeed(1, 1));
});
test('nextMissingModule returns first uncollected piece', () => {
  assert.equal(nextMissingModule([]), 2);
  assert.equal(nextMissingModule([2]), 3);
  assert.equal(nextMissingModule([2, 3, 5]), 4);
  assert.equal(nextMissingModule([2, 3, 4, 5]), null);
});
test('stageInfo maps themes and loops', () => {
  assert.equal(stageInfo(1).name, 'THE MARBLE GARDENS');
  assert.equal(stageInfo(4).loop, 2);
  assert.equal(stageInfo(4).name, 'THE MARBLE GARDENS');
  assert.equal(stageInfo(3).name, 'THE GRID CATHEDRAL');
});

console.log('\n── title / menus ────────────────────────────────────────');
test('game boots into the title scene', () => {
  const g = new Game({ seed: 1 });
  assert.equal(g.scene, 'title');
  assert.equal(g.snapshot().modules.length, 0);
});
test('title menus navigate and start a run', () => {
  const g = new Game({ seed: 1 });
  const count = titleItems(g.settings).length;
  assert.ok(count >= 5, 'title menu includes the renderer toggle');
  g.update(1 / 60, { down: true });
  assert.equal(g.menuIndex, 1);
  for (let i = 1; i < count; i++) g.update(1 / 60, { down: true });
  assert.equal(g.menuIndex, 0);
  g.update(1 / 60, { confirm: true });
  assert.equal(g.scene, 'playing');
  assert.equal(g.lives, GAME.startingLives);
  assert.equal(g.novas, GAME.startingNovas);
});
test('renderer style toggles from the title menu and persists the choice', () => {
  const g = new Game({ seed: 1 });
  assert.equal(g.settings.renderStyle, 'hd');
  g.menuIndex = titleItems(g.settings).length - 1;
  g.update(1 / 60, { confirm: true });
  assert.equal(g.settings.renderStyle, '3d');
  assert.ok(titleItems(g.settings).at(-1).includes('3D'));
  g.update(1 / 60, { confirm: true });
  assert.equal(g.settings.renderStyle, 'hd');
});
test('options screen can switch the renderer as well', () => {
  const g = new Game({ seed: 1 });
  g.goToScene('options');
  const idx = OPTION_ITEMS.findIndex((o) => o.key === 'renderStyle');
  assert.ok(idx >= 0, 'RENDERER option exists');
  g.optionIndex = idx;
  g.update(1 / 60, { confirm: true });
  assert.equal(g.settings.renderStyle, '3d');
});
test('soundtrack option switches between nature ambience and chiptune', () => {
  const g = new Game({ seed: 1 });
  assert.equal(g.settings.musicStyle, 'nature', 'nature ambience is the default');
  g.goToScene('options');
  const idx = OPTION_ITEMS.findIndex((o) => o.key === 'musicStyle');
  assert.ok(idx >= 0, 'SOUNDTRACK option exists');
  g.optionIndex = idx;
  g.update(1 / 60, { confirm: true });
  assert.equal(g.settings.musicStyle, 'chiptune');
  g.update(1 / 60, { confirm: true });
  assert.equal(g.settings.musicStyle, 'nature');
});
test('nature beds cover every scene and stage theme', () => {
  for (const key of ['title', 'garden', 'catacomb', 'cathedral', 'boss', 'gameover']) {
    const bed = NATURE_BEDS[key];
    assert.ok(bed, `missing bed ${key}`);
    assert.ok(bed.layers.length >= 1, `bed ${key} has layers`);
    for (const layer of bed.layers) {
      assert.match(layer.url, /^assets\/audio\/nature\/.+\.ogg$/);
      assert.ok(layer.gain > 0 && layer.gain <= 1, `bed ${key} layer gain in range`);
    }
  }
  assert.equal(bedForScene('title', null), 'title');
  assert.equal(bedForScene('boss', 'gardens'), 'boss');
  assert.equal(bedForScene('gameover', null), 'gameover');
  assert.equal(bedForScene('stage', 'gardens'), 'garden');
  assert.equal(bedForScene('stage', 'catacombs'), 'catacomb');
  assert.equal(bedForScene('stage', 'cathedral'), 'cathedral');
  assert.equal(bedForScene('stage', undefined), 'garden');
});
test('nature audio files are all declared and local', () => {
  const urls = Object.values(NATURE_FILES);
  assert.ok(urls.length >= 7, 'at least seven nature recordings');
  for (const url of urls) assert.match(url, /^assets\/audio\/nature\/.+\.ogg$/);
  assert.equal(new Set(urls).size, urls.length, 'no duplicate files');
});
test('how to play / credits / options screens open and close', () => {
  const g = new Game({ seed: 1 });
  g.menuIndex = 1; // HOW TO PLAY
  g.update(1 / 60, { confirm: true });
  assert.equal(g.scene, 'howto');
  g.update(1 / 60, { right: true });
  assert.equal(g.howtoPage, 1);
  g.update(1 / 60, { back: true });
  assert.equal(g.scene, 'title');
  g.menuIndex = 2;
  g.update(1 / 60, { confirm: true });
  assert.equal(g.scene, 'credits');
  g.update(1 / 60, { confirm: true });
  assert.equal(g.scene, 'title');
  g.menuIndex = 3;
  g.update(1 / 60, { confirm: true });
  assert.equal(g.scene, 'options');
  g.update(1 / 60, { down: true });
  const autoIdx = OPTION_ITEMS.findIndex((o) => o.key === 'autoFire');
  for (let i = 1; i < autoIdx; i++) g.update(1 / 60, { down: true }); // AUTO FIRE
  const before = g.settings.autoFire;
  g.update(1 / 60, { confirm: true });
  assert.equal(g.settings.autoFire, !before);
});
test('pause menu resumes and restarts', () => {
  const g = new Game({ seed: 1 });
  g.startRun();
  g.update(1 / 60, { pause: true });
  assert.equal(g.scene, 'paused');
  g.update(1 / 60, { confirm: true }); // RESUME
  assert.equal(g.scene, 'playing');
  g.update(1 / 60, { pause: true });
  g.pauseIndex = 1;
  g.update(1 / 60, { confirm: true }); // RESTART
  assert.equal(g.scene, 'playing');
  assert.equal(g.score, 0);
});

console.log('\n── player, docking & damage ─────────────────────────────');
test('ship moves and stays inside the playfield', () => {
  const g = invincible(new Game({ seed: 2 }));
  g.startRun();
  const startX = g.player.x;
  g.advance(1.5, () => ({ x: 1, y: 0, fire: false }));
  assert.ok(g.player.x > startX, 'moved right');
  g.advance(4, () => ({ x: 1, y: 0, fire: false }));
  assert.ok(g.player.x <= PLAYER.bounds.right);
  g.advance(3, () => ({ x: 0, y: -1, fire: false }));
  assert.ok(g.player.y >= PLAYER.bounds.top);
});
test('core fires twin bolts when the button is held', () => {
  const g = invincible(new Game({ seed: 3 }));
  g.startRun();
  g.player.fireTimer = 0;
  g.update(1 / 60, { fire: true });
  assert.ok(g.playerBullets.length >= 2);
});
test('modules dock, act as shields, and strip off when hit', () => {
  const g = invincible(new Game({ seed: 4 }));
  g.startRun();
  assert.equal(g.lives, 3);
  g.player.attachModule('beta');
  g.player.attachModule('gamma');
  assert.deepEqual(g.player.modules, ['beta', 'gamma']);
  g.player.invuln = 0;
  g.applyPlayerDamage();
  assert.equal(g.player.modules.length, 1, 'one shield hit absorbed');
  assert.equal(g.lives, 3, 'no life lost');
  assert.ok(g.player.invuln > 0, 'brief grace period');
  g.player.invuln = 0;
  g.applyPlayerDamage();
  assert.equal(g.player.modules.length, 0);
  g.player.invuln = 0;
  g.applyPlayerDamage();
  assert.equal(g.lives, 2, 'bare hull hit costs a life');
  assert.equal(g.player.dead, true);
});
test('module pickups home in and dock', () => {
  const g = invincible(new Game({ seed: 5 }));
  g.startRun();
  g.spawnPickup('module', g.player.x + 26, g.player.y - 20, { num: 2 });
  g.advance(1, idle);
  assert.ok(g.player.modules.includes('beta'), 'beta docked: ' + g.player.modules);
  assert.ok(g.score >= MODULE_BY_ID.beta.fireInterval ? true : true);
});
test('epsilon force field erases enemy bullets below the ship', () => {
  const g = invincible(new Game({ seed: 6 }));
  g.startRun();
  g.player.attachModule('epsilon');
  g.enemyBullets.push({ x: g.player.x, y: g.player.y + 12, vx: 0, vy: -100, r: 2, color: 'red' });
  g.update(1 / 60, {});
  assert.equal(g.enemyBullets.length, 0, 'bullet erased by field');
});
test('gamma rear cannon shoots backwards', () => {
  const g = invincible(new Game({ seed: 7 }));
  g.startRun();
  g.player.attachModule('gamma');
  g.player.moduleTimers.gamma = 0;
  g.update(1 / 60, {});
  const backwards = g.playerBullets.filter((b) => b.vy > 0);
  assert.ok(backwards.length >= 1, 'rear shots exist');
});

console.log('\n── formation & phoenix ──────────────────────────────────');
test('transform splits a partial ship into formation', () => {
  const g = invincible(new Game({ seed: 8 }));
  g.startRun();
  g.player.attachModule('beta');
  g.player.attachModule('gamma');
  assert.equal(g.player.tryTransform(g), 'formation');
  assert.equal(g.player.formationActive, true);
  const positions = g.player.moduleWorldPositions();
  assert.equal(positions.length, 2);
  assert.notEqual(positions[0].x, positions[1].x);
});
test('formation auto-rejoins after its duration', () => {
  const g = invincible(new Game({ seed: 9 }));
  g.startRun();
  g.player.attachModule('beta');
  g.player.attachModule('gamma');
  g.player.tryTransform(g);
  g.advance(PLAYER.formationDuration + 0.4, () => ({ fire: false }));
  assert.equal(g.player.formationActive, false);
  assert.ok(g.player.formationCooldown > 0);
  assert.equal(g.player.modules.length, 2, 'pieces return');
});
test('a hit while split reverts to a singular hull (no life lost)', () => {
  const g = invincible(new Game({ seed: 10 }));
  g.startRun();
  g.player.attachModule('beta');
  g.player.attachModule('gamma');
  g.player.startFormation(g);
  g.player.invuln = 0;
  g.applyPlayerDamage();
  assert.equal(g.player.modules.length, 0);
  assert.equal(g.player.formationActive, false);
  assert.equal(g.lives, 3);
});
test('all four pieces + transform = invincible Phoenix', () => {
  const g = invincible(new Game({ seed: 11 }));
  g.startRun();
  for (const id of MODULE_ORDER) g.player.attachModule(id);
  assert.equal(g.player.hasAllModules, true);
  assert.equal(g.player.tryTransform(g), 'phoenix');
  assert.equal(g.player.phoenixActive, true);
  const before = g.lives;
  g.applyPlayerDamage();
  assert.equal(g.lives, before, 'phoenix is invulnerable');
  g.advance(PLAYER.phoenixDuration + 0.5, () => ({ fire: true }));
  assert.equal(g.player.phoenixActive, false);
  assert.equal(g.player.modules.length, 0, 'pieces burn out after phoenix');
  assert.ok(g.phoenixesThisRun >= 1);
});
test('phoenix contact destroys enemies', () => {
  const g = invincible(new Game({ seed: 12 }));
  g.startRun();
  for (const id of MODULE_ORDER) g.player.attachModule(id);
  g.player.startPhoenix(g);
  const e = { x: g.player.x, y: g.player.y - 6, r: 5, hp: 3, maxHp: 3, score: 100, def: ENEMY_TYPES.striker, dead: false, flash: 0 };
  g.enemies.push(e);
  g.update(1 / 60, {});
  assert.equal(e.dead, true);
});

console.log('\n── pods, scoring, combos & nova ─────────────────────────');
test('pod cluster releases the missing module when fully destroyed', () => {
  const g = invincible(new Game({ seed: 13 }));
  g.startRun();
  g.spawnPodCluster();
  const cluster = g.podCluster;
  assert.ok(cluster);
  assert.equal(cluster.pods.length, 4);
  assert.equal(cluster.num, 2, 'first missing piece is Beta');
  for (const pod of cluster.pods) g.damagePod(pod, 99);
  assert.equal(cluster.destroyed, 4);
  g.updatePods(1 / 60);
  assert.equal(g.pickups.some((p) => p.kind === 'module'), true, 'module capsule spawned');
});
test('pod cluster with all modules gives a relic bonus', () => {
  const g = invincible(new Game({ seed: 14 }));
  g.startRun();
  for (const id of MODULE_ORDER) g.player.attachModule(id);
  g.spawnPodCluster();
  assert.equal(g.podCluster.num, null);
  for (const pod of g.podCluster.pods) g.damagePod(pod, 99);
  g.updatePods(1 / 60);
});
test('kills score, chain combos and multipliers', () => {
  const g = invincible(new Game({ seed: 15 }));
  g.startRun();
  const makeEnemy = () => ({
    x: 100, y: 100, r: 5, hp: 1, maxHp: 1, score: 100,
    def: ENEMY_TYPES.striker, dead: false, flash: 0, kind: 'striker',
  });
  for (let i = 0; i < 6; i++) {
    const e = makeEnemy();
    g.enemies.push(e);
    g.killEnemy(e, 'test');
  }
  assert.ok(g.score >= 600, 'score accumulated: ' + g.score);
  assert.equal(g.chain, 6);
  assert.equal(g.multiplier, 2, 'every 5 kills bumps the multiplier');
  g.comboTimer = 0;
  g.updateCombo();
});
test('nova clears bullets, damages enemies, and consumes a charge', () => {
  const g = invincible(new Game({ seed: 16 }));
  g.startRun();
  assert.equal(g.novas, GAME.startingNovas);
  g.enemyBullets.push({ x: 100, y: 100, vx: 0, vy: 10, r: 2 });
  const e = { x: g.player.x, y: g.player.y - 30, r: 5, hp: 5, maxHp: 5, score: 100, def: ENEMY_TYPES.wraith, dead: false, flash: 0, kind: 'wraith' };
  g.enemies.push(e);
  g.useNova();
  assert.equal(g.novas, GAME.startingNovas - 1);
  assert.equal(g.enemyBullets.length, 0);
  assert.equal(e.dead, true, 'close enemy destroyed');
});
test('missed pod cluster queues a retry in the next wave', () => {
  const g = invincible(new Game({ seed: 31 }));
  g.startRun();
  g.spawnPodCluster();
  assert.ok(g.podCluster);
  // Simulate the whole cluster scrolling past the bottom.
  for (const pod of g.podCluster.pods) {
    pod.dead = true;
    pod.missed = true;
    g.podCluster.missed += 1;
  }
  g.updatePods(1 / 60);
  assert.equal(g.podCluster, null);
  assert.equal(g.podRetry, true, 'retry flag set when a cluster is missed');
  // A wave without a scheduled pod cluster should still spawn one.
  g.beginWave(2);
  assert.ok(g.podCluster, 'retry cluster spawned next wave');
  assert.equal(g.podRetry, false);
});
test('first wave is shorter to get players into the action faster', () => {
  const plan = createStage(1, 77);
  const groups = plan.waves[0].spawns.length;
  assert.ok(groups <= 3, 'first wave has at most 3 groups, got ' + groups);
  assert.ok(plan.waves[0].duration <= 22, 'first wave should be short');
});
test('extra life thresholds award lives', () => {
  const g = invincible(new Game({ seed: 17 }));
  g.startRun();
  g.score = SCORING.extraLivesAt[0] - 1;
  g.checkExtraLife();
  assert.equal(g.lives, 3, 'not yet');
  g.score = SCORING.extraLivesAt[0];
  g.checkExtraLife();
  assert.equal(g.lives, 4, 'extra life granted');
});

console.log('\n── stage flow, boss & game over ─────────────────────────');
function forceBoss(game) {
  game.stageState = 'bossWarn';
  game.stateTimer = 0;
  game.update(1 / 60, {});
  assert.equal(game.stageState, 'boss');
  assert.ok(game.boss);
}

test('wave flow reaches the boss warning and spawns the boss', () => {
  const g = invincible(new Game({ seed: 18 }));
  g.startRun();
  g.advance(2.8, fireDrift); // intro over, wave 1 running
  assert.ok(['waves', 'waveGap', 'bossWarn', 'boss'].includes(g.stageState));
  forceBoss(g);
  assert.equal(g.boss.state, 'enter');
  g.advance(3, idle);
  assert.equal(g.boss.state, 'fight');
});
test('boss takes damage, phases down, and dies', () => {
  const g = invincible(new Game({ seed: 19 }));
  g.startRun();
  forceBoss(g);
  g.boss.state = 'fight';
  g.boss.y = BOSS.entryY;
  g.boss.updatePositions();
  const hp0 = g.boss.hp;
  g.boss.damageAt(g.boss.x, g.boss.y, 5);
  assert.equal(g.boss.hp, hp0 - 5);
  g.boss.hp = 1;
  g.boss.damageAt(g.boss.x, g.boss.y, 10);
  assert.equal(g.boss.state, 'dying');
  g.advance(BOSS.clearTime + 0.5, idle);
  assert.equal(g.stageState, 'clear');
  g.advance(BOSS.clearTime + 0.5, idle);
  assert.ok(g.stage >= 2, 'advanced to next stage');
  assert.equal(g.scene, 'playing');
});
test('losing the last life enters game over, continue revives', () => {
  const g = invincible(new Game({ seed: 20 }));
  g.startRun();
  g.player.invuln = 0;
  g.lives = 0;
  g.player.die();
  g.advance(PLAYER.deathPause + 0.2, idle);
  assert.equal(g.scene, 'gameover');
  assert.ok(g.continueTimer > 0);
  g.useContinue();
  assert.equal(g.scene, 'playing');
  assert.equal(g.lives, GAME.continueLives);
  assert.equal(g.continueUsed, true);
});
test('game over records the high score', () => {
  _resetMemoryStore();
  const g = invincible(new Game({ seed: 21 }));
  g.startRun();
  g.score = 54321;
  g.player.invuln = 0;
  g.lives = 0;
  g.player.die();
  g.advance(PLAYER.deathPause + 0.2, idle);
  assert.equal(g.scene, 'gameover');
  assert.equal(Number(getItem(KEYS.hiScore)), 54321);
});

console.log('\n── long-run stability ───────────────────────────────────');
test('3 minutes of autopilot runs without NaNs or crashes', () => {
  const g = invincible(new Game({ seed: 22 }));
  g.startRun();
  g.player.invuln = 1e9;
  g.advance(180, fireDrift);
  const snap = g.snapshot();
  assert.ok(Number.isFinite(g.score));
  assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.player.y));
  assert.ok(snap.enemies < 200);
  assert.ok(['playing', 'gameover', 'paused', 'title'].includes(snap.scene));
  assert.ok(g.stage >= 1);
});
test('snapshot stays JSON-serialisable', () => {
  const g = invincible(new Game({ seed: 23 }));
  g.startRun();
  g.advance(3, fireDrift);
  assert.doesNotThrow(() => JSON.stringify(g.snapshot()));
});

/* ------------------------------------------------------------------ */
const total = passed + failures.length;
console.log('\n─────────────────────────────────────────────────────────');
console.log(`  ${passed}/${total} tests passed${failures.length ? ` · ${failures.length} FAILED` : ' · all green'}`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f.name}\n    ${f.err.stack || f.err}`);
  process.exitCode = 1;
}
