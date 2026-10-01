/**
 * Copies exported annex PNGs from Documents/Annexes into src/assets/annexes/page-{index}.png
 * Mapping:
 *   Annexes (A-G).pptx.png     -> page-0 (Annex A)
 *   Annexes (A-G).pptx (1).png -> page-1 (Annex B)
 *   ... through (7).png -> page-7 (Annex F page 3)
 *   Annexes (A-G).pptx (8).png -> page-8 (Annex G)
 * Run: npm run sync-annexes
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(__dirname, "../Documents/Annexes");
const outDir = path.join(__dirname, "../src/assets/annexes");

const mappings = [
  { exportName: "Annexes (A-G).pptx.png", pageIndex: 0 },
  { exportName: "Annexes (A-G).pptx (1).png", pageIndex: 1 },
  { exportName: "Annexes (A-G).pptx (2).png", pageIndex: 2 },
  { exportName: "Annexes (A-G).pptx (3).png", pageIndex: 3 },
  { exportName: "Annexes (A-G).pptx (4).png", pageIndex: 4 },
  { exportName: "Annexes (A-G).pptx (5).png", pageIndex: 5 },
  { exportName: "Annexes (A-G).pptx (6).png", pageIndex: 6 },
  { exportName: "Annexes (A-G).pptx (7).png", pageIndex: 7 },
  { exportName: "Annexes (A-G).pptx (8).png", pageIndex: 8 },
];

fs.mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const { exportName, pageIndex } of mappings) {
  const src = path.join(sourceDir, exportName);
  const dest = path.join(outDir, `page-${pageIndex}.png`);
  if (!fs.existsSync(src)) {
    console.warn("Missing:", src);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log(`page-${pageIndex}.png <- ${exportName}`);
  copied += 1;
}

console.log(`Synced ${copied} annex page images to ${outDir}`);
