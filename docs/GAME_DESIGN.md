# Cyber Michelangelo — Game Design & Technical Specification

**Project:** Cyber Michelangelo · سايبر مايكل أنجلو
**Genre:** Vertical scrolling shoot 'em up (shmup)
**Platform:** Web browser — HTML5 Canvas 2D + WebAudio, **zero dependencies**
**Rendering:** 240 × 420 logical space rasterised at 2–4× device resolution (vector art, gradients, prerendered HD parallax) + optional three.js 3D renderer
**Simulation:** fixed 1/60 s timestep, DOM-free `Game` state machine
**Reference:** *Terra Cresta* (Nichibutsu, 1985) — modular docking, formation split, flaming Phoenix
**Art direction:** “digital Renaissance in deep space” — HD-2D vector ships, marble, gold leaf and neon over prerendered baroque environments; optional low-poly 3D mode with the same art direction
**Version:** 1.6.0

---

## 1. Vision & design pillars

1. **A ship you assemble under fire.** The core loop is not “collect power-ups” but *build* a machine: each run starts as a bare hull and the player chooses to hunt pod clusters for pieces that raise both firepower **and** the size of the damage buffer.
2. **Risk lives on the transform key.** Splitting into formation makes the pieces invincible but exposes the hull; staying assembled keeps shield hits but risks losing the whole build. The same button is the Phoenix ignition when the ship is complete.
3. **Arcade clarity, HD presentation.** Everything stays readable on a phone: a modern glass HUD, colour-coded modules, bright energy bullets and dark-edged silhouettes, rendered at device resolution instead of chunky pixels.
4. **Endless, remixable stages.** Three hand-built environments loop forever with deterministic wave generation, escalating difficulty and a three-phase boss per stage.
5. **No assets, no dependencies, no network.** Every pixel, note and sound effect is produced from code at runtime, so the game is portable, offline-capable and fully inspectable.

---

## 2. Screen, presentation & scale

| Property | Value |
| --- | --- |
| Logical gameplay space | **240 × 420** (all positions, hitboxes and layout) |
| Render buffer | 240 × 420 × **device scale** (2–4× based on screen size / DPR) |
| Aspect ratio | 4 : 7 (portrait arcade cabinet) |
| HUD strip | top 34 logical px: score, lives, stage; second row NOVA, combo, module capsules |
| Playfield | y = 34 … 412, x = 8 … 232 |
| Presentation | HD-2D: smooth vector ships & UI, prerendered background layers, additive glow |
| Renderer styles | **HD-2D** (default, Canvas2D) · optional **3D** (three.js WebGL underlay, selectable at the title screen) |
| Post effects | vignette, optional scanlines, integer screen shake, colour flash |
| Typography | system sans/mono via canvas `fillText` with gradient fills; Arabic lines rendered as crisp HD canvas text |

The renderer keeps gameplay in a 240×420 logical coordinate space, but the offscreen buffer is allocated at `240·S × 420·S` where `S` tracks the device canvas size. Vector art (ships, boss, pickups, UI) is drawn with paths and gradients into that buffer, while static environment layers are prerendered once at the same scale and blitted as parallax; the result is crisp on every screen without changing a single gameplay value.

---

## 3. Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | Arrows / WASD | Left stick / D-pad | Relative drag anywhere on the pad |
| Fire | `Z` / `Space` / `J` (hold) | A | Auto-fire while dragging |
| Transform | `X` / `K` / `Shift` | X | `FORM` button |
| Nova | `B` / `L` | B | `NOVA` button |
| Pause | `Esc` / `P` | Start | ⏸ button |
| Mute | `M` | — | — |
| Fullscreen | `F` | — | — |

Menus: `↑↓` to navigate, `Enter` to confirm, `Esc` to go back. The input layer exposes analog axes plus one-frame edges for every action; the Game receives a single snapshot per frame.

---

## 4. Player ship — Alpha Unit

