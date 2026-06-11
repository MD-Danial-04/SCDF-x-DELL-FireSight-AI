import { convertRoomPlan } from "../../floorplan/convert";
import { RoomPlanParseError } from "../../floorplan/parse";
import { svgStringToAnnexPngBlob } from "./svgToAnnexPng";

export interface ImportRoomPlanResult {
  pngBlob: Blob;
  warnings: string[];
}

async function readFileAsText(file: File): Promise<string> {
  return file.text();
}

export async function importRoomPlanFloorplan(
  file: File,
): Promise<ImportRoomPlanResult> {
  const json = await readFileAsText(file);

  let svg: string;
  let warnings: string[];
  try {
    ({ svg, warnings } = convertRoomPlan(json));
  } catch (err) {
    if (err instanceof RoomPlanParseError) {
      throw new Error(err.message);
    }
    throw err instanceof Error
      ? err
      : new Error("Failed to convert RoomPlan JSON");
  }

  const pngBlob = await svgStringToAnnexPngBlob(svg);
  return { pngBlob, warnings };
}
