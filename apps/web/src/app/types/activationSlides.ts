import { defaultCaseId } from "../lib/caseId";

export interface ActivationSlideData {
  station: string;
  rota: string;
  dutyDate: string;
  callSign: string;
  sc: string;
  po: string;
  incidentNo: string;
  dateDispatched: string;
  timeDispatched: string;
  timeArrived: string;
  incidentLocation: string;
  premisesOwner: string;
  premisesUen: string;
  accompanyingPerson: string;
  accompanyingContact: string;
  classification: string;
  handedOver: string;
  otherRemarks: string;
}

export type ActivationSlideFieldKey = keyof ActivationSlideData;

export function createEmptySlideData(): ActivationSlideData {
  const today = new Date().toISOString().slice(0, 10);
  const incidentNo = defaultCaseId(today);
  return {
    station: "",
    rota: "",
    dutyDate: today,
    callSign: "",
    sc: "",
    po: "",
    incidentNo,
    dateDispatched: today,
    timeDispatched: "16:27",
    timeArrived: "16:27",
    incidentLocation: "",
    premisesOwner: "",
    premisesUen: "",
    accompanyingPerson: "",
    accompanyingContact: "",
    classification: "",
    handedOver: "",
    otherRemarks: "",
  };
}
