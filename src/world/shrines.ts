import * as THREE from 'three';
import { sites, type Site } from '../data';
import { terrainHeight, getGradientMap } from './terrain';
import { addOutlines } from './outline';
import { addCollider } from './colliders';

export interface ShrineInstance {
  site: Site;
  group: THREE.Group;
  position: THREE.Vector3;
  /** animated bits */
  gem?: THREE.Mesh;
  ring?: THREE.Mesh;
  beam: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  discovered: boolean;
}

const DISCOVERED_COLOR = new THREE.Color('#d9b96a');

function makeBeam(accent: string, height: number, radius: number): { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.7, height, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = height / 2;
  return { mesh, mat };
}

function stoneMat(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() });
}

/* ---------- shrine variants ---------- */

function buildProjectShrine(site: Site): { group: THREE.Group; gem: THREE.Mesh; ring: THREE.Mesh; beam: THREE.Mesh; beamMat: THREE.MeshBasicMaterial; light: THREE.PointLight } {
  const g = new THREE.Group();
  const dark = stoneMat('#5b636d');
  const light = stoneMat('#7d8792');

  // stepped stone base
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 0.7, 8), dark);
  base1.position.y = 0.35;
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.6, 8), light);
  base2.position.y = 1.0;
  g.add(base1, base2);

  // twin pillars
  const pillarGeo = new THREE.BoxGeometry(0.55, 3.6, 0.55);
  for (const sx of [-1.7, 1.7]) {
    const p = new THREE.Mesh(pillarGeo, dark);
    p.position.set(sx, 3.0, 0);
    p.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.85), light);
    cap.position.set(sx, 4.9, 0);
    g.add(p, cap);
  }
  // lintel
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 0.7), dark);
  lintel.position.y = 5.3;
  lintel.castShadow = true;
  g.add(lintel);

  // floating gem
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshStandardMaterial({
      color: site.accent,
      emissive: site.accent,
      emissiveIntensity: 1.6,
      roughness: 0.25,
    })
  );
  gem.position.y = 3.2;
  g.add(gem);

  // slowly-spinning rune ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.06, 8, 40),
    new THREE.MeshBasicMaterial({ color: site.accent, transparent: true, opacity: 0.75 })
  );
  ring.position.y = 3.2;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  // sky beam (taller for featured projects)
  const { mesh: beam, mat: beamMat } = makeBeam(site.accent, site.featured ? 90 : 60, site.featured ? 1.0 : 0.7);
  g.add(beam);

  const pl = new THREE.PointLight(site.accent, 30, 22, 1.8);
  pl.position.y = 3.4;
  g.add(pl);

  return { group: g, gem, ring, beam, beamMat, light: pl };
}

function buildCabin(site: Site): { group: THREE.Group; beam: THREE.Mesh; beamMat: THREE.MeshBasicMaterial; light: THREE.PointLight } {
  const g = new THREE.Group();
  const wood = stoneMat('#8a6242');
  const woodDark = stoneMat('#6d4c33');

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 3.6), wood);
  body.position.y = 1.3;
  body.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2.2, 4), stoneMat('#b0483a'));
  roof.position.y = 3.7;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), stoneMat('#77808a'));
  chimney.position.set(1.2, 4.2, 0.8);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.12), woodDark);
  door.position.set(0, 0.75, 1.82);
  const winMat = new THREE.MeshStandardMaterial({ color: '#ffdf9e', emissive: '#ffb85c', emissiveIntensity: 1.2 });
  for (const sx of [-1.4, 1.4]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), winMat);
    w.position.set(sx, 1.6, 1.82);
    g.add(w);
  }
  g.add(body, roof, chimney, door);

  const { mesh: beam, mat: beamMat } = makeBeam(site.accent, 50, 0.6);
  g.add(beam);
  const pl = new THREE.PointLight(site.accent, 24, 18, 1.8);
  pl.position.set(0, 2.6, 2.5);
  g.add(pl);
  return { group: g, beam, beamMat, light: pl };
}

function buildDock(site: Site): { group: THREE.Group; beam: THREE.Mesh; beamMat: THREE.MeshBasicMaterial; light: THREE.PointLight } {
  const g = new THREE.Group();
  const wood = stoneMat('#8a6242');

  // pier of planks marching toward the sea
  for (let i = 0; i < 6; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.5), wood);
    plank.position.set(0, 0.4 - i * 0.12, i * 1.7);
    plank.castShadow = true;
    g.add(plank);
    if (i % 2 === 0) {
      for (const sx of [-1.1, 1.1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.8, 5), wood);
        post.position.set(sx, -0.4 - i * 0.12, i * 1.7);
        g.add(post);
      }
    }
  }
  // lantern post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.6, 6), wood);
  post.position.set(1.0, 1.6, 0.4);
  const lantern = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color: '#ffdf9e', emissive: '#ffc46b', emissiveIntensity: 1.8 })
  );
  lantern.position.set(1.0, 3.0, 0.4);
  g.add(post, lantern);

  // little boat
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.5, 3.4, 6), stoneMat('#6d4c33'));
  hull.rotation.z = Math.PI / 2;
  hull.rotation.y = Math.PI / 2;
  hull.scale.set(1, 1, 0.6);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5), wood);
  mast.position.y = 1.4;
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.7), new THREE.MeshToonMaterial({ color: '#efe6cf', side: THREE.DoubleSide }));
  sail.position.set(0.02, 1.5, 0.05);
  boat.add(hull, mast, sail);
  boat.position.set(-2.6, -0.5, 9.5);
  boat.rotation.y = 0.4;
  g.add(boat);

  const { mesh: beam, mat: beamMat } = makeBeam(site.accent, 46, 0.6);
  g.add(beam);
  const pl = new THREE.PointLight(site.accent, 22, 18, 1.8);
  pl.position.set(1.0, 3.0, 0.4);
  g.add(pl);
  return { group: g, beam, beamMat, light: pl };
}

