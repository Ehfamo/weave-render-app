import cover1 from "@/assets/cover-1.webp";
import cover2 from "@/assets/cover-2.webp";
import cover3 from "@/assets/cover-3.webp";
import cover4 from "@/assets/cover-4.webp";
import cover5 from "@/assets/cover-5.webp";
import cover6 from "@/assets/cover-6.webp";
import cover7 from "@/assets/cover-7.webp";
import cover8 from "@/assets/cover-8.webp";
import cover9 from "@/assets/cover-9.webp";
import cover10 from "@/assets/cover-10.webp";
import cover11 from "@/assets/cover-11.webp";
import cover12 from "@/assets/cover-12.webp";
import cover13 from "@/assets/cover-13.webp";
import cover14 from "@/assets/cover-14.webp";
import cover15 from "@/assets/cover-15.webp";
import cover16 from "@/assets/cover-16.webp";
import cr1 from "@/assets/Photo of model women (1).webp";
import cr2 from "@/assets/Photo of model women.webp";
import cr3 from "@/assets/A menacing plus-size model hell goddess.webp";
import cr4 from "@/assets/Drine shot of a full body A beautiful futuristic b.webp";
import cr5 from "@/assets/4k photo_selfie of 25 year old punk girl_looks lik.webp";

export type PromptState = "free" | "premium" | "soon";
export type ViralSignal = "trending" | "rising" | "top1" | "viral" | null;

export type Prompt = {
  id: string;
  title: string;
  category: string;
  state: PromptState;
  cover: string;
  author: string;
  views: string;
  likes: string;
  prompt: string;
  breakdown: { label: string; value: string }[];
  engine?: {
    role: string;
    context: string;
    instructions: string;
    output: string;
    constraints: string;
  };
  copies?: number;
  saves?: number;
  shares?: number;
  remixes?: number;
  viralScore?: number;
  signal?: ViralSignal;
  tagline?: string;
  related?: string[];
};

const covers = [cover1, cover2, cover3, cover4, cover5, cover6, cover7, cover8, cover9, cover10, cover11, cover12, cover13, cover14, cover15, cover16];

export const PROMPTS: Prompt[] = [
  {
    id: "baroque-muse",
    title: "Baroque Muse Portrait",
    category: "Portrait",
    state: "premium",
    cover: cover1,
    author: "@nocturne",
    views: "1.2M",
    likes: "84.3k",
    prompt: "Cinematic baroque portrait of a young woman, painterly chiaroscuro lighting, gilded velvet drapery, intricate ornate detail, shot on Hasselblad, 85mm, ultra detailed skin texture, Rembrandt key light, deep amber palette, museum quality.",
    breakdown: [
      { label: "Style", value: "Baroque, painterly, editorial" },
      { label: "Lighting", value: "Chiaroscuro / Rembrandt" },
      { label: "Camera", value: "Hasselblad H6D, 85mm f/1.4" },
      { label: "Palette", value: "Obsidian · Amber · Ruby" },
    ],
    engine: {
      role: "You are a master baroque portrait director with a Vogue Italia editorial sensibility.",
      context: "Cover art for a luxury AI prompt drop. Subject: a young muse in gilded velvet.",
      instructions: "Render a single hero portrait. Painterly chiaroscuro. Ornate gilt detail. Skin must read as photograph, not illustration.",
      output: "Single 4:5 image, 8k, museum-grade color, deep negative space upper-right for typography.",
      constraints: "No modern clothing. No text. No watermarks. No symmetric framing.",
    },
    copies: 12480, saves: 8210, shares: 3640, remixes: 920, viralScore: 98, signal: "top1",
    tagline: "The crown jewel of editorial AI portraits.",
    related: ["neon-jewel", "velvet-bloom", "visor-oracle"],
  },
  {
    id: "neon-splash",
    title: "Neon Splash Editorial",
    category: "Fashion",
    state: "free",
    cover: cover2,
    author: "@maryikai",
    views: "880k",
    likes: "61.2k",
    prompt: "High contrast monochrome editorial portrait, single hot pink neon paint splash through hair, dramatic studio lighting, fashion magazine cover, sculpted shadows, glossy skin, Vogue Italia.",
    breakdown: [
      { label: "Style", value: "Monochrome editorial w/ accent" },
      { label: "Accent", value: "Neon Magenta #FF1F8F" },
      { label: "Camera", value: "Phase One IQ4, 80mm" },
      { label: "Mood", value: "Bold · Defiant · Iconic" },
    ],
    engine: {
      role: "You are an avant-garde fashion photographer working for Vogue Italia.",
      context: "Editorial cover. Monochrome with one chromatic accent.",
      instructions: "Studio portrait. Hard side key light. One vivid magenta paint splash through hair.",
      output: "4:5, magazine-cover-grade, glossy skin texture, no grain.",
      constraints: "Only one color outside black & white. No props. No text overlays.",
    },
    copies: 9320, saves: 6440, shares: 4810, remixes: 2110, viralScore: 96, signal: "trending",
    tagline: "The most copied prompt this week.",
    related: ["neon-jewel", "visor-oracle", "baroque-muse"],
  },
  {
    id: "gold-particles",
    title: "Gold Particle Realm",
    category: "Atmosphere",
    state: "free",
    cover: cover3,
    author: "@ember",
    views: "412k",
    likes: "29.8k",
    prompt: "Vast cinematic landscape at dusk, swarms of glowing gold particles rising over silhouetted mountains, volumetric god rays, dust motes, IMAX wide format, deep amber and obsidian palette.",
    breakdown: [
      { label: "Format", value: "IMAX 1.43:1" },
      { label: "Lighting", value: "Volumetric god rays" },
      { label: "Palette", value: "Amber · Obsidian" },
      { label: "Render", value: "Octane, 8k" },
    ],
    copies: 5120, saves: 4030, shares: 1280, remixes: 410, viralScore: 84, signal: "rising",
    related: ["monolith-corridor", "void-astronaut", "velvet-bloom"],
  },
  {
    id: "cyberpunk-dusk",
    title: "Cyberpunk Dusk City",
    category: "Sci-Fi",
    state: "soon",
    cover: cover4,
    author: "@ghostnet",
    views: "—",
    likes: "—",
    prompt: "[Locked — drops in 3d 14h]",
    breakdown: [
      { label: "Drop", value: "Tier 01 — Founders Pack" },
      { label: "Edition", value: "500 of 500" },
      { label: "Style", value: "Cyberpunk noir" },
      { label: "Status", value: "Coming soon" },
    ],
    copies: 0, saves: 2410, shares: 320, remixes: 0, viralScore: 91, signal: "viral",
    related: ["void-astronaut", "monolith-corridor", "ai-sigil"],
  },
  {
    id: "velvet-bloom",
    title: "Velvet & Gold Bloom",
    category: "Texture",
    state: "premium",
    cover: cover5,
    author: "@atelier",
    views: "260k",
    likes: "18.4k",
    prompt: "Macro abstract: deep maroon velvet with molten gold ink bloom, baroque painterly texture, satin fibers visible, museum lit, perfect for hero backdrops.",
    breakdown: [
      { label: "Style", value: "Macro abstract" },
      { label: "Material", value: "Velvet · Gold leaf" },
      { label: "Use", value: "Hero backdrop" },
      { label: "Resolution", value: "8192 × 10240" },
    ],
    copies: 3210, saves: 2640, shares: 410, remixes: 180, viralScore: 76, signal: null,
    related: ["liquid-alchemy", "baroque-muse", "gold-particles"],
  },
  {
    id: "neon-jewel",
    title: "Neon Jewel Couture",
    category: "Fashion",
    state: "premium",
    cover: cover6,
    author: "@maryikai",
    views: "640k",
    likes: "44.1k",
    prompt: "Monochrome high fashion portrait, vivid hot pink couture jewelry, selective color, dramatic side light, glossy editorial skin.",
    breakdown: [
      { label: "Style", value: "Selective color editorial" },
      { label: "Subject", value: "Couture jewelry" },
      { label: "Light", value: "Hard side key, falloff black" },
      { label: "Mood", value: "Imperial · Electric" },
    ],
    copies: 4810, saves: 3920, shares: 1640, remixes: 510, viralScore: 88, signal: "trending",
    related: ["neon-splash", "baroque-muse", "visor-oracle"],
  },
  {
    id: "ai-sigil",
    title: "AI Sigil Hologram",
    category: "Sci-Fi",
    state: "free",
    cover: cover11,
    author: "@kernel",
    views: "1.8M",
    likes: "112k",
    prompt: "Holographic AI sigil floating in dark space, intersecting magenta and gold light beams forming geometric octagonal frame, refracted glass shards, volumetric haze, editorial luxury tech aesthetic.",
    breakdown: [
      { label: "Style", value: "Cyber-baroque holographic" },
      { label: "Lighting", value: "Refracted neon beams" },
      { label: "Use", value: "Brand hero / album art" },
      { label: "Render", value: "Octane volumetric, 8k" },
    ],
    copies: 18420, saves: 11200, shares: 6210, remixes: 3140, viralScore: 99, signal: "viral",
    tagline: "#1 most-remixed prompt of the month.",
    related: ["void-astronaut", "monolith-corridor", "cyberpunk-dusk"],
  },
  {
    id: "monolith-corridor",
    title: "Monolith Corridor",
    category: "Atmosphere",
    state: "free",
    cover: cover16,
    author: "@kubrickai",
    views: "720k",
    likes: "52.7k",
    prompt: "Brutalist obsidian colonnade, single shaft of magenta neon light cutting vertically, gold inlaid floor reflections, atmospheric volumetric fog, symmetric one-point perspective, cinematic.",
    breakdown: [
      { label: "Style", value: "Brutalist neon-baroque" },
      { label: "Composition", value: "Symmetric one-point" },
      { label: "Lighting", value: "Single neon shaft + fog" },
      { label: "Use", value: "Hero / interlude / cover" },
    ],
    copies: 8420, saves: 5310, shares: 2110, remixes: 880, viralScore: 92, signal: "rising",
    related: ["gold-particles", "ai-sigil", "void-astronaut"],
  },
  {
    id: "liquid-alchemy",
    title: "Liquid Alchemy",
    category: "Texture",
    state: "free",
    cover: cover13,
    author: "@atelier",
    views: "510k",
    likes: "37.6k",
    prompt: "Macro photograph of liquid mercury blending with molten gold and neon pink ink in zero gravity, abstract fluid art, ultra detailed surface tension, dark moody lighting, museum quality.",
    breakdown: [
      { label: "Style", value: "Fluid macro abstract" },
      { label: "Materials", value: "Mercury · Gold · Magenta ink" },
      { label: "Light", value: "Single soft key, deep falloff" },
      { label: "Use", value: "Texture / wallpaper / cover" },
    ],
    copies: 6210, saves: 4810, shares: 1820, remixes: 640, viralScore: 86, signal: "trending",
    related: ["velvet-bloom", "ai-sigil", "gold-particles"],
  },
  {
    id: "void-astronaut",
    title: "Void Astronaut",
    category: "Sci-Fi",
    state: "premium",
    cover: cover15,
    author: "@ghostnet",
    views: "1.1M",
    likes: "78.4k",
    prompt: "A solitary astronaut floating in deep space, surrounded by symmetric magenta nebulae and gold asteroid debris, Kubrick-style centered composition, ultra detailed suit reflections, cosmic horror serenity.",
    breakdown: [
      { label: "Style", value: "Cosmic Kubrick" },
      { label: "Composition", value: "Centered symmetric" },
      { label: "Mood", value: "Sublime · Lonely · Vast" },
      { label: "Render", value: "Octane, 8k" },
    ],
    copies: 9810, saves: 7220, shares: 3410, remixes: 1240, viralScore: 95, signal: "top1",
    related: ["ai-sigil", "monolith-corridor", "cyberpunk-dusk"],
  },
  {
    id: "visor-oracle",
    title: "Visor Oracle",
    category: "Portrait",
    state: "premium",
    cover: cover14,
    author: "@nocturne",
    views: "830k",
    likes: "59.1k",
    prompt: "Mysterious woman wearing a glowing translucent cyber visor, cyber-baroque jewelry, flowing magenta silk, golden particle dust, dramatic chiaroscuro studio lighting, editorial magazine cover.",
    breakdown: [
      { label: "Style", value: "Cyber-baroque editorial" },
      { label: "Wardrobe", value: "Magenta silk · Gold jewelry" },
      { label: "Light", value: "Hard chiaroscuro key" },
      { label: "Mood", value: "Imperial · Future · Sacred" },
    ],
    copies: 7140, saves: 5210, shares: 2210, remixes: 740, viralScore: 90, signal: "trending",
    related: ["baroque-muse", "neon-jewel", "ai-sigil"],
  },
  {
    id: "magenta-cathedral",
    title: "Magenta Cathedral",
    category: "Atmosphere",
    state: "soon",
    cover: cover12,
    author: "@kernel",
    views: "—",
    likes: "—",
    prompt: "[Locked — drops in 6d 02h]",
    breakdown: [
      { label: "Drop", value: "Tier 02 — Sanctum" },
      { label: "Edition", value: "250 of 250" },
      { label: "Style", value: "Sacred cyber-baroque" },
      { label: "Status", value: "Coming soon" },
    ],
    copies: 0, saves: 1820, shares: 240, remixes: 0, viralScore: 87, signal: "viral",
    related: ["monolith-corridor", "void-astronaut", "ai-sigil"],
  },
  {
    id: "ember-portrait-7",
    title: "Ember Portrait 07",
    category: "Portrait",
    state: "free",
    cover: cover7,
    author: "@ember",
    views: "320k",
    likes: "22.9k",
    prompt: "Editorial portrait bathed in ember orange rim light, deep obsidian background, painterly skin, single tear catching neon highlight, cinematic close-up.",
    breakdown: [
      { label: "Style", value: "Editorial cinematic" },
      { label: "Light", value: "Ember rim · obsidian fill" },
      { label: "Mood", value: "Quiet · defiant" },
      { label: "Camera", value: "85mm f/1.2" },
    ],
    copies: 2810, saves: 1940, shares: 510, remixes: 220, viralScore: 72, signal: "rising",
    related: ["baroque-muse", "neon-splash", "visor-oracle"],
  },
  {
    id: "noir-dunes",
    title: "Noir Dunes",
    category: "Atmosphere",
    state: "free",
    cover: cover8,
    author: "@ember",
    views: "190k",
    likes: "12.4k",
    prompt: "Endless obsidian dunes under a magenta moon, lone wanderer silhouette, gold dust drift, IMAX cinematography, sublime negative space.",
    breakdown: [
      { label: "Style", value: "Mythic minimalism" },
      { label: "Palette", value: "Obsidian · Magenta · Gold" },
      { label: "Use", value: "Atmospheric backdrop" },
    ],
    copies: 1840, saves: 1310, shares: 420, remixes: 110, viralScore: 68, signal: null,
    related: ["gold-particles", "monolith-corridor", "void-astronaut"],
  },
  {
    id: "obsidian-couture",
    title: "Obsidian Couture",
    category: "Fashion",
    state: "premium",
    cover: cover9,
    author: "@atelier",
    views: "470k",
    likes: "31.5k",
    prompt: "Avant-garde couture model, sculpted obsidian gown, gold filigree mask, hard rim light, museum gallery setting, Balenciaga editorial.",
    breakdown: [
      { label: "Style", value: "Avant-garde couture" },
      { label: "Wardrobe", value: "Obsidian gown · gold mask" },
      { label: "Light", value: "Hard rim, deep shadow fill" },
    ],
    copies: 4120, saves: 3210, shares: 1140, remixes: 320, viralScore: 83, signal: "rising",
    related: ["neon-jewel", "visor-oracle", "baroque-muse"],
  },
  {
    id: "stained-future",
    title: "Stained-Glass Future",
    category: "Sci-Fi",
    state: "free",
    cover: cover10,
    author: "@kubrickai",
    views: "240k",
    likes: "16.8k",
    prompt: "Stained-glass cathedral window depicting an AI deity, magenta and gold leadwork, sun beams scattering through to dust-filled cathedral, sublime religious-tech mood.",
    breakdown: [
      { label: "Style", value: "Sacred cyber-baroque" },
      { label: "Subject", value: "AI deity stained glass" },
      { label: "Light", value: "Volumetric god rays" },
    ],
    copies: 2410, saves: 1840, shares: 610, remixes: 240, viralScore: 75, signal: "rising",
    related: ["magenta-cathedral", "monolith-corridor", "ai-sigil"],
  },
];

