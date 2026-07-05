import * as THREE from 'three';
import { sites } from '../data';
import { WORLD_RADIUS, terrainHeight, terrainNormal, getGradientMap } from './terrain';
import { outlineInstanced } from './outline';
import { addCollider } from './colliders';

const rng = (a: number, b: number) => a + Math.random() * (b - a);

function farFromSites(x: number, z: number, min: number): boolean {
  for (const s of sites) {
    if (Math.hypot(x - s.pos[0], z - s.pos[1]) < min) return false;
  }
  return true;
}

/** Sample a random land point matching a height band; null if unlucky. */
function sampleLand(minH: number, maxH: number, siteClearance: number): [number, number, number] | null {
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * WORLD_RADIUS * 0.86;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h > minH && h < maxH && farFromSites(x, z, siteClearance)) return [x, h, z];
  }
  return null;
}

/* ------------------------------------------------------------------ */

export function createVegetation(scene: THREE.Scene): {
  update: (t: number, playerPos?: THREE.Vector3) => void;
} {
  const gradientMap = getGradientMap();
  const dummy = new THREE.Object3D();

  /* ---- trees: instanced trunks + instanced canopies ---- */
  const TREES = 90;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 5);
  trunkGeo.translate(0, 1.1, 0);
  const canopyGeo = new THREE.IcosahedronGeometry(1.7, 0);
  const trunkMat = new THREE.MeshToonMaterial({ color: '#6d4c33', gradientMap });
  const canopyMatA = new THREE.MeshToonMaterial({ color: '#4e9c47', gradientMap });
  const canopyMatB = new THREE.MeshToonMaterial({ color: '#6cb552', gradientMap });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);
  const canopiesA = new THREE.InstancedMesh(canopyGeo, canopyMatA, TREES);
  const canopiesB = new THREE.InstancedMesh(canopyGeo, canopyMatB, TREES);
  trunks.castShadow = canopiesA.castShadow = canopiesB.castShadow = true;

  let placed = 0;
  while (placed < TREES) {
    const p = sampleLand(1.6, 13, 9);
    if (!p) continue;
    const [x, h, z] = p;
    const s = rng(0.8, 1.7);
    const rot = rng(0, Math.PI * 2);

    dummy.position.set(x, h - 0.15, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);

    dummy.position.set(x, h + 2.5 * s, z);
    dummy.scale.set(s * rng(0.9, 1.2), s * rng(1.0, 1.5), s * rng(0.9, 1.2));
    dummy.updateMatrix();
    canopiesA.setMatrixAt(placed, dummy.matrix);

    dummy.position.set(x + rng(-0.7, 0.7) * s, h + 3.4 * s, z + rng(-0.7, 0.7) * s);
    dummy.scale.setScalar(s * rng(0.55, 0.8));
    dummy.updateMatrix();
    canopiesB.setMatrixAt(placed, dummy.matrix);
    // trunk blocks at any height (you can still glide through the leaves)
    addCollider({ x, z, r: 0.38 * s + 0.08, top: Infinity });
    placed++;
  }
  scene.add(trunks, canopiesA, canopiesB);
  scene.add(outlineInstanced(trunks, 0.03), outlineInstanced(canopiesA, 0.05), outlineInstanced(canopiesB, 0.05));

  /* ---- rocks ---- */
  const ROCKS = 60;
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshToonMaterial({ color: '#97a0a8', gradientMap });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS);
  rocks.castShadow = true;
  placed = 0;
  while (placed < ROCKS) {
    const p = sampleLand(0.4, 22, 7);
    if (!p) continue;
    const [x, h, z] = p;
    const sx = rng(0.3, 1.6);
    const sy = rng(0.25, 1.1);
    const sz = rng(0.3, 1.6);
    dummy.position.set(x, h + 0.1, z);
    dummy.rotation.set(rng(0, 3), rng(0, 3), rng(0, 3));
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rocks.setMatrixAt(placed, dummy.matrix);
    // pebbles stay walk-over; bigger rocks block and can be stood on
    if (Math.max(sx, sz) >= 0.55) {
      addCollider({ x, z, r: Math.max(sx, sz) * 0.8, top: h + 0.1 + sy * 0.8, walkable: true });
    }
    placed++;
  }
  scene.add(rocks);
  scene.add(outlineInstanced(rocks, 0.04));

  /* ---- swaying grass blades ---- */
  const BLADES = 2600;
  const bladeGeo = new THREE.ConeGeometry(0.09, 1.0, 3);
  bladeGeo.translate(0, 0.5, 0); // pivot at the root so sway bends the tip
  const uTime = { value: 0 };
  const uPlayer = { value: new THREE.Vector3(0, -999, 0) };
  const bladeMat = new THREE.MeshToonMaterial({ color: '#8fd06c', gradientMap });
  bladeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uPlayer = uPlayer;
    shader.vertexShader =
      'uniform float uTime;\nuniform vec3 uPlayer;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float ph = 0.0;
          #ifdef USE_INSTANCING
            ph = instanceMatrix[3][0] * 0.45 + instanceMatrix[3][2] * 0.35;
          #endif
          float sway = sin(uTime * 2.1 + ph) * 0.18 * position.y;
          transformed.x += sway;
          transformed.z += sway * 0.6;
          #ifdef USE_INSTANCING
          {
            // blades lean away from the hero's boots
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            vec2 away = ip.xz - uPlayer.xz;
            float d = length(away);
            float bend = smoothstep(1.7, 0.25, d)
                       * smoothstep(2.8, 1.2, abs(ip.y - uPlayer.y))
                       * 0.55 * position.y;
            vec2 dir = d > 1e-3 ? away / d : vec2(1.0, 0.0);
            transformed.x += dir.x * bend;
            transformed.z += dir.y * bend;
            transformed.y -= bend * 0.45;
          }
          #endif
        }`
      );
  };
  const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, BLADES);
  const grassColor = new THREE.Color();
  placed = 0;
  while (placed < BLADES) {
    const p = sampleLand(1.4, 12.5, 5);
    if (!p) continue;
    const [x, h, z] = p;
    dummy.position.set(x, h - 0.05, z);
    dummy.rotation.set(rng(-0.15, 0.15), rng(0, Math.PI * 2), rng(-0.15, 0.15));
    dummy.scale.set(rng(0.7, 1.3), rng(0.7, 1.6), rng(0.7, 1.3));
    dummy.updateMatrix();
    grass.setMatrixAt(placed, dummy.matrix);
    grassColor.setHSL(0.28 + rng(-0.03, 0.03), 0.55, rng(0.42, 0.58));
    grass.setColorAt(placed, grassColor);
    placed++;
  }
  scene.add(grass);

  /* ---- flowers (tiny colour pops, BotW-style) ---- */
  const FLOWERS = 220;
  const flowerGeo = new THREE.OctahedronGeometry(0.16, 0);
  const flowerMat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap });
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, FLOWERS);
  const palette = ['#ff7f9f', '#ffd166', '#7fd8ff', '#f4f4f4', '#c69bff'].map((c) => new THREE.Color(c));
  placed = 0;
  while (placed < FLOWERS) {
    const p = sampleLand(1.5, 10, 5);
    if (!p) continue;
    const [x, h, z] = p;
    // keep flowers off steep slopes
    if (terrainNormal(x, z).y < 0.85) continue;
    dummy.position.set(x, h + 0.28, z);
    dummy.rotation.set(0, rng(0, Math.PI), 0);
    dummy.scale.setScalar(rng(0.7, 1.3));
    dummy.updateMatrix();
    flowers.setMatrixAt(placed, dummy.matrix);
    flowers.setColorAt(placed, palette[placed % palette.length]);
    placed++;
  }
  scene.add(flowers);

  return {
    update: (t: number, playerPos?: THREE.Vector3) => {
      uTime.value = t;
      if (playerPos) uPlayer.value.copy(playerPos);
    },
  };
}
