# Cyber Michelangelo آ· ط³ط§ظٹط¨ط± ظ…ط§ظٹظƒظ„ ط£ظ†ط¬ظ„ظˆ

**A digital-Renaissance pixel-art vertical shoot 'em up â€” inspired by *Terra Cresta* (1985), built with AI assistance, zero dependencies.**

ظ„ط¹ط¨ط© ط¥ط·ظ„ط§ظ‚ ظ†ط§ط± ط¹ظ…ظˆط¯ظٹط© ط¨ط£ط³ظ„ظˆط¨ ط§ظ„ط¨ظƒط³ظ„ ط¢ط±طھطŒ ظ…ط³طھظˆط­ط§ط© ظ…ظ† *Terra Cresta* ط§ظ„ظƒظ„ط§ط³ظٹظƒظٹط©طŒ ط¨ظڈظ†ظٹطھ ط¨ظ…ط³ط§ط¹ط¯ط© ط§ظ„ط°ظƒط§ط، ط§ظ„ط§طµط·ظ†ط§ط¹ظٹ ظˆط¨ط¯ظˆظ† ط£ظٹ ظ…ظƒطھط¨ط§طھ ط®ط§ط±ط¬ظٹط©.

### â–¶ Play the live build آ· ط¬ط±ظ‘ط¨ظ‡ط§ ط§ظ„ط¢ظ†

**<https://ly.id.ly/Cyber-Michelangelo/>** â€” deployed straight from this repository (GitHub Pages mirror).
A Cloudflare Pages deployment with a custom domain is planned next.

### What's new in v1.1

- **Readability pass:** dark-outlined sprites, brighter weapon cores, stronger enemy eyes and a light halo behind the player craft.
- **Fairer opening:** first pod cluster on wave 1, missed clusters retry next wave, **2 starting NOVA charges**, longer **8.5 s Phoenix**, calmer first wave.
- **First-run tutorial:** a short hint line teaches the pod â†’ module loop during the first seconds of stage 1.

![Title screen](screenshots/title.png)

---

## Play now آ· ط´ط؛ظ‘ظ„ ط§ظ„ظ„ط¹ط¨ط©

Requires **Node.js 18+** (already installed here). There are **no npm dependencies**, so nothing to install â€” even offline:

```bash
npm start          # â†’ http://127.0.0.1:5173
```

Then open <http://127.0.0.1:5173> in any modern browser. That's it.

> ظٹطھط·ظ„ط¨ Node.js 18+ ظپظ‚ط·طŒ ظˆظ„ط§ ظٹط­طھط§ط¬ ط£ظٹ `npm install` ظ„ط£ظ†ظ‡ ط¨ط¯ظˆظ† ظ…ظƒطھط¨ط§طھ ط®ط§ط±ط¬ظٹط©. ط´ط؛ظ‘ظ„ `npm start` ط«ظ… ط§ظپطھط­ ط§ظ„ط±ط§ط¨ط·.

### Deploy on Cloudflare Pages (static hosting)

The game is a pure static site â€” perfect for **Cloudflare Pages** and later a custom domain:

1. Push this repository to GitHub.
2. In the Cloudflare dashboard â†’ **Workers & Pages â†’ Create â†’ Pages â†’ Connect to Git**, choose the `Cyber-Michelangelo` repository.
3. Settings:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty â€” there is no build step)*
   - **Build output directory:** `/`
4. Deploy. The game is served at `https://<project>.pages.dev`; add a **custom domain** under *Custom domains* whenever you like (Cloudflare manages the TLS certificate automatically).

`_headers` (security/caching headers), `_redirects` (`/play` â†’ `/`), and a themed `404.html` are included. `server.mjs` is only for local development and is not required in production.

#### Deploy without the dashboard (Direct Upload API)

A zero-dependency deploy script is included â€” ideal for CI or for hosting without connecting GitHub:

