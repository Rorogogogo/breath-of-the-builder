# ⚔️ Breath of the Builder — Portfolio v3

A **Zelda-inspired open-world 3D portfolio** for Robert Wang. You play a small
low-poly hero dropped onto a cel-shaded island. Every project is a **glowing
shrine** with a beacon of light shooting into the sky — walk up, press **E**,
and the shrine opens a quest-log style panel with the project's story, metrics,
tech, and links. Discover all 7 shrines to complete the island.

All geometry is **original primitives** built in code — no Nintendo assets, no
downloaded models, no textures. The whole world is generated at runtime from a
deterministic noise function.

## Stack

- **Vite** + **TypeScript** — instant dev server, no framework overhead in the game loop
- **three.js** (vanilla) — cel-shaded (`MeshToonMaterial` + gradient map) low-poly world
- Zero other runtime dependencies; UI is plain HTML/CSS on top of the canvas

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # typecheck + production build → dist/
```

## Controls

| Input | Action |
| ----- | ------ |
| **WASD / arrows** | move (camera-relative) |
| **drag mouse** | orbit camera · **wheel** zoom |
| **Shift** | sprint (drains the stamina wheel, BotW-style — hit zero and you're winded) |
| **Space** | jump |
| **E / Enter** | examine a shrine · close panel (also **Esc**) |
| **Touch** | left-bottom = virtual joystick (push far to sprint), drag elsewhere = camera, gold **E** button to interact |

## How it's built

- `src/data.ts` — **single source of truth** for all content (ported from v2). Search `REPLACE` for placeholder links.
- `src/world/terrain.ts` — deterministic fBm value-noise island; `terrainHeight(x, z)` drives the mesh, object placement, player ground clamp, and camera collision. Terrain auto-flattens a plateau around every shrine.
- `src/world/vegetation.ts` — instanced trees / rocks / flowers + 2,600 grass blades swaying via a vertex-shader injection (`onBeforeCompile`).
- `src/world/shrines.ts` — project shrines (floating gem + rune ring + additive sky beam), the builder's cabin, and the traveler's dock. Discovered shrines turn their beam gold.
- `src/world/water.ts` / `sky.ts` — toon ocean with shader waves; gradient sky dome, drifting low-poly clouds, warm afternoon sun with soft shadows.
- `src/player.ts` — procedural walk cycle, sprint + stamina, jump/gravity, orbit-follow camera with terrain collision.
- `src/ui.ts` + `index.html` — Zelda-style HUD: quest tracker, stamina wheel, discovery toasts, gold-cornered shrine panel.
- `src/audio.ts` — WebAudio synth chimes (discovery arpeggio); no audio files.

## What to replace

- `src/data.ts` → `REPLACE` markers: GitHub / LinkedIn / live-demo links, resume.
- `public/resume.pdf` → drop a real resume PDF.
- `flatFallbackUrl` → point the title screen's "recruiter in a hurry" link at a hosted flat portfolio (v1).

## Version history

- **v1** — `../v1-new-portfolio` — classic Next.js/MUI site ([repo](https://github.com/Rorogogogo/New-Portfolio))
- **v2** — `../v2-builder-island` — *A Developer Manga*, inked B&W side-scroller
- **v3** — this — *Breath of the Builder*, open-world 3D island
