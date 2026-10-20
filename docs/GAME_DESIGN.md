# Cyber Michelangelo â€” Game Design & Technical Specification

**Project:** Cyber Michelangelo آ· ط³ط§ظٹط¨ط± ظ…ط§ظٹظƒظ„ ط£ظ†ط¬ظ„ظˆ
**Genre:** Vertical scrolling shoot 'em up (shmup)
**Platform:** Web browser â€” HTML5 Canvas 2D + WebAudio, **zero dependencies**
**Rendering:** 240 أ— 420 pixel buffer, nearest-neighbour upscale to a 4:7 portrait cabinet
**Simulation:** fixed 1/60 s timestep, DOM-free `Game` state machine
**Reference:** *Terra Cresta* (Nichibutsu, 1985) â€” modular docking, formation split, flaming Phoenix
**Art direction:** â€œdigital Renaissance in deep spaceâ€‌ â€” marble, gold leaf, neon circuitry, pixel art
**Version:** 1.1.0

---

## 1. Vision & design pillars

1. **A ship you assemble under fire.** The core loop is not â€œcollect power-upsâ€‌ but *build* a machine: each run starts as a bare hull and the player chooses to hunt pod clusters for pieces that raise both firepower **and** the size of the damage buffer.
2. **Risk lives on the transform key.** Splitting into formation makes the pieces invincible but exposes the hull; staying assembled keeps shield hits but risks losing the whole build. The same button is the Phoenix ignition when the ship is complete.
3. **Arcade clarity.** Everything important is readable on a 240-px-wide screen: 5أ—7 pixel HUD type, colour-coded modules, bright bullets, dark-outlined silhouettes.
4. **Endless, remixable stages.** Three hand-built environments loop forever with deterministic wave generation, escalating difficulty and a three-phase boss per stage.
5. **No assets, no dependencies, no network.** Every pixel, note and sound effect is produced from code at runtime, so the game is portable, offline-capable and fully inspectable.

---

## 2. Screen, presentation & scale

| Property | Value |
| --- | --- |
| Logical pixel buffer | **240 أ— 420** |
| Aspect ratio | 4 : 7 (portrait arcade cabinet) |
| HUD strip | top 34 px (`SCORE`, `LIVES`, `STAGE`; second row `NOVA`, combo, module pips) |
| Playfield | y = 34 â€¦ 412, x = 8 â€¦ 232 |
| Display scaling | nearest-neighbour upscale to viewport; DPR-aware backing store |
| Post effects | vignette, optional CRT scanlines, integer screen shake, colour flash |
| Font | custom 5أ—7 bitmap font (English); Arabic lines rendered as crisp HD canvas text |

The renderer draws into an offscreen `PixelScreen` and blits it to the visible canvas each frame. This keeps all sprite coordinates integral and makes the look identical on every device.

---

## 3. Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | Arrows / WASD | Left stick / D-pad | Relative drag anywhere on the pad |
| Fire | `Z` / `Space` / `J` (hold) | A | Auto-fire while dragging |
| Transform | `X` / `K` / `Shift` | X | `FORM` button |
| Nova | `B` / `L` | B | `NOVA` button |
| Pause | `Esc` / `P` | Start | âڈ¸ button |
| Mute | `M` | â€” | â€” |
| Fullscreen | `F` | â€” | â€” |

Menus: `â†‘â†“` to navigate, `Enter` to confirm, `Esc` to go back. The input layer exposes analog axes plus one-frame edges for every action; the Game receives a single snapshot per frame.

---

## 4. Player ship â€” Alpha Unit

| Stat | Value |
| --- | --- |
| Speed | 122 px/s (Phoenix: أ—1.12) |
| Acceleration | exponential approach, 18/s (weighty arcade feel) |
| Core hitbox | circle r = 4.5 px |
| Fire interval | 0.112 s (twin bolts, 1 damage, 270 px/s) |
| Start lives | 3 (max display 5) |
| Invulnerability after module loss | â‰ˆ1.24 s |
| Respawn invulnerability | 2.6 s |
| Death pause before respawn | 1.4 s |

### 4.1 Module system

