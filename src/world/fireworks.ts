import * as THREE from 'three';

/**
 * fireworks.ts — celebration bursts for the completion ending. One additive
 * THREE.Points cloud (~420 particles in 6 staggered bursts), so the whole
 * show costs a single draw call and no lights.
 */

const BURSTS = 6;
const PER_BURST = 70;
const COUNT = BURSTS * PER_BURST;
const BURST_GAP = 1.1; // seconds between bursts
const LIFE = 2.3; // particle lifetime
const GRAV = -7;

export interface Fireworks {
  start: () => void;
  update: (dt: number) => void;
}

export function createFireworks(scene: THREE.Scene, accents: string[]): Fireworks {
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const baseColors: THREE.Color[] = [];
  const burstCenters: THREE.Vector3[] = [];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.4,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);

  let active = false;
  let t = 0;

  return {
    start: () => {
      active = true;
      t = 0;
      burstCenters.length = 0;
      baseColors.length = 0;
      for (let b = 0; b < BURSTS; b++) {
        const ang = (b / BURSTS) * Math.PI * 2 + Math.random() * 0.8;
        burstCenters.push(
          new THREE.Vector3(Math.cos(ang) * (24 + Math.random() * 26), 32 + Math.random() * 14, Math.sin(ang) * (24 + Math.random() * 26))
        );
        baseColors.push(new THREE.Color(accents[b % accents.length]));
        for (let i = 0; i < PER_BURST; i++) {
          const idx = (b * PER_BURST + i) * 3;
          // uniform-ish sphere of velocities
          const u = Math.random() * 2 - 1;
          const ph = Math.random() * Math.PI * 2;
          const r = Math.sqrt(1 - u * u);
          const speed = 7 + Math.random() * 6;
          velocities[idx] = r * Math.cos(ph) * speed;
          velocities[idx + 1] = u * speed + 2;
          velocities[idx + 2] = r * Math.sin(ph) * speed;
          positions[idx] = burstCenters[b].x;
          positions[idx + 1] = burstCenters[b].y;
          positions[idx + 2] = burstCenters[b].z;
          colors[idx] = colors[idx + 1] = colors[idx + 2] = 0; // dark until its burst pops
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      points.visible = true;
    },

    update: (dt: number) => {
      if (!active) return;
      t += dt;
      let anyAlive = false;
      for (let b = 0; b < BURSTS; b++) {
        const age = t - b * BURST_GAP;
        if (age < 0) {
          anyAlive = true;
          continue;
        }
        if (age > LIFE) continue;
        anyAlive = true;
        const fade = Math.max(0, 1 - age / LIFE);
        const c = baseColors[b];
        for (let i = 0; i < PER_BURST; i++) {
          const idx = (b * PER_BURST + i) * 3;
          positions[idx] += velocities[idx] * dt;
          positions[idx + 1] += velocities[idx + 1] * dt;
          positions[idx + 2] += velocities[idx + 2] * dt;
          velocities[idx + 1] += GRAV * dt;
          // additive blending: fading toward black fades the spark out
          colors[idx] = c.r * fade;
          colors[idx + 1] = c.g * fade;
          colors[idx + 2] = c.b * fade;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      if (!anyAlive) {
        active = false;
        points.visible = false;
      }
    },
  };
}