export const getPrompt = (id: string) => PROMPTS.find((p) => p.id === id);

export const ROWS: { title: string; tag: string; ids: string[] }[] = [
  { title: "For You · AI Personalized", tag: "Tuned to your taste", ids: ["ai-sigil", "void-astronaut", "neon-splash", "monolith-corridor", "visor-oracle", "baroque-muse"] },
  { title: "Trending in your field", tag: "Top 1% velocity", ids: ["neon-splash", "ai-sigil", "visor-oracle", "neon-jewel", "liquid-alchemy", "monolith-corridor"] },
  { title: "High-conversion prompts", tag: "Most copied this week", ids: ["ai-sigil", "neon-splash", "void-astronaut", "monolith-corridor", "neon-jewel", "liquid-alchemy"] },
  { title: "Elite creator picks", tag: "Curated by @nocturne", ids: ["baroque-muse", "visor-oracle", "obsidian-couture", "velvet-bloom", "ember-portrait-7"] },
  { title: "XeomX Originals", tag: "Curated by editors", ids: ["baroque-muse", "neon-jewel", "velvet-bloom", "gold-particles", "neon-splash", "cyberpunk-dusk"] },
  { title: "Coming soon · Locked drops", tag: "Tier 01 — Founders", ids: ["cyberpunk-dusk", "magenta-cathedral", "stained-future", "void-astronaut"] },
];