Pods appear as clusters of **four ground relics**. Every pod in the cluster must be destroyed before it scrolls past the bottom; the cluster carries the number of the **first missing piece**. Clearing it releases a homing capsule with that module.

| # | Module | Role | Weapon | Fire interval | Tactical note |
| --- | --- | --- | --- | --- | --- |
| 2 | **BETA** â€” Auxiliary Fire | Twin side cannons | 2 forward bolts, 1 dmg | 0.175 s | Doubles forward density |
| 3 | **GAMMA** â€” Rear Cannon | Rear coverage | 2 rear diagonal bolts | 0.24 s | Covers your six |
| 4 | **DELTA** â€” Concussive Beam | Anti-big-target | piercing lance, 2 dmg, 3 pierces | 2.5 s | Pierces shields/aegis |
| 5 | **EPSILON** â€” Rear Force Field | Defence | passive aura r = 27 px | â€” | Erases enemy bullets near hull |

Each docked module adds its hitbox at a fixed slot (`خ² âˆ’12,2 آ· خ³ +12,2 آ· خ´ 0,+13 آ· خµ 0,âˆ’13`). Module collection is counted as score (+750 each).

### 4.2 Damage model (modular damage buffer)

```
hit while Phoenix active      â†’ ignored (invulnerable)
hit while formation active    â†’ all pieces lost; hull reverts; no life lost; 1.9 s i-frames
hit while modules docked      â†’ outermost piece destroyed; ~1.24 s i-frames
hit with bare hull            â†’ lose a life; clear all enemy bullets; 1.4 s death pause
```

This mirrors the originalâ€™s â€œpieces are shieldsâ€‌ design while staying forgiving: a hit never kills a fully-built ship unexpectedly.

---

## 5. Formation split & Phoenix

### 5.1 Formation split

Press **Transform** with **1â€“3 pieces docked**. Shape is derived from the number of pieces (`formationStyleForCount`):

| Pieces | Style | Choreography |
| --- | --- | --- |
| 1 | **ESCORT** | The piece orbits the hull (halo). |
| 2 | **MOON** | Crescent of two pieces guarding the nose, slowly rotating. |
| 3 | **EXTEND** | Sweeping echelon line in front â€” â€œhelicopter fireâ€‌. |

Rules:
- Duration **3.4 s**, then auto-rejoin; cooldown **2.8 s**.
- Detached pieces are **invulnerable**, fire at **أ—1.45 rate**, and are tethered to the hull with light beams.
- The **hull is still vulnerable**. A hull hit while split reverts the ship: all pieces are lost and the player gets 1.9 s of invulnerability, but **no life is lost**.
- Positions are pure functions of `(count, style, t)` in `src/game/formations.js`.

### 5.2 Phoenix

When **all four pieces are docked**, pressing Transform ignites the **Phoenix**:

- Duration **8.5 s**, full invulnerability.
- Contact with enemies instantly destroys them; all enemy bullets are erased on ignition.
- Fires a triple **flame stream** (2 dmg, 4 pierces, every 0.095 s).
- Doubles score gained from kills; grants a one-off +2 500 activation bonus.
- On expiry the four pieces **burn out** (lost) with a big explosion, and the ship gains 1.9 s + extra grace and a short cooldown. The player must rebuild from pod clusters.

This gives the Phoenix a real cost and keeps the assembly loop interesting across a long endless run.

---

## 6. Nova bomb

| Stat | Value |
| --- | --- |
| Start charges | 2 (max 3) |
| Effect | Clear all enemy bullets; 60 dmg to boss; 30 + 2أ—stage dmg to all enemies in 140 px; 1.3 s invulnerability; screen flash + shake |
| Sources | Start of run, bosses (+1), score milestones, Goliath drops (22 %), pickup drops |
| UI | `NOVA âœ¦ أ—N` in the HUD |

Nova is the panic button and the only way to erase a full bullet wall. It is deliberately scarce.

---

## 7. Enemies

