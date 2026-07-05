import * as THREE from 'three';
import { sites } from '../data';
import { WORLD_RADIUS, terrainHeight } from './terrain';

/**
 * critters.ts — a dozen butterflies wandering the meadows by day, and a
 * scatter of fireflies that only wake at night. Pure ambience; no collision.
 */

const rng = (a: number, b: number) => a + Math.random() * (b - a);

function sampleMeadow(): [number, number, number] {
  for (let tries = 0; tries < 40; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * WORLD_RADIUS * 0.7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = terrainHeight(x, z);
    let nearSite = false;
    for (const s of sites) {
      if (Math.hypot(x - s.pos[0], z - s.pos[1]) < 10) nearSite = true;
    }
    if (h > 1.5 && h < 11 && !nearSite) return [x, h, z];
  }
  return [0, terrainHeight(0, 0), 0];
}

interface Butterfly {
  group: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  home: THREE.Vector3;
  seed: number;
  prev: THREE.Vector3;
}

export function createCritters(scene: THREE.Scene): {
  update: (t: number, night: number) => void;
} {
  /* ---- butterflies ---- */
  const wingGeo = new THREE.PlaneGeometry(0.24, 0.17);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0.12, 0, 0); // hinge along the body line
  const palette = ['#ffd166', '#ff7f9f', '#7fd8ff', '#f4f4f4'];
  const butterflies: Butterfly[] = [];

  for (let i = 0; i < 12; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: palette[i % palette.length],
      side: THREE.DoubleSide,
    });
    const g = new THREE.Group();
    const wingR = new THREE.Mesh(wingGeo, mat);
    const wingL = new THREE.Mesh(wingGeo, mat);
    wingL.scale.x = -1;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.02, 0.14, 3, 5),
      new THREE.MeshBasicMaterial({ color: '#2a2622' })
    );
    body.rotation.x = Math.PI / 2;
    g.add(wingL, wingR, body);

    const [x, h, z] = sampleMeadow();
    butterflies.push({
      group: g,
      wingL,
      wingR,
      home: new THREE.Vector3(x, h, z),
      seed: rng(0, 100),
      prev: new THREE.Vector3(x, h + 1, z),
    });
    scene.add(g);
  }

  /* ---- fireflies: one additive Points cloud, awake only at night ---- */
  const FIREFLIES = 70;
  const flyBase: THREE.Vector3[] = [];
  const flyPos = new Float32Array(FIREFLIES * 3);
  for (let i = 0; i < FIREFLIES; i++) {
    const [x, h, z] = sampleMeadow();
    flyBase.push(new THREE.Vector3(x, h, z));
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flyMat = new THREE.PointsMaterial({
    color: '#d9f29a',
    size: 0.14,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fireflies = new THREE.Points(flyGeo, flyMat);
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  const next = new THREE.Vector3();

  return {
    update: (t, night) => {
      for (const b of butterflies) {
        const s = b.seed;
        next.set(
          b.home.x + Math.sin(t * 0.42 + s) * 4.2 + Math.sin(t * 1.7 + s * 2) * 0.5,
          b.home.y + 0.85 + Math.sin(t * 1.1 + s * 3) * 0.4,
          b.home.z + Math.cos(t * 0.31 + s * 1.3) * 4.2
        );
        b.group.position.copy(next);
        const dx = next.x - b.prev.x;
        const dz = next.z - b.prev.z;
        if (dx * dx + dz * dz > 1e-8) b.group.rotation.y = Math.atan2(dx, dz);
        b.prev.copy(next);
        const flap = 0.15 + (Math.sin(t * 15 + s * 4) * 0.5 + 0.5) * 1.05;
        b.wingR.rotation.z = -flap;
        b.wingL.rotation.z = flap;
        // butterflies roost at night
        b.group.visible = night < 0.6;
      }

      flyMat.opacity = night * 0.9;
      if (night > 0.02) {
        for (let i = 0; i < FIREFLIES; i++) {
          const base = flyBase[i];
          flyPos[i * 3] = base.x + Math.sin(t * 0.7 + i * 2.1) * 1.6;
          flyPos[i * 3 + 1] = base.y + 0.7 + Math.sin(t * 1.3 + i) * 0.5;
          flyPos[i * 3 + 2] = base.z + Math.cos(t * 0.5 + i * 1.7) * 1.6;
        }
        flyGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}