```bash
# token needs "Account â†’ Cloudflare Pages â†’ Edit"
export CLOUDFLARE_API_TOKEN=...        # Windows: $env:CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID=...

npm run deploy -- --dry-run   # list the 56 files that will be uploaded
npm run deploy                # creates the Pages project (first run) + deploys
```

It prints the deployment URL (`https://<project>.pages.dev`). Add the custom domain once under **Pages â†’ Custom domains** (Cloudflare creates the DNS record + certificate automatically when the zone is on the same account).

> Why Direct Upload matters here: the current live mirror (`ly.id.ly`) is fronted by Cloudflare's proxy, and GitHub Pages serves JS with a 4-hour `max-age`. Cloudflare Pages respects this repo's `_headers` (`must-revalidate`), so every deploy becomes visible immediately.

---

## Controls آ· ط§ظ„طھط­ظƒظ…

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | `â†گ â†‘ â†’ â†“` / `WASD` | Left stick / D-pad | Drag anywhere (relative) |
| Fire | `Z` / `Space` / `J` (hold) | A | Auto-fire while dragging |
| Transform (split / Phoenix) | `X` / `K` / `Shift` | X | `FORM` button |
| Nova bomb | `B` / `L` | B | `NOVA` button |
| Pause | `Esc` / `P` | Start | âڈ¸ button |
| Mute | `M` | â€” | â€” |
| Fullscreen | `F` | â€” | â€” |

Menus: `â†‘ â†“` + `Enter`; `Esc` = back. Auto-fire can also be enabled for keyboard in **Options**.

---

## The game آ· ط§ظ„ظ„ط¹ط¨ط©

### 1. Core ship â€” Alpha Unit
A twin-laser craft with a forgiving 4-pixel core hitbox and a banked, weighty feel.

### 2. Shoot the pods, earn the modules
Ground relics scroll into view in clusters of four. **Destroy every pod in a cluster** to release the module capsule it guards â€” the cluster carries the number of the piece you still need (`2`, `3`, `4`, `5`). Let the pods scroll past and the **cluster retries on the very next wave**, so a missed cluster never costs a whole stage.

> ط£ط·ظ„ظ‚ ط§ظ„ظ†ط§ط± ط¹ظ„ظ‰ ط§ظ„طµظˆط§ظ…ط¹ ط§ظ„ط£ط±ط¶ظٹط© ط§ظ„ط£ط±ط¨ط¹ط© ظپظٹ ظƒظ„ ظ…ط¬ظ…ظˆط¹ط© ظ„طھظڈط­ط±ظ‘ط± ظƒط¨ط³ظˆظ„ط© ط§ظ„ظˆط­ط¯ط© ط§ظ„ظ…ط±ظ‚ظ‘ظ…ط©طŒ ط«ظ… ط§ظ„طھظ‚ط·ظ‡ط§ ظ„طھظ„طھط­ظ… ط¨ط³ظپظٹظ†طھظƒ â€” ظˆط¥ط°ط§ ظپظˆظ‘طھ ظ…ط¬ظ…ظˆط¹ط© ظپط³طھط¹ظˆط¯ ظپظٹ ط§ظ„ظ…ظˆط¬ط© ط§ظ„طھط§ظ„ظٹط©.

The four modules, each with its own role:

| # | Module | Weapon / role |
| --- | --- | --- |
| 2 | **BETA** â€” Auxiliary Fire | Twin side cannons; doubles forward fire density |
| 3 | **GAMMA** â€” Rear Cannon | Downward-outward rear shots cover your six |
| 4 | **DELTA** â€” Concussive Beam | Periodic piercing lance that shreds big targets |
| 5 | **EPSILON** â€” Rear Force Field | A green aura that erases enemy bullets near the ship |

Every docked module is also **one absorbed hit**. A hit removes the outermost piece instead of your life â€” the original's famous modular damage buffer.

### 3. Formation split â€” the transform key
With **1â€“3 pieces docked**, press `X` to make the pieces split into a tactical formation around the hull:

- **1 piece â†’ ESCORT** â€” a halo orbit.
- **2 pieces â†’ MOON** â€” a crescent guarding the nose.
- **3 pieces â†’ EXTEND** â€” a sweeping echelon line, "helicopter fire".

While split, the pieces are **invulnerable and fire faster**, but the main hull is **not**. A hit on the hull reverts you to a singular craft and all pieces are lost â€” risk / reward. The formation auto-rejoins after 3.4 s, then needs a short cooldown.

### 4. Phoenix transformation
Collect **all four pieces**, then press `X`. The craft becomes the **invincible flaming Phoenix** for 8.5 s: it flies faster, clears bullets, destroys enemies by contact, pours out a triple flame stream and doubles score gains. When the fire dies down, the four pieces **burn out** â€” rebuild by hunting new pod clusters.

### 5. Nova bomb
Start each run with **two** NOVA charges (max 3). Press `B` to erase every enemy bullet on screen, invincibly flash, and deal heavy damage to everything nearby. Charges drop from Goliath gunships, bosses and score milestones.

### 6. Endless looped stages
Five procedural waves per stage, then a boss. Three hand-built environments cycle endlessly:

1. **THE MARBLE GARDENS** â€” floating classical ruins over a nebula.
2. **THE NEON CATACOMBS** â€” runed caverns of bioluminescent crystal.
3. **THE GRID CATHEDRAL** â€” gothic spires above a perspective grid.

Each loop raises enemy HP, bullet speed, fire rate and formation density (`DIFFICULTY` in `src/game/config.js`). Every stage ends with a **Null Court Colossus** â€” a three-phase marble war-mask with destructible hands, aimed bursts, rings, bullet walls and spirals.

### 7. Scoring
Wave clears, boss kills, pod clusters, Phoenix bonuses and a kill-chain multiplier (up to **أ—8**, decaying over 2.2 s) feed an arcade score. Extra lives at 30 000, 80 000, 150 000, 250 000, 400 000, 600 000 and 850 000 points. High scores persist in `localStorage`.

---

## Screenshots آ· ظ„ظ‚ط·ط§طھ

| Gameplay | Boss |
| --- | --- |
| ![Gameplay](screenshots/game.png) | ![Boss](screenshots/boss.png) |

| Phoenix | Formation |
| --- | --- |
| ![Phoenix](screenshots/phoenix.png) | ![Formation](screenshots/formation.png) |

| Catacombs | Grid Cathedral |
| --- | --- |
| ![Catacombs](screenshots/catacombs.png) | ![Cathedral](screenshots/cathedral.png) |

---

## Project structure

```
index.html            page shell (canvas 4:7 portrait cabinet)
styles.css            cabinet framing, boot overlay
server.mjs            zero-dependency static server (node server.mjs)
src/
  main.js             bootstrap: canvas, input, audio, fixed 60 Hz loop, URL test hooks
  core/
    math.js           deterministic RNG, easing, geometry helpers
    storage.js        safe localStorage wrapper + high scores/settings
    input.js          keyboard + gamepad + relative-drag touch
    audio.js          procedural WebAudio chiptune + 30 SFX (no audio files)
  game/
    config.js         all tunables: player, modules, enemies, boss, scoring, difficulty
    formations.js     pure formation choreography
    waves.js          deterministic stage/wave generator (pure)
    player.js         Alpha craft, docking, formation split, Phoenix, damage buffer
    enemies.js        eight enemy behaviours + spawn factories
    boss.js           three-phase Colossus fight
    game.js           DOM-free state machine: scenes, waves, collisions, scoring, lives
  render/
    palette.js        the "digital Renaissance" colour system, three stage themes
    pixel.js          pixel-buffer primitives, sprite compiler, glow/particle helpers
    pixelfont.js      5أ—7 bitmap font
    sprites.js        hand-authored pixel art (all assets generated at runtime)
    background.js     deterministic parallax environments
    title.js          title/attract screen
    hud.js            HUD, boss bar, banners, popups, touch controls
    screens.js        how-to-play, credits, options, pause, game over
    renderer.js       full renderer + particle/FX system
  ui/touch.js         touch-control layout shared by input & renderer
tests/
  smoke.mjs           41 pure-logic tests (Node, no DOM)
  syntax.mjs          parse-check every source module
tools/capture.ps1     headless-Edge screenshot helper used for visual verification
docs/GAME_DESIGN.md   full design/technical specification
research/             preserved prior Terra Cresta research report site (reference only)
```