| Sprite | Name | HP | Score | Behaviour |
| --- | --- | --- | --- | --- |
| `striker` | STRIKER DRONE | 1 | 120 | sine-wave descent, no fire |
| `wraith` | P-11 WRAITH | 2 | 180 | hovers, aimed single shot |
| `sentinel` | SENTINEL POD | 3 | 230 | ground turret scrolling with terrain, 2-shot aimed spread |
| `goliath` | GOLIATH MK-II | 9 | 540 | strafing gunship, 3-way aimed burst, drops Nova |
| `seraph` | SERAPH MINE | 2 | 170 | drifting orb, explodes into a radial 8-bullet ring |
| `vesper` | VESPER WING | 1 | 150 | fast dive, locks a vector toward the player |
| `lance` | LANCE SNIPER | 2 | 270 | hovers, telegraphs, then fires a fast aimed round |
| `aegis` | AEGIS WARDEN | 6 | 400 | shield front deflects bolts off-centre; pierce beams ignore it |

Enemy stats are multiplied per stage/loop: HP أ—`DIFFICULTY.enemyHp`, bullet speed أ—`bulletSpeed`, fire rate أ—`fireRate`.

### 7.1 The Colossus (stage boss)

**COLOSSUS OF THE NULL COURT** / **VANDAL SERAPH** / **THE GRID TITAN** (name by theme). A marble war-mask flanked by two destructive fists.

| Stat | Value |
| --- | --- |
| HP | 300 + 120 أ— (stageâˆ’1) + 160 أ— (loopâˆ’1) |
| Hands | 2 أ— 22 % of HP, destructible (600 أ— stage score each) |
| Score | 5 000 أ— stage |
| Contact radius | core 24 px, hands 11 px |

Three phases by core HP:
- **Phase 1 (100â€“66 %):** hands fire aimed bursts; core fires 12-bullet radial rings.
- **Phase 2 (66â€“33 %):** rotating two-arm spiral + drifting bullet wall with one gap.
- **Phase 3 (33â€“0 %):** three-arm spiral, dense rings, aimed streams and summoned Striker escorts every 5.5 s.

On death: 3.2 s explosion sequence, screen flash, +stage clear bonus, one Nova and a heart pickup, then the next stage (theme cycles, loop increases every three stages).

---

## 8. Stages, waves & difficulty

- Each stage: **5 procedural waves** + boss. Themes cycle: **THE MARBLE GARDENS â†’ THE NEON CATACOMBS â†’ THE GRID CATHEDRAL â†’ repeat**.
- Waves are generated deterministically from `hashSeed(runSeed, stage, 'waves')` (`src/game/waves.js`), so a given seed + stage always produces the same encounter.
- Wave templates: `PATROL`, `STRIKE`, `BARRAGE`, `ELITE`, `ONSLAUGHT` with formation patterns `line`, `v`, `snake`, `column`, `pair`.
- Pod clusters are scheduled on waves 1, 2 and 4; a **missed cluster is retried on the following wave** instead of costing a whole stage. If all modules are owned, a cleared cluster pays a relic bonus (+900 and a gold gem).
- New players get a **first-run tutorial line** for the first 18 s of stage 1 explaining the pod â†’ module loop (and later the split key).
- Wave clear bonus = 300 + 50 أ— stage. Stage clear = 2 500 أ— stage.
- **Loop scaling** (`DIFFICULTY`):
  - `enemyHp = min(7, 1 + 0.16آ·(stageâˆ’1) + 0.40آ·(loopâˆ’1))`
  - `bulletSpeed = min(1.85, 1 + 0.045آ·(stageâˆ’1) + 0.13آ·(loopâˆ’1))`
  - `density = min(2.3, 1 + 0.10آ·(stageâˆ’1) + 0.28آ·(loopâˆ’1))`
  - `fireRate = min(2.1, 1 + 0.06آ·(stageâˆ’1) + 0.16آ·(loopâˆ’1))`

---

## 9. Scoring, lives & continue

| Event | Score |
| --- | --- |
| Enemy kill | base أ— combo أ— (Phoenix ? 2 : 1) |
| Pod destroyed | 80 |
| Pod cluster cleared | module capsule (+750 on dock) or relic +900 |
| Wave clear | 300 + 50 أ— stage |
| Stage clear | 2 500 أ— stage |
| Phoenix activation | +2 500 |
| Boss | 5 000 أ— stage (+600 أ— stage per severed hand) |

