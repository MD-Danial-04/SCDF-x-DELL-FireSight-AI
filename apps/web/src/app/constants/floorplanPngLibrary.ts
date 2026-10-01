import bearingUrl from "../../assets/floorplan-library/bearing.png?url";
import busUrl from "../../assets/floorplan-library/bus.png?url";
import carUrl from "../../assets/floorplan-library/car.png?url";
import casementWindowsUrl from "../../assets/floorplan-library/casement_windows.png?url";
import chairUrl from "../../assets/floorplan-library/chair.png?url";
import chairWithArmrestUrl from "../../assets/floorplan-library/chair_with_armrest.png?url";
import deskWithMonitorUrl from "../../assets/floorplan-library/desk_with_monitor.png?url";
import doubleDoorLeftUrl from "../../assets/floorplan-library/double_door_left.png?url";
import doubleDoorRightUrl from "../../assets/floorplan-library/double_door_right.png?url";
import generalTemplateUrl from "../../assets/floorplan-library/General_Template.png?url";
import liftUrl from "../../assets/floorplan-library/lift.png?url";
import lorryUrl from "../../assets/floorplan-library/lorry.png?url";
import mailboxUrl from "../../assets/floorplan-library/mailbox.png?url";
import motorcycleUrl from "../../assets/floorplan-library/motorcycle.png?url";
import motorcycleWithCarriageBoxUrl from "../../assets/floorplan-library/motorcycle_with_carriage_box.png?url";
import motorcycleHondaCupUrl from "../../assets/floorplan-library/motorcylce(Honda_Cup).png?url";
import noticeBoardUrl from "../../assets/floorplan-library/notice_board.png?url";
import oddShapeStairUrl from "../../assets/floorplan-library/odd_shape_stair.png?url";
import queenSizeBedUrl from "../../assets/floorplan-library/queen_size_bed.png?url";
import rectangleDiningTableUrl from "../../assets/floorplan-library/rectangle_dining_table.png?url";
import roundDiningTableUrl from "../../assets/floorplan-library/round_dining_table.png?url";
import scooterUrl from "../../assets/floorplan-library/scooter.png?url";
import scooterWithCarriageBoxUrl from "../../assets/floorplan-library/scooter_with_carriage_box.png?url";
import singleBedUrl from "../../assets/floorplan-library/single_bed.png?url";
import singleDoorLeftUrl from "../../assets/floorplan-library/single_door_left.png?url";
import singleDoorRightUrl from "../../assets/floorplan-library/single_door_right.png?url";
import sofa1Url from "../../assets/floorplan-library/sofa_1.png?url";
import sofa2Url from "../../assets/floorplan-library/sofa_2.png?url";
import sofa3Url from "../../assets/floorplan-library/sofa_3.png?url";
import skidLoaderTopViewUrl from "../../assets/floorplan-library/skid_laoder_top_view.png?url";
import skidLoaderSideViewUrl from "../../assets/floorplan-library/skid_loader_side_view.png?url";
import slidingWindowUrl from "../../assets/floorplan-library/sliding_window.png?url";
import slopeUrl from "../../assets/floorplan-library/slope.png?url";
import spiralStairUrl from "../../assets/floorplan-library/spiral_stair.png?url";
import stairsDownUrl from "../../assets/floorplan-library/stairs_down.png?url";
import stairsUpUrl from "../../assets/floorplan-library/stairs_up.png?url";
import straightStairDownUrl from "../../assets/floorplan-library/straight_stair_down.png?url";
import straightStairUpUrl from "../../assets/floorplan-library/straight_stair_up.png?url";
import treeUrl from "../../assets/floorplan-library/tree.png?url";
import wallWithPillarsUrl from "../../assets/floorplan-library/wall_with_pillars.png?url";

export type FloorplanLibraryCategory =
  | "Doors"
  | "Windows"
  | "Stairs & ramps"
  | "Furniture"
  | "Vehicles"
  | "Building"
  | "Misc";

/** Display order for grouped category sections in the floorplan library. */
export const FLOORPLAN_LIBRARY_CATEGORY_ORDER: FloorplanLibraryCategory[] = [
  "Doors",
  "Windows",
  "Stairs & ramps",
  "Furniture",
  "Vehicles",
  "Building",
  "Misc",
];

export interface SharedFloorplanPngLibraryItem {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  category: FloorplanLibraryCategory;
}

/**
 * Shared PNG library bundled with the app for all users.
 *
 * To add a shared PNG:
 * 1. Put the PNG under `src/assets/floorplan-library/`
 * 2. Import it here with `?url`
 * 3. Add an entry to `SHARED_FLOORPLAN_PNG_LIBRARY`
 */
