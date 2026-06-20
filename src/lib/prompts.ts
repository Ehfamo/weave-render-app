import cover1 from "@/assets/cover-1.jpg";
import cover2 from "@/assets/cover-2.jpg";
import cover3 from "@/assets/cover-3.jpg";
import cover4 from "@/assets/cover-4.jpg";
import cover5 from "@/assets/cover-5.jpg";
import cover6 from "@/assets/cover-6.jpg";
import cover7 from "@/assets/cover-7.jpg";
import cover8 from "@/assets/cover-8.jpg";
import cover9 from "@/assets/cover-9.jpg";
import cover10 from "@/assets/cover-10.jpg";
import cover11 from "@/assets/cover-11.jpg";
import cover12 from "@/assets/cover-12.jpg";
import cover13 from "@/assets/cover-13.jpg";
import cover14 from "@/assets/cover-14.jpg";
import cover15 from "@/assets/cover-15.jpg";
import cover16 from "@/assets/cover-16.jpg";

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
  // Engine breakdown (Role / Context / Instructions / Output / Constraints)
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
    prompt:
      "Cinematic baroque portrait of a young woman, painterly chiaroscuro lighting, gilded velvet drapery, intricate ornate detail, shot on Hasselblad, 85mm, ultra detailed skin texture, Rembrandt key light, deep amber palette, museum quality.",
    breakdown: [
      { label: "Style", value: "Baroque, painterly, editorial" },
      { label: "Lighting", value: "Chiaroscuro / Rembrandt" },
      { label: "Camera", value: "Hasselblad H6D, 85mm f/1.4" },
      { label: "Palette", value: "Obsidian · Amber · Ruby" },
    ],
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
    prompt:
      "High contrast monochrome editorial portrait, single hot pink neon paint splash through hair, dramatic studio lighting, fashion magazine cover, sculpted shadows, glossy skin, Vogue Italia.",
    breakdown: [
      { label: "Style", value: "Monochrome editorial w/ accent" },
      { label: "Accent", value: "Neon Magenta #FF1F8F" },
      { label: "Camera", value: "Phase One IQ4, 80mm" },
      { label: "Mood", value: "Bold · Defiant · Iconic" },
    ],
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
    prompt:
      "Vast cinematic landscape at dusk, swarms of glowing gold particles rising over silhouetted mountains, volumetric god rays, dust motes, IMAX wide format, deep amber and obsidian palette.",
    breakdown: [
      { label: "Format", value: "IMAX 1.43:1" },
      { label: "Lighting", value: "Volumetric god rays" },
      { label: "Palette", value: "Amber · Obsidian" },
      { label: "Render", value: "Octane, 8k" },
    ],
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
    prompt:
      "Macro abstract: deep maroon velvet with molten gold ink bloom, baroque painterly texture, satin fibers visible, museum lit, perfect for hero backdrops.",
    breakdown: [
      { label: "Style", value: "Macro abstract" },
      { label: "Material", value: "Velvet · Gold leaf" },
      { label: "Use", value: "Hero backdrop" },
      { label: "Resolution", value: "8192 × 10240" },
    ],
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
    prompt:
      "Monochrome high fashion portrait, vivid hot pink couture jewelry — beaded necklace and chandelier earrings — selective color, dramatic side light, glossy editorial skin.",
    breakdown: [
      { label: "Style", value: "Selective color editorial" },
      { label: "Subject", value: "Couture jewelry" },
      { label: "Light", value: "Hard side key, falloff black" },
      { label: "Mood", value: "Imperial · Electric" },
    ],
  },
];

export const getPrompt = (id: string) => PROMPTS.find((p) => p.id === id);

export const ROWS: { title: string; tag: string; ids: string[] }[] = [
  {
    title: "XeomX Originals",
    tag: "Curated by editors",
    ids: ["baroque-muse", "neon-jewel", "velvet-bloom", "gold-particles", "neon-splash", "cyberpunk-dusk"],
  },
  {
    title: "Trending this week",
    tag: "Top 1% velocity",
    ids: ["neon-splash", "gold-particles", "neon-jewel", "baroque-muse", "velvet-bloom"],
  },
  {
    title: "Premium drops",
    tag: "Members only",
    ids: ["baroque-muse", "neon-jewel", "velvet-bloom", "cyberpunk-dusk"],
  },
  {
    title: "Coming soon",
    tag: "Tier 01 — Founders",
    ids: ["cyberpunk-dusk", "baroque-muse", "neon-jewel"],
  },
];

export const CATEGORIES = ["All", "Portrait", "Fashion", "Atmosphere", "Sci-Fi", "Texture"];

export const _covers = covers;