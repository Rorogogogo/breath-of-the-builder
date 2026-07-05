/**
 * data.ts — single source of truth for all portfolio content in the world.
 * Ported from v2 (builder-island) portfolio-data.ts.
 * All copy and links for the portfolio live here.
 */

export type SiteKind = 'project' | 'about' | 'contact';

export interface SiteLink {
  label: string;
  href: string;
  primary?: boolean;
}

export interface Site {
  id: string;
  kind: SiteKind;
  /** shrine name shown in the world + panel title */
  title: string;
  /** flavour name, Zelda-style */
  shrineName: string;
  category: string;
  summary: string;
  description: string;
  features: string[];
  tech: string[];
  metrics: { label: string; value: string }[];
  links: SiteLink[];
  accent: string;
  /** world position [x, z]; y comes from the terrain */
  pos: [number, number];
  /** terrain is flattened to this height around the site */
  plateau: number;
  featured?: boolean;
}

export const profile = {
  name: 'Robert Wang',
  role: 'Full-Stack Developer & AI-Native Product Builder',
  location: 'Sydney, Australia',
  email: 'mailto:xwang.robert@gmail.com',
  github: 'https://github.com/Rorogogogo',
  linkedin: 'https://www.linkedin.com/in/robert-wang-cs/',
  resume: '/resume.pdf',
};

