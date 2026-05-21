/**
 * Export incident workflow flowchart to PNG.
 * Run: npm run export-workflow-diagram
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const input = path.join(root, "docs/incident-workflow-steps.mmd");
const output = path.join(root, "docs/incident-workflow-steps.png");

const mmdc = path.join(root, "node_modules/.bin/mmdc");
const result = spawnSync(
  mmdc,
  [
    "-i",
    input,
    "-o",
    output,
    "-b",
    "white",
    "-t",
    "default",
    "-w",
    "1800",
    "-s",
    "2",
  ],
  { stdio: "inherit", cwd: root }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Exported ${output}`);
