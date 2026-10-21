# CC0 soundtrack — provenance & attribution

The tracks in this folder are an **optional** alternative to the game's
procedural chiptune soundtrack (`src/core/audio.js`). They are only downloaded
by the browser when the player selects **Options → MUSIC STYLE → CC0 MUSIC**
(or opens the game with `?cc0music=1`).

All four files are licensed **CC0 1.0 Universal (Public Domain Dedication)**:
<https://creativecommons.org/publicdomain/zero/1.0/>

Attribution is not legally required under CC0, but we credit the authors here
and in the in-game Credits screen because their work made this option possible.

| File in this folder | Track | Author / credit | Source (CC0) | Original file |
| --- | --- | --- | --- | --- |
| `title-galactic-temple.ogg` | Galactic Temple | **yd** | <https://opengameart.org/content/galactic-temple> | `GalacticTemple.ogg` from `GalacticTemple.zip` |
| `stage-high-energy.ogg` | High-Energy Adventure Theme (main theme) | **SRG774** | <https://opengameart.org/content/high-energy-adventure-theme-130-bpm> | `main.ogg` from `complete.zip` |
| `boss-fast-fight.wav` | Fast fight / battle music (looped) | Loop edit by **XCVG** of music by **Ville Nousiainen** | <https://opengameart.org/content/fast-fight-battle-music-looped> (original: <https://opengameart.org/content/fast-fight-battle-music>) | `fight_looped.wav` |
| `gameover-dark-intro.ogg` | Dark Intro | **Nikke** | <https://opengameart.org/content/dark-intro> | `Dark Intro_0.ogg` |

Notes:

- Files were downloaded from the OpenGameArt pages above and **renamed only** —
  the audio data is unmodified. Looping is applied at playback time
  (`AudioBufferSourceNode.loop = true`).
- The "Fast fight" loop edit page asks, entirely optionally, for credit to
  Ville Nousiainen and/or a link to <https://soundcloud.com/mutkanto>; we do
  both here.
- If a track is missing or cannot be decoded, the game automatically falls back
  to the procedural chiptune so gameplay/audio never breaks.
- Track usage is per the OpenGameArt license declarations on the pages above;
  if you redistribute this game, keep this file with it.
