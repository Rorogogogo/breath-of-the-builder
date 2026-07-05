import type * as THREE from 'three';

/**
 * colliders.ts — cheap cylinder collision volumes for the static world.
 * World builders register cylinders; the player resolves against them each
 * frame (a plain array scan — ~170 colliders, one player, trivially fast).
 *
 * Two behaviours per collider:
 *  - blocking: the player is pushed out horizontally (tree trunks, walls)
 *  - walkable: the flat top acts as ground, so low steps are climbed
 *    automatically and taller ones can be jumped/glided onto (rocks,
 *    shrine bases)
 */

export interface Collider {
  x: number;
  z: number;
  r: number;
  /** world-space y of the obstacle's top; Infinity = always blocks */
  top: number;
  /** can the player stand on the top surface? */
  walkable?: boolean;
}

export const PLAYER_RADIUS = 0.45;

const colliders: Collider[] = [];

export function addCollider(c: Collider): void {
  colliders.push(c);
}

const CAM_RADIUS = 0.3;

/**
 * How far along the camera boom (target → desired position) the view stays
 * clear of colliders: returns the largest fraction in (0, 1] before the
 * segment enters a cylinder below its top. The caller shortens the boom to
 * this fraction so the hero is never hidden behind an obstacle.
 */
export function cameraClearance(from: THREE.Vector3, to: THREE.Vector3): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dy = to.y - from.y;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return 1;
  let fr = 1;
  for (const c of colliders) {
    const r = c.r + CAM_RADIUS;
    const fx = from.x - c.x;
    const fz = from.z - c.z;
    // segment-vs-circle in the ground plane: |f + u·d| = r
    const b = 2 * (fx * dx + fz * dz);
    const cc = fx * fx + fz * fz - r * r;
    const disc = b * b - 4 * len2 * cc;
    if (disc <= 0) continue;
    const u0 = (-b - Math.sqrt(disc)) / (2 * len2);
    if (u0 <= 0 || u0 >= fr) continue; // behind the target, inside it, or already cut shorter
    if (from.y + dy * u0 < c.top + CAM_RADIUS) fr = Math.max(0, u0 - 0.02);
  }
  return fr;
}

/**
 * Push `pos` horizontally out of any blocking cylinder and return the highest
 * walkable top supporting the player (or -Infinity). `stepUp` is how far below
 * a walkable top the feet may be while still being lifted onto it — a stair
 * height while grounded, near-zero while airborne so mid-air passes push out
 * instead of teleporting up.
 */
export function collide(pos: THREE.Vector3, stepUp: number): number {
  let ground = -Infinity;
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const minD = c.r + PLAYER_RADIUS;
    if (Math.abs(dx) > minD || Math.abs(dz) > minD) continue;
    const d = Math.hypot(dx, dz);
    if (d >= minD) continue;

    if (c.walkable && pos.y >= c.top - stepUp) {
      ground = Math.max(ground, c.top);
      continue;
    }
    if (pos.y >= c.top) continue; // sailing clear over the top

    // push out radially
    if (d > 1e-4) {
      const k = minD / d;
      pos.x = c.x + dx * k;
      pos.z = c.z + dz * k;
    } else {
      pos.x = c.x + minD; // dead centre: pick an arbitrary direction
    }
  }
  return ground;
}
