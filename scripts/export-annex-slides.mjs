/**
 * Export annex slide images from Annexes (A-G).pptx to src/assets/annexes/*.png
 * Run: npm run export-annexes
 *
 * Prefers LibreOffice headless when available; otherwise creates labeled placeholders via ImageMagick.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync, spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pptxPath = path.join(root, "src/assets/annexes/Annexes-A-G.pptx");
const outDir = path.join(root, "src/assets/annexes");

const EXPORTS = [
  { file: "annex-a.png", title: "Annex A – Layout Plan" },
  { file: "annex-b.png", title: "Annex B – Photographs" },
  { file: "annex-c.png", title: "Annex C – Sketch" },
  { file: "annex-d.png", title: "Annex D – Photo log" },
  { file: "annex-e.png", title: "Annex E – Sketch" },
  { file: "annex-f-1.png", title: "Annex F – Photo 1" },
  { file: "annex-f-2.png", title: "Annex F – Photo 2" },
  { file: "annex-f-3.png", title: "Annex F – Photo 3" },
  { file: "annex-g.png", title: "Annex G – Sketch" },
];

function findSoffice() {
  for (const cmd of ["soffice", "libreoffice"]) {
    try {
      execSync(`command -v ${cmd}`, { stdio: "ignore" });
      return cmd;
    } catch {
      /* continue */
    }
  }
  return null;
}

function exportWithLibreOffice(soffice) {
  const tmpDir = fs.mkdtempSync(path.join(root, "tmp-annex-export-"));
  const pdfPath = path.join(tmpDir, "Annexes-A-G.pdf");
  execSync(
    `"${soffice}" --headless --convert-to pdf --outdir "${tmpDir}" "${pptxPath}"`,
    { stdio: "inherit" }
  );
  if (!fs.existsSync(pdfPath)) {
    throw new Error("LibreOffice PDF export failed");
  }
  execSync(`magick -density 150 "${pdfPath}" "${path.join(tmpDir, "slide-%d.png")}"`, {
    stdio: "inherit",
  });
  const slides = fs
    .readdirSync(tmpDir)
    .filter((f) => f.startsWith("slide-") && f.endsWith(".png"))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return na - nb;
    });
  const mapping = [
    "annex-a.png",
    "annex-b.png",
    "annex-c.png",
    "annex-d.png",
    "annex-e.png",
    "annex-f-1.png",
    "annex-f-2.png",
    "annex-f-3.png",
    "annex-g.png",
  ];
  mapping.forEach((dest, i) => {
    if (slides[i]) {
      fs.copyFileSync(path.join(tmpDir, slides[i]), path.join(outDir, dest));
    }
  });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("Exported annex slides via LibreOffice + ImageMagick");
}

function exportPlaceholders() {
  for (const { file, title } of EXPORTS) {
    const out = path.join(outDir, file);
    spawnSync(
      "magick",
      [
        "-size",
        "1280x720",
        "canvas:white",
        "-gravity",
        "center",
        "-pointsize",
        "36",
        "-fill",
        "black",
        "-annotate",
        "0",
        title,
        out,
      ],
      { stdio: "inherit" }
    );
  }
  console.log("Created placeholder annex PNGs (install LibreOffice for real slide exports)");
}

if (!fs.existsSync(pptxPath)) {
  console.error("Missing:", pptxPath);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const soffice = findSoffice();
try {
  if (soffice) {
    exportWithLibreOffice(soffice);
  } else {
    exportPlaceholders();
  }
} catch (err) {
  console.warn("LibreOffice export failed, using placeholders:", err.message);
  exportPlaceholders();
}

console.log("Annex images written to", outDir);
