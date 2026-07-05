import * as THREE from 'three';

/**
 * outline.ts — Wind Waker-style ink outlines via the inverted-hull trick:
 * a second, black, backface-only shell of the same geometry, pushed out
 * along vertex normals in the vertex shader. Cheap (no postprocessing) and
 * works for both regular and instanced meshes.
 */

const INK = '#101418';
const matCache = new Map<number, THREE.MeshBasicMaterial>();

function getOutlineMaterial(thickness: number): THREE.MeshBasicMaterial {
  let mat = matCache.get(thickness);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed += normalize(normal) * ${thickness.toFixed(4)};`
      );
    };
    matCache.set(thickness, mat);
  }
  return mat;
}

function isOutlinable(mesh: THREE.Mesh): boolean {
  const m = mesh.material as THREE.Material;
  if (Array.isArray(mesh.material)) return false;
  if (m.transparent || m.blending !== THREE.NormalBlending) return false; // beams, rings
  if (m.side === THREE.DoubleSide) return false; // flat planes like the sail
  return true;
}

/**
 * Add ink outlines to every solid mesh under `root` (in place).
 * `maxThickness` is a ceiling — each shell's real thickness is proportional
 * to the mesh's size, so small parts (eyes, buckles, pommels) don't drown
 * in ink. Meshes smaller than ~10 cm get no outline at all; set
 * `mesh.userData.noOutline = true` to opt out explicitly.
 */
export function addOutlines(root: THREE.Object3D, maxThickness = 0.03): void {
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && o.name !== 'ink-outline') {
      if (isOutlinable(o as THREE.Mesh)) targets.push(o as THREE.Mesh);
    }
  });
  for (const mesh of targets) {
    if (mesh.userData.noOutline) continue;
    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const size = geo.boundingSphere!.radius * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
    if (size < 0.1) continue;
    // ~8% of the part's radius, capped, quantized to keep the material cache small
    const t = Math.min(maxThickness, size * 0.08);
    const tq = Math.max(0.006, Math.round(t * 250) / 250);
    const shell = new THREE.Mesh(geo, getOutlineMaterial(tq));
    shell.name = 'ink-outline';
    shell.castShadow = false;
    mesh.add(shell); // inherits the mesh's transform, follows animation
  }
}

/** Outline shell for an InstancedMesh — shares the source's instance matrices. */
export function outlineInstanced(src: THREE.InstancedMesh, thickness = 0.04): THREE.InstancedMesh {
  const shell = new THREE.InstancedMesh(src.geometry, getOutlineMaterial(thickness), src.count);
  shell.name = 'ink-outline';
  shell.instanceMatrix = src.instanceMatrix;
  shell.castShadow = false;
  return shell;
}