- **Kill-chain combo:** +1 chain per kill, window 2.2 s, multiplier = `min(8, 1 + floor(chain/5))`.
- **Extra lives** at 30 000 / 80 000 / 150 000 / 250 000 / 400 000 / 600 000 / 850 000.
- **Continue:** on the last death, a 9-second continue window offers one revive (2 lives, keeps score, clears bullets). High score, stats and settings persist in `localStorage` with a safe in-memory fallback.

---

## 10. Art direction

- **Palette:** deep space indigo; marble / gold for the player faction; cyan, magenta and green for energy; orange/gold for flame. Full palette in `src/render/palette.js`.
- **Themes:** each environment is deterministically generated from a seed and layered with atmospheric perspective (far layers drawn at 55 % opacity, mid 82 %, near 100 %):
  - *Marble Gardens* â€” floating temple fragments with arches, broken columns and neon lichen over a ringed moon.
  - *Neon Catacombs* â€” jagged caves, glowing rune circles and bioluminescent crystal clusters.
  - *Grid Cathedral* â€” a rose window, spires with lancet lights and a perspective grid floor reflecting the window.
- **Sprites:** hand-authored character maps compiled to canvases at boot (`src/render/sprites.js`); enemies get a 1-px dark outline for readability.
- **Effects:** pixel sparks, smoke, rings, flames and glow sprites cached in `src/render/pixel.js`; screen shake, colour flash, vignette and optional scanlines.
- **HUD:** arcade layout per the concept sheet â€” SCORE value (2أ—), LIVES hearts, STAGE + stage name, NOVA charge, combo multiplier and 2â€“5 shield pips that light up as pieces dock.

---

## 11. Audio

All sound is synthesised at runtime (`src/core/audio.js`): a look-ahead 16th-note sequencer drives bass, arpeggio, pad and drums per track.

| Track | Tempo | Character |
| --- | --- | --- |
| `title` | 92 BPM | slow arpeggio, warm pad, no drums |
| `stage` | 148 BPM | driving bass, 16th arps, full drums, hook note |
| `boss` | 164 BPM | darker minor progression, heavy drums, alarm siren |
| `gameover` | 74 BPM | descending lament |

30+ designed SFX (laser, beam, explosions, dock chime, formation whoosh, Nova blast, Phoenix roar, alarms, UI blips) are built from oscillator/ noise voices with throttling per sound. Music, SFX and mute are user-adjustable in Options.

---

## 12. Technical architecture

```
main.js â”€â”€â–¶ Renderer (pixel buffer â†’ present, VFX, menus)
   â”‚           â–²
   â”œâ”€â”€â–¶ Game â”€â”€â”ک reads state       Game: scenes, waves, collisions, scoring, lives
   â”‚      â”‚
   â”‚      â”œâ”€â”€ Player: movement, docking, formation, Phoenix, weapons
   â”‚      â”œâ”€â”€ waves.js: deterministic stage plans (pure)
   â”‚      â”œâ”€â”€ enemies.js / boss.js: behaviours
   â”‚      â””â”€â”€ hooks.fx / hooks.audio: injected visual & audio events
   â”œâ”€â”€â–¶ InputManager (keyboard / gamepad / touch â†’ snapshot + edges)
   â””â”€â”€â–¶ AudioEngine (WebAudio music + SFX)
```

- **Fixed timestep:** 60 Hz accumulator; rendering happens once per animation frame; post effects use real dt.
- **Determinism:** seeded RNG (`mulberry32`) for waves and background generation; logic can be advanced headlessly (`game.advance(seconds)`).
- **Performance:** cached glow/sprite/mask canvases, additive glow sprites instead of `shadowBlur`, particle cap 520, entity caps (260 bullets, ~40 enemies), single 240أ—420 buffer â†’ 60 fps on modest hardware.
- **Resilience:** WebAudio starts on first user gesture (autoplay policy), storage failures fall back to memory, the game pauses on tab hide, and `window.onerror` surfaces fatal issues to the self-test DOM.
- **Testability:** every gameplay module is DOM-free. `tests/smoke.mjs` runs 41 assertions on the real game class; `?selftest=1` runs 16 in-browser rendering checks (HUD pixels, all scenes, all themes, boss, formation, Phoenix).