### Architecture in one paragraph
Simulation is a **DOM-free state machine** (`Game`) updated at a fixed 1/60 s step; rendering, audio and visual FX are injected as small interfaces. Every sprite is compiled at runtime from character maps (`sprites.js`), every sound is synthesised (`audio.js`), and every background is generated from a seeded RNG (`background.js`). The world renders into a **240أ—420 pixel buffer** that is upscaled with nearest-neighbour filtering to the display canvas, giving crisp arcade pixels at any size. This makes the game deterministic and testable headlessly, with no asset pipeline and no network access.

---

## Verification آ· ط§ظ„طھط­ظ‚ظ‚

```bash
npm test                    # 41 logic tests, all green
node tests/syntax.mjs       # every module parses
```

Browser self-test (renders every scene and asserts canvas output):

```
http://127.0.0.1:5173/?selftest=1&noboot=1     â†’ DOM gets {ok: true, results: [...]}
```

Screenshot helpers used during development (headless Edge):

```
node server.mjs
powershell -File tools/capture.ps1 -Shots "title|?noboot=1;game|?scene=game&sim=26&freeze=1&noboot=1"
```

Debug URL hooks: `?scene=game|boss|phoenix|formation|catacombs|cathedral|gameover|howto|credits|options`, `&sim=SECONDS`, `&freeze=1`, `&touch=1`, `&seed=N`, `&mute=1`, `&fps=1`, `&noscanlines=1`.

---

## Credits & attribution آ· ط§ظ„ط´ظƒط± ظˆط§ظ„ط­ظ‚ظˆظ‚

- **Inspired by *Terra Cresta*** (Nichibutsu, 1985) â€” designed by **Shigeki Fujiwara**, music by **Kenji Yoshida**. Its modular power-up and formation-split system is the direct design ancestor of this project.
- Series context: ***Moon Cresta*** (1980), ***Terra Cresta*** (1985), ***Sol Cresta*** (2022, PlatinumGames).
- **Cyber Michelangelo** is an original, non-commercial homage. **No original game code, art, names or audio assets were used** â€” every pixel and every sound is generated procedurally in this repository.
- Built with **AI assistance** (DeepSeek agent) for design, code, art and audio.
- The `research/` folder preserves an independent Arabic research report on the *Cresta* series that informed the design; it is reference material and is not required to play.

**License:** MIT.

---

## ط§ظ„ط®ظ„ط§طµط© ط¨ط§ظ„ط¹ط±ط¨ظٹط©