/* ---------- assembly ---------- */

export function createShrines(scene: THREE.Scene): {
  shrines: ShrineInstance[];
  update: (t: number) => void;
  markDiscovered: (id: string) => void;
  celebrate: () => void;
} {
  const shrines: ShrineInstance[] = [];
  let celebrating = false;

  for (const site of sites) {
    const [x, z] = site.pos;
    const y = terrainHeight(x, z);

    let built: { group: THREE.Group; gem?: THREE.Mesh; ring?: THREE.Mesh; beam: THREE.Mesh; beamMat: THREE.MeshBasicMaterial; light: THREE.PointLight };
    if (site.kind === 'about') built = buildCabin(site);
    else if (site.kind === 'contact') built = buildDock(site);
    else built = buildProjectShrine(site);

    built.group.position.set(x, y, z);
    // face roughly toward the island centre
    const rot = Math.atan2(-x, -z);
    built.group.rotation.y = rot;
    addOutlines(built.group, 0.035);
    scene.add(built.group);

    // collision volumes (local offset [lx, lz] → world via the group's yaw)
    const world = (lx: number, lz: number): [number, number] => [
      x + lx * Math.cos(rot) + lz * Math.sin(rot),
      z - lx * Math.sin(rot) + lz * Math.cos(rot),
    ];
    if (site.kind === 'about') {
      // cabin: one blocking cylinder over walls + roof
      addCollider({ x, z, r: 3.1, top: y + 6 });
    } else if (site.kind === 'contact') {
      // dock: just the lantern post; the low planks stay walk-over
      const [px, pz] = world(1.0, 0.4);
      addCollider({ x: px, z: pz, r: 0.28, top: y + 3.0 });
    } else {
      // project shrine: stepped bases climb like stairs, pillars block
      addCollider({ x, z, r: 3.9, top: y + 0.7, walkable: true });
      addCollider({ x, z, r: 3.0, top: y + 1.3, walkable: true });
      for (const sx of [-1.7, 1.7]) {
        const [px, pz] = world(sx, 0);
        addCollider({ x: px, z: pz, r: 0.5, top: y + 5.3 });
      }
    }

    shrines.push({
      site,
      group: built.group,
      position: new THREE.Vector3(x, y, z),
      gem: built.gem,
      ring: built.ring,
      beam: built.beam,
      beamMat: built.beamMat,
      light: built.light,
      discovered: false,
    });
  }

  return {
    shrines,
    update: (t: number) => {
      for (let i = 0; i < shrines.length; i++) {
        const s = shrines[i];
        if (s.gem) {
          s.gem.rotation.y = t * 0.9 + i;
          s.gem.position.y = 3.2 + Math.sin(t * 1.6 + i * 1.3) * 0.18;
        }
        if (s.ring) {
          s.ring.rotation.z = t * 0.5 + i;
          s.ring.position.y = 3.2 + Math.sin(t * 1.6 + i * 1.3 + 1.2) * 0.12;
        }
        s.beamMat.opacity = celebrating
          ? 0.38 + Math.sin(t * 1.8 + i * 2.1) * 0.08 // bright but still reads gold
          : (s.discovered ? 0.14 : 0.3) + Math.sin(t * 1.8 + i * 2.1) * 0.06;
        s.light.intensity = celebrating
          ? 42 + Math.sin(t * 2.2 + i) * 6
          : (s.discovered ? 18 : 28) + Math.sin(t * 2.2 + i) * 4;
      }
    },
    markDiscovered: (id: string) => {
      const s = shrines.find((sh) => sh.site.id === id);
      if (!s || s.discovered) return;
      s.discovered = true;
      s.beamMat.color.copy(DISCOVERED_COLOR);
      s.light.color.copy(DISCOVERED_COLOR);
    },
    // the 100%-completion moment: every beam goes gold, wide and bright
    celebrate: () => {
      celebrating = true;
      for (const s of shrines) {
        s.beamMat.color.copy(DISCOVERED_COLOR);
        s.light.color.copy(DISCOVERED_COLOR);
        s.beam.scale.set(2, 1, 2);
      }
    },
  };
}