---

## 13. Deliberate design choices & deviations

| Choice | Rationale |
| --- | --- |
| Four attachable pieces (2â€“5) + Alpha core | faithful to the brief; pods are numbered for the missing piece, so clusters always feel useful |
| Pod cluster must be fully cleared | creates a small aiming objective and lets players fail it (cluster returns later) |
| Formation hull stays vulnerable | preserves the originalâ€™s risk/reward; a hit strips all pieces but never a life |
| Phoenix burns the pieces | keeps the rebuild loop meaningful instead of a permanent power state |
| Nova added | the reference concept sheet includes a BOMB counter; it also fixes bullet-wall difficulty spikes |
| Endless loops instead of fixed stages | â€œdynamic difficulty and looping stagesâ€‌ requirement; a boss per stage gives each loop a climax |
| No original assets or names | non-commercial homage with procedural, original art/music |

---

## 14. Verification matrix

| Layer | Command | Result |
| --- | --- | --- |
| Module parsing | `node tests/syntax.mjs` | all modules parse |
| Game logic (41 tests) | `node tests/smoke.mjs` | green: movement, docking, shield buffer, formation, Phoenix, pods, scoring, boss phases, stage flow, game over/continue, 3-minute autopilot stability |
| Browser integration (16 checks) | `/?selftest=1` | green: sprite build, title/gameplay/boss/formation/Phoenix/menu renders, HUD pixels, three themes |
| Visual QA | `tools/capture.ps1` + headless Edge | 11 scene screenshots reviewed |

---

## 15. Credits & attribution

Inspired by **Terra Cresta** (Nichibutsu, 1985) â€” designed by **Shigeki Fujiwara**, music by **Kenji Yoshida**; series context includes **Moon Cresta** (1980) and **Sol Cresta** (2022, PlatinumGames). Cyber Michelangelo is an original, non-commercial homage; no original code, art, audio or names were used. Built with AI assistance. All art, music and effects are generated procedurally in this repository. License: MIT.

---

## ظ…ظ„ط®طµ ط§ظ„طھطµظ…ظٹظ… ط¨ط§ظ„ط¹ط±ط¨ظٹط©