**ط³ط§ظٹط¨ط± ظ…ط§ظٹظƒظ„ ط£ظ†ط¬ظ„ظˆ** ظ„ط¹ط¨ط© ط´ظˆطھط± ط¹ظ…ظˆط¯ظٹط© ط¨ط£ط³ظ„ظˆط¨ ط§ظ„ط¨ظƒط³ظ„ ط¢ط±طھطŒ ظ…ط³طھظˆط­ط§ط© ظ…ظ† *Terra Cresta* (1985) ظ…ط¹ ط¥ط¹ط§ط¯ط© طھطµظˆظ‘ط± ظپظ†ظٹط© آ«ظ†ظ‡ط¶ط© ط±ظ‚ظ…ظٹط©آ»:
ط³ظپظٹظ†ط© ط£ظ„ظپط§ ط§ظ„ط£ط³ط§ط³ظٹط©طŒ ظˆط£ط±ط¨ط¹ ظˆط­ط¯ط§طھ ظ‚طھط§ظ„ظٹط© (ط¨ظٹطھط§طŒ ط؛ط§ظ…ط§طŒ ط¯ظ„طھط§طŒ ط¥ط¨ط³ظٹظ„ظˆظ†) طھظڈط­ط±ظژظ‘ط± ط¨ط¥ط³ظ‚ط§ط· ط§ظ„طµظˆط§ظ…ط¹ ط§ظ„ط£ط±ط¶ظٹط© ظˆطھظ„طھط­ظ… ط¨ط§ظ„ط³ظپظٹظ†ط© ظپطھظ…ظ†ط­ظ‡ط§ ظ‚ظˆط© ظ†ط§ط±ظٹط© ط¥ط¶ط§ظپظٹط© ظˆطھظ…طھطµ ط§ظ„ط¶ط±ط¨ط§طھ ط¨ط¯ظ„ط§ظ‹ ظ…ظ†ظƒ.
ط§ط¶ط؛ط· ط²ط± ط§ظ„طھط­ظˆظٹظ„ `X` ظ„طھظپظƒظٹظƒ ط§ظ„ظˆط­ط¯ط§طھ ظپظٹ طھط´ظƒظٹظ„ط§طھ ظ‚طھط§ظ„ظٹط© ظ…ط¤ظ‚طھط© (ط§ظ„ظ‡ظ„ط§ظ„طŒ ط§ظ„طھظ…ط¯ط¯طŒ ط§ظ„ط­ط±ط§ط³ط©) â€” ط§ظ„ظ‚ط·ط¹ ظ…ظ†ظٹط¹ط© ط£ط«ظ†ط§ط، ط§ظ„ط§ظ†ظپطµط§ظ„ ظ„ظƒظ† ط¬ط³ظ… ط§ظ„ط³ظپظٹظ†ط© ظ…ظƒط´ظˆظپط› ظˆط¥ط°ط§ ط¬ظ…ط¹طھ ط§ظ„ظ‚ط·ط¹ ط§ظ„ط£ط±ط¨ط¹ ظپط§ط¶ط؛ط· `X` ظ„طھطھط­ظˆظ„ ط¥ظ„ظ‰ **ط·ط§ط¦ط± ط§ظ„ط¹ظ†ظ‚ط§ط، ط§ظ„ظ†ط§ط±ظٹ** ط§ظ„ط°ظٹ ظ„ط§ ظٹظڈظ‚ظ‡ط± ظ„ط¯ظ‚ط§ط¦ظ‚. ط£ط¶ظپ ط¥ظ„ظ‰ ط°ظ„ظƒ ظ‚ظ†ط¨ظ„ط© **NOVA** ط§ظ„ظ…ط§ط³ط­ط© ظ„ظ„ط´ط§ط´ط©طŒ ظˆظ…ط¶ط§ط¹ظپط§طھ ط§ظ„ظ†ظ‚ط§ط·طŒ ظˆط«ظ„ط§ط« ط¨ظٹط¦ط§طھ ظ…طھط¬ط¯ط¯ط©طŒ ظˆط²ط¹ظ…ط§ط، ظ…ط±ط­ظ„ظٹظ†طŒ ظˆظ…ظˆط³ظٹظ‚ظ‰ ظˆظ…ط¤ط«ط±ط§طھ ظ…ظˆظ„ظ‘ط¯ط© ط±ظ‚ظ…ظٹط§ظ‹. طھط¹ظ…ظ„ ط§ظ„ظ„ط¹ط¨ط© ط¨ط§ظ„ظƒط§ظ…ظ„ ط¨ط¯ظˆظ† ط¥ظ†طھط±ظ†طھ ظˆط¨ط¯ظˆظ† ط£ظٹ ظ…ظƒطھط¨ط§طھطŒ ظˆظ…ط®طھط¨ظژط±ط© ط¨ظ€ 39 ط§ط®طھط¨ط§ط±ط§ظ‹ ظ…ظ†ط·ظ‚ظٹط§ظ‹ ظˆظپط­ظˆطµط§طھ ط¨طµط±ظٹط© ط¢ظ„ظٹط©.

