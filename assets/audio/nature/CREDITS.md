# NATURE soundtrack — provenance & attribution

These recordings power the **optional NATURE soundtrack style** of Cyber
Michelangelo (the default soundtrack is the synthesised *space-nature* ambience
in `src/core/space_ambience.js`, which needs no files). The NATURE style maps
each scene to a layered bed of real nature field recordings (forest, river,
wind, rain, thunder, cave water). All files are **public domain** or **CC0 1.0**
and are used here as-is (renamed only; looping/crossfading happens at runtime).

Attribution is not legally required for PD/CC0, but we credit every recordist
here and in the in-game Credits screen because their work makes this possible.

| File | Recording | Author / credit | Source | License |
| --- | --- | --- | --- | --- |
| `forest-ambience.ogg` | Forest ambience — birds, crows, insects and wind in the trees | **nille** | [Wikimedia Commons: 20090610 0 ambience.ogg](https://commons.wikimedia.org/wiki/File:20090610_0_ambience.ogg) · originally PDSounds.org record #707 | Public Domain (PDSounds.org release) |
| `river-stones.ogg` | Shallow small river with stony riverbed | **stephan** | [Wikimedia Commons: Shallow small river with stony riverbed.ogg](https://commons.wikimedia.org/wiki/File:Shallow_small_river_with_stony_riverbed.ogg) · PDSounds.org #99 | Public Domain (PDSounds.org release) |
| `rivulet-woods.ogg` | Welling rivulet in the woods | **stephan** | [Wikimedia Commons: Welling rivulet in the woods.ogg](https://commons.wikimedia.org/wiki/File:Welling_rivulet_in_the_woods.ogg) · PDSounds.org #100 | Public Domain (PDSounds.org release) |
| `wind.ogg` | Wind (loopable, synthesised to sound natural) | **Écrivain** | [OpenGameArt: Icy Heights](https://opengameart.org/content/icy-heights) | CC0 1.0 |
| `rain-thunder.ogg` | Natural rain with a long thunder clap | **WuxiaScrub** | [OpenGameArt: Rain + Long Thunder](https://opengameart.org/content/rain-long-thunder) | CC0 1.0 |
| `rain-soft.ogg` | Soft loopable rain (extracted from a 4-loop pack) | **Ylmir** | [OpenGameArt: Rain (loopable)](https://opengameart.org/content/rain-loopable) — `2.ogg` from `Rain OGG.zip` | CC0 1.0 |
| `cavern.ogg` | Dark cavern ambience (water, wind, resonance; assembled from CC0 sources) | **Paul Wortmann** | [OpenGameArt: Dark Cavern Ambient](https://opengameart.org/content/dark-cavern-ambient) | CC0 1.0 |

License links: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) ·
[PDSounds.org public-domain statement](http://www.pdsounds.org/help/what_can_i_find_here)

Notes:

- No file content was edited; only renamed (`2.ogg` → `rain-soft.ogg`). The game
  crossfades loops and randomises short accents at playback time.
- The wind file is a synthesised wind design (not a field recording); it is used
  at low level purely as an air layer. All other recordings are natural.
- Scenes: title = forest + wind (+ rivulet accent); gardens = river + forest;
  catacombs = cavern + rivulet; cathedral = wind + faint storm; boss = storm
  (rain/thunder + stronger wind); game-over = soft rain.
- If a browser cannot decode a file, that layer falls back to filtered-noise
  synthesis so gameplay audio never breaks.
- Keep this file with the game if you redistribute these assets.
