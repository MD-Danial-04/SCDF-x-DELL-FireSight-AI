/**
 * Export incident workflow flowchart to PNG.
 * Run: npm run export-workflow-diagram
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const input = path.join(root, "docs/incident-workflow-steps.mmd");
const config = path.join(root, "docs/incident-workflow-steps.config.json");
const output = path.join(root, "docs/incident-workflow-steps.png");

const mmdc = path.join(root, "node_modules/.bin/mmdc");
const env = { ...process.env };
if (!env.PUPPETEER_EXECUTABLE_PATH) {
  for (const browser of ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser"]) {
    if (fs.existsSync(browser)) {
      env.PUPPETEER_EXECUTABLE_PATH = browser;
      break;
    }
  }
}

const result = spawnSync(
  mmdc,
  [
    "-i",
    input,
    "-o",
    output,
    "-c",
    config,
    "-b",
    "white",
    "-w",
    "2400",
    "-s",
    "4",
  ],
  { stdio: "inherit", cwd: root, env }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Exported ${output}`);
