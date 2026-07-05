import * as THREE from 'three';
import { sites } from '../data';

export const WORLD_RADIUS = 110;
export const WATER_LEVEL = 0;

/* ---------------- deterministic value noise ---------------- */

function hash(ix: number, iz: number): number {
  let h = ix * 374761393 + iz * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  // map to [0, 1)
  return ((h >>> 0) % 100000) / 100000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function fbm(x: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq) * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum; // roughly [0, 1)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/* ---------------- height function ---------------- */

/**
 * Terrain height at any world (x, z). Deterministic — used for the mesh,
 * object placement, and the player's ground clamp.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // island mask: 1 at centre, fades to 0 toward the rim → ocean
  const mask = smoothstep(WORLD_RADIUS, WORLD_RADIUS * 0.28, r);

  let h = fbm(x * 0.013 + 31.7, z * 0.013 - 12.3, 4) * 17;
  h += fbm(x * 0.055 + 7.1, z * 0.055 + 3.3, 3) * 2.6;

  // central mountain
  const dm = Math.hypot(x + 8, z - 14);
  h += 24 * Math.exp(-(dm * dm) / (2 * 20 * 20));

  h = h * mask - 3.2;

  // flatten a plateau around every site so shrines sit on level ground
  for (const s of sites) {
    const d = Math.hypot(x - s.pos[0], z - s.pos[1]);
    if (d < 14) {
      const infl = smoothstep(14, 5, d);
      h = h + (s.plateau - h) * infl;
    }
  }
  return h;
}

/** Approximate surface normal via finite differences. */
export function terrainNormal(x: number, z: number): THREE.Vector3 {
  const e = 0.6;
  const hl = terrainHeight(x - e, z);
  const hr = terrainHeight(x + e, z);
  const hd = terrainHeight(x, z - e);
  const hu = terrainHeight(x, z + e);
  return new THREE.Vector3(hl - hr, 2 * e, hd - hu).normalize();
}

/* ---------------- toon gradient map (shared) ---------------- */

let gradientMap: THREE.DataTexture | null = null;
export function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    const data = new Uint8Array([110, 160, 210, 255]);
    gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

/* ---------------- mesh ---------------- */

const C_SAND = new THREE.Color('#e2cf96');
const C_SAND_WET = new THREE.Color('#c7b183');
const C_GRASS_A = new THREE.Color('#79c163');
const C_GRASS_B = new THREE.Color('#5aa84e');
const C_ROCK = new THREE.Color('#8d949c');
const C_SNOW = new THREE.Color('#f2f6f9');

export function createTerrain(): THREE.Mesh {
  const size = WORLD_RADIUS * 2.4;
  const segs = 150;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);

    // colour by height with a little noise so bands aren't perfect lines
    const jitter = (valueNoise(x * 0.11, z * 0.11) - 0.5) * 1.6;
    const hh = h + jitter;
    if (hh < 0.9) c.copy(hh < -0.4 ? C_SAND_WET : C_SAND);
    else if (hh < 2.0) c.copy(C_SAND).lerp(C_GRASS_A, smoothstep(0.9, 2.0, hh));
    else if (hh < 13) c.copy(C_GRASS_A).lerp(C_GRASS_B, valueNoise(x * 0.05, z * 0.05));
    else if (hh < 19) c.copy(C_GRASS_B).lerp(C_ROCK, smoothstep(13, 19, hh));
    else c.copy(C_ROCK).lerp(C_SNOW, smoothstep(20, 24, hh));

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: getGradientMap(),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------------- ocean floor (so the water edge isn't a void) -------- */

export function createSeaFloor(): THREE.Mesh {
  const geo = new THREE.CircleGeometry(WORLD_RADIUS * 4, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: '#1d5e7e' });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -6;
  return mesh;
}