| Stat | Value |
| --- | --- |
| Speed | 122 px/s (Phoenix: ×1.12) |
| Acceleration | exponential approach, 18/s (weighty arcade feel) |
| Core hitbox | circle r = 4.5 px |
| Fire interval | 0.112 s (twin bolts, 1 damage, 270 px/s) |
| Start lives | 3 (max display 5) |
| Invulnerability after module loss | ≈1.24 s |
| Respawn invulnerability | 2.6 s |
| Death pause before respawn | 1.4 s |

### 4.1 Module system

Pods appear as clusters of **four ground relics**. Every pod in the cluster must be destroyed before it scrolls past the bottom; the cluster carries the number of the **first missing piece**. Clearing it releases a homing capsule with that module.

| # | Module | Role | Weapon | Fire interval | Tactical note |
| --- | --- | --- | --- | --- | --- |
| 2 | **BETA** — Auxiliary Fire | Twin side cannons | 2 forward bolts, 1 dmg | 0.175 s | Doubles forward density |
| 3 | **GAMMA** — Rear Cannon | Rear coverage | 2 rear diagonal bolts | 0.24 s | Covers your six |
| 4 | **DELTA** — Concussive Beam | Anti-big-target | piercing lance, 2 dmg, 3 pierces | 2.5 s | Pierces shields/aegis |
| 5 | **EPSILON** — Rear Force Field | Defence | passive aura r = 27 px | — | Erases enemy bullets near hull |

Each docked module adds its hitbox at a fixed slot (`β −12,2 · γ +12,2 · δ 0,+13 · ε 0,−13`). Module collection is counted as score (+750 each).

### 4.2 Damage model (modular damage buffer)

```
hit while Phoenix active      → ignored (invulnerable)
hit while formation active    → all pieces lost; hull reverts; no life lost; 1.9 s i-frames
hit while modules docked      → outermost piece destroyed; ~1.24 s i-frames
hit with bare hull            → lose a life; clear all enemy bullets; 1.4 s death pause
```

This mirrors the original’s “pieces are shields” design while staying forgiving: a hit never kills a fully-built ship unexpectedly.

---

## 5. Formation split & Phoenix

### 5.1 Formation split

Press **Transform** with **1–3 pieces docked**. Shape is derived from the number of pieces (`formationStyleForCount`):

| Pieces | Style | Choreography |
| --- | --- | --- |
| 1 | **ESCORT** | The piece orbits the hull (halo). |
| 2 | **MOON** | Crescent of two pieces guarding the nose, slowly rotating. |
| 3 | **EXTEND** | Sweeping echelon line in front — “helicopter fire”. |

Rules:
- Duration **3.4 s**, then auto-rejoin; cooldown **2.8 s**.
- Detached pieces are **invulnerable**, fire at **×1.45 rate**, and are tethered to the hull with light beams.
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
| Effect | Clear all enemy bullets; 60 dmg to boss; 30 + 2×stage dmg to all enemies in 140 px; 1.3 s invulnerability; screen flash + shake |
| Sources | Start of run, bosses (+1), score milestones, Goliath drops (22 %), pickup drops |
| UI | `NOVA ✦ ×N` in the HUD |

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

Enemy stats are multiplied per stage/loop: HP ×`DIFFICULTY.enemyHp`, bullet speed ×`bulletSpeed`, fire rate ×`fireRate`.

### 7.1 The Colossus (stage boss)

**COLOSSUS OF THE NULL COURT** / **VANDAL SERAPH** / **THE GRID TITAN** (name by theme). A marble war-mask flanked by two destructive fists.

| Stat | Value |
| --- | --- |
| HP | 300 + 120 × (stage−1) + 160 × (loop−1) |
| Hands | 2 × 22 % of HP, destructible (600 × stage score each) |
| Score | 5 000 × stage |
| Contact radius | core 24 px, hands 11 px |

Three phases by core HP:
- **Phase 1 (100–66 %):** hands fire aimed bursts; core fires 12-bullet radial rings.
- **Phase 2 (66–33 %):** rotating two-arm spiral + drifting bullet wall with one gap.
- **Phase 3 (33–0 %):** three-arm spiral, dense rings, aimed streams and summoned Striker escorts every 5.5 s.

