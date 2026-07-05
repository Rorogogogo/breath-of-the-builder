import * as THREE from 'three';
import type { Input } from './input';
import { terrainHeight, getGradientMap, WATER_LEVEL } from './world/terrain';
import { collide, cameraClearance } from './world/colliders';
import { playFootstep, playSplash } from './audio';

const WALK_SPEED = 7;
const SPRINT_SPEED = 11.5;
const GRAVITY = -32;
const JUMP_VELOCITY = 11.5;
const STAMINA_MAX = 100;
const STAMINA_DRAIN = 24; // per second while sprinting
const STAMINA_REGEN = 20;
const GLIDE_SPEED = 8.5;
const GLIDE_FALL = -2.8; // terminal fall speed under the canopy
const GLIDE_DRAIN = 10; // stamina per second while gliding
const BASE_FOV = 55;
const GLIDE_FOV = 61;
// swimming: terrain deeper than DEEP_WATER puts the hero in the drink
const DEEP_WATER = -1.35;
const SWIM_Y = WATER_LEVEL - 1.05; // feet depth while swimming
const SWIM_SPEED = 4.6;
const SWIM_SPRINT = 6.8;
const SWIM_DRAIN = 6; // treading water is tiring — no regen at sea
const SWIM_SPRINT_DRAIN = 16;

/**
 * The hero of the codewild — an original low-poly adventurer built from
 * primitives (teal tunic, red scarf as a nod to portfolio v2), with a
 * procedural walk cycle. No Nintendo assets anywhere.
 */
export class Player {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3(0, 0, -74);

  stamina = STAMINA_MAX;
  exhausted = false;
  gliding = false;
  swimming = false;
  /** set for one frame when the hero lands hard (dust puff hook) */
  justLanded = false;
  /** set for one frame when the sea wins and the hero washes ashore */
  justRescued = false;
  private velY = 0;
  private grounded = true;
  private heading = 0; // facing angle
  private walkPhase = 0;
  private swimPhase = 0;
  private prevStepSign = 1;
  private speedSmooth = 0;
  /** last solid dry-land spot — where the sea returns exhausted swimmers */
  private lastSafe = new THREE.Vector3(0, 0, -74);

  // camera orbit state
  camYaw = Math.PI; // behind the player looking north into the island
  camPitch = 0.42;
  camDist = 9;

  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private legL!: THREE.Group;
  private legR!: THREE.Group;
  private body!: THREE.Group;
  private scarfTail!: THREE.Mesh;
  private capTip!: THREE.Mesh;
  private head!: THREE.Group;
  private canopy!: THREE.Group;
  private canopyDome!: THREE.Mesh;
  private turnSmooth = 0;

  get airborne(): boolean {
    return !this.grounded && !this.swimming;
  }

  get onGround(): boolean {
    return this.grounded;
  }

  get speed(): number {
    return this.speedSmooth;
  }

  constructor(scene: THREE.Scene) {
    this.buildMesh();
    this.position.y = terrainHeight(this.position.x, this.position.z);
    this.group.position.copy(this.position);
    scene.add(this.group);
  }

  private buildMesh(): void {
    const gm = getGradientMap();
    const tunic = new THREE.MeshToonMaterial({ color: '#2e9e9b', gradientMap: gm });
    const tunicDark = new THREE.MeshToonMaterial({ color: '#227a78', gradientMap: gm });
    const skin = new THREE.MeshToonMaterial({ color: '#f2c9a0', gradientMap: gm });
    const hair = new THREE.MeshToonMaterial({ color: '#7a5230', gradientMap: gm });
    const pants = new THREE.MeshToonMaterial({ color: '#3c4756', gradientMap: gm });
    const leather = new THREE.MeshToonMaterial({ color: '#54402e', gradientMap: gm });
    const scarf = new THREE.MeshToonMaterial({ color: '#e04a3f', gradientMap: gm });
    const gold = new THREE.MeshToonMaterial({ color: '#d9b96a', gradientMap: gm });
    const steel = new THREE.MeshToonMaterial({ color: '#c8d2da', gradientMap: gm });
    const dark = new THREE.MeshToonMaterial({ color: '#2a2622', gradientMap: gm });

    const M = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      return m;
    };

