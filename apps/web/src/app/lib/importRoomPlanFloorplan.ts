import { convertRoomPlan } from "../../floorplan/convert";
import { RoomPlanParseError } from "../../floorplan/parse";

export interface ConvertRoomPlanFileResult {
  svg: string;
  warnings: string[];
}

export async function convertRoomPlanFile(
  file: File,
): Promise<ConvertRoomPlanFileResult> {
  const json = await file.text();

  try {
    return convertRoomPlan(json);
  } catch (err) {
    if (err instanceof RoomPlanParseError) {
      throw new Error(err.message);
    }
    throw err instanceof Error
      ? err
      : new Error("Failed to convert RoomPlan JSON");
  }
}