export const sites: Site[] = [
  {
    id: 'nomoreide',
    kind: 'project',
    title: 'NoMoreIDE',
    shrineName: 'Shrine of the Quiet Console',
    category: 'Developer Tools',
    featured: true,
    summary: 'A lightweight local development control console for AI-native vibe coders.',
    description:
      'NoMoreIDE is a lightweight local development control console for AI-native vibe coders — built for developers who no longer want to rely on heavy traditional IDEs for every task. ' +
      'Developers increasingly use Claude Code, Codex, and other AI coding agents to generate or modify code. What they need is not another heavy IDE, but a lightweight local control console that AI can understand, configure, and trigger with prompts. ' +
      'NoMoreIDE reduces development noise so developers can focus on ideas, products, and UX.',
    features: [
      'Terminal management',
      'Git workflow control',
      'Database access',
      'Logs & local services',
      'GitHub workflow integration',
      'Prompt-configurable dev actions',
      'Lightweight developer dashboard',
    ],
    tech: ['TypeScript', 'Node.js', 'MCP', 'React', 'Local-first', 'CLI'],
    metrics: [
      { label: 'Focus', value: 'Less noise' },
      { label: 'Built for', value: 'AI-native devs' },
      { label: 'Footprint', value: 'Lightweight' },
    ],
    links: [
      { label: 'GitHub', href: 'https://github.com/Rorogogogo/nomoreide', primary: true },
      { label: 'Live Demo', href: 'https://www.nomoreide.com' },
    ],
    accent: '#6ee7ff',
    pos: [-30, -6],
    plateau: 6,
  },
  {
    id: 'branctl',
    kind: 'project',
    title: 'Brainctl',
    shrineName: 'Shrine of the Branching Path',
    category: 'Developer Tools',
    featured: true,
    summary: 'A modern control tower for branches, workflows, and AI-assisted engineering tasks.',
    description:
      'Brainctl is a developer control tool focused on making branch-based workflows, local development operations, and AI-assisted engineering tasks easier to manage from one clean interface — a command/control layer for developers; a modern control tower for managing branches, workflows, and development commands.',
    features: [
      'Branch workflow control',
      'Local project command center',
      'Git operation shortcuts',
      'AI-assisted workflow triggers',
      'Repository status overview',
      'Clean command-first interface',
    ],
    tech: ['TypeScript', 'Git', 'AI workflows', 'CLI', 'Local-first'],
    metrics: [
      { label: 'Layer', value: 'Command/control' },
      { label: 'Interface', value: 'Command-first' },
      { label: 'Status', value: 'In progress' },
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/Rorogogogo/brainctl', primary: true }],
    accent: '#a78bfa',
    pos: [28, -12],
    plateau: 7.5,
  },
  {
    id: 'jobjourney',
    kind: 'project',
    title: 'JobJourney',
    shrineName: 'Shrine of a Thousand Doors',
    category: 'AI Product',
    summary: 'AI job assistant — Chrome extension + web platform. 850+ users, 400k+ job searches.',
    description:
      'JobJourney is an AI job assistant delivered as a Chrome extension and a web platform. It helps job seekers collect, organise, and act on opportunities with AI assistance across the whole journey — from finding roles to preparing for interviews.',
    features: [
      'Job collection from LinkedIn, Seek, Indeed',
      'AI CV–JD matching',
      'Cover letter generation',
      'CV evaluation',
      'Mock interview',
      'Portfolio generator',
    ],
    tech: ['Next.js', '.NET 9', 'PostgreSQL', 'AWS EC2', 'Cloudflare', 'OpenAI', 'MCP', 'Stripe'],
    metrics: [
      { label: 'Users', value: '850+' },
      { label: 'Job searches', value: '400k+' },
      { label: 'Surface', value: 'Ext + Web' },
    ],
    links: [{ label: 'Live Demo', href: 'https://jobjourney.me', primary: true }],
    accent: '#34d399',
    pos: [-52, 30],
    plateau: 4.5,
  },
  {
    id: 'standtogether',
    kind: 'project',
    title: 'StandTogether',
    shrineName: 'Shrine of the Gathered Flame',
    category: 'Community',
    summary: 'Community safety & justice platform — used as an official campaign website.',
    description:
      'StandTogether is a community safety and justice platform built as a non-profit-style public platform. It combines an interactive map, a timeline, public resources, AI moderation, and an admin workflow. It was used as an official campaign website.',
    features: ['Interactive map', 'Timeline', 'Public resources', 'AI moderation', 'Admin workflow'],
    tech: ['Next.js', '.NET 9', 'PostgreSQL', 'Leaflet', 'AWS / GCP', 'Cloudflare', 'AWS SES'],
    metrics: [
      { label: 'Visits / week', value: '3k+' },
      { label: 'Interactions', value: '30k+' },
      { label: 'Submissions', value: '50+' },
    ],
    links: [{ label: 'Live Demo', href: 'https://standtogether.club', primary: true }],
    accent: '#fbbf24',
    pos: [50, 32],
    plateau: 5,
  },
  {
    id: 'export-system',
    kind: 'project',
    title: 'Export System',
    shrineName: 'Shrine of the Sealed Ledger',
    category: 'Enterprise',
    summary: 'Commercial export management system — a production platform for export workflows.',
    description:
      'A commercial export management system handling export workflows end to end: RFP, PRF, FINL, HCRD, HCD, certificate requests, and reissue flows, integrated with ABF / DAFF workflows. It handles EDIFACT / S-MIME / EDI email, generates Excel drafts, polls Exchange email, runs Hangfire background jobs, and pushes SignalR notifications.',
    features: [
      'RFP / PRF / FINL / HCRD / HCD workflows',
      'Certificate requests & reissue flows',
      'ABF / DAFF integration',
      'EDIFACT / EDI email handling',
      'Hangfire background jobs',
      'SignalR notifications',
    ],
    tech: ['React', 'TypeScript', 'MUI', '.NET 9', 'EF Core', 'PostgreSQL', 'Hangfire', 'SignalR', 'Azure DevOps'],
    metrics: [
      { label: 'Type', value: 'Production' },
      { label: 'Domain', value: 'Export' },
      { label: 'Integrations', value: 'ABF / DAFF / EDI' },
    ],
    links: [],
    accent: '#f87171',
    pos: [6, 58],
    plateau: 6.5,
  },
  {
    id: 'about',
    kind: 'about',
    title: 'Robert Wang',
    shrineName: "The Builder's Cabin",
    category: 'About the Builder',
    summary: 'Sydney-based full-stack developer and AI-native product builder.',
    description:
      'Sydney-based full-stack developer and AI-native product builder. I build practical AI products, developer tools, and production-grade business systems — developer tools for AI-native workflows, shipped AI products with real users, and production systems that quietly keep businesses running.',
    features: [
      'Developer tools for AI-native workflows',
      'Shipped AI products with real users',
      'Production-grade business systems',
    ],
    tech: ['.NET', 'React', 'Next.js', 'TypeScript', 'PostgreSQL', 'AWS', 'Azure', 'CI/CD', 'OpenAI', 'MCP'],
    metrics: [
      { label: 'Base', value: 'Sydney, AU' },
      { label: 'Class', value: 'Full-Stack' },
      { label: 'Spec', value: 'AI-native' },
    ],
    links: [
      { label: 'Resume', href: profile.resume, primary: true },
      { label: 'GitHub', href: profile.github },
      { label: 'LinkedIn', href: profile.linkedin },
    ],
    accent: '#ffb86b',
    pos: [-4, -50],
    plateau: 3.2,
  },
  {
    id: 'contact',
    kind: 'contact',
    title: 'Send a Raven',
    shrineName: "The Traveler's Dock",
    category: 'Contact',
    summary: 'Interested in AI-native developer tools, practical AI products, or production systems?',
    description:
      'Interested in AI-native developer tools, practical AI products, or production systems? The dock is always open — a boat leaves for Sydney every tide. Let’s connect.',
    features: [],
    tech: [],
    metrics: [
      { label: 'Response time', value: '< 1 tide' },
      { label: 'Timezone', value: 'AEST' },
    ],
    links: [
      { label: 'Email me', href: profile.email, primary: true },
      { label: 'LinkedIn', href: profile.linkedin },
      { label: 'GitHub', href: profile.github },
    ],
    accent: '#6ee7ff',
    pos: [14, 74],
    plateau: 1.6,
  },
];

/* ------------------------------------------------------------------ */
/*  SKILL TREE — surfaced in-world as collectible skill orbs           */
/* ------------------------------------------------------------------ */

export interface SkillGroup {
  category: string;
  accent: string;
  skills: string[];
}

export const skillTree: SkillGroup[] = [
  {
    category: 'Frontend',
    accent: '#6ee7ff',
    skills: ['React', 'Next.js', 'TypeScript', 'MUI', 'Tailwind CSS', 'Framer Motion'],
  },
  {
    category: 'Backend',
    accent: '#a78bfa',
    skills: ['.NET', 'EF Core', 'PostgreSQL', 'REST APIs', 'Authentication', 'Hangfire', 'SignalR'],
  },
  {
    category: 'AI',
    accent: '#34d399',
    skills: [
      'OpenAI',
      'MCP',
      'AI workflow design',
      'CV–JD matching',
      'Transcript summarisation',
      'Mock interview analysis',
      'AI coding workflows',
    ],
  },
  {
    category: 'Developer Tools',
    accent: '#ffb86b',
    skills: [
      'Local-first tooling',
      'Terminal workflows',
      'Git workflows',
      'Prompt-based automation',
      'AI-native development',
      'Chrome extensions',
      'MCP tools',
    ],
  },
  {
    category: 'DevOps',
    accent: '#f87171',
    skills: [
      'AWS EC2',
      'Azure App Service',
      'Azure DevOps',
      'GitHub Actions',
      'Cloudflare',
      'Nginx',
      'PM2',
      'CI/CD',
      'Key Vault',
    ],
  },
];

export const totalSkills = skillTree.reduce((n, g) => n + g.skills.length, 0);

/** v1/v2 fallback for the "recruiter in a hurry" link on the title screen */
export const flatFallbackUrl = 'https://robert.jobjourney.me/';
