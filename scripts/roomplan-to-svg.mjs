#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertRoomPlan } from "../src/floorplan/convert.ts";

function printUsage() {
  console.error(`Usage: roomplan-to-svg <input.json> [-o output.svg]

Converts Apple RoomPlan JSON to a 2D SVG floorplan.

Options:
  -o, --output   Output SVG file path (default: stdout)
  -h, --help     Show this help
`);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    printUsage();
    process.exit(argv.includes("-h") || argv.includes("--help") ? 0 : 1);
  }

  let input = "";
  let output;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      output = argv[++i];
      if (!output) {
        console.error("Missing value for --output");
        process.exit(1);
      }
    } else if (!arg.startsWith("-")) {
      input = arg;
    }
  }

  if (!input) {
    printUsage();
    process.exit(1);
  }

  return { input, output };
}

const { input, output } = parseArgs(process.argv.slice(2));
const json = readFileSync(resolve(input), "utf-8");
const { svg, warnings } = convertRoomPlan(json);

for (const warning of warnings) {
  console.error(`warning: ${warning}`);
}

if (output) {
  writeFileSync(resolve(output), svg, "utf-8");
  console.error(`Wrote ${resolve(output)}`);
} else {
  process.stdout.write(svg);
}