export const CATEGORIES = ["All", "Portrait", "Fashion", "Atmosphere", "Sci-Fi", "Texture"];

export type Collection = {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  cover: string;
  ids: string[];
  badge: string;
};

export const COLLECTIONS: Collection[] = [
  { id: "saas-in-10", title: "Build a SaaS in 10 prompts", subtitle: "From idea to launch — engineered prompt chain", count: 10, cover: cr1, ids: ["ai-sigil", "monolith-corridor", "neon-splash", "void-astronaut"], badge: "Pro path" },
  { id: "10x-marketer", title: "Become a 10x marketer", subtitle: "Hooks, headlines, funnels — battle-tested", count: 14, cover: cr2, ids: ["neon-splash", "neon-jewel", "visor-oracle", "obsidian-couture"], badge: "Hot" },
  { id: "automation-mastery", title: "AI automation mastery", subtitle: "Agents, workflows, chained reasoning", count: 12, cover: cr3, ids: ["ai-sigil", "monolith-corridor", "void-astronaut", "magenta-cathedral"], badge: "Series A" },
  { id: "editorial-aesthetic", title: "Editorial aesthetic codex", subtitle: "Vogue-grade visual prompts, every one cinematic", count: 18, cover: cr4, ids: ["baroque-muse", "visor-oracle", "neon-jewel", "obsidian-couture", "ember-portrait-7"], badge: "Curated" },
];