On death: 3.2 s explosion sequence, screen flash, +stage clear bonus, one Nova and a heart pickup, then the next stage (theme cycles, loop increases every three stages).

---

## 8. Stages, waves & difficulty

- Each stage: **5 procedural waves** + boss. Themes cycle: **THE MARBLE GARDENS → THE NEON CATACOMBS → THE GRID CATHEDRAL → repeat**.
- Waves are generated deterministically from `hashSeed(runSeed, stage, 'waves')` (`src/game/waves.js`), so a given seed + stage always produces the same encounter.
- Wave templates: `PATROL`, `STRIKE`, `BARRAGE`, `ELITE`, `ONSLAUGHT` with formation patterns `line`, `v`, `snake`, `column`, `pair`.
- Pod clusters are scheduled on waves 1, 2 and 4; a **missed cluster is retried on the following wave** instead of costing a whole stage. If all modules are owned, a cleared cluster pays a relic bonus (+900 and a gold gem).
- New players get a **first-run tutorial line** for the first 18 s of stage 1 explaining the pod → module loop (and later the split key).
- Wave clear bonus = 300 + 50 × stage. Stage clear = 2 500 × stage.
- **Loop scaling** (`DIFFICULTY`):
  - `enemyHp = min(7, 1 + 0.16·(stage−1) + 0.40·(loop−1))`
  - `bulletSpeed = min(1.85, 1 + 0.045·(stage−1) + 0.13·(loop−1))`
  - `density = min(2.3, 1 + 0.10·(stage−1) + 0.28·(loop−1))`
  - `fireRate = min(2.1, 1 + 0.06·(stage−1) + 0.16·(loop−1))`

---

## 9. Scoring, lives & continue

| Event | Score |
| --- | --- |
| Enemy kill | base × combo × (Phoenix ? 2 : 1) |
| Pod destroyed | 80 |
| Pod cluster cleared | module capsule (+750 on dock) or relic +900 |
| Wave clear | 300 + 50 × stage |
| Stage clear | 2 500 × stage |
| Phoenix activation | +2 500 |
| Boss | 5 000 × stage (+600 × stage per severed hand) |

- **Kill-chain combo:** +1 chain per kill, window 2.2 s, multiplier = `min(8, 1 + floor(chain/5))`.
- **Extra lives** at 30 000 / 80 000 / 150 000 / 250 000 / 400 000 / 600 000 / 850 000.
- **Continue:** on the last death, a 9-second continue window offers one revive (2 lives, keeps score, clears bullets). High score, stats and settings persist in `localStorage` with a safe in-memory fallback.

---

## 10. Art direction (HD-2D)

- **Palette:** deep space indigo; marble / gold for the player faction; cyan, magenta and green for energy; orange/gold for flame. Full palette in `src/render/palette.js`.
- **Hero craft (`art_player.js`):** layered vector construction — armoured swept wings with gold leading edges, marble fuselage gradient, glass canopy with glint, gold nose blade, intake grilles, twin engine housings with animated plumes, banking into movement, navigation lights, and four visible docking sockets. The four modules are drawn as distinct pods (twin side cannons, rear turret, gold crystal lance, green field emitter) with docking clamps that flash on arrival.
- **Enemies (`art_enemies.js`):** eight distinct silhouettes with plating gradients, glowing reactor cores, animated engine flames and enemy-specific details (e.g. the Aegis barrier arcs, the Lance charge coils).
- **Boss (`art_boss.js`):** engraved marble war-mask with gold crown and jewels, deep eye sockets with irises that track the player, mouth grille, sculpted cheek plates and growing cracks as HP drops; floating fists with gold cuffs, thrusters and their own tracking eyes.
- **Environments (`art_background.js`):** each theme prerendered once per device scale into parallax layers with atmospheric perspective (far 55 %, mid 82 %, near 100 %) plus live elements: twinkling stars, dust motes, light rays, drips, a rose window and a scrolling perspective grid.
  - *Marble Gardens* — floating temple fragments, broken arcades and a ringed moon.
  - *Neon Catacombs* — jagged cave walls, rune circles, stalactites and bioluminescent crystal clusters.
  - *Grid Cathedral* — gothic spires, stained-glass lancets, a pulsing rose window and a grid floor reflecting it.