export const SHARED_FLOORPLAN_PNG_LIBRARY: SharedFloorplanPngLibraryItem[] = [
  { id: "bearing", name: "Bearing", dataUrl: bearingUrl, width: 720, height: 1040, category: "Misc" },
  { id: "bus", name: "Bus", dataUrl: busUrl, width: 720, height: 1040, category: "Vehicles" },
  { id: "car", name: "Car", dataUrl: carUrl, width: 720, height: 1040, category: "Vehicles" },
  { id: "casement-windows", name: "Casement windows", dataUrl: casementWindowsUrl, width: 720, height: 1040, category: "Windows" },
  { id: "chair", name: "Chair", dataUrl: chairUrl, width: 720, height: 1040, category: "Furniture" },
  { id: "chair-with-armrest", name: "Chair with armrest", dataUrl: chairWithArmrestUrl, width: 720, height: 1040, category: "Furniture" },
  { id: "desk-with-monitor", name: "Desk with monitor", dataUrl: deskWithMonitorUrl, width: 720, height: 1040, category: "Furniture" },
  { id: "double-door-left", name: "Double door left", dataUrl: doubleDoorLeftUrl, width: 720, height: 1040, category: "Doors" },
  { id: "double-door-right", name: "Double door right", dataUrl: doubleDoorRightUrl, width: 720, height: 1040, category: "Doors" },
  { id: "general-template", name: "General template", dataUrl: generalTemplateUrl, width: 720, height: 1040, category: "Misc" },
  { id: "lift", name: "Lift", dataUrl: liftUrl, width: 720, height: 1040, category: "Building" },
  { id: "lorry", name: "Lorry", dataUrl: lorryUrl, width: 720, height: 1040, category: "Vehicles" },
  { id: "mailbox", name: "Mailbox", dataUrl: mailboxUrl, width: 720, height: 1040, category: "Building" },
  { id: "motorcycle", name: "Motorcycle", dataUrl: motorcycleUrl, width: 720, height: 1040, category: "Vehicles" },
  {
    id: "motorcycle-with-carriage-box",
    name: "Motorcycle with carriage box",
    dataUrl: motorcycleWithCarriageBoxUrl,
    width: 720,
    height: 1040,
    category: "Vehicles",
  },
  {
    id: "motorcycle-honda-cup",
    name: "Motorcycle (Honda Cup)",
    dataUrl: motorcycleHondaCupUrl,
    width: 720,
    height: 1040,
    category: "Vehicles",
  },
  { id: "notice-board", name: "Notice board", dataUrl: noticeBoardUrl, width: 720, height: 1040, category: "Building" },
  { id: "odd-shape-stair", name: "Odd shape stair", dataUrl: oddShapeStairUrl, width: 720, height: 1040, category: "Stairs & ramps" },
  { id: "queen-size-bed", name: "Queen size bed", dataUrl: queenSizeBedUrl, width: 720, height: 1040, category: "Furniture" },
  { id: "rectangle-dining-table", name: "Rectangle dining table", dataUrl: rectangleDiningTableUrl, width: 720, height: 1040, category: "Furniture" },
  { id: "round-dining-table", name: "Round dining table", dataUrl: roundDiningTableUrl, width: 720, height: 1040, category: "Furniture" },
  { id: "scooter", name: "Scooter", dataUrl: scooterUrl, width: 720, height: 1040, category: "Vehicles" },
  {
    id: "scooter-with-carriage-box",
    name: "Scooter with carriage box",
    dataUrl: scooterWithCarriageBoxUrl,
    width: 720,
    height: 1040,
    category: "Vehicles",
  },
  { id: "single-bed", name: "Single bed", dataUrl: singleBedUrl, width: 720, height: 1040, category: "Furniture" },
  { id: "single-door-left", name: "Single door left", dataUrl: singleDoorLeftUrl, width: 720, height: 1040, category: "Doors" },
  { id: "single-door-right", name: "Single door right", dataUrl: singleDoorRightUrl, width: 720, height: 1040, category: "Doors" },
  { id: "sofa-1", name: "Sofa 1", dataUrl: sofa1Url, width: 720, height: 1040, category: "Furniture" },
  { id: "sofa-2", name: "Sofa 2", dataUrl: sofa2Url, width: 720, height: 1040, category: "Furniture" },
  { id: "sofa-3", name: "Sofa 3", dataUrl: sofa3Url, width: 720, height: 1040, category: "Furniture" },
  { id: "skid-loader-top-view", name: "Skid loader top view", dataUrl: skidLoaderTopViewUrl, width: 720, height: 1040, category: "Vehicles" },
  { id: "skid-loader-side-view", name: "Skid loader side view", dataUrl: skidLoaderSideViewUrl, width: 720, height: 1040, category: "Vehicles" },
  { id: "sliding-window", name: "Sliding window", dataUrl: slidingWindowUrl, width: 720, height: 1040, category: "Windows" },
  { id: "slope", name: "Slope", dataUrl: slopeUrl, width: 720, height: 1040, category: "Stairs & ramps" },
  { id: "spiral-stair", name: "Spiral stair", dataUrl: spiralStairUrl, width: 720, height: 1040, category: "Stairs & ramps" },
  { id: "stairs-down", name: "Stairs down", dataUrl: stairsDownUrl, width: 720, height: 1040, category: "Stairs & ramps" },
  { id: "stairs-up", name: "Stairs up", dataUrl: stairsUpUrl, width: 720, height: 1040, category: "Stairs & ramps" },
  {
    id: "straight-stair-down",
    name: "Straight stair down",
    dataUrl: straightStairDownUrl,
    width: 720,
    height: 1040,
    category: "Stairs & ramps",
  },
  {
    id: "straight-stair-up",
    name: "Straight stair up",
    dataUrl: straightStairUpUrl,
    width: 720,
    height: 1040,
    category: "Stairs & ramps",
  },
  {
    id: "tree",
    name: "Tree",
    dataUrl: treeUrl,
    width: 720,
    height: 1040,
    category: "Misc",
  },
  {
    id: "wall-with-pillars",
    name: "Wall with pillars",
    dataUrl: wallWithPillarsUrl,
    width: 720,
    height: 1040,
    category: "Building",
  },
];
