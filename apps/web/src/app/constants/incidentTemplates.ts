export type IncidentCategory = "fire" | "rescue" | "rta" | "medical" | "hazmat" | "false-alarm";

export interface IncidentType {
  id: string;
  name: string;
  category: IncidentCategory;
  template: string;
  requiresFireReport: boolean;
}

export const incidentCategoryMeta: Record<
  IncidentCategory,
  { label: string; description: string }
> = {
  fire: {
    label: "Fire",
    description: "Structure, vegetation, and vehicle fires",
  },
  rescue: {
    label: "Rescue",
    description: "Person rescue and extrication",
  },
  rta: {
    label: "RTA",
    description: "Road traffic accidents",
  },
  medical: {
    label: "Medical",
    description: "Cardiac arrest and medical emergencies",
  },
  hazmat: {
    label: "Hazmat",
    description: "Gas leaks and hazardous materials",
  },
  "false-alarm": {
    label: "False alarm",
    description: "FAM, FAGI, and nuisance activations",
  },
};

/** Display order for grouped incident type selector */
export const incidentCategoryOrder: IncidentCategory[] = [
  "fire",
  "rescue",
  "rta",
  "medical",
  "hazmat",
  "false-alarm",
];

export const incidentTypes: IncidentType[] = [
  {
    id: "vegetation-fire",
    name: "Vegetation Fire",
    category: "fire",
    requiresFireReport: true,
    template: `[Appliance Call Sign] stop at location, case of fire vegetation of [Dimensions, e.g., 40m by 80m].

Fire extinguished with [Number]x [Size, e.g., 38mm/70mm] jet. [No forcible entry conducted / Forcible entry conducted]. No injury reported.

Case classified as [Classification Code, e.g., C2 accidental] due to [Cause, e.g., live firing / naked light]. Case handed over to [Rank & Name] [Tango ID] from [NPC Name] NPC.`,
  },
  {
    id: "fire-moderate-rubbish",
    name: "Fire (Moderate) — Rubbish Chute",
    category: "fire",
    requiresFireReport: true,
    template: `[Appliance Call Sign] stop at location, case of fire mod.

Upon arrival, [white smoke / black smoke] seen in the lift shaft. Upon investigation, fire found in CRC of block [Block Number] involving rubbish contents. CD extinguished fire using [Number]x [hosereel / 38mm jet].

Case classified as [Classification Code, e.g., C2 accidental] due to [Cause, e.g., naked light].

Case handed over to [Rank & Name] [Tango ID] from [NPC Name] NPC.`,
  },
  {
    id: "vehicle-container-fire",
    name: "Vehicle / Container Fire",
    category: "fire",
    requiresFireReport: true,
    template: `[Appliance Call Sign] stop at location, case of fire motor vehicle.

Fire involving [Description of asset, e.g., an 3x5m open container comprising of disposed paint tins / engine compartment of car]. CD at work with [Number]x [Size, e.g., 38mm] jet.

Case classified as [Classification Code, e.g., C2 accidental] due to [Cause, e.g., naked light]. No injuries reported. No forcible entry conducted.

Case handed to [Rank & Name] [Tango ID] from [NPC Name] NPC.`,
  },
  {
    id: "rescue-suicide",
    name: "Rescue Suicide",
    category: "rescue",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of rescue suicide.

Upon arrival, subject ([Gender]/[Race]/[Age]) apprehended by SPF. Subject sustained [Nature of injury, e.g., minor cuts on arms / no visible injuries], attended by [Ambulance Call Sign] [refused conveyance / conveyed to Hospital].

[No forcible entry conducted / Forcible entry conducted by CD using hydraulic tools].

Case handed over to [Rank & Name] [Tango ID] from [NPC Name] NPC.`,
  },
  {
    id: "height-rescue",
    name: "Height Rescue",
    category: "rescue",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of rescue [minor/adult] due to fall from height.

Upon arrival, SCDF accessed patient at [Location, e.g., 2nd floor roof shelter] through [Access point, e.g., level 2 corridor parapet]. [Appliance Call Sign] assisted [Ambulance Call Sign] from level [Floor] parapet using 1x spinal board.

Case handed over to [Rank & Name/Tango ID] from [NPC Name] NPC.`,
  },
  {
    id: "lift-rescue",
    name: "Lift Rescue",
    category: "rescue",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of lift rescue.

Upon arrival, lift technician [Technician Name] from [Company, e.g., EMSU] arrived on scene [prior to SCDF arrival / alongside SCDF] and used lift key to open lift door for subject(s) stuck at level [Floor Number].

No forcible entry conducted. No injury reported. [No SPF on scene / SPF present].`,
  },
  {
    id: "rta-chain-collision",
    name: "RTA — Chain Collision",
    category: "rta",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of RTA involving a chain collision of [Number]x vehicles: [List Vehicles with Plate Numbers, e.g., white Toyota Wish SGT3790U, white Toyota Dyna GBH2673D].

[Number]x casualties self-evacuated prior to SCDF arrival. No rescue was conducted and no persons were trapped.

Casualties being assessed by [Ambulance Call Sign] crew. Case handed to [Rank & Name/Tango ID] from TP (Traffic Police).`,
  },
  {
    id: "cardiac-arrest-active",
    name: "Cardiac Arrest (Active Resuscitation)",
    category: "medical",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of CARDIAC ARREST P1+.

Upon arrival, patient unconscious, no pulse, no breathing. Conducted [Number] minutes of HPCPR, [shock advised / no shock advised] before [Ambulance Call Sign] arrived.

Case handed over to [Ambulance Call Sign]. Patient conveyed to [Hospital Code, e.g., Hotel 9 / Hotel 4].`,
  },
  {
    id: "cardiac-arrest-doa",
    name: "Cardiac Arrest (DOA)",
    category: "medical",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of CARDIAC ARREST.

Upon arrival, patient found unconscious and [Ambulance Call Sign] paramedic pronounced patient DOA.

[Appliance Call Sign] assistance no longer required by [Ambulance Call Sign] paramedic. Turnout closed.`,
  },
  {
    id: "gas-leak",
    name: "Gas Leak",
    category: "hazmat",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of gas leak.

[Smell of gas / Vapor cloud] from [Source, e.g., unattended stove in function room]. Alarm MOP called SCDF. Upon arrival, gas valve switched off by [Title/Name, e.g., gym supervisor].

No sign of reading on gas detectors.

Case handed over to [Rank & Name] [Tango ID] from [NPC Name] NPC.`,
  },
  {
    id: "false-alarm-malfunction",
    name: "False Alarm Malfunction (FAM)",
    category: "false-alarm",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of false alarm malfunction of [Device, e.g., smoke detector] zone [Zone Number].

Upon investigation, there is no smoke, no fire, and no hazards. [No SPF at scene / SPF present].

CD liaised with [Title & Name, e.g., Mr Chella Supervisor / FCC Security].`,
  },
  {
    id: "false-alarm-good-intent",
    name: "False Alarm Good Intent (FAGI)",
    category: "false-alarm",
    requiresFireReport: false,
    template: `[Appliance Call Sign] stop at location, case of FAGI involving [Description, e.g., 1x unknown cylinder found during site excavation].

Upon arrival, no smoke, no fire, and no casualties. No sign of reading from gas detector & [Hazmat Detector, e.g., G999].

Case classified as false alarm good intent. Case handed to [Rank & Name] [Tango ID] from [NPC Name] NPC.`,
  },
];

export function getIncidentTypesByCategory(): {
  category: IncidentCategory;
  label: string;
  types: IncidentType[];
}[] {
  return incidentCategoryOrder
    .map((category) => ({
      category,
      label: incidentCategoryMeta[category].label,
      types: incidentTypes.filter((t) => t.category === category),
    }))
    .filter((group) => group.types.length > 0);
}

export function getIncidentCategoryLabel(category: IncidentCategory): string {
  return incidentCategoryMeta[category].label;
}