- **Pickups (`art_pickups.js`):** marble relic plinths with glowing crystal domes and numerals, target brackets on the piece you still need, energy capsules, faceted gems, Nova orb and heart.
- **UI (`ui_hd.js`, `screens.js`, `art_title.js`):** glass panels, gradient typography, vector hearts, module capsules, segmented boss bar, countdown ring and a metallic wordmark title screen with a live hero diorama.
- **Effects:** cached additive glow sprites, gradient energy bullets, particle sparks/smoke/rings/flames, screen shake, colour flash, vignette and optional scanlines.
- **Optional 3D mode (`src/render3d/renderer3d.js`):** a second renderer replays the same `Game` state as a three.js WebGL scene drawn on an underlay canvas, with the 2D canvas kept on top as a transparent overlay for bullets, particles, HUD and menus. The hero craft, four module pods, all eight enemies, the Colossus (marble mask, crown, glowing eyes, floating fists), relic pods and pickups are low-poly procedural models with emissive cores and engine glows. Environments become true 3D prop fields (floating temples, crystal clusters, gothic spires), a 3D starfield, fog, hemisphere/directional/point lights and a camera-with-player-sway. three.js r160 is vendored locally and lazy-loaded only when the player enables 3D; if WebGL is unavailable the game falls back to HD-2D automatically.

---

## 11. Audio

### Default: “space nature” ambience (`src/core/space_ambience.js`)

The soundtrack is **not music**. It is a quiet organic sci-fi bed, synthesised at runtime and shaped exactly like the design brief that produced it:

| Layer | What it is | Processing |
| --- | --- | --- |
| 1. Low space rumble | deep-ocean brown noise + a drifting sub drone | low-pass ~120 Hz, slow filter LFO, convolution reverb, very low gain |
| 2. Drifting wind | pink-ish noise | band-pass + high-pass, pan LFO left↔right, filter LFO; gain/filter rise slightly with the player's speed |
| 3. Random details | distant thunder, a water drop, an ice crack — one every 8–20 s | each layer EQ'd, pitched, sent to the same reverb, mood-dependent gaps (boss 6–12 s, title 10–20 s, game-over 14–24 s) |

The bed is intentionally very quiet and sits on its own bus so it can be **ducked automatically** whenever a laser / enemy shot / explosion / hit / player-damage sound fires (`DUCK_PRESETS` in `space_ambience.js`), then smoothly restored. The wind layer responds to movement: `main.js` feeds `audio.setMotion(playerSpeed/130)` every frame.

### Gameplay SFX (nature-flavoured synthesis, `src/core/audio.js`)

All SFX are layered from synthesised natural materials, filtered/pitched and sent to a short echo so they sit clearly above the bed without sounding like raw nature recordings:

| Gameplay event | Sound design |
| --- | --- |
| player fire | short wooden click + water bubble |
| enemy fire | darker ice crack |
| hit (pod/boss) | small wind chime + water splash |
| small explosion | soft fire hiss + crumbling stone |
| big explosion / boss death | distant thunder + light quake + ocean rumble + stone |
| player damage | cracking ice + low heartbeat |
| power-up / dock / shield | water bubbles + cave echo |
| score / wave / stage clear | short natural wind chimes |
| UI move/select/back | water drop + light echo |

The 32 SFX names are throttled per sound and duck the bed. A headless `?audio-probe=1` hook unlocks WebAudio, plays every SFX once, and reports the ambience state into the DOM for verification.

### Optional soundtracks

*Options → SOUNDTRACK* also offers two alternatives; all three are remembered between sessions:

| Style | Engine | Notes |
| --- | --- | --- |
| **SPACE NATURE** (default) | `space_ambience.js` | the procedural bed above; no files, works offline |
| **NATURE** | `ambience.js` | v1.5 layered field recordings per scene (forest, river, cave, storm, rain); all Public Domain / CC0 1.0, credited in `assets/audio/nature/CREDITS.md` and in-game |
| **CHIPTUNE** | sequencer in `audio.js` | the original procedural soundtrack, kept for history |

`?audio=space|nature|chiptune` forces a style for debugging; the AMBIENCE slider sets the bed volume. The space bed and the nature-bed map are both exported as plain data (`SPACE_LAYERS`, `SPACE_DETAILS`, `DUCK_PRESETS`, `NATURE_BEDS`) so Node tests and the browser self-test can verify the design without creating an AudioContext.

---

## 12. Technical architecture

```
main.js ──▶ Renderer (device-res buffer → present, VFX, HD-2D art, menus)
   │           ├──▶ Renderer3D (optional three.js underlay, same Game state)
   │           ▲
   ├──▶ Game ──┘ reads state       Game: scenes, waves, collisions, scoring, lives
   │      │
   │      ├── Player: movement, docking, formation, Phoenix, weapons
   │      ├── waves.js: deterministic stage plans (pure)
   │      ├── enemies.js / boss.js: behaviours
   │      └── hooks.fx / hooks.audio: injected visual & audio events
   ├──▶ InputManager (keyboard / gamepad / touch → snapshot + edges)
   └──▶ AudioEngine (WebAudio music + SFX)
```

- **Fixed timestep:** 60 Hz accumulator; rendering happens once per animation frame; post effects use real dt.
- **Determinism:** seeded RNG (`mulberry32`) for waves and background generation; logic can be advanced headlessly (`game.advance(seconds)`).
- **Performance:** cached glow/sprite/mask canvases, additive glow sprites instead of `shadowBlur`, particle cap 520, entity caps (260 bullets, ~40 enemies), single 240×420 buffer → 60 fps on modest hardware.
- **Resilience:** WebAudio starts on first user gesture (autoplay policy), storage failures fall back to memory, the game pauses on tab hide, and `window.onerror` surfaces fatal issues to the self-test DOM.
- **Testability:** every gameplay module is DOM-free. `tests/smoke.mjs` runs 48 assertions on the real game class; `?selftest=1` runs 19 in-browser checks (HUD pixels, all scenes, all themes, boss, formation, Phoenix, 3D renderer probe, nature-recording availability/OGG codec probe).

---

## 13. Deliberate design choices & deviations

| Choice | Rationale |
| --- | --- |
| Four attachable pieces (2–5) + Alpha core | faithful to the brief; pods are numbered for the missing piece, so clusters always feel useful |
| Pod cluster must be fully cleared | creates a small aiming objective and lets players fail it (cluster returns later) |
| Formation hull stays vulnerable | preserves the original’s risk/reward; a hit strips all pieces but never a life |
| Phoenix burns the pieces | keeps the rebuild loop meaningful instead of a permanent power state |
| Nova added | the reference concept sheet includes a BOMB counter; it also fixes bullet-wall difficulty spikes |
| Endless loops instead of fixed stages | “dynamic difficulty and looping stages” requirement; a boss per stage gives each loop a climax |
| No original assets or names | non-commercial homage with procedural, original art/music |

---

## 14. Verification matrix

| Layer | Command | Result |
| --- | --- | --- |
| Module parsing | `node tests/syntax.mjs` | all modules parse |
| Game logic (48 tests) | `node tests/smoke.mjs` | green: movement, docking, shield buffer, formation, Phoenix, pods, scoring, boss phases, stage flow, game over/continue, title/options renderer + soundtrack choices, space-nature layer/detail/duck map, nature bed/theme coverage, 3-minute autopilot stability |
| Browser integration (16 checks) | `/?selftest=1` | green: sprite build, title/gameplay/boss/formation/Phoenix/menu renders, HUD pixels, three themes |
| Visual QA | `tools/capture.ps1` + headless Edge | 11 scene screenshots reviewed |

