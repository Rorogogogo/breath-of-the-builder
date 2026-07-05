import * as THREE from 'three';
import './style.css';
import { createTerrain, createSeaFloor, terrainHeight } from './world/terrain';
import { createWater } from './world/water';
import { createSky } from './world/sky';
import { createVegetation } from './world/vegetation';
import { createShrines } from './world/shrines';
import { createFairy } from './world/fairy';
import { createFireworks } from './world/fireworks';
import { createOrbs } from './world/orbs';
import { createCritters } from './world/critters';
import { createDust } from './world/dust';
import { Player } from './player';
import { Input } from './input';
import { UI } from './ui';
import {
  playDiscover, playClick, playCollect, playStart, playHorn, playFanfare, startMusic, toggleMusic,
} from './audio';
import { flatFallbackUrl, sites } from './data';

const INTERACT_RADIUS = 7;
const VISIT_RADIUS = 13;

/* ---------------- renderer / scene ---------------- */

const canvas = document.getElementById('game') as HTMLCanvasElement;
// phones: cap the pixel ratio harder — dpr-3 screens can't fill that many
// fragments with soft shadows at 60 fps
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const maxPixelRatio = coarsePointer ? 1.6 : 2;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#cfe4ee', 70, 420);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1600);

/* ---------------- world ---------------- */

scene.add(createTerrain());
scene.add(createSeaFloor());
const water = createWater();
scene.add(water.mesh);
const sky = createSky(scene, coarsePointer ? 1024 : 2048);
const vegetation = createVegetation(scene);
const { shrines, update: updateShrines, markDiscovered, celebrate } = createShrines(scene);
const fairy = createFairy(scene);
const fireworks = createFireworks(scene, sites.map((s) => s.accent));
const orbs = createOrbs(scene);
const critters = createCritters(scene);
const dust = createDust(scene);

const input = new Input(canvas);
const ui = new UI();
const player = new Player(scene);

/* ---------------- title / start flow ---------------- */

type Mode = 'title' | 'play';
let mode: Mode = 'title';

const titleEl = document.getElementById('title-screen')!;
document.getElementById('btn-skip')!.setAttribute('href', flatFallbackUrl);

function startGame(): void {
  if (mode === 'play') return;
  mode = 'play';
  playStart();
  startMusic();
  titleEl.classList.add('fade');
  setTimeout(() => titleEl.classList.add('hidden'), 1200);
  ui.showHud();
}

const musicBtn = document.getElementById('btn-music')!;
function onToggleMusic(): void {
  const on = toggleMusic();
  musicBtn.textContent = on ? '♪' : '♪̸';
  musicBtn.classList.toggle('off', !on);
}
musicBtn.addEventListener('click', onToggleMusic);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && mode === 'play') onToggleMusic();
});

document.getElementById('btn-start')!.addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame();
});

/* ---------------- interaction ---------------- */

function nearestShrine(): (typeof shrines)[number] | null {
  let best: (typeof shrines)[number] | null = null;
  let bestD = INTERACT_RADIUS;
  for (const s of shrines) {
    const d = Math.hypot(s.position.x - player.position.x, s.position.z - player.position.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/* ---------------- completion ending ---------------- */

let ending: { t: number; creditsShown: boolean } | null = null;
let endingDone = false;

function maybeStartEnding(): void {
  if (endingDone || !ui.allDiscovered) return;
  endingDone = true;
  ending = { t: 0, creditsShown: false };
  celebrate();
  fireworks.start();
  playFanfare();
}

// dev-only hook so the headless smoke test can reach the ending without
// walking to all seven shrines
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.__endingTest = (): void => {
    for (const s of shrines) {
      ui.discover(s.site);
      markDiscovered(s.site.id);
    }
    maybeStartEnding();
  };
  w.__pos = (): number[] => player.position.toArray();
  w.__cam = (): number[] => camera.position.toArray();
  w.__setPos = (x: number, z: number): void => {
    player.position.set(x, terrainHeight(x, z) + 0.1, z);
  };
  w.__orbs = (): number[][] =>
    orbs.orbs.filter((o) => !o.collected).map((o) => [o.position.x, o.position.y, o.position.z]);
  w.__phase = (p: number | null): void => sky.setPhase(p);
  w.__camDist = (): number => player.camDist;
}

/* ---------------- main loop ---------------- */

const clock = new THREE.Clock();
let sprintDustTimer = 0;

function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  water.update(t);
  sky.update(t);
  vegetation.update(t, mode === 'play' ? player.position : undefined);
  updateShrines(t);
  critters.update(t, sky.nightAmount());

  fireworks.update(dt);
  dust.update(dt);

  if (mode === 'title') {
    // slow cinematic orbit high above the island
    const a = t * 0.06;
    camera.position.set(Math.sin(a) * 150, 70 + Math.sin(t * 0.15) * 6, Math.cos(a) * 150);
    camera.lookAt(0, 8, 0);
  } else if (ending) {
    // completion sequence: rise to a slow island-wide orbit, then credits
    ending.t += dt;
    input.blocked = true;
    const a = ending.t * 0.09;
    const desired = new THREE.Vector3(Math.sin(a) * 125, 82, Math.cos(a) * 125);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 1.5));
    camera.lookAt(0, 6, 0);
    if (ending.t > 4.5 && !ending.creditsShown) {
      ending.creditsShown = true;
      ui.showCredits(() => {
        playClick();
        ending = null; // free roam continues
      });
    }
  } else {
    input.blocked = ui.panelOpen;
    player.update(dt, input, camera);
    ui.setStamina(player.stamina / 100, player.exhausted);
    ui.setJumpButton(player.airborne);

    // skill orbs, dust puffs, sea-rescue toast
    orbs.update(t, player.position, (orb) => {
      playCollect();
      ui.collectSkill(orb);
    });
    if (player.justLanded) dust.burst(player.position, 9, 0.45, 1.3);
    if (player.onGround && player.speed > 9.2) {
      sprintDustTimer -= dt;
      if (sprintDustTimer <= 0) {
        dust.burst(player.position, 2, 0.22, 0.8);
        sprintDustTimer = 0.16;
      }
    }
    if (player.justRescued) ui.toast('The sea carried you back to shore…');

    const undiscovered = shrines.filter((s) => !s.discovered).map((s) => s.position);
    const inputActive =
      ui.panelOpen ||
      Math.abs(input.state.moveX) > 0.01 ||
      Math.abs(input.state.moveY) > 0.01 ||
      input.state.jumpHeld;
    fairy.update(dt, t, player.position, undiscovered, inputActive);

    // first-approach region banners (suppressed while a panel is open)
    if (!ui.panelOpen) {
      for (const s of shrines) {
        const d = Math.hypot(s.position.x - player.position.x, s.position.z - player.position.z);
        if (d < VISIT_RADIUS && ui.visitRegion(s.site)) playHorn();
      }
    }

    const near = ui.panelOpen ? null : nearestShrine();
    ui.setPrompt(near ? `Examine — ${near.site.shrineName}` : null);

    if (near && input.state.interactPressed && !ui.panelOpen) {
      playClick();
      if (ui.discover(near.site)) {
        playDiscover();
        markDiscovered(near.site.id);
      }
      ui.openPanel(near.site, () => {
        playClick();
        fairy.nudge(); // point toward the next shrine when they leave this one
        maybeStartEnding(); // final panel closed with all 7 discovered
      });
    }
  }

  input.endFrame();
  renderer.render(scene, camera);
}

frame();

/* ---------------- resize ---------------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