ط§ظ„ظ„ط¹ط¨ط© ط´ظˆطھط± ط¹ظ…ظˆط¯ظٹ ط¨ط£ط³ظ„ظˆط¨ ط§ظ„ط¨ظƒط³ظ„ ط¢ط±طھ (240أ—420 ط¨ظƒط³ظ„ ظ…ظ†ط·ظ‚ظٹطŒ ط¨ظ†ط³ط¨ط© 4:7) ط¨ظ„ط§ ط£ظٹ ظ…ظƒطھط¨ط§طھ ط£ظˆ ظ…ظ„ظپط§طھ ظپظ†ظٹط©.
طھط¨ط¯ط£ ط¨ط³ظپظٹظ†ط© **ط£ظ„ظپط§** ط§ظ„ط¨ط³ظٹط·ط©طŒ ظˆطھط­طµظ„ ط¹ظ„ظ‰ ط£ط±ط¨ط¹ ظˆط­ط¯ط§طھ (**ط¨ظٹطھط§طŒ ط؛ط§ظ…ط§طŒ ط¯ظ„طھط§طŒ ط¥ط¨ط³ظٹظ„ظˆظ†**) ط¨ط¥ط³ظ‚ط§ط· ظ…ط¬ظ…ظˆط¹ط§طھ ط§ظ„طµظˆط§ظ…ط¹ ط§ظ„ط£ط±ط¶ظٹط© ط§ظ„ط£ط±ط¨ط¹طŒ ظپظٹظ…ظ†ط­ظƒ ظƒظ„ ط§ظ„طھط­ط§ظ… ظ‚ظˆط© ظ†ط§ط±ظٹط© ط¥ط¶ط§ظپظٹط© ظˆط§ظ…طھطµط§طµط§ظ‹ ظ„ط¶ط±ط¨ط© ظˆط§ط­ط¯ط© ط¨ط¯ظ„ط§ظ‹ ظ…ظ† ط­ظٹط§طھظƒ.
ط²ط± ط§ظ„طھط­ظˆظٹظ„ `X` ظٹظپظƒظƒ ط§ظ„ظˆط­ط¯ط§طھ ظپظٹ طھط´ظƒظٹظ„ ظ…ط¤ظ‚طھ (ط­ط±ط§ط³ط©/ظ‡ظ„ط§ظ„/طھظ…ط¯ط¯) ظپطھظƒظˆظ† ط§ظ„ظˆط­ط¯ط§طھ ظ…ظ†ظٹط¹ط© ظˆط§ظ„ط¬ط³ظ… ظ…ظƒط´ظˆظپط§ظ‹ط› ظˆط¥ط°ط§ ظƒط§ظ†طھ ط§ظ„ظ‚ط·ط¹ ط§ظ„ط£ط±ط¨ط¹ ظ…ظ„طھط­ظ…ط© ظپط§ط¶ط؛ط·ظ‡ ظ„طھطھط­ظˆظ„ ط¥ظ„ظ‰ **ط§ظ„ط¹ظ†ظ‚ط§ط،** ط§ظ„ط°ظٹ ظ„ط§ ظٹظڈظ‚ظ‡ط± ظˆظٹط­ط±ظ‚ ط§ظ„ظ‚ط·ط¹ ط¨ط¹ط¯ ط§ظ†طھظ‡ط§ط، ظ…ط¯طھظ‡. ط£ط¶ظپ ط¥ظ„ظ‰ ط°ظ„ظƒ ظ‚ظ†ط¨ظ„ط© **NOVA** ط§ظ„ظ…ط§ط³ط­ط© ظ„ظ„ط±طµط§طµطŒ ظˆظ…ط¶ط§ط¹ظپ ط§ظ„ظ†ظ‚ط§ط·طŒ ظˆط«ظ„ط§ط« ط¨ظٹط¦ط§طھ ظ…طھط¬ط¯ط¯ط© (ط­ط¯ط§ط¦ظ‚ ط§ظ„ط±ط®ط§ظ…طŒ ط§ظ„ط³ط±ط§ط¯ظٹط¨ ط§ظ„ظ†ظٹظˆظ†ظٹط©طŒ ظƒط§طھط¯ط±ط§ط¦ظٹط© ط§ظ„ط´ط¨ظƒط©) ظ…ط¹ ط²ط¹ظٹظ… ط«ظ„ط§ط«ظٹ ط§ظ„ط£ط·ظˆط§ط± ظپظٹ ظƒظ„ ظ…ط±ط­ظ„ط© ظˆط¯ظˆط±ط§طھ ظ„ط§ ظ†ظ‡ط§ط¦ظٹط© طھطھطµط§ط¹ط¯ طµط¹ظˆط¨طھظ‡ط§.
طھظ‚ظ†ظٹط§ظ‹: ظ…ط­ط§ظƒط§ط© ط«ط§ط¨طھط© 60 ظ‡ط±طھط²طŒ ط­ط§ظ„ط© ط§ظ„ظ„ط¹ط¨ط© ظ…ط³طھظ‚ظ„ط© طھظ…ط§ظ…ط§ظ‹ ط¹ظ† ط§ظ„ظ…طھطµظپط­ ظˆظ‚ط§ط¨ظ„ط© ظ„ظ„ط§ط®طھط¨ط§ط±طŒ ظˆظƒظ„ ط§ظ„ط±ط³ظ… ظˆط§ظ„ظ…ظˆط³ظٹظ‚ظ‰ ظˆط§ظ„ظ…ط¤ط«ط±ط§طھ ظ…ظˆظ„ظ‘ط¯ط© ط¨ط±ظ…ط¬ظٹط§ظ‹ ظ…ظ† ط´ظٹظپط±ط© ط§ظ„ظ…طµط¯ط±.