---

## 15. Changelog & roadmap

### v1.6.0 — “space nature” sound design (current)
- New default soundtrack `src/core/space_ambience.js`: a very quiet low space rumble (deep ocean + high wind, low-pass + convolution reverb) and a drifting wind layer that pans slowly and rises slightly with player speed; sparse random details (distant thunder / water drop / ice crack) every 8–20 s.
- All 32 gameplay SFX rebuilt from synthesised natural materials (wood, water, ice, stone, thunder) with filters, pitch glides and a short echo; background is automatically ducked on lasers/explosions/hits/player damage and restored (`DUCK_PRESETS`).
- *Options → SOUNDTRACK* offers **SPACE NATURE** (default) / **NATURE** (v1.5 field-recording beds) / **CHIPTUNE**; AMBIENCE slider and `?audio=` debug hook. Boss mood increases detail density and rumble weight.
- +2 logic tests (48 total); new headless `?audio-probe=1` hook verifies the bed and smoke-tests all 32 SFX in Chromium.

### v1.5.0 — nature ambience replaces music
- The soundtrack became a layered bed of **real nature field recordings** (forest, river, rivulet, wind, rain, thunder, cave water) instead of music; each scene/theme got its own bed and the boss a storm.
- New `src/core/ambience.js`: seamless 2.6 s crossfaded loops, equal-power bed crossfades on scene/theme changes, randomized accents, per-layer filtered-noise fallback when a sample cannot be decoded.
- *Options → SOUNDTRACK* switched **NATURE** / **CHIPTUNE**; AMBIENCE slider controls the layer volume. The v1.4 CC0 music option and assets were retired at the user's request.
- All seven recordings are Public Domain or CC0 1.0 (PDSounds.org via Wikimedia Commons, and OpenGameArt); provenance in `assets/audio/nature/CREDITS.md`. Still available as the optional NATURE soundtrack.

### v1.4.0 — CC0 music tracks (retired in v1.5)
- Added *Options → MUSIC STYLE* with four sampled **CC0 1.0** tracks for title/stage/boss/game-over, with full attribution.
- Replaced in v1.5 by the nature-ambience direction; the files and menu option were removed, attribution remains in this changelog and release notes.

### v1.3.0 — optional 3D mode
- New optional three.js renderer (`src/render3d/renderer3d.js`): 3D hero craft and module pods, all eight enemies, Colossus with marble mask/floating fists, relic pods, pickups, procedural themed prop fields, starfield, fog and dynamic lighting.
- Renderer selectable from the title menu (`RENDER: HD-2D / 3D`) and Options → RENDERER; the choice persists and defaults to HD-2D.
- three.js r160 vendored locally (`vendor/three`, MIT), lazy-loaded only when 3D is enabled; automatic HD-2D fallback when WebGL is unavailable.
- Classic HD-2D path untouched; +2 logic tests for the renderer choice (43 total) and a 17th browser check probing the 3D renderer.

### v1.2.0 — HD-2D visual overhaul
- Device-resolution render pipeline (2–4×) with vector hero craft, docking modules, eight HD enemies, HD bullets, HD Colossus boss and HD pods/pickups.
- Prerendered HD parallax environments for all three themes with atmospheric depth, stars, dust, light rays, rose window and grid floor.
- New HD HUD, title screen with live hero diorama, and HD how-to-play / credits / options / pause / game-over screens.
- Mechanics untouched; 41 logic tests + 16 in-browser checks green.

### v1.1.0 — readability + fairer opening
- Outlined sprites, brighter bullets, enemy eye glints, player halo.
- Pod clusters from wave 1, missed-cluster retry, 2 starting NOVAs, 8.5 s Phoenix, shorter first wave, first-run tutorial hint.

### v1.0.0 — first playable release
- Full modular docking, formation split, Phoenix, Nova, endless looped stages + boss, procedural art/audio, 39 initial tests.

