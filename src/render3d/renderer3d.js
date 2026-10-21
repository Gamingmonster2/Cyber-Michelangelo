/**
 * Optional 3D renderer (Phase 2).
 *
 * Renders the *same* DOM-free game state with three.js on an underlay canvas:
 * the 2D HD renderer keeps drawing bullets, particles, HUD and menus on top.
 * The classic HD-2D renderer remains the default and the safe fallback.
 *
 * Mapping: 1 world unit = 10 logical pixels. Screen +x = world +x,
 * screen +y (down) = world -y, so gameplay positions map 1:1.
 */
import * as THREE from '../../vendor/three/three.module.min.js';
import { P, THEMES } from '../render/palette.js';

const W = 240;
const H = 420;
const U = 0.1; // world units per logical pixel
const X0 = 120;
const Y0 = 210;

const wx = (x) => (x - X0) * U;
const wy = (y) => (Y0 - y) * U;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const glowTexCache = new Map();
function glowTexture(color) {
  if (glowTexCache.has(color)) return glowTexCache.get(color);
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowTexCache.set(color, tex);
  return tex;
}

function glowSprite(color, scale = 1) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture(color),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

function material(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: opts.metal ?? 0.45,
    roughness: opts.rough ?? 0.5,
    emissive: new THREE.Color(opts.emissive || '#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 12, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  octa: new THREE.OctahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.16, 8, 20),
  plane: new THREE.PlaneGeometry(1, 1),
};

function mesh(geo, mat, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Sky texture                                                         */
/* ------------------------------------------------------------------ */

function makeSkyTexture(theme) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 672;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, theme.skyTop);
  g.addColorStop(0.35, theme.skyMid);
  g.addColorStop(0.75, theme.skyLow);
  g.addColorStop(1, '#07040f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Nebula clouds.
  const tints = [theme.haze, theme.accent2, theme.accent, theme.planet];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 9; i++) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const r = 60 + rand() * 180;
    const col = tints[i % tints.length];
    const ng = ctx.createRadialGradient(x, y, 0, x, y, r);
    ng.addColorStop(0, col + '44');
    ng.addColorStop(0.6, col + '18');
    ng.addColorStop(1, col + '00');
    ctx.fillStyle = ng;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Stars.
  for (let i = 0; i < 260; i++) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.6})`;
    ctx.fillRect(x, y, rand() < 0.9 ? 1 : 2, rand() < 0.9 ? 1 : 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Ship & prop factories                                               */
/* ------------------------------------------------------------------ */

function buildModule(id) {
  const group = new THREE.Group();
  if (id === 'beta') {
    const body = mesh(GEO.box, material(P.steelMid, { metal: 0.7, rough: 0.35 }), 0.75, 0.7, 0.6);
    group.add(body);
    for (const s of [-1, 1]) {
      const barrel = mesh(GEO.cyl6, material(P.steelSh, { metal: 0.8, rough: 0.3 }), 0.11, 0.65, 0.11, s * 0.2, 0.62, 0);
      group.add(barrel);
      group.add(glowSprite(P.cyan, 0.7).translateY(1));
    }
    const stripe = mesh(GEO.box, material(P.cyan, { emissive: P.cyan, emissiveIntensity: 0.9 }), 0.7, 0.12, 0.62, 0, 0.1, 0.01);
    group.add(stripe);
  } else if (id === 'gamma') {
    group.add(mesh(GEO.box, material(P.steelMid, { metal: 0.7, rough: 0.35 }), 0.75, 0.7, 0.6));
    for (const s of [-1, 1]) {
      const barrel = mesh(GEO.cyl6, material(P.steelSh), 0.11, 0.55, 0.11, s * 0.22, -0.55, 0);
      group.add(barrel);
    }
    group.add(mesh(GEO.box, material(P.magenta, { emissive: P.magenta, emissiveIntensity: 1 }), 0.6, 0.12, 0.62, 0, -0.1, 0.01));
  } else if (id === 'delta') {
    const crystal = mesh(GEO.octa, material(P.gold, { metal: 0.9, rough: 0.15, emissive: P.gold, emissiveIntensity: 0.6 }), 0.34, 0.75, 0.34);
    group.add(crystal);
    group.add(glowSprite(P.goldHi, 1.4));
  } else {
    const ring = mesh(GEO.torus, material(P.green, { metal: 0.6, emissive: P.green, emissiveIntensity: 0.9 }), 0.34, 0.34, 0.34);
    group.add(ring);
    group.add(mesh(GEO.sphere, material(P.greenHi, { emissive: P.greenHi, emissiveIntensity: 0.8 }), 0.12, 0.12, 0.12));
    group.add(glowSprite(P.green, 1.1));
  }
  return group;
}

function buildPlayer() {
  const group = new THREE.Group();
  const marble = material(P.marble, { metal: 0.35, rough: 0.4 });
  const marbleHi = material(P.marbleHi, { metal: 0.3, rough: 0.35 });
  const gold = material(P.gold, { metal: 0.9, rough: 0.2, emissive: P.gold, emissiveIntensity: 0.25 });
  const dark = material(P.steelDeep, { metal: 0.7, rough: 0.4 });
  const canopyMat = material(P.cyanDeep, { metal: 0.9, rough: 0.1, emissive: P.cyan, emissiveIntensity: 1.1 });

  // Fuselage (nose points +Y).
  group.add(mesh(GEO.cyl6, marble, 0.34, 2.2, 0.3, 0, 0, 0));
  group.add(mesh(GEO.cone6, marbleHi, 0.34, 1.0, 0.3, 0, 1.55, 0));
  group.add(mesh(GEO.cone6, gold, 0.14, 0.5, 0.14, 0, 2.25, 0));
  // Canopy.
  const canopy = mesh(GEO.sphere, canopyMat, 0.26, 0.5, 0.22, 0, 0.55, 0.24);
  group.add(canopy);
  // Wings (swept, with gold leading edge).
  for (const s of [-1, 1]) {
    const wing = mesh(GEO.box, marble, 1.45, 0.55, 0.12, s * 1.0, -0.25, 0);
    wing.rotation.z = s * -0.14;
    wing.rotation.y = s * 0.18;
    group.add(wing);
    const trim = mesh(GEO.box, gold, 1.45, 0.07, 0.14, s * 1.0, -0.02, 0.01);
    trim.rotation.z = s * -0.14;
    trim.rotation.y = s * 0.18;
    group.add(trim);
    // Wingtip engine pod.
    const pod = mesh(GEO.cyl8, dark, 0.16, 0.6, 0.16, s * 1.5, -0.55, 0);
    group.add(pod);
    const flame = glowSprite(P.cyan, 0.9);
    flame.position.set(s * 1.5, -1.0, 0);
    group.add(flame);
  }
  // Engines.
  for (const s of [-1, 1]) {
    group.add(mesh(GEO.cyl8, dark, 0.2, 0.8, 0.2, s * 0.45, -0.85, 0));
    const flame = glowSprite(P.cyanHi, 1.1);
    flame.position.set(s * 0.45, -1.45, 0);
    group.add(flame);
  }
  // Tail fins.
  for (const s of [-1, 1]) {
    const fin = mesh(GEO.box, gold, 0.1, 0.5, 0.4, s * 0.5, -1.15, 0);
    fin.rotation.z = s * 0.25;
    group.add(fin);
  }
  group.userData.flames = group.children.filter((c) => c.isSprite);
  group.userData.canopy = canopy;
  return group;
}

function buildPhoenix() {
  const group = new THREE.Group();
  const gold = material(P.gold, { metal: 0.8, rough: 0.25, emissive: P.gold, emissiveIntensity: 0.9 });
  const orange = material(P.orange, { metal: 0.4, rough: 0.4, emissive: P.orange, emissiveIntensity: 1.1 });
  const white = material(P.marbleHi, { metal: 0.2, rough: 0.3, emissive: P.goldHi, emissiveIntensity: 0.8 });
  group.add(mesh(GEO.cone6, white, 0.3, 1.6, 0.3, 0, 0.4, 0));
  group.add(mesh(GEO.sphere, gold, 0.42, 0.55, 0.42, 0, -0.4, 0.1));
  for (const s of [-1, 1]) {
    const wing = mesh(GEO.box, orange, 2.0, 0.5, 0.08, s * 1.25, 0.1, 0);
    wing.rotation.z = s * 0.45;
    wing.rotation.y = s * -0.25;
    group.add(wing);
    const feather = mesh(GEO.box, gold, 1.2, 0.2, 0.1, s * 0.9, -0.35, 0.02);
    feather.rotation.z = s * 0.3;
    group.add(feather);
    const tip = glowSprite(P.orangeHi, 1.6);
    tip.position.set(s * 2.1, 0.4, 0);
    group.add(tip);
  }
  const tail = glowSprite(P.orange, 2.4);
  tail.position.set(0, -1.3, 0);
  group.add(tail);
  group.userData.wings = group.children.filter((c) => c.geometry === GEO.box);
  group.userData.flames = group.children.filter((c) => c.isSprite);
  return group;
}

/* ------------------------------------------------------------------ */
/* Enemy models                                                        */
/* ------------------------------------------------------------------ */

function buildEnemyModel(kind) {
  const group = new THREE.Group();
  const steel = material(P.steel, { metal: 0.7, rough: 0.4 });
  const steelDark = material(P.steelSh, { metal: 0.6, rough: 0.5 });
  const steelHi = material(P.steelHi, { metal: 0.8, rough: 0.3 });
  const magenta = material(P.magenta, { metal: 0.5, rough: 0.35, emissive: P.magenta, emissiveIntensity: 0.8 });
  const violet = material(P.violet, { metal: 0.5, rough: 0.35, emissive: P.violet, emissiveIntensity: 0.8 });
  const green = material(P.green, { metal: 0.4, rough: 0.4, emissive: P.green, emissiveIntensity: 1.0 });
  const cyan = material(P.cyan, { metal: 0.5, rough: 0.3, emissive: P.cyan, emissiveIntensity: 1.0 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.white) });
  const cores = [];

  if (kind === 'striker') {
    const hull = mesh(GEO.cone4, steel, 0.55, 1.4, 0.4);
    hull.rotation.x = Math.PI; // nose down
    group.add(hull);
    for (const s of [-1, 1]) {
      const wing = mesh(GEO.box, steelDark, 1.3, 0.25, 0.16, s * 0.85, 0.2, 0);
      wing.rotation.z = s * 0.2;
      group.add(wing);
    }
    const eye = mesh(GEO.sphere, green, 0.16, 0.16, 0.16, 0, 0.4, 0.2);
    group.add(eye);
    group.add(glowSprite(P.green, 0.8).translateZ(0.3).translateY(0.4));
    cores.push(eye.material);
  } else if (kind === 'wraith') {
    group.add(mesh(GEO.sphere, steelDark, 0.5, 0.55, 0.32));
    for (const s of [-1, 1]) {
      const wing = mesh(GEO.box, magenta, 1.5, 0.4, 0.12, s * 0.95, 0.05, 0);
      wing.rotation.z = s * -0.25;
      group.add(wing);
    }
    const core = mesh(GEO.sphere, magenta, 0.24, 0.24, 0.24, 0, 0.1, 0.28);
    group.add(core);
    group.add(glowSprite(P.magenta, 1.2).translateZ(0.4));
    cores.push(core.material);
  } else if (kind === 'sentinel') {
    group.add(mesh(GEO.cyl8, steelDark, 1.0, 0.3, 1.0, 0, -0.5, 0));
    group.add(mesh(GEO.sphere, steel, 0.7, 0.55, 0.7, 0, 0.1, 0));
    group.add(mesh(GEO.cyl6, steelHi, 0.16, 0.9, 0.16, 0, -0.2, 0.55));
    const core = mesh(GEO.sphere, magenta, 0.2, 0.2, 0.2, 0, 0.1, 0.55);
    group.add(core);
    group.add(glowSprite(P.magenta, 1.0).translateZ(0.6));
    cores.push(core.material);
  } else if (kind === 'goliath') {
    group.add(mesh(GEO.box, steel, 2.0, 1.1, 0.7));
    group.add(mesh(GEO.box, steelDark, 2.4, 0.4, 0.5, 0, -0.4, 0));
    for (const s of [-1, 1]) {
      group.add(mesh(GEO.cyl8, steelHi, 0.28, 1.3, 0.28, s * 1.25, -0.2, 0));
      const muzzle = glowSprite(P.magenta, 0.9);
      muzzle.position.set(s * 1.25, -1.0, 0.1);
      group.add(muzzle);
    }
    const reactor = mesh(GEO.sphere, magenta, 0.36, 0.36, 0.36, 0, 0.1, 0.45);
    group.add(reactor);
    group.add(glowSprite(P.magenta, 1.6).translateZ(0.5));
    cores.push(reactor.material);
  } else if (kind === 'seraph') {
    group.add(mesh(GEO.sphere, steel, 0.62, 0.62, 0.62));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spike = mesh(GEO.cone6, steelDark, 0.1, 0.7, 0.1, Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0);
      spike.rotation.z = a - Math.PI / 2;
      group.add(spike);
    }
    const core = mesh(GEO.sphere, green, 0.3, 0.3, 0.3, 0, 0, 0.4);
    group.add(core);
    group.add(glowSprite(P.green, 1.3).translateZ(0.5));
    cores.push(core.material);
  } else if (kind === 'vesper') {
    const hull = mesh(GEO.cone4, magenta, 0.4, 1.3, 0.28);
    hull.rotation.x = Math.PI;
    group.add(hull);
    for (const s of [-1, 1]) {
      const wing = mesh(GEO.box, magenta, 0.8, 0.18, 0.1, s * 0.5, 0.2, 0);
      group.add(wing);
    }
    group.add(glowSprite(P.orange, 0.8).translateY(0.9));
    cores.push(magenta);
  } else if (kind === 'lance') {
    group.add(mesh(GEO.cyl8, steel, 0.42, 1.3, 0.42));
    const barrel = mesh(GEO.cyl6, steelHi, 0.13, 1.8, 0.13, 0, -1.2, 0);
    group.add(barrel);
    const core = mesh(GEO.sphere, violet, 0.22, 0.22, 0.22, 0, 0.1, 0.35);
    group.add(core);
    group.add(glowSprite(P.violet, 1.1).translateZ(0.4));
    cores.push(core.material);
  } else if (kind === 'aegis') {
    group.add(mesh(GEO.cyl6, steel, 0.85, 0.9, 0.85));
    const shield = mesh(GEO.torus, cyan, 0.9, 0.9, 1.2, 0, 0, 0.2);
    shield.rotation.x = Math.PI / 2;
    group.add(shield);
    const core = mesh(GEO.sphere, cyan, 0.24, 0.24, 0.24, 0, 0, 0.5);
    group.add(core);
    group.add(glowSprite(P.cyan, 1.2).translateZ(0.6));
    cores.push(core.material);
  } else {
    group.add(mesh(GEO.box, steel, 1, 1, 0.6));
    cores.push(steel);
  }
  group.rotation.z = Math.PI; // face down toward the player
  group.userData.cores = cores;
  return group;
}

function buildPod(pod) {
  const group = new THREE.Group();
  const color = pod.num == null
    ? P.gold
    : { 2: P.cyan, 3: P.magenta, 4: P.gold, 5: P.green }[pod.num] || P.cyan;
  const deep = pod.num == null ? P.goldDeep : P.steelDeep;
  group.add(mesh(GEO.cyl8, material(P.marble, { metal: 0.2, rough: 0.6 }), 0.5, 0.5, 0.5, 0, -0.4, 0));
  group.add(mesh(GEO.box, material(P.marbleMid, { metal: 0.2, rough: 0.6 }), 0.9, 0.18, 0.9, 0, -0.7, 0));
  const crystal = mesh(GEO.octa, material(color, {
    metal: 0.4, rough: 0.15, emissive: color, emissiveIntensity: 1.0,
  }), 0.32, 0.42, 0.32, 0, 0.1, 0);
  group.add(crystal);
  group.add(glowSprite(color, 1.6).translateY(0.1));
  group.add(mesh(GEO.torus, material(deep, { emissive: color, emissiveIntensity: 0.4 }), 0.7, 0.7, 0.7, 0, -0.15, 0));
  group.userData.crystal = crystal;
  return group;
}

function buildPickup(kind, color) {
  const group = new THREE.Group();
  if (kind === 'gem') {
    group.add(mesh(GEO.octa, material(color, { metal: 0.6, rough: 0.1, emissive: color, emissiveIntensity: 0.9 }), 0.28, 0.4, 0.28));
  } else if (kind === 'module') {
    group.add(mesh(GEO.octa, material(color, { metal: 0.7, rough: 0.2, emissive: color, emissiveIntensity: 0.8 }), 0.4, 0.55, 0.4));
    group.add(mesh(GEO.torus, material(P.marbleHi, { emissive: color, emissiveIntensity: 0.5 }), 0.6, 0.6, 0.6));
  } else if (kind === 'nova') {
    group.add(mesh(GEO.sphere, material(P.orange, { metal: 0.5, rough: 0.3, emissive: P.orange, emissiveIntensity: 1.1 }), 0.42, 0.42, 0.42));
  } else {
    group.add(mesh(GEO.sphere, material(P.red, { metal: 0.3, rough: 0.4, emissive: P.red, emissiveIntensity: 0.9 }), 0.35, 0.3, 0.35));
  }
  group.add(glowSprite(color, 1.3));
  return group;
}

/* ------------------------------------------------------------------ */
/* Boss model                                                          */
/* ------------------------------------------------------------------ */

function buildBoss() {
  const group = new THREE.Group();
  const marble = material(P.marble, { metal: 0.35, rough: 0.45 });
  const marbleSh = material(P.marbleSh, { metal: 0.3, rough: 0.5 });
  const gold = material(P.gold, { metal: 0.9, rough: 0.2, emissive: P.gold, emissiveIntensity: 0.4 });
  const dark = material(P.outline, { metal: 0.6, rough: 0.5 });

  const head = new THREE.Group();
  // Sculpted mask base.
  head.add(mesh(GEO.sphere, marbleSh, 2.6, 2.9, 1.0));
  head.add(mesh(GEO.sphere, marble, 2.3, 2.6, 0.9, 0, 0.05, 0.35));
  // Brow and nose.
  head.add(mesh(GEO.box, marble, 2.2, 0.42, 0.5, 0, 0.85, 0.85));
  head.add(mesh(GEO.box, marbleSh, 0.4, 1.2, 0.32, 0, 0.1, 1.08));
  // Eye sockets + emissive eyes.
  const eyes = [];
  for (const s of [-1, 1]) {
    head.add(mesh(GEO.box, dark, 1.05, 0.8, 0.22, s * 0.92, 0.42, 0.92));
    head.add(mesh(GEO.box, marbleSh, 0.9, 0.2, 0.3, s * 0.92, 0.86, 0.98));
    const eye = mesh(GEO.sphere, material(P.magenta, {
      emissive: P.magenta, emissiveIntensity: 1.8, metal: 0.3, rough: 0.2,
    }), 0.42, 0.42, 0.3, s * 0.92, 0.4, 1.08);
    head.add(eye);
    const halo = glowSprite(P.magenta, 1.5);
    halo.position.set(s * 0.92, 0.4, 1.2);
    head.add(halo);
    eyes.push(eye);
  }
  // Mouth grille.
  head.add(mesh(GEO.box, dark, 1.7, 0.75, 0.24, 0, -0.95, 0.98));
  for (let i = 0; i < 6; i++) {
    head.add(mesh(GEO.box, material(P.magenta, { emissive: P.magenta, emissiveIntensity: 1.1 }), 0.14, 0.5, 0.14, -0.65 + i * 0.26, -0.95, 1.1));
  }
  // Jaw / chin.
  head.add(mesh(GEO.box, marble, 1.5, 0.5, 0.7, 0, -1.5, 0.6));
  head.add(mesh(GEO.box, gold, 1.5, 0.12, 0.76, 0, -1.7, 0.6));
  // Cheek fins.
  for (const s of [-1, 1]) {
    head.add(mesh(GEO.box, marbleSh, 0.4, 0.9, 0.9, s * 2.0, -0.35, 0.35));
  }
  // Crown.
  head.add(mesh(GEO.box, gold, 2.6, 0.4, 0.5, 0, 2.4, 0.5));
  for (let i = 0; i < 5; i++) {
    const rise = i === 2 ? 1.1 : i % 2 === 0 ? 0.6 : 0.8;
    head.add(mesh(GEO.cone4, gold, 0.26, rise, 0.26, -1.0 + i * 0.5, 2.7 + rise / 2, 0.5));
  }
  // Cheek plates.
  for (const s of [-1, 1]) {
    head.add(mesh(GEO.box, marbleSh, 0.45, 1.4, 0.5, s * 1.75, -0.1, 0.55));
    head.add(mesh(GEO.box, gold, 0.1, 1.2, 0.1, s * 1.9, -0.1, 0.68));
  }
  group.add(head);

  // Floating fists.
  const hands = new THREE.Group();
  const handModels = [];
  for (const s of [-1, 1]) {
    const hand = new THREE.Group();
    hand.add(mesh(GEO.box, marbleSh, 1.5, 1.4, 1.2));
    hand.add(mesh(GEO.box, marble, 1.25, 1.2, 1.05, 0, 0.05, 0.15));
    // Knuckle plates.
    for (let i = 0; i < 3; i++) {
      hand.add(mesh(GEO.box, marble, 0.32, 0.28, 0.2, -0.42 + i * 0.42, 0.62, 0.5));
    }
    // Gold cuff.
    hand.add(mesh(GEO.cyl8, gold, 0.95, 0.3, 0.95, 0, 0.95, 0));
    // Eye.
    const eye = mesh(GEO.sphere, material(P.cyan, {
      emissive: P.cyan, emissiveIntensity: 1.6, metal: 0.2, rough: 0.2,
    }), 0.2, 0.2, 0.2, 0, -0.1, 0.62);
    hand.add(eye);
    const halo = glowSprite(P.cyan, 0.9);
    halo.position.set(0, -0.1, 0.75);
    hand.add(halo);
    hand.userData.eye = eye;
    handModels.push({ group: hand, side: s });
    hands.add(hand);
  }
  group.add(hands);

  group.userData.head = head;
  group.userData.hands = handModels;
  group.userData.eyes = eyes;
  return group;
}

/* ------------------------------------------------------------------ */
/* Renderer3D                                                          */
/* ------------------------------------------------------------------ */

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ready = false;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.themeId = null;
    this.props = [];
    this.enemyPools = new Map();
    this.podPool = [];
    this.pickupPools = new Map();
    this.time = 0;
    this._tmp = new THREE.Vector3();
  }

  /** Returns true when a WebGL context and scene were created. */
  init() {
    if (this.ready) return true;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      this.renderer.setPixelRatio(1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    } catch (err) {
      console.warn('[3d] WebGL init failed:', err);
      return false;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05040c);
    this.scene.fog = new THREE.FogExp2(0x05040c, 0.0062);

    this.camera = new THREE.PerspectiveCamera(16, W / H, 1, 400);
    this.camera.position.set(0, 14, 150);
    this.camera.lookAt(0, 0, 0);

    // Lights.
    const hemi = new THREE.HemisphereLight(0x9fb6ff, 0x2a1030, 1.1);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1d6, 2.6);
    key.position.set(24, 40, 60);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fdfff, 1.2);
    rim.position.set(-30, -10, 20);
    this.scene.add(rim);
    this.playerLight = new THREE.PointLight(0x5ef2ff, 24, 26, 2);
    this.scene.add(this.playerLight);
    this.bossLight = new THREE.PointLight(0xff5fb0, 0, 60, 2);
    this.scene.add(this.bossLight);

    // Sky backdrop.
    this.skyMat = new THREE.MeshBasicMaterial({ fog: false, color: new THREE.Color(0x94a8cc) });
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.skyMat);
    this.sky.position.set(0, 0, -120);
    this.sky.scale.set(64, 112, 1);
    this.scene.add(this.sky);

    // Starfield.
    const starCount = 420;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 2] = -160 + Math.random() * 170;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xdfefff, size: 0.18, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.scene.add(this.stars);

    // Player craft + phoenix.
    this.player = buildPlayer();
    this.player.scale.setScalar(1.28);
    this.player.position.set(0, -10, 2.8);
    this.scene.add(this.player);
    this.modules = {};
    for (const id of ['beta', 'gamma', 'delta', 'epsilon']) {
      const m = buildModule(id);
      m.visible = false;
      this.player.add(m);
      this.modules[id] = m;
    }
    this.phoenix = buildPhoenix();
    this.phoenix.scale.setScalar(1.2);
    this.phoenix.visible = false;
    this.scene.add(this.phoenix);

    // Boss.
    this.boss = buildBoss();
    this.boss.scale.setScalar(1.22);
    this.boss.visible = false;
    this.scene.add(this.boss);

    this.ready = true;
    return true;
  }

  resize(cssW, cssH, dpr) {
    if (!this.ready) return;
    const pixelWidth = Math.max(64, Math.round(cssW * dpr));
    const pixelHeight = Math.max(64, Math.round(cssH * dpr));
    this.renderer.setSize(pixelWidth, pixelHeight, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  applyTheme(theme) {
    if (this.themeId === theme.id) return;
    this.themeId = theme.id;
    if (this.skyMat.map) this.skyMat.map.dispose();
    this.skyMat.map = makeSkyTexture(theme);
    this.skyMat.needsUpdate = true;
    const fogColor = new THREE.Color(theme.skyLow);
    this.scene.fog.color.copy(fogColor);
    this.scene.background = new THREE.Color(theme.skyLow);
    this.buildProps(theme);
  }

  buildProps(theme) {
    for (const p of this.props) {
      this.scene.remove(p.group);
      disposeTree(p.group);
    }
    this.props = [];
      const rand = (a, b) => a + Math.random() * (b - a);
      const count = 18;
      for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        if (theme.id === 'gardens') {
          // Floating temple fragment (bigger and deeper than the 2D props).
          const w = rand(3.2, 6.4);
          group.add(mesh(GEO.box, material(P.marbleMid, { metal: 0.2, rough: 0.65 }), w, 0.5, rand(1.8, 3.4)));
          group.add(mesh(GEO.box, material(P.marbleDeep, { metal: 0.2, rough: 0.7 }), w * 0.94, 0.5, rand(1.6, 3), 0, -0.5, 0));
          for (let c = 0; c < 3; c++) {
            group.add(mesh(GEO.cyl8, material(P.marble, { metal: 0.2, rough: 0.6 }), 0.2, rand(1.4, 2.8), 0.2, -1.2 + c * 1.2, 0.9, 0));
          }
          group.add(mesh(GEO.cone4, material(P.gold, { metal: 0.8, rough: 0.3, emissive: P.gold, emissiveIntensity: 0.3 }), 1.6, 0.9, 1.1, 0, 1.9, 0));
          group.add(glowSprite(P.goldHi, 2.2).translateY(1.7));
        } else if (theme.id === 'catacombs') {
          // Crystal cluster / rock.
          group.add(mesh(GEO.octa, material(P.marbleDeep, { metal: 0.2, rough: 0.8 }), rand(1.2, 2.6), rand(1, 2), rand(1.2, 2.6)));
          const crystalColor = Math.random() < 0.5 ? P.green : P.cyan;
          for (let c = 0; c < 3; c++) {
            const cr = mesh(GEO.octa, material(crystalColor, {
              metal: 0.4, rough: 0.1, emissive: crystalColor, emissiveIntensity: 1.5,
            }), 0.28, rand(0.8, 2.0), 0.28, rand(-0.9, 0.9), rand(0.3, 1.4), rand(-0.6, 0.6));
            group.add(cr);
          }
          group.add(glowSprite(crystalColor, 3).translateY(0.9));
        } else {
          // Gothic spire.
          group.add(mesh(GEO.box, material(P.marbleDeep, { metal: 0.3, rough: 0.6 }), 1.0, rand(3, 5.5), 1.0));
          group.add(mesh(GEO.cone4, material(P.marbleSh, { metal: 0.3, rough: 0.5 }), 0.8, rand(2, 3.4), 0.8, 0, 3.4, 0));
          const win = mesh(GEO.box, material(P.gold, {
            metal: 0.4, rough: 0.2, emissive: P.gold, emissiveIntensity: 1.3,
          }), 0.26, 0.9, 0.06, 0, -0.6, 0.52);
          group.add(win);
          group.add(glowSprite(P.gold, 1.6).translateZ(0.6).translateY(-0.6));
        }
        group.position.set(rand(-18, 18), rand(-13, 10), rand(-115, 0));
        group.rotation.set(rand(-0.2, 0.2), rand(0, Math.PI * 2), rand(-0.2, 0.2));
        group.userData.speed = rand(5, 14);
        group.userData.spin = rand(-0.2, 0.2);
        group.userData.bobPhase = rand(0, Math.PI * 2);
        this.scene.add(group);
        this.props.push({ group, baseY: group.position.y });
      }
  }

  getEnemyModel(kind) {
    let pool = this.enemyPools.get(kind);
    if (!pool) {
      pool = [];
      this.enemyPools.set(kind, pool);
    }
    return pool;
  }

  /** Render one frame of the 3D world for the current game state. */
  render(game, time, dt) {
    if (!this.ready) return;
    this.time = time;
    if (game.theme) this.applyTheme(game.theme);

    // Camera sway follows the player for a parallax feel.
    const p = game.player;
    if (p) {
      const targetX = wx(p.x) * 0.16;
      this.camera.position.x += (targetX - this.camera.position.x) * 0.05;
      this.camera.lookAt(this.camera.position.x * 0.35, 0, 0);
    }

    this.updatePlayer(game, time);
    this.updateEnemies(game, time);
    this.updatePods(game, time);
    this.updatePickups(game, time);
    this.updateBoss(game, time);
    this.updateProps(dt, time);
    this.updateStars(dt);

    this.renderer.render(this.scene, this.camera);
  }

  /* ---------------------------------------------------------------- */

  updatePlayer(game, time) {
    const p = game.player;
    if (!p || p.dead) {
      this.player.visible = false;
      this.phoenix.visible = false;
      return;
    }
    const phoenix = p.phoenixActive;
    this.player.visible = !phoenix;
    this.phoenix.visible = phoenix;
    const group = phoenix ? this.phoenix : this.player;
    group.position.set(wx(p.x), wy(p.y), 2.5 + Math.sin(time * 2) * 0.06);
    group.rotation.z = -(p.tilt || 0) * 0.35;
    group.rotation.x = -0.08;
    this.playerLight.position.set(wx(p.x), wy(p.y), 6);
    this.playerLight.intensity = p.phoenixActive ? 60 : 24;
    this.playerLight.color.set(p.phoenixActive ? P.orange : P.cyan);

    if (phoenix) {
      const flap = Math.sin(time * 8) * 0.15;
      if (this.phoenix.userData.wings) {
        for (let i = 0; i < this.phoenix.userData.wings.length; i++) {
          this.phoenix.userData.wings[i].rotation.z += ((i % 2 === 0 ? 1 : -1) * flap - this.phoenix.userData.wings[i].rotation.z) * 0.2;
        }
      }
      return;
    }

    // Module visibility + formation offsets (reuse gameplay positions).
    const world = p.moduleWorldPositions();
    const byId = new Map(world.map((m) => [m.id, m]));
    for (const id of Object.keys(this.modules)) {
      const mod = this.modules[id];
      const m = byId.get(id);
      mod.visible = Boolean(m);
      if (m) {
        mod.position.set(wx(m.x) - wx(p.x), wy(m.y) - wy(p.y), 0.35 + Math.sin(time * 3 + m.x) * 0.08);
        mod.rotation.z = m.flying ? Math.sin(time * 2 + m.x) * 0.3 : 0;
        const dockAnim = p.dockAnims && p.dockAnims[id];
        const scale = dockAnim === undefined ? 1 : 0.7 + 0.3 * Math.min(1, dockAnim / 0.22);
        mod.scale.setScalar(scale);
      }
    }
    // Engine flame pulse.
    const flick = 0.8 + Math.sin(time * 26) * 0.25;
    for (const flame of this.player.userData.flames) {
      flame.scale.set(0.8 * flick + 0.4, 0.8 * flick + 0.4, 1);
    }
    if (p.hitPulse > 0) {
      this.player.userData.canopy.material.emissiveIntensity = 1.1 + p.hitPulse * 2;
    } else {
      this.player.userData.canopy.material.emissiveIntensity = 1.1;
    }
  }

  updateEnemies(game, time) {
    const byKind = new Map();
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (!byKind.has(e.kind)) byKind.set(e.kind, []);
      byKind.get(e.kind).push(e);
    }
    // Hide pooled models first.
    for (const [kind, pool] of this.enemyPools) {
      for (const entry of pool) entry.group.visible = false;
    }
    for (const [kind, list] of byKind) {
      const pool = this.getEnemyModel(kind);
      for (let i = 0; i < list.length; i++) {
        let entry = pool[i];
        if (!entry) {
          const group = buildEnemyModel(kind);
          this.scene.add(group);
          entry = { group, cores: group.userData.cores || [] };
          pool[i] = entry;
        }
        const e = list[i];
        const g = entry.group;
        g.visible = true;
        const scale = (e.kind === 'goliath' ? 1.7 : e.kind === 'seraph' ? 1.15 : e.kind === 'vesper' ? 0.85 : 1.2) * 1.28;
        g.position.set(wx(e.x), wy(e.y), Math.sin(time * 2 + e.uid) * 0.15);
        g.rotation.z = Math.PI + (e.vx || 0) * 0.002;
        g.scale.setScalar(scale);
        g.position.z += Math.sin(time * 3 + e.uid) * 0.05;
        // Hit flash: brighten emissive cores.
        const flash = e.flash > 0 ? 1 + e.flash * 3 : 1;
        for (const m of entry.cores) {
          if (m && m.emissiveIntensity !== undefined) m.emissiveIntensity = flash;
        }
      }
    }
  }

  updatePods(game, time) {
    const cluster = game.podCluster;
    const pods = cluster ? cluster.pods.filter((p) => !p.dead) : [];
    while (this.podPool.length < pods.length) {
      const g = buildPod({ num: 2 });
      this.scene.add(g);
      this.podPool.push(g);
    }
    for (let i = 0; i < this.podPool.length; i++) {
      const g = this.podPool[i];
      const pod = pods[i];
      g.visible = Boolean(pod);
      if (!pod) continue;
      const color = pod.num == null
        ? P.gold
        : { 2: P.cyan, 3: P.magenta, 4: P.gold, 5: P.green }[pod.num] || P.cyan;
      g.userData.crystal.material.color.set(color);
      g.userData.crystal.material.emissive.set(color);
      g.position.set(wx(pod.x), wy(pod.y), 0);
      g.rotation.y = time * 0.8;
      g.scale.setScalar(1.45);
    }
  }

  updatePickups(game, time) {
    for (const pool of this.pickupPools.values()) for (const g of pool) g.visible = false;
    const lists = { gem: [], module: [], nova: [], heart: [] };
    for (const item of game.pickups) {
      if (lists[item.kind]) lists[item.kind].push(item);
    }
    for (const kind of Object.keys(lists)) {
      const list = lists[kind];
      if (!this.pickupPools.has(kind)) this.pickupPools.set(kind, []);
      const pool = this.pickupPools.get(kind);
      for (let i = 0; i < list.length; i++) {
        let g = pool[i];
        if (!g) {
          const color = kind === 'gem' ? P.cyan
            : kind === 'module' ? P.gold
              : kind === 'nova' ? P.orange : P.red;
          g = buildPickup(kind, color);
          this.scene.add(g);
          pool[i] = g;
        }
        const item = list[i];
        g.visible = true;
        g.position.set(wx(item.x), wy(item.y), 0.6 + Math.sin(time * 3 + item.x) * 0.12);
        g.rotation.y = time * 1.6;
        if (kind === 'module' && item.num) {
          const color = { 2: P.cyan, 3: P.magenta, 4: P.gold, 5: P.green }[item.num] || P.gold;
          g.scale.setScalar(1.1);
          g.children[0].material.color.set(color);
          g.children[0].material.emissive.set(color);
        }
      }
    }
  }

  updateBoss(game, time) {
    const boss = game.boss;
    this.boss.visible = Boolean(boss);
    if (!boss) {
      this.bossLight.intensity = 0;
      return;
    }
    const g = this.boss;
    g.position.set(wx(boss.x), wy(boss.y), 1);
    g.position.y += Math.sin(time * 1.6) * 0.08;
    const head = g.userData.head;
    head.rotation.y = Math.sin(time * 0.6) * 0.08;
    head.rotation.x = Math.sin(time * 0.9) * 0.03;
    const hover = Math.sin(time * 1.8) * 0.18;
    for (const hand of g.userData.hands) {
      const side = hand.side;
      const h = boss.hands.find((x) => (side < 0 ? x.id === 'left' : x.id === 'right'));
      if (!h) continue;
      hand.group.visible = h.alive;
      hand.group.position.set(wx(h.x) - wx(boss.x), wy(h.y) - wy(boss.y) + hover * (side < 0 ? 1 : -1), 0.4);
      hand.group.rotation.z = Math.sin(time * 1.4 + side) * 0.08;
      if (h.alive) {
        const eye = hand.group.userData.eye;
        eye.material.emissiveIntensity = 1.2 + Math.sin(time * 5 + side) * 0.5;
      }
    }
    // Eye colour follows phase.
    const color = boss.phase >= 3 ? P.red : boss.phase === 2 ? P.magenta : P.cyan;
    for (const eye of g.userData.eyes) {
      eye.material.emissive.set(color);
      eye.material.color.set(color);
      eye.material.emissiveIntensity = 1.3 + Math.sin(time * 5) * 0.5;
    }
    // Hit flash.
    const flash = boss.flash > 0 ? boss.flash : 0;
    head.scale.setScalar(1 + flash * 0.02);
    this.bossLight.position.set(wx(boss.x), wy(boss.y), 10);
    this.bossLight.intensity = 40 + Math.sin(time * 3) * 8;
    this.bossLight.color.set(color);
  }

  updateProps(dt, time) {
    for (const p of this.props) {
      const g = p.group;
      g.position.z += p.group.userData.speed * dt;
      g.rotation.y += p.group.userData.spin * dt;
      g.position.y = p.baseY + Math.sin(time * 0.8 + p.group.userData.bobPhase) * 0.15;
      if (g.position.z > 14) {
        g.position.z = -130 - Math.random() * 20;
        g.position.x = (Math.random() - 0.5) * 34;
        g.position.y = -12 + Math.random() * 21;
        p.baseY = g.position.y;
        g.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
      }
    }
  }

  updateStars(dt) {
    const pos = this.stars.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i) + dt * 12;
      if (z > 10) z -= 175;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  }

  dispose() {
    if (!this.ready) return;
    disposeTree(this.scene);
    this.renderer.dispose();
    this.ready = false;
  }
}