export const getCollection = (id: string) => COLLECTIONS.find((c) => c.id === id);

export type Creator = {
  handle: string;
  name: string;
  tier: "Founder" | "Elite" | "Rising";
  followers: string;
  copies: string;
  cover: string;
  bio: string;
};

export const CREATORS: Creator[] = [
  { handle: "@nocturne", name: "Noir Atelier", tier: "Founder", followers: "284k", copies: "1.4M", cover: cr1, bio: "Baroque editorial · Vogue-grade prompts." },
  { handle: "@maryikai", name: "Marya Ikai", tier: "Elite", followers: "192k", copies: "910k", cover: cr2, bio: "Selective color editorial. Iconic only." },
  { handle: "@kernel", name: "Kernel Lab", tier: "Founder", followers: "421k", copies: "2.1M", cover: cr3, bio: "Cyber-baroque sigils & brand systems." },
  { handle: "@ghostnet", name: "Ghostnet", tier: "Elite", followers: "168k", copies: "780k", cover: cr4, bio: "Cosmic Kubrick. Lonely vastness." },
  { handle: "@atelier", name: "Atelier 9", tier: "Rising", followers: "84k", copies: "320k", cover: cr5, bio: "Texture-first. Velvet, gold, surface." },
  { handle: "@kubrickai", name: "Kubrick.ai", tier: "Elite", followers: "212k", copies: "1.0M", cover: cover16, bio: "Symmetric monoliths. Sacred minimal." },
];

export const TOP_PROMPT_IDS = ["ai-sigil", "void-astronaut", "baroque-muse", "neon-splash", "monolith-corridor", "visor-oracle", "neon-jewel", "liquid-alchemy"];

export const _covers = covers;
