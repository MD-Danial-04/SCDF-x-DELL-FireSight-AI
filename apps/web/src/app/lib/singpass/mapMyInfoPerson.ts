import type {
  InterviewDetailsResult,
  InterviewExtractableField,
} from "../../types/inference";
import type { MyInfoPerson, MyInfoRegisteredAddress } from "../../types/myinfo";
import type { FireReportData } from "../../types/fireReport";
import type { Interviewee } from "../../types/interviewee";
import { mergeTenantFields, type MergeTenantFieldsResult } from "../mergeTenantFields";
import {
  mergeIntervieweeFields,
  type MergeIntervieweeFieldsResult,
} from "../mergeIntervieweeFields";

function titleCase(value: string | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function computeAge(dob: string | undefined): string {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? `${age}` : "";
}

function formatDob(dob: string | undefined): string {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return dob;
  return birth.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function composeAddress(regadd: MyInfoRegisteredAddress | undefined): string {
  if (!regadd) return "";
  const blockLine = [regadd.block, regadd.street].filter(Boolean).join(" ");
  const unit =
    regadd.floor && regadd.unit ? `#${regadd.floor}-${regadd.unit}` : "";
  const lines = [
    [blockLine, unit].filter(Boolean).join(", "),
    regadd.building,
    [regadd.country, regadd.postal].filter(Boolean).join(" "),
  ].filter((line) => line && line.trim().length > 0);
  return lines.join("\n");
}

function composeVehicles(person: MyInfoPerson): string {
  if (!person.vehicles || person.vehicles.length === 0) return "";
  return person.vehicles
    .map((vehicle) => vehicle.vehicleno)
    .filter((no): no is string => Boolean(no))
    .join(", ");
}

/**
 * Converts a MyInfo person into the same `InterviewDetailsResult` shape produced
 * by the AI extraction pipeline, so the existing tenant/interviewee merge
 * helpers (only-fill-empty, badges) can be reused unchanged.
 */
export function personToInterviewDetails(
  person: MyInfoPerson
): InterviewDetailsResult {
  const dobAndPlace = [formatDob(person.dob), titleCase(person.birthcountry)]
    .filter(Boolean)
    .join(", ");

  const fields: Partial<Record<InterviewExtractableField, string>> = {
    name: titleCase(person.name),
    nameChinese: person.nameChinese ?? "",
    designation: titleCase(person.occupation),
    nric: person.uinfin,
    passportNo: person.passportnumber ?? "",
    nationality: titleCase(person.nationality),
    sex: titleCase(person.sex),
    age: computeAge(person.dob),
    dateAndPlaceOfBirth: dobAndPlace,
    maritalStatus: titleCase(person.marital),
    numberOfChildren:
      person.childrenbirthrecords?.count != null
        ? `${person.childrenbirthrecords.count}`
        : "",
    vehicleNo: composeVehicles(person),
    address: composeAddress(person.regadd),
    placeOfEmployment: titleCase(person.employment),
    contactMobile: person.mobileno ?? "",
  };

  // Drop empty values so merge helpers treat them as "not provided".
  const cleaned: Partial<Record<InterviewExtractableField, string>> = {};
  for (const [key, value] of Object.entries(fields) as [
    InterviewExtractableField,
    string,
  ][]) {
    if (value && value.trim().length > 0) {
      cleaned[key] = value.trim();
    }
  }

  const confidence: Partial<Record<InterviewExtractableField, number>> = {};
  for (const key of Object.keys(cleaned) as InterviewExtractableField[]) {
    confidence[key] = 1;
  }

  return { fields: cleaned, confidence, source: "fake" };
}

export function mapPersonToTenant(
  person: MyInfoPerson,
  fields: FireReportData,
  overwriteKeys?: Set<keyof FireReportData>
): MergeTenantFieldsResult {
  return mergeTenantFields(
    fields,
    personToInterviewDetails(person),
    overwriteKeys
  );
}

export function mapPersonToInterviewee(
  person: MyInfoPerson,
  interviewee: Interviewee
): MergeIntervieweeFieldsResult {
  return mergeIntervieweeFields(interviewee, personToInterviewDetails(person));
}
