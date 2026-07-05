# Plan — "Make it a complete little game" (v3 richness batch)

Four features, agreed with Robert on 2026-07-05, to take *Breath of the Builder*
from tech demo to complete game loop: **Paraglider, Fairy companion,
Region-name banners, Completion ending.** Build in that order — each is
independently shippable.

## Context (read first)

- Project: `~/Downloads/work/portfolio/v3-breath-of-the-builder` — Vite + TS +
  vanilla three.js (only dep: `three`). `npm run dev` (Vite default :5173),
  `npm run build` = tsc + vite build.
- Architecture: `src/main.ts` (loop + wiring), `src/player.ts` (movement/camera/
  stamina/procedural anim), `src/world/terrain.ts` (**`terrainHeight(x,z)` is the
  shared deterministic ground truth**), `src/world/shrines.ts` (7 sites, returns
  `{ shrines, update, markDiscovered }`), `src/ui.ts` (HUD/panel/toasts, tracks
  `discovered` set), `src/audio.ts` (generative music + chimes), `src/data.ts`
  (all content).
- Hard constraints: **no Nintendo assets or melodies** (original everything);
  all copy lives in `data.ts`; hero has **no ink outlines** (user removed them),
  world objects keep them (`world/outline.ts`, size-proportional); don't touch
  `../v1-new-portfolio` (own GitHub repo).
- Verify pattern: `npx tsc --noEmit`, then headless Chrome via puppeteer-core at
  `../v2-builder-island/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js`
  + `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  (flags: `--no-sandbox --use-gl=angle --autoplay-policy=no-user-gesture-required`),
  click `#btn-start`, drive keys, screenshot, assert no pageerrors.

## 1. Paraglider (player.ts, small ui hint)

- **Trigger:** hold **Space** while airborne and falling (`!grounded && velY < 0`).
  Release / land / stamina empty → cancel.
- **Physics:** while gliding clamp `velY` to ~-2.8 (lerp toward it), air speed ~8.5,
  full steering; stamina drain ~10/s (reuse sprint drain path; exhausted rule applies).
- **Visuals:** build a canopy group in `buildMesh` (hidden by default): curved
  cloth = 3–4 arched box/cylinder segments in parchment `#efe6cf` with wooden
  struts + 2 rope lines to hands; show only while gliding. Pose: both arms up
  (`rotation.x ≈ -2.6`), legs dangle, body pitch slight forward. Scarf already
  streams (speed-based) — looks great here for free.
- **Camera:** +6° FOV while gliding (lerp), gives speed feel.
- **HUD:** add "hold Space in air — glide" to `#controls-hint` and title screen hint.
- Touch: holding the jump area = second tap-and-hold on right side — keep simple:
  the E button doubles as glide-hold in air? No — add small second touch button
  (🪂) that appears only while airborne.

## 2. Fairy companion (`src/world/fairy.ts`, wire in main.ts)

- **Look:** core sphere (0.12, white, emissive) + additive glow sprite/halo +
  small PointLight (teal `#9ff2ff`, intensity ~8, dist 6). Bobs on sine, orbits
  loosely at offset (~1.2, 1.8, 0.8) from player via spring/damp follow.
- **Guidance:** if (no movement input for >7s && at least one undiscovered shrine)
  OR just closed a panel with shrines remaining → fairy flies ~20 units toward
  nearest undiscovered shrine (ease out/in), pulses brighter, then returns.
  Cooldown ~20s. Expose `fairy.update(dt, playerPos, targets)`.
- **Audio:** tiny sparkle chime (existing `tone()` helper) when she starts guiding.
- Keep it subtle — companion, not tour guide.

## 3. Region-name banners (ui.ts + index.html + style.css)

- **Trigger:** first time player comes within ~13 units of a site (separate
  `visited` set — distinct from `discovered`, which requires pressing E).
  Suppress while panel open or title screen up.
- **Visual:** BotW area-discovery style — thin gold rules above/below, shrine
  name in Cinzel, letter-spaced, fades in 0.6s, holds 2s, fades 0.8s. Optional
  soft low horn note (original, single tone) on appear.
- Data: use `site.shrineName`. Markup: one `#region-banner` div, CSS keyframes.

## 4. Completion ending (main.ts + shrines.ts + ui.ts + audio.ts)

- **Trigger:** `discovered.size === sites.length` and the final panel closes.
  Run once; afterwards free-roam continues.
- **Sequence (~10s):**
  1. Block input; lerp camera up/back to a high island-wide orbit.
  2. `shrines.celebrate()`: all beams → gold, widen ×2, opacity up.
  3. Fireworks: ~6 bursts over the island — one InstancedMesh of ~400 tiny
     spheres, per-burst velocity + gravity + fade in the loop (or additive
     `THREE.Points`). Colors from site accents.
  4. `playFanfare()` in audio.ts — short **original** triumphant figure
     (e.g. C–E–G–A–G arpeggio, layered 3rds; do NOT quote the Zelda "item get").
  5. Credits card overlay (reuse panel styling): "The island remembers you" +
     name, role, tagline + **Email / Resume / GitHub / LinkedIn** buttons
     (links from `data.ts` profile) + "Keep exploring" button to dismiss.
- This is the recruiter CTA moment — links must be prominent.

## Order & verification

Ship one feature at a time: implement → `npx tsc --noEmit` → headless smoke
(screenshot glide pose / fairy guiding / banner visible / ending card) → next.
Watch perf: fireworks instanced, fairy is 1 light (total point lights stays < 10).

## Backlog (agreed, not in this batch)

Collectible skill orbs surfacing the unused `skillTree` data from v2 → HUD
"Spirit of the Builder"; day–night cycle; grass bend/dust puffs/butterflies/
footstep sounds; swimming to replace the shoreline wall. Then: git init v3 +
deploy (static → Cloudflare Pages/Vercel), replace `REPLACE` links in data.ts,
add `public/resume.pdf`.
