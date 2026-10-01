/**
 * Copies slide assets from Documents/ into src/assets/slides/
 * Run: npm run sync-slides
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(__dirname, "../Documents");
const outDir = path.join(__dirname, "../src/assets/slides");

const mappings = [
  { exportName: "Slide_background.png", destName: "slide-background.png" },
];

fs.mkdirSync(outDir, { recursive: true });

for (const { exportName, destName } of mappings) {
  const src = path.join(sourceDir, exportName);
  const dest = path.join(outDir, destName);
  if (!fs.existsSync(src)) {
    console.warn("Missing:", src);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log(`${destName} <- ${exportName}`);
}

console.log(`Synced slide assets to ${outDir}`);
