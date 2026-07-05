import * as THREE from 'three';
import { sites, skillTree } from '../data';
import { WORLD_RADIUS, terrainHeight } from './terrain';

/**
 * orbs.ts — collectible skill orbs ("Spirit of the Builder").
 * Each skill from the portfolio's skill tree becomes a floating orb, colour-
 * coded by category and clustered so each category haunts its own corner of
 * the island. Walk (or glide) through one to gather it.
 */

export interface Orb {
  skill: string;
  category: string;
  accent: string;
  /** rest position of the orb centre; it bobs around this */
  position: THREE.Vector3;
  collected: boolean;
}

const COLLECT_RADIUS = 1.8;

function farFromSites(x: number, z: number, min: number): boolean {
  for (const s of sites) {
    if (Math.hypot(x - s.pos[0], z - s.pos[1]) < min) return false;
  }
  return true;
}

export function createOrbs(scene: THREE.Scene): {
  orbs: Orb[];
  update: (t: number, playerPos: THREE.Vector3, onCollect: (orb: Orb) => void) => void;
} {
  const orbs: Orb[] = [];

  // one anchor bearing per category so colours cluster into little regions
  skillTree.forEach((group, gi) => {
    const bearing = (gi / skillTree.length) * Math.PI * 2 + 0.7;
    const ax = Math.cos(bearing) * WORLD_RADIUS * 0.42;
    const az = Math.sin(bearing) * WORLD_RADIUS * 0.42;

    for (const skill of group.skills) {
      let px = ax;
      let pz = az;
      let ph = Math.max(terrainHeight(ax, az), 1.2);
      for (let tries = 0; tries < 60; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.sqrt(Math.random()) * 26;
        const x = ax + Math.cos(a) * r;
        const z = az + Math.sin(a) * r;
        const h = terrainHeight(x, z);
        if (h > 1.2 && h < 21 && farFromSites(x, z, 8)) {
          px = x;
          pz = z;
          ph = h;
          break;
        }
      }
      orbs.push({
        skill,
        category: group.category,
        accent: group.accent,
        position: new THREE.Vector3(px, ph + 1.05, pz),
        collected: false,
      });
    }
  });

  const n = orbs.length;
  const core = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    n
  );
  const halo = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.44, 10, 10),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    n
  );
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    c.set(orbs[i].accent);
    core.setColorAt(i, c);
    halo.setColorAt(i, c);
  }
  scene.add(core, halo);

  const dummy = new THREE.Object3D();

  return {
    orbs,
    update: (t, playerPos, onCollect) => {
      for (let i = 0; i < n; i++) {
        const o = orbs[i];
        if (o.collected) {
          dummy.position.copy(o.position);
          dummy.scale.setScalar(0.0001);
        } else {
          const y = o.position.y + Math.sin(t * 1.8 + i * 1.7) * 0.22;
          dummy.position.set(o.position.x, y, o.position.z);
          dummy.scale.setScalar(1 + Math.sin(t * 3.1 + i) * 0.1);

          const dx = playerPos.x - o.position.x;
          const dy = playerPos.y + 1 - y;
          const dz = playerPos.z - o.position.z;
          if (dx * dx + dy * dy + dz * dz < COLLECT_RADIUS * COLLECT_RADIUS) {
            o.collected = true;
            onCollect(o);
            dummy.scale.setScalar(0.0001);
          }
        }
        dummy.updateMatrix();
        core.setMatrixAt(i, dummy.matrix);
        halo.setMatrixAt(i, dummy.matrix);
      }
      core.instanceMatrix.needsUpdate = true;
      halo.instanceMatrix.needsUpdate = true;
    },
  };
}