    this.body = new THREE.Group();

    /* ---- torso: tapered tunic + flared skirt + belt ---- */
    const torso = M(new THREE.CylinderGeometry(0.3, 0.4, 0.85, 10), tunic);
    torso.position.y = 1.12;
    const skirt = M(new THREE.CylinderGeometry(0.4, 0.52, 0.34, 10), tunicDark);
    skirt.position.y = 0.62;
    const belt = M(new THREE.CylinderGeometry(0.41, 0.43, 0.12, 10), leather);
    belt.position.y = 0.8;
    const buckle = M(new THREE.BoxGeometry(0.16, 0.12, 0.05), gold);
    buckle.position.set(0, 0.8, 0.41);
    // small chest strap for the sword
    const strap = M(new THREE.BoxGeometry(0.1, 0.95, 0.05), leather);
    strap.position.set(0.07, 1.12, 0.34);
    strap.rotation.z = 0.55;
    this.body.add(torso, skirt, belt, buckle, strap);

    /* ---- head group (bobs slightly) ---- */
    this.head = new THREE.Group();
    this.head.position.y = 1.62;

    const skull = M(new THREE.SphereGeometry(0.34, 14, 12), skin);
    skull.scale.set(1, 0.95, 0.92);
    skull.position.y = 0.3;
    // hair: fringe + sides + back
    const fringe = M(new THREE.BoxGeometry(0.56, 0.14, 0.14), hair);
    fringe.position.set(0, 0.5, 0.24);
    fringe.rotation.x = -0.25;
    const hairBack = M(new THREE.SphereGeometry(0.35, 12, 10), hair);
    hairBack.scale.set(1.02, 0.9, 0.95);
    hairBack.position.set(0, 0.36, -0.05);
    // eyes: big friendly toon eyes
    const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
    for (const sx of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(eyeGeo, dark);
      eye.scale.set(1, 1.5, 0.6);
      eye.position.set(sx, 0.3, 0.3);
      this.head.add(eye);
    }
    // pointed adventurer's cap, tilted back, with a swaying tip
    const cap = M(new THREE.ConeGeometry(0.33, 0.62, 10), tunicDark);
    cap.position.set(0, 0.72, -0.06);
    cap.rotation.x = -0.35;
    const capBand = M(new THREE.CylinderGeometry(0.345, 0.36, 0.12, 10), tunic);
    capBand.position.set(0, 0.55, 0);
    capBand.rotation.x = -0.15;
    this.capTip = M(new THREE.SphereGeometry(0.09, 8, 8), gold);
    this.capTip.position.set(0, 0.98, -0.32);
    this.head.add(skull, fringe, hairBack, cap, capBand, this.capTip);
    this.body.add(this.head);

    /* ---- scarf: wrap + animated tail ---- */
    const scarfWrap = M(new THREE.TorusGeometry(0.27, 0.1, 8, 12), scarf);
    scarfWrap.position.y = 1.58;
    scarfWrap.rotation.x = Math.PI / 2;
    this.scarfTail = M(new THREE.BoxGeometry(0.2, 0.62, 0.06), scarf);
    this.scarfTail.geometry.translate(0, -0.31, 0); // pivot at the knot
    this.scarfTail.position.set(-0.12, 1.56, -0.3);
    this.scarfTail.rotation.x = 0.35;
    this.body.add(scarfWrap, this.scarfTail);

