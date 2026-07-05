/**
 * input.ts — keyboard, mouse-drag camera orbit, wheel zoom, and a virtual
 * joystick + action button on touch devices.
 */

export interface InputState {
  /** movement axes in [-1, 1]: x = strafe, y = forward */
  moveX: number;
  moveY: number;
  sprint: boolean;
  /** true while the jump key / glide button is held (paraglider) */
  jumpHeld: boolean;
  /** consumed-by-reader flags */
  jumpPressed: boolean;
  interactPressed: boolean;
  /** camera orbit deltas since last frame (pixels) */
  lookDX: number;
  lookDY: number;
  zoomDelta: number;
}

export class Input {
  readonly state: InputState = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    jumpHeld: false,
    jumpPressed: false,
    interactPressed: false,
    lookDX: 0,
    lookDY: 0,
    zoomDelta: 0,
  };

  readonly isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  private keys = new Set<string>();
  /** pointerId → role, so joystick and camera drags can coexist */
  private touchRoles = new Map<number, 'joystick' | 'camera'>();
  /** pointerId → last position, for camera deltas and pinch zoom */
  private pointerPos = new Map<number, { x: number; y: number }>();
  private joyOrigin = { x: 0, y: 0 };

  /** when true (a panel is open), gameplay input is ignored */
  blocked = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.state.jumpHeld = false;
    });

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    if (this.isTouch) {
      document.body.classList.add('touch');
      const btnE = document.getElementById('btn-e')!;
      btnE.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.state.interactPressed = true;
      });
      // jump button — full Space parity: tap = jump / burst out of water,
      // hold while airborne = glide (icon handled by UI.setJumpButton)
      const btnJump = document.getElementById('btn-jump')!;
      btnJump.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.blocked) return;
        this.state.jumpPressed = true;
        this.state.jumpHeld = true;
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
        btnJump.addEventListener(ev, () => {
          this.state.jumpHeld = false;
        });
      }
    }
  }

  /** call once per frame after reading; clears per-frame deltas */
  endFrame(): void {
    this.state.lookDX = 0;
    this.state.lookDY = 0;
    this.state.zoomDelta = 0;
    this.state.jumpPressed = false;
    this.state.interactPressed = false;
  }

  private updateMoveFromKeys(): void {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    this.state.moveX = x;
    this.state.moveY = y;
    this.state.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE' || e.code === 'Enter') this.state.interactPressed = true;
    if (this.blocked) return;
    this.keys.add(e.code);
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.state.jumpPressed = true;
      this.state.jumpHeld = true;
    }
    this.updateMoveFromKeys();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'Space') this.state.jumpHeld = false;
    this.updateMoveFromKeys();
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.blocked) return;
    if (this.isTouch && e.clientX < window.innerWidth * 0.45 && e.clientY > window.innerHeight * 0.45) {
      // left-bottom quadrant on touch = joystick
      this.touchRoles.set(e.pointerId, 'joystick');
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.positionJoystick(e.clientX, e.clientY, e.clientX, e.clientY);
    } else {
      this.touchRoles.set(e.pointerId, 'camera');
    }
    this.pointerPos.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private onPointerMove = (e: PointerEvent): void => {
    const role = this.touchRoles.get(e.pointerId);
    if (!role) return;
    if (role === 'joystick') {
      const dx = e.clientX - this.joyOrigin.x;
      const dy = e.clientY - this.joyOrigin.y;
      const len = Math.hypot(dx, dy);
      const max = 46;
      const cl = len > max ? max / len : 1;
      this.state.moveX = (dx * cl) / max;
      this.state.moveY = (-dy * cl) / max;
      this.state.sprint = len > max * 1.55;
      this.positionJoystick(this.joyOrigin.x, this.joyOrigin.y, this.joyOrigin.x + dx * cl, this.joyOrigin.y + dy * cl);
    } else if (!this.blocked) {
      const camIds = [...this.touchRoles].filter(([, r]) => r === 'camera').map(([id]) => id);
      if (camIds.length >= 2) {
        // two fingers on the camera side = pinch zoom
        const [a, b] = camIds;
        const pa = this.pointerPos.get(a)!;
        const pb = this.pointerPos.get(b)!;
        const oldDist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        const na = e.pointerId === a ? { x: e.clientX, y: e.clientY } : pa;
        const nb = e.pointerId === b ? { x: e.clientX, y: e.clientY } : pb;
        const newDist = Math.hypot(na.x - nb.x, na.y - nb.y);
        this.state.zoomDelta += (oldDist - newDist) * 2.4;
      } else {
        const prev = this.pointerPos.get(e.pointerId)!;
        this.state.lookDX += e.clientX - prev.x;
        this.state.lookDY += e.clientY - prev.y;
      }
    }
    this.pointerPos.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private onPointerUp = (e: PointerEvent): void => {
    const role = this.touchRoles.get(e.pointerId);
    if (role === 'joystick') {
      this.state.moveX = 0;
      this.state.moveY = 0;
      this.state.sprint = false;
      document.getElementById('joystick')!.classList.add('hidden');
    }
    this.touchRoles.delete(e.pointerId);
    this.pointerPos.delete(e.pointerId);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (!this.blocked) this.state.zoomDelta += e.deltaY;
  };

  private positionJoystick(ox: number, oy: number, kx: number, ky: number): void {
    const joy = document.getElementById('joystick')!;
    const knob = document.getElementById('joystick-knob')!;
    joy.classList.remove('hidden');
    knob.classList.toggle('sprint', this.state.sprint);
    joy.style.left = `${ox - 60}px`;
    joy.style.top = `${oy - 60}px`;
    joy.style.bottom = 'auto';
    knob.style.transform = `translate(${kx - ox}px, ${ky - oy}px)`;
  }
}
