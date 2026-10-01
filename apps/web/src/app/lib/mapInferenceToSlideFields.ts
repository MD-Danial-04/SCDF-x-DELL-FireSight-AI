import type { ActivationSlideData } from "../types/activationSlides";
import type { InferenceResult } from "../types/inference";

export function mapInferenceToSlideFields(
  result: InferenceResult | null | undefined
): Partial<ActivationSlideData> {
  const fields = result?.fields;
  if (!fields) return {};

  const handedOver = [fields.handoverOfficer, fields.handoverNpc]
    .filter((value) => Boolean(value && String(value).trim()))
    .join(" - ");

  return {
    callSign: fields.applianceCallSign ?? "",
    incidentLocation: fields.locationOfFire ?? "",
    classification: fields.classification ?? "",
    handedOver,
    otherRemarks: fields.eventsCircumstances ?? "",
  };
}
