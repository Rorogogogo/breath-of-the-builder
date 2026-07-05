import * as THREE from 'three';

/**
 * Gradient sky dome + drifting low-poly clouds + a full day–night cycle:
 * the sun arcs overhead, dusk burns warm, then a pale moon and stars take
 * the watch. One cycle lasts CYCLE seconds and the game starts mid-morning.
 */

const CYCLE = 280; // seconds per full day
const START_PHASE = 0.14; // begin with the sun well up
const DAY_SHARE = 0.72; // fraction of the cycle spent with the sun up — nights stay short

interface Palette {
  top: string;
  horizon: string;
  bottom: string;
  sun: string;
  sunI: number;
  hemi: number;
  fog: string;
  cloud: string;
}

const DAY: Palette = {
  top: '#5fa8e8', horizon: '#dceef2', bottom: '#bcd8de',
  sun: '#fff1d0', sunI: 3.0, hemi: 1.0, fog: '#cfe4ee', cloud: '#ffffff',
};
const DUSK: Palette = {
  top: '#55549c', horizon: '#ffb37c', bottom: '#c98d63',
  sun: '#ffbb80', sunI: 2.1, hemi: 0.55, fog: '#e0bda2', cloud: '#f0c8a8',
};
const NIGHT: Palette = {
  top: '#0a1430', horizon: '#22304f', bottom: '#0d1522',
  sun: '#a8c0e8', sunI: 0.0, hemi: 0.32, fog: '#141f33', cloud: '#3e4c66',
};

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function createSky(scene: THREE.Scene): {
  update: (t: number) => void;
  /** night amount in [0,1] — handy for other systems (fireflies, music…) */
  nightAmount: () => number;
  /** dev: pin the cycle to a fixed phase (null = run normally) */
  setPhase: (p: number | null) => void;
} {
  // --- dome ---
  const skyGeo = new THREE.SphereGeometry(760, 24, 16);
  const uTop = { value: new THREE.Color(DAY.top) };
  const uHorizon = { value: new THREE.Color(DAY.horizon) };
  const uBottom = { value: new THREE.Color(DAY.bottom) };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { topColor: uTop, horizonColor: uHorizon, bottomColor: uBottom },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        vec3 c = h > 0.0
          ? mix(horizonColor, topColor, pow(h, 0.65))
          : mix(horizonColor, bottomColor, pow(-h, 0.7));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // --- lights ---
  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
  sun.position.set(90, 130, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 140;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // faint blue moonlight so night stays readable (no second shadow map)
  const moonLight = new THREE.DirectionalLight('#bfd4ff', 0);
  moonLight.position.set(-80, 100, 40);
  scene.add(moonLight);

  const hemi = new THREE.HemisphereLight('#bdd9ff', '#a89a76', DAY.hemi);
  scene.add(hemi);

  // --- sun & moon discs riding the same arc ---
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(30, 24),
    new THREE.MeshBasicMaterial({ color: '#fff6da', fog: false, toneMapped: false })
  );
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(19, 24),
    new THREE.MeshBasicMaterial({
      color: '#e9eff9', fog: false, toneMapped: false, transparent: true, opacity: 0,
    })
  );
  scene.add(sunDisc, moonDisc);

  // --- stars: one Points cloud on the upper dome, faded in at night ---
  const STARS = 420;
  const starPos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    // uniform-ish points on the upper hemisphere
    const u = Math.random();
    const v = Math.random();
    const az = u * Math.PI * 2;
    const el = Math.asin(0.08 + v * 0.9);
    const r = 700;
    starPos[i * 3] = Math.cos(az) * Math.cos(el) * r;
    starPos[i * 3 + 1] = Math.sin(el) * r;
    starPos[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#dfe8ff',
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- clouds ---
  const cloudMat = new THREE.MeshToonMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.92,
  });
  const puffGeo = new THREE.IcosahedronGeometry(1, 0);
  const clouds: THREE.Group[] = [];
  const rng = (a: number, b: number) => a + Math.random() * (b - a);
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p++) {
      const m = new THREE.Mesh(puffGeo, cloudMat);
      m.position.set(rng(-7, 7), rng(-1, 1.5), rng(-3, 3));
      m.scale.set(rng(4, 8), rng(1.6, 2.6), rng(3, 5));
      m.rotation.y = rng(0, Math.PI);
      cloud.add(m);
    }
    cloud.position.set(rng(-320, 320), rng(65, 110), rng(-320, 320));
    scene.add(cloud);
    clouds.push(cloud);
  }

  // scratch colours for the per-frame palette blend
  const cTop = new THREE.Color();
  const cHor = new THREE.Color();
  const cBot = new THREE.Color();
  const cSun = new THREE.Color();
  const cFog = new THREE.Color();
  const cCloud = new THREE.Color();
  const pTop = { d: new THREE.Color(DAY.top), k: new THREE.Color(DUSK.top), n: new THREE.Color(NIGHT.top) };
  const pHor = { d: new THREE.Color(DAY.horizon), k: new THREE.Color(DUSK.horizon), n: new THREE.Color(NIGHT.horizon) };
  const pBot = { d: new THREE.Color(DAY.bottom), k: new THREE.Color(DUSK.bottom), n: new THREE.Color(NIGHT.bottom) };
  const pSun = { d: new THREE.Color(DAY.sun), k: new THREE.Color(DUSK.sun), n: new THREE.Color(NIGHT.sun) };
  const pFog = { d: new THREE.Color(DAY.fog), k: new THREE.Color(DUSK.fog), n: new THREE.Color(NIGHT.fog) };
  const pCloud = { d: new THREE.Color(DAY.cloud), k: new THREE.Color(DUSK.cloud), n: new THREE.Color(NIGHT.cloud) };

  const blend = (
    out: THREE.Color,
    p: { d: THREE.Color; k: THREE.Color; n: THREE.Color },
    day: number,
    dusk: number,
    night: number
  ): THREE.Color => {
    out.setRGB(
      p.d.r * day + p.k.r * dusk + p.n.r * night,
      p.d.g * day + p.k.g * dusk + p.n.g * night,
      p.d.b * day + p.k.b * dusk + p.n.b * night
    );
    return out;
  };

  let phaseOverride: number | null = null;
  let night = 0;

  return {
    update: (t: number) => {
      // warp the clock so the sun's half-circle (phase 0–0.5) gets DAY_SHARE
      // of the cycle and the night half hurries past
      const u = phaseOverride ?? (t / CYCLE + START_PHASE * DAY_SHARE / 0.5) % 1;
      const phase =
        phaseOverride ?? (u < DAY_SHARE ? (u / DAY_SHARE) * 0.5 : 0.5 + ((u - DAY_SHARE) / (1 - DAY_SHARE)) * 0.5);
      const theta = phase * Math.PI * 2;
      const elev = Math.sin(theta); // sun elevation in [-1, 1]

      const day = smoothstep(0.1, 0.32, elev);
      night = smoothstep(0.08, 0.3, -elev);
      const dusk = Math.max(0, 1 - day - night);

      // --- lights follow the arc ---
      const sx = Math.cos(theta) * 150;
      const sy = Math.sin(theta) * 150;
      sun.position.set(sx, Math.max(sy, 6), -60);
      blend(cSun, pSun, day, dusk, night);
      sun.color.copy(cSun);
      // fade the sun out entirely once it dips below the horizon
      sun.intensity = (DAY.sunI * day + DUSK.sunI * dusk) * smoothstep(-0.04, 0.1, elev);
      moonLight.intensity = night * 0.55;
      hemi.intensity = DAY.hemi * day + DUSK.hemi * dusk + NIGHT.hemi * night;

      // --- discs ---
      sunDisc.position.set(Math.cos(theta) * 700, Math.sin(theta) * 700, -280);
      sunDisc.lookAt(0, 0, 0);
      sunDisc.visible = elev > -0.12;
      moonDisc.position.set(-Math.cos(theta) * 700, -Math.sin(theta) * 700, 240);
      moonDisc.lookAt(0, 0, 0);
      (moonDisc.material as THREE.MeshBasicMaterial).opacity = night;
      moonDisc.visible = night > 0.02;

      // --- palette ---
      uTop.value.copy(blend(cTop, pTop, day, dusk, night));
      uHorizon.value.copy(blend(cHor, pHor, day, dusk, night));
      uBottom.value.copy(blend(cBot, pBot, day, dusk, night));
      if (scene.fog) scene.fog.color.copy(blend(cFog, pFog, day, dusk, night));
      cloudMat.color.copy(blend(cCloud, pCloud, day, dusk, night));
      starMat.opacity = night * 0.9;
      stars.rotation.y = t * 0.004; // the heavens wheel slowly

      // --- clouds drift ---
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.position.x += 0.024 + (i % 3) * 0.008;
        if (c.position.x > 360) c.position.x = -360;
        c.position.y += Math.sin(t * 0.2 + i) * 0.004;
      }
    },
    nightAmount: () => night,
    setPhase: (p) => {
      phaseOverride = p;
    },
  };
}