    /* ---- shield + sword on the back ---- */
    const back = new THREE.Group();
    const shield = M(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 6), leather);
    shield.rotation.x = Math.PI / 2;
    const shieldRim = M(new THREE.TorusGeometry(0.4, 0.045, 6, 6), steel);
    shieldRim.position.z = 0.02;
    const shieldGem = M(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({
      color: '#2e9e9b', emissive: '#2e9e9b', emissiveIntensity: 0.6, roughness: 0.3,
    }));
    shieldGem.position.z = 0.06;
    shieldGem.scale.z = 0.5;
    back.add(shield, shieldRim, shieldGem);
    back.position.set(0, 1.18, -0.5);
    back.rotation.z = 0.1;

    const sword = new THREE.Group();
    const scabbard = M(new THREE.BoxGeometry(0.12, 0.85, 0.06), leather);
    const scabTip = M(new THREE.BoxGeometry(0.13, 0.08, 0.07), gold);
    scabTip.position.y = -0.44;
    const guard = M(new THREE.BoxGeometry(0.26, 0.06, 0.09), gold);
    guard.position.y = 0.45;
    const grip = M(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), dark);
    grip.position.y = 0.62;
    const pommel = M(new THREE.SphereGeometry(0.06, 8, 8), gold);
    pommel.position.y = 0.79;
    sword.add(scabbard, scabTip, guard, grip, pommel);
    sword.position.set(-0.1, 1.25, -0.58);
    sword.rotation.z = 0.6;
    this.body.add(back, sword);

    /* ---- paraglider: striped cloth dome + wooden frame + suspension lines ---- */
    this.canopy = new THREE.Group();

    // canopy dome: a sphere cap, non-indexed so each face takes a flat stripe
    const domeGeo = new THREE.SphereGeometry(1.55, 18, 6, 0, Math.PI * 2, 0, 0.8).toNonIndexed();
    const dp = domeGeo.getAttribute('position');
    const stripeCols = new Float32Array(dp.count * 3);
    const cA = new THREE.Color('#e04a3f'); // scarf red
    const cB = new THREE.Color('#efe6cf'); // parchment
    for (let f = 0; f < dp.count; f += 3) {
      // colour by face-centroid longitude → 12 crisp alternating gores
      let cx = 0;
      let cz = 0;
      for (let v = 0; v < 3; v++) {
        cx += dp.getX(f + v);
        cz += dp.getZ(f + v);
      }
      const gore = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 12 + 0.5);
      const c = gore % 2 === 0 ? cA : cB;
      for (let v = 0; v < 3; v++) stripeCols.set([c.r, c.g, c.b], (f + v) * 3);
    }
    domeGeo.setAttribute('color', new THREE.BufferAttribute(stripeCols, 3));
    this.canopyDome = M(
      domeGeo,
      new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gm, side: THREE.DoubleSide })
    );
    this.canopyDome.scale.set(1.45, 0.58, 1.05);
    const finial = M(new THREE.SphereGeometry(0.07, 8, 8), gold);
    finial.position.y = 0.94;
    this.canopy.add(this.canopyDome, finial);

    // wooden frame: crossbar + fore-aft spar just under the rim
    const rimY = 1.1 * 0.58; // cap-rim height after the dome's y-scale
    const bar = M(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), leather);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = rimY;
    const spar = M(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 6), leather);
    spar.rotation.x = Math.PI / 2;
    spar.position.y = rimY;
    this.canopy.add(bar, spar);

    // grips the hero hangs from + four lines out to the crossbar ends
    for (const sx of [-1, 1]) {
      const grip = M(new THREE.CylinderGeometry(0.028, 0.028, 0.8, 5), dark);
      grip.position.set(sx * 0.42, rimY - 0.42, 0.04);
      grip.rotation.z = sx * 0.12;
      this.canopy.add(grip);
      for (const sz of [-0.5, 0.5]) {
        const line = M(new THREE.CylinderGeometry(0.016, 0.016, 1.05, 4), dark);
        line.position.set(sx * 0.85, rimY - 0.38, sz * 0.5);
        line.rotation.z = sx * 0.72;
        line.rotation.x = -sz * 0.55;
        this.canopy.add(line);
      }
    }

    this.canopy.position.y = 2.05;
    this.canopy.visible = false;
    this.body.add(this.canopy);

    /* ---- limbs: capsules with hands / boots ---- */
    const makeArm = (side: number): THREE.Group => {
      const g = new THREE.Group();
      const shoulder = M(new THREE.SphereGeometry(0.14, 8, 8), tunic);
      const upper = M(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), tunic);
      upper.position.y = -0.28;
      const hand = M(new THREE.SphereGeometry(0.11, 8, 8), skin);
      hand.position.y = -0.56;
      g.add(shoulder, upper, hand);
      g.position.set(side * 0.44, 1.46, 0);
      return g;
    };
    const makeLeg = (side: number): THREE.Group => {
      const g = new THREE.Group();
      const thigh = M(new THREE.CapsuleGeometry(0.115, 0.36, 4, 8), pants);
      thigh.position.y = -0.22;
      const boot = M(new THREE.CapsuleGeometry(0.12, 0.14, 4, 8), leather);
      boot.position.y = -0.52;
      const toe = M(new THREE.SphereGeometry(0.11, 8, 8), leather);
      toe.scale.set(1, 0.7, 1.5);
      toe.position.set(0, -0.6, 0.08);
      g.add(thigh, boot, toe);
      g.position.set(side * 0.19, 0.66, 0);
      return g;
    };

    this.armL = makeArm(-1);
    this.armR = makeArm(1);
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);
    this.body.add(this.armL, this.armR, this.legL, this.legR);

    this.group.add(this.body);
  }

  /** the sea wins: wash the hero back to the last dry-land spot */
  private rescue(): void {
    this.swimming = false;
    this.position.copy(this.lastSafe);
    this.position.y = terrainHeight(this.lastSafe.x, this.lastSafe.z);
    this.velY = 0;
    this.grounded = true;
    this.stamina = 30;
    this.justRescued = true;
  }

  update(dt: number, input: Input, camera: THREE.PerspectiveCamera): void {
    const st = input.state;
    this.justLanded = false;
    this.justRescued = false;

    // ---- camera orbit ----
    this.camYaw -= st.lookDX * 0.0052;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + st.lookDY * 0.004, -0.05, 1.25);
    this.camDist = THREE.MathUtils.clamp(this.camDist + st.zoomDelta * 0.01, 4.5, 18);

    // ---- movement (camera-relative) ----
    const mv = new THREE.Vector2(st.moveX, st.moveY);
    if (mv.lengthSq() > 1) mv.normalize();
    const moving = mv.lengthSq() > 0.001;

    const wantsSprint = st.sprint && moving && !this.exhausted && (this.grounded || this.swimming);
    // paraglider: hold jump while airborne and falling
    this.gliding =
      st.jumpHeld && !this.grounded && !this.swimming && this.velY < 0 && !this.exhausted && this.stamina > 0;
    if (wantsSprint || this.gliding || this.swimming) {
      // the sea drains even a floating hero — no regen until dry land
      const drain = this.gliding
        ? GLIDE_DRAIN
        : this.swimming
          ? (wantsSprint ? SWIM_SPRINT_DRAIN : SWIM_DRAIN)
          : STAMINA_DRAIN;
      this.stamina -= drain * dt;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
        this.gliding = false;
        if (this.swimming) this.rescue();
      }
    } else {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
      if (this.exhausted && this.stamina > STAMINA_MAX * 0.3) this.exhausted = false;
    }

    const targetSpeed = this.swimming
      ? (moving ? (wantsSprint ? SWIM_SPRINT : SWIM_SPEED) : 0)
      : this.gliding
        ? (moving ? GLIDE_SPEED : 0)
        : moving
          ? (wantsSprint ? SPRINT_SPEED : WALK_SPEED) * (this.exhausted ? 0.55 : 1)
          : 0;
    this.speedSmooth = THREE.MathUtils.damp(this.speedSmooth, targetSpeed, 10, dt);

    const headingBefore = this.heading;

    if (moving) {
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      // camera forward on the ground plane; right = forward × up
      const dirX = -sin * mv.y + cos * mv.x;
      const dirZ = -cos * mv.y - sin * mv.x;
      const targetHeading = Math.atan2(dirX, dirZ);

      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);

      const step = this.speedSmooth * dt;
      const nx = this.position.x + Math.sin(this.heading) * step;
      const nz = this.position.z + Math.cos(this.heading) * step;

      // only the world rim blocks now — the sea is swimmable
      if (Math.hypot(nx, nz) < 105) {
        this.position.x = nx;
        this.position.z = nz;
      }
    }

    // smoothed yaw rate, used to bank the glider into turns
    let dTurn = this.heading - headingBefore;
    while (dTurn > Math.PI) dTurn -= Math.PI * 2;
    while (dTurn < -Math.PI) dTurn += Math.PI * 2;
    this.turnSmooth = THREE.MathUtils.damp(this.turnSmooth, dTurn / Math.max(dt, 1e-4), 8, dt);

    // ---- static object collision ----
    // grounded: step up stair-sized walkable ledges; airborne: only land on
    // tops we're actually above, otherwise get pushed out
    const platform = collide(this.position, this.grounded ? 0.75 : 0.05);

    // ---- water / gravity / jump ----
    const terrH = terrainHeight(this.position.x, this.position.z);
    const ground = Math.max(terrH, platform);

    if (!this.swimming && terrH < DEEP_WATER && ground < SWIM_Y && this.position.y <= SWIM_Y + 0.15) {
      // the sea takes over: kill the fall, surface, splash
      this.swimming = true;
      this.gliding = false;
      this.grounded = false;
      this.velY = 0;
      this.position.y = SWIM_Y;
      playSplash();
    }

    if (this.swimming) {
      if (ground >= SWIM_Y - 0.05) {
        // shallows reached — stand up
        this.swimming = false;
        this.position.y = ground;
        this.grounded = true;
        this.velY = 0;
      } else if (st.jumpPressed && !this.exhausted) {
        // burst up out of the water
        this.swimming = false;
        this.velY = 8.5;
        playSplash();
      } else {
        this.position.y = SWIM_Y + Math.sin(performance.now() * 0.0021) * 0.1;
      }
    }

    if (!this.swimming) {
      if (st.jumpPressed && this.grounded) {
        this.velY = JUMP_VELOCITY;
        this.grounded = false;
      }
      this.velY += GRAVITY * dt;
      // canopy drag: ease the fall toward a gentle terminal velocity
      if (this.gliding && this.velY < GLIDE_FALL) {
        this.velY = THREE.MathUtils.damp(this.velY, GLIDE_FALL, 9, dt);
      }
      this.position.y += this.velY * dt;
      if (this.position.y <= ground) {
        if (!this.grounded && this.velY < -9) this.justLanded = true;
        this.position.y = ground;
        this.velY = 0;
        this.grounded = true;
        this.gliding = false;
      }
    }

    // remember the last dry solid spot — where the sea returns tired swimmers
    if (this.grounded && terrH > 0.6 && this.position.y <= terrH + 0.05) {
      this.lastSafe.copy(this.position);
    }

    // ---- pose ----
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;

    const speedFrac = this.speedSmooth / SPRINT_SPEED;
    const tNow = performance.now() * 0.001;

    // scarf streams out behind with speed; cap tip wobbles
    this.scarfTail.rotation.x = 0.35 + speedFrac * 1.1 + Math.sin(tNow * 5.5) * (0.06 + speedFrac * 0.3);
    this.scarfTail.rotation.z = Math.sin(tNow * 4.2) * (0.05 + speedFrac * 0.2);
    this.capTip.position.x = Math.sin(tNow * 4.8) * (0.015 + speedFrac * 0.05);
    this.head.rotation.x = speedFrac * 0.1;

    if (this.swimming) {
      this.swimPhase += dt * (3.5 + speedFrac * 9);
      const sw = Math.sin(this.swimPhase);
      if (speedFrac > 0.05) {
        // front crawl: alternating strokes, fluttering legs, body prone
        this.armL.rotation.x = -1.5 + sw * 1.5;
        this.armR.rotation.x = -1.5 - sw * 1.5;
        this.legL.rotation.x = sw * 0.45;
        this.legR.rotation.x = -sw * 0.45;
        this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, 1.18, 6, dt);
        this.body.position.y = THREE.MathUtils.damp(this.body.position.y, 0.78, 6, dt);
      } else {
        // treading water, half-reclined
        this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, -0.5 + sw * 0.2, 6, dt);
        this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, -0.5 - sw * 0.2, 6, dt);
        this.legL.rotation.x = sw * 0.3;
        this.legR.rotation.x = -sw * 0.3;
        this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, 0.55, 5, dt);
        this.body.position.y = THREE.MathUtils.damp(this.body.position.y, 0.5, 5, dt);
      }
    } else if (this.grounded && speedFrac > 0.03) {
      this.walkPhase += dt * (6 + speedFrac * 8);
      const amp = 0.45 + speedFrac * 0.5;
      const s = Math.sin(this.walkPhase);
      // a footstep lands each time the stride crosses centre
      const stepSign = s >= 0 ? 1 : -1;
      if (stepSign !== this.prevStepSign) playFootstep(0.012 + speedFrac * 0.035);
      this.prevStepSign = stepSign;
      this.legL.rotation.x = s * amp;
      this.legR.rotation.x = -s * amp;
      this.armL.rotation.x = -s * amp * 0.8;
      this.armR.rotation.x = s * amp * 0.8;
      this.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.09;
      this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, speedFrac * 0.12, 12, dt);
    } else if (!this.grounded) {
      if (this.gliding) {
        // hands up on the grips, legs dangling, slight forward lean
        this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, -2.6, 10, dt);
        this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, -2.6, 10, dt);
        const sway = Math.sin(tNow * 2.4);
        this.legL.rotation.x = 0.25 + sway * 0.12;
        this.legR.rotation.x = 0.1 - sway * 0.12;
        this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, 0.22, 6, dt);
        // cloth breathes and the canopy rocks gently in the airflow
        this.canopyDome.scale.y = 0.58 + Math.sin(tNow * 8.5) * 0.02;
        this.canopy.rotation.x = Math.sin(tNow * 2.8) * 0.045;
      } else {
        this.legL.rotation.x = 0.5;
        this.legR.rotation.x = -0.3;
        this.armL.rotation.x = -0.9;
        this.armR.rotation.x = -0.9;
      }
    } else {
      const breathe = Math.sin(performance.now() * 0.0016) * 0.03;
      this.legL.rotation.x = THREE.MathUtils.damp(this.legL.rotation.x, 0, 8, dt);
      this.legR.rotation.x = THREE.MathUtils.damp(this.legR.rotation.x, 0, 8, dt);
      this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, breathe, 8, dt);
      this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, -breathe, 8, dt);
      this.body.position.y = THREE.MathUtils.damp(this.body.position.y, 0, 8, dt);
      this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, 0, 8, dt);
    }

    this.canopy.visible = this.gliding;
    // bank hero + canopy into glider turns; settle upright otherwise
    const bank = this.gliding ? THREE.MathUtils.clamp(-this.turnSmooth * 0.28, -0.38, 0.38) : 0;
    this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, bank, 5, dt);

    // ---- camera ----
    // widen the FOV a touch while gliding for a sense of speed
    const wantFov = this.gliding ? GLIDE_FOV : BASE_FOV;
    if (Math.abs(camera.fov - wantFov) > 0.01) {
      camera.fov = THREE.MathUtils.damp(camera.fov, wantFov, 4, dt);
      camera.updateProjectionMatrix();
    }
    const target = new THREE.Vector3(this.position.x, this.position.y + 1.7, this.position.z);
    const off = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    ).multiplyScalar(this.camDist);
    const desired = target.clone().add(off);
    // shorten the boom in front of obstacles so the hero stays in view
    const fr = cameraClearance(target, desired);
    if (fr < 1) {
      const minFr = Math.min(1, 2.2 / this.camDist); // never closer than ~2.2 units
      desired.copy(target).addScaledVector(off, Math.max(fr, minFr));
    }
    // keep the camera above the terrain — and above the sea while swimming
    const camGround = Math.max(terrainHeight(desired.x, desired.z) + 0.6, WATER_LEVEL + 0.55);
    if (desired.y < camGround) desired.y = camGround;
    // snap in quickly when obstructed, ease back out gently
    camera.position.lerp(desired, 1 - Math.exp(-dt * (fr < 1 ? 16 : 7)));
    camera.lookAt(target);
  }
}
