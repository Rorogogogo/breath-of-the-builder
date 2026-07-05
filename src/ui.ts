import type { Site } from './data';
import { sites, profile, totalSkills } from './data';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

export class UI {
  panelOpen = false;
  private discovered = new Set<string>();
  /** sites the player has walked near (banner shown) — distinct from discovered */
  private visited = new Set<string>();
  private toastTimer = 0;
  private bannerTimer = 0;
  private pickupTimer = 0;
  private skillsCollected = 0;
  private onCloseCb: (() => void) | null = null;

  constructor() {
    $('quest-total').textContent = String(sites.length);
    $('spirit-total').textContent = String(totalSkills);
    const dots = $('quest-dots');
    for (const s of sites) {
      const d = document.createElement('div');
      d.className = 'dot';
      d.id = `dot-${s.id}`;
      d.title = s.title;
      dots.appendChild(d);
    }
    $('panel-close').addEventListener('click', () => this.closePanel());
    $('panel-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closePanel();
    });
    window.addEventListener('keydown', (e) => {
      if (this.panelOpen && (e.code === 'Escape' || e.code === 'KeyE')) {
        e.stopPropagation();
        this.closePanel();
      }
    }, { capture: true });
  }

  showHud(): void {
    $('hud').classList.remove('hidden');
  }

  setPrompt(text: string | null): void {
    const el = $('prompt');
    if (text) {
      $('prompt-text').textContent = text;
      el.classList.remove('hidden');
      if (document.body.classList.contains('touch')) $('btn-e').classList.remove('hidden');
    } else {
      el.classList.add('hidden');
      $('btn-e').classList.add('hidden');
    }
  }

  /** show the touch 🪂 button only while airborne */
  setGlideButton(airborne: boolean): void {
    if (!document.body.classList.contains('touch')) return;
    $('btn-glide').classList.toggle('hidden', !airborne);
  }

  setStamina(frac: number, exhausted: boolean): void {
    const wrap = $('stamina-wrap');
    const bar = $('stamina');
    wrap.classList.toggle('show', frac < 0.999);
    bar.style.setProperty('--frac', `${Math.max(0, frac) * 100}%`);
    bar.classList.toggle('low', exhausted);
  }

  toast(msg: string): void {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add('hidden'), 3200);
  }

  /** area-discovery banner on first approach; returns true if newly visited */
  visitRegion(site: Site): boolean {
    if (this.visited.has(site.id)) return false;
    this.visited.add(site.id);
    const el = $('region-banner');
    $('region-banner-text').textContent = site.shrineName;
    el.classList.add('hidden');
    void el.offsetWidth; // restart the CSS animation
    el.classList.remove('hidden');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => el.classList.add('hidden'), 3500);
    return true;
  }

  /** a skill orb was gathered — bump the Spirit counter, flash a chip */
  collectSkill(orb: { skill: string; category: string; accent: string }): void {
    this.skillsCollected++;
    $('spirit-count').textContent = String(this.skillsCollected);
    const el = $('pickup');
    document.documentElement.style.setProperty('--pickup-accent', orb.accent);
    $('pickup-text').innerHTML = '';
    const b = document.createElement('b');
    b.textContent = orb.skill;
    $('pickup-text').append('✦ ', b, ` — ${orb.category}`);
    el.classList.add('hidden');
    void el.offsetWidth; // restart the CSS animation
    el.classList.remove('hidden');
    clearTimeout(this.pickupTimer);
    this.pickupTimer = window.setTimeout(() => el.classList.add('hidden'), 2000);
    if (this.skillsCollected === totalSkills) {
      setTimeout(() => this.toast('✦ Spirit of the Builder complete ✦'), 400);
    }
  }

  /** returns true if this was a first discovery */
  discover(site: Site): boolean {
    if (this.discovered.has(site.id)) return false;
    this.discovered.add(site.id);
    $('quest-count').textContent = String(this.discovered.size);
    $(`dot-${site.id}`).classList.add('lit');
    if (this.discovered.size === sites.length) {
      setTimeout(() => this.toast('✦ All shrines discovered — the island remembers you ✦'), 600);
    } else {
      this.toast(`${site.shrineName} — discovered`);
    }
    return true;
  }

  openPanel(site: Site, onClose: () => void): void {
    this.panelOpen = true;
    this.onCloseCb = onClose;
    document.documentElement.style.setProperty('--accent', site.accent);

    $('panel-category').textContent = site.category;
    $('panel-title').textContent = site.title;
    $('panel-subtitle').textContent = `${site.shrineName} · ${site.summary}`;
    $('panel-desc').textContent = site.description;

    const metrics = $('panel-metrics');
    metrics.innerHTML = '';
    for (const m of site.metrics) {
      const d = document.createElement('div');
      d.className = 'metric';
      const b = document.createElement('b');
      b.textContent = m.value;
      const s = document.createElement('span');
      s.textContent = m.label;
      d.append(b, s);
      metrics.appendChild(d);
    }

    const featWrap = $('panel-features-wrap');
    const feats = $('panel-features');
    feats.innerHTML = '';
    featWrap.style.display = site.features.length ? '' : 'none';
    for (const f of site.features) {
      const li = document.createElement('li');
      li.textContent = f;
      feats.appendChild(li);
    }

    const techWrap = $('panel-tech-wrap');
    const tech = $('panel-tech');
    tech.innerHTML = '';
    techWrap.style.display = site.tech.length ? '' : 'none';
    for (const t of site.tech) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = t;
      tech.appendChild(chip);
    }

    const links = $('panel-links');
    links.innerHTML = '';
    for (const l of site.links) {
      const a = document.createElement('a');
      a.href = l.href;
      a.target = l.href.startsWith('mailto:') ? '_self' : '_blank';
      a.rel = 'noopener';
      a.className = l.primary ? 'primary' : 'secondary';
      a.textContent = l.label;
      links.appendChild(a);
    }

    $('panel-backdrop').classList.remove('hidden');
  }

  get allDiscovered(): boolean {
    return this.discovered.size === sites.length;
  }

  /** completion credits card — the recruiter CTA moment */
  showCredits(onDismiss: () => void): void {
    $('credits-name').textContent = profile.name;
    $('credits-role').textContent = `${profile.role} · ${profile.location}`;
    const links = $('credits-links');
    links.innerHTML = '';
    const ctas: { label: string; href: string; primary?: boolean }[] = [
      { label: 'Email me', href: profile.email, primary: true },
      { label: 'Resume', href: profile.resume },
      { label: 'GitHub', href: profile.github },
      { label: 'LinkedIn', href: profile.linkedin },
    ];
    for (const l of ctas) {
      const a = document.createElement('a');
      a.href = l.href;
      a.target = l.href.startsWith('mailto:') ? '_self' : '_blank';
      a.rel = 'noopener';
      a.className = l.primary ? 'primary' : 'secondary';
      a.textContent = l.label;
      links.appendChild(a);
    }
    $('credits-backdrop').classList.remove('hidden');
    $('btn-keep-exploring').addEventListener(
      'click',
      () => {
        $('credits-backdrop').classList.add('hidden');
        onDismiss();
      },
      { once: true }
    );
  }

  closePanel(): void {
    if (!this.panelOpen) return;
    this.panelOpen = false;
    $('panel-backdrop').classList.add('hidden');
    this.onCloseCb?.();
    this.onCloseCb = null;
  }
}
