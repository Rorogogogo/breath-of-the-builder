import * as THREE from 'three';
import { terrainHeight } from './terrain';
import { playSparkle } from '../audio';

/**
 * fairy.ts — a small glowing companion that drifts beside the hero and,
 * when the player seems lost (or just left a shrine), flies a short way
 * toward the nearest undiscovered shrine before returning. A companion,
 * not a tour guide: subtle, infrequent, easily ignored.
 */

const FOLLOW_OFFSET = new THREE.Vector3(1.2, 1.8, 0.8);
const GUIDE_DIST = 20;
const IDLE_TRIGGER = 7; // seconds without movement input
const COOLDOWN = 20;
const OUT_TIME = 1.7;
const HOLD_TIME = 0.9;

const easeInOut = (u: number): number => u * u * (3 - 2 * u);

export interface Fairy {
  /** call every frame; `targets` = positions of undiscovered shrines */
  update: (dt: number, t: number, playerPos: THREE.Vector3, targets: THREE.Vector3[], inputActive: boolean) => void;
  /** request a guidance flight soon (e.g. the player just closed a panel) */
  nudge: () => void;
}

export function createFairy(scene: THREE.Scene): Fairy {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );

  // soft additive halo from a canvas radial gradient
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c2 = cv.getContext('2d')!;
  const grad = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(159,242,255,0.95)');
  grad.addColorStop(0.35, 'rgba(159,242,255,0.35)');
  grad.addColorStop(1, 'rgba(159,242,255,0)');
  c2.fillStyle = grad;
  c2.fillRect(0, 0, 64, 64);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  halo.scale.setScalar(1.5);

  const light = new THREE.PointLight('#9ff2ff', 8, 6, 2);
  group.add(core, halo, light);
  scene.add(group);

  const pos = new THREE.Vector3(1.2, 4, -72); // beside the spawn point
  group.position.copy(pos);

  type Phase = 'follow' | 'out' | 'hold' | 'return';
  let phase: Phase = 'follow';
  let phaseT = 0;
  let idle = 0;
  let cooldown = 0;
  let nudged = false;
  const guideFrom = new THREE.Vector3();
  const guideTo = new THREE.Vector3();
  const home = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function nearestTarget(playerPos: THREE.Vector3, targets: THREE.Vector3[]): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const p of targets) {
      const d = p.distanceToSquared(playerPos);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  return {
    nudge: () => {
      nudged = true;
    },

    update(dt, t, playerPos, targets, inputActive): void {
      cooldown = Math.max(0, cooldown - dt);
      idle = inputActive ? 0 : idle + dt;

      home.set(
        playerPos.x + FOLLOW_OFFSET.x,
        playerPos.y + FOLLOW_OFFSET.y + Math.sin(t * 2.3) * 0.16,
        playerPos.z + FOLLOW_OFFSET.z
      );

      if (phase === 'follow') {
        const wantGuide = (idle > IDLE_TRIGGER || nudged) && cooldown === 0 && targets.length > 0;
        nudged = false; // one shot — consumed (or dropped) every frame
        if (wantGuide) {
          const target = nearestTarget(playerPos, targets)!;
          tmp.copy(target).sub(playerPos);
          tmp.y = 0;
          const dist = Math.min(GUIDE_DIST, tmp.length() - 4);
          if (dist > 6) {
            tmp.normalize().multiplyScalar(dist);
            guideFrom.copy(pos);
            guideTo.set(playerPos.x + tmp.x, 0, playerPos.z + tmp.z);
            guideTo.y = Math.max(terrainHeight(guideTo.x, guideTo.z) + 2.8, playerPos.y + 2.2);
            phase = 'out';
            phaseT = 0;
            idle = 0;
            playSparkle();
          } else {
            // already close to the shrine — no flight needed, just wait
            cooldown = COOLDOWN;
          }
        }
        // loose spring follow
        const l = 1 - Math.exp(-dt * 4);
        pos.lerp(home, l);
      } else if (phase === 'out') {
        phaseT += dt;
        const u = easeInOut(Math.min(1, phaseT / OUT_TIME));
        pos.lerpVectors(guideFrom, guideTo, u);
        if (phaseT >= OUT_TIME) {
          phase = 'hold';
          phaseT = 0;
        }
      } else if (phase === 'hold') {
        phaseT += dt;
        pos.copy(guideTo);
        pos.y += Math.sin(t * 4) * 0.2;
        if (phaseT >= HOLD_TIME) {
          phase = 'return';
          phaseT = 0;
          cooldown = COOLDOWN;
        }
      } else {
        // return: chase the (moving) home point until we're back
        const l = 1 - Math.exp(-dt * 3.2);
        pos.lerp(home, l);
        if (pos.distanceTo(home) < 1.1) phase = 'follow';
      }

      // never sink into the ground
      const floor = terrainHeight(pos.x, pos.z) + 0.5;
      if (pos.y < floor) pos.y = floor;

      group.position.copy(pos);

      // gentle shimmer; brighter pulse while guiding
      const guiding = phase === 'out' || phase === 'hold';
      const pulse = guiding ? 15 + Math.sin(t * 9) * 4 : 8 + Math.sin(t * 5.2) * 1.4;
      light.intensity = pulse;
      halo.scale.setScalar(guiding ? 1.9 + Math.sin(t * 9) * 0.2 : 1.5 + Math.sin(t * 5.2) * 0.08);
    },
  };
}
