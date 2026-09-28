/**
 * Generates simple placeholder product SVGs so the seeded catalogue renders
 * without shipping binary images. Run: `npm run gen:images`
 *
 * Each product gets a tonal card with a shoe silhouette. Replace these with real
 * photography before launch; nothing in the app depends on them being generated.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "images", "products");
mkdirSync(OUT, { recursive: true });

/** @type {{file:string, label:string, accent:string, dark:string, kind:"sneaker"|"sandal"|"boot"|"formal"|"slipper"|"kids"}[]} */
const ITEMS = [
  { file: "trail-runner-1.svg", label: "Trail Runner", accent: "#4a5568", dark: "#2d3748", kind: "sneaker" },
  { file: "trail-runner-2.svg", label: "Trail Runner", accent: "#5d6b3a", dark: "#3f4a28", kind: "sneaker" },
  { file: "swayambhu-sneaker-1.svg", label: "Swayambhu", accent: "#e7e5e4", dark: "#a8a29e", kind: "sneaker" },
  { file: "oxford-1.svg", label: "Leather Oxford", accent: "#4a3728", dark: "#2f2318", kind: "formal" },
  { file: "derby-1.svg", label: "Court Derby", accent: "#1a1a1a", dark: "#000000", kind: "formal" },
  { file: "high-top-1.svg", label: "High-Top", accent: "#b91c1c", dark: "#7f1d1d", kind: "sneaker" },
  { file: "running-w-1.svg", label: "Cushioned Run", accent: "#0d9488", dark: "#0f766e", kind: "sneaker" },
  { file: "sandal-m-1.svg", label: "Fisherman", accent: "#5d6b3a", dark: "#3f4a28", kind: "sandal" },
  { file: "sandal-w-1.svg", label: "Woven", accent: "#d6c1a5", dark: "#a8926f", kind: "sandal" },
  { file: "slipper-1.svg", label: "House Slipper", accent: "#3f3f46", dark: "#27272a", kind: "slipper" },
  { file: "boot-1.svg", label: "Trail Boot", accent: "#6b4423", dark: "#452a14", kind: "boot" },
  { file: "kids-canvas-1.svg", label: "Kids Canvas", accent: "#eab308", dark: "#a16207", kind: "kids" },
  { file: "kids-lightup-1.svg", label: "Light-Up", accent: "#ec4899", dark: "#be185d", kind: "kids" },
];

const SHAPES = {
  sneaker: `
    <path d="M110 250c0-22 6-42 16-58l24-38c5-7 13-11 22-11h40c9 0 17 4 22 11l24 38c10 16 16 36 16 58v14c0 13-10 23-23 23H133c-13 0-23-10-23-23z" fill="url(#g)"/>
    <path d="M110 264h224v4c0 13-10 23-23 23H133c-13 0-23-10-23-23z" fill="var(--dark)"/>
    <path d="M150 143l-14 30h44l10-30z" fill="#faf9f7" opacity=".25"/>
    <circle cx="186" cy="196" r="6" fill="#faf9f7" opacity=".9"/>
    <circle cx="206" cy="212" r="6" fill="#faf9f7" opacity=".9"/>
    <circle cx="186" cy="212" r="6" fill="#faf9f7" opacity=".9"/>`,
  formal: `
    <path d="M92 236c0-14 7-26 19-35 17-13 39-20 63-20s45 7 61 20c11 9 17 21 17 35v18c0 12-10 22-22 22H114c-12 0-22-10-22-22z" fill="url(#g)"/>
    <path d="M111 201c14-11 37-18 63-18s48 7 61 18c-13 8-36 13-61 13s-50-5-63-13z" fill="var(--dark)"/>
    <path d="M148 172c8-7 20-7 26 0" stroke="#faf9f7" stroke-width="6" fill="none" stroke-linecap="round" opacity=".85"/>`,
  sandal: `
    <ellipse cx="222" cy="248" rx="118" ry="34" fill="url(#g)"/>
    <ellipse cx="222" cy="240" rx="110" ry="30" fill="var(--dark)" opacity=".55"/>
    <path d="M158 236c18-44 42-66 64-66s44 22 56 66" stroke="url(#g)" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M176 218c12-26 26-38 46-38s32 12 40 38" stroke="url(#g)" stroke-width="13" fill="none" stroke-linecap="round" opacity=".75"/>`,
  slipper: `
    <path d="M118 232c0-30 34-52 104-52s104 22 104 52v30c0 16-13 29-29 29H147c-16 0-29-13-29-29z" fill="url(#g)"/>
    <path d="M150 196c22-14 46-20 72-20s50 6 72 20c-20 10-46 15-72 15s-52-5-72-15z" fill="#faf9f7" opacity=".35"/>`,
  boot: `
    <path d="M140 160c0-10 8-18 18-18h44c10 0 18 8 18 18v58c0 26 20 40 52 46l40 8c14 3 24 15 24 29v6H140z" fill="url(#g)"/>
    <path d="M140 290h196v4c0 10-8 18-18 18H158c-10 0-18-8-18-18z" fill="var(--dark)"/>
    <path d="M156 168h48v14h-48z" fill="var(--dark)" opacity=".5"/>
    <path d="M156 200h48v14h-48z" fill="var(--dark)" opacity=".5"/>`,
  kids: `
    <path d="M148 240c0-18 5-34 13-47l19-30c4-7 11-10 19-10h30c8 0 14 3 19 10l19 30c8 13 13 29 13 47v12c0 11-9 20-20 20h-92c-11 0-20-9-20-20z" fill="url(#g)"/>
    <path d="M148 252h172v3c0 11-9 20-20 20h-132c-11 0-20-9-20-20z" fill="var(--dark)"/>
    <circle cx="214" cy="196" r="5" fill="#faf9f7" opacity=".9"/>`,
};

for (const item of ITEMS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 444 400" role="img" aria-label="${item.label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${item.accent}"/>
      <stop offset="100%" stop-color="${item.dark}"/>
    </linearGradient>
  </defs>
  <rect width="444" height="400" fill="#faf9f7"/>
  <ellipse cx="222" cy="330" rx="150" ry="16" fill="#1c1917" opacity=".06"/>
  <g>${SHAPES[item.kind]}</g>
  <text x="222" y="368" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="#8b8378">${item.label}</text>
</svg>
`;
  writeFileSync(join(OUT, item.file), svg, "utf8");
}

console.log(`Wrote ${ITEMS.length} product images to ${OUT}`);
