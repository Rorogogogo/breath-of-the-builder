import * as THREE from 'three';

/**
 * dust.ts — a tiny pool of soft dust puffs kicked up by sprinting feet and
 * hard landings. One InstancedMesh; inactive particles collapse to zero scale.
 */

const MAX = 48;

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

export function createDust(scene: THREE.Scene): {
  burst: (at: THREE.Vector3, count: number, spread: number, up: number) => void;
  update: (dt: number) => void;
} {
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.1, 0),
    new THREE.MeshBasicMaterial({
      color: '#d9cfb0',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
    MAX
  );
  mesh.frustumCulled = false;
  scene.add(mesh);

  const pool: Particle[] = Array.from({ length: MAX }, () => ({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    size: 1,
  }));
  let cursor = 0;
  const dummy = new THREE.Object3D();

  return {
    burst: (at, count, spread, up) => {
      for (let i = 0; i < count; i++) {
        const p = pool[cursor];
        cursor = (cursor + 1) % MAX;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        p.pos.set(at.x + Math.cos(a) * r, at.y + 0.12, at.z + Math.sin(a) * r);
        p.vel.set(Math.cos(a) * (0.4 + Math.random()), up * (0.5 + Math.random() * 0.7), Math.sin(a) * (0.4 + Math.random()));
        p.maxLife = 0.45 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.size = 0.7 + Math.random() * 0.9;
      }
    },
    update: (dt) => {
      for (let i = 0; i < MAX; i++) {
        const p = pool[i];
        if (p.life > 0) {
          p.life -= dt;
          p.vel.y -= 1.6 * dt;
          p.vel.multiplyScalar(Math.exp(-dt * 2.2));
          p.pos.addScaledVector(p.vel, dt);
          const frac = Math.max(0, p.life / p.maxLife);
          // puff: grow fast, then dissolve
          const s = p.size * Math.sin(Math.min(1, 1 - frac) * Math.PI * 0.5 + (1 - frac) * 0.4) * frac;
          dummy.position.copy(p.pos);
          dummy.scale.setScalar(Math.max(s, 0.0001));
        } else {
          dummy.scale.setScalar(0.0001);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