### Roadmap — remaining polish
- **Sound depth:** a barely-audible hidden pulse option for the space bed, boss-phase storm intensity ramps, and a 3D-tuned reverb send.
- **3D refinements:** higher-detail models, a 3D title/attract scene, and optional bloom if it stays 60 fps on phones.
- **Cloudflare Pages deploy:** requires a scoped API token + account id (`npm run deploy`); GitHub Pages mirror is live today.
- **Extra juice:** richer boss-death sequences, more particle layering, and optional haptics on mobile.

---

## 16. Credits & attribution

Inspired by **Terra Cresta** (Nichibutsu, 1985) — designed by **Shigeki Fujiwara**, music by **Kenji Yoshida**; series context includes **Moon Cresta** (1980) and **Sol Cresta** (2022, PlatinumGames). Cyber Michelangelo is an original, non-commercial homage; no original code, art, audio or names were used. Built with AI assistance. All art, the default **space-nature ambience** (`src/core/space_ambience.js`) and all 32 SFX are generated procedurally in this repository. The optional **NATURE** soundtrack uses **public-domain / CC0 1.0** field recordings (`assets/audio/nature/`, full links in its `CREDITS.md`): forest ambience by *nille* and river/rivulet recordings by *stephan* (PDSounds.org via Wikimedia Commons); wind by *Écrivain*, rain + thunder by *WuxiaScrub*, soft rain by *Ylmir* and cavern ambience by *Paul Wortmann* (OpenGameArt). The optional 3D mode uses **three.js r160**, vendored in `vendor/three` under the MIT License (© 2010-2023 three.js authors); all 3D models and environments are original procedural code. License: MIT.

---

## ملخص التصميم بالعربية

اللعبة شوتر عمودي بأسلوب **HD-2D** (فن متجهي بدقة الجهاز فوق خلفيات نهضوية متحركة، 240×420 منطقي بنسبة 4:7) بلا أي ملفات فنية خارجية، مع **وضع 3D اختياري** مبني على three.js المضمّن محلياً ويُختار من شاشة البداية، و**تصميم صوتي «طبيعة فضائية»**: خلفية منخفضة جداً من هدير فضائي ورياح متغيرة تتحرك مع سرعة اللاعب، وتفاصيل طبيعية متقطعة (رعد بعيد/قطرة ماء/طقطقة جليد) كل 8–20 ثانية، ومؤثرات لعب من طبقات خشب/ماء/جليد/حجر/رعد مع تخفيض تلقائي للخلفية. تتوفر خيارات **NATURE** (تسجيلات طبيعية حرة) و**CHIPTUNE** الكلاسيكي.
تبدأ بسفينة **ألفا** البسيطة، وتحصل على أربع وحدات (**بيتا، غاما، دلتا، إبسيلون**) بإسقاط مجموعات الصوامع الأرضية الأربع، فيمنحك كل التحام قوة نارية إضافية وامتصاصاً لضربة واحدة بدلاً من حياتك.
زر التحويل `X` يفكك الوحدات في تشكيل مؤقت (حراسة/هلال/تمدد) فتكون الوحدات منيعة والجسم مكشوفاً؛ وإذا كانت القطع الأربع ملتحمة فاضغطه لتتحول إلى **العنقاء** الذي لا يُقهر ويحرق القطع بعد انتهاء مدته. أضف إلى ذلك قنبلة **NOVA** الماسحة للرصاص، ومضاعف النقاط، وثلاث بيئات متجددة (حدائق الرخام، السراديب النيونية، كاتدرائية الشبكة) مع زعيم ثلاثي الأطوار في كل مرحلة ودورات لا نهائية تتصاعد صعوبتها.
تقنياً: محاكاة ثابتة 60 هرتز، حالة اللعبة مستقلة تماماً عن المتصفح وقابلة للاختبار، والرسم والمؤثرات الصوتية والخلفية الافتراضية «طبيعة فضائية» مولّدة برمجياً بالكامل، مع خيار خلفية تسجيلات طبيعية حرة موثّقة المصادر؛ والنسخة الكلاسيكية تعمل دائماً كخيار افتراضي آمن إن لم يتوفر WebGL.
