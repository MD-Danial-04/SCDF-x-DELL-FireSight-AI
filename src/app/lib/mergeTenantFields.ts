import type {
  InterviewDetailsResult,
  InterviewExtractableField,
} from "../types/inference";
import type { FireReportData, FireReportFieldKey } from "../types/fireReport";

const INTERVIEW_TO_TENANT_FIELD: Partial<
  Record<InterviewExtractableField, FireReportFieldKey>
> = {
  name: "tenantName",
  designation: "tenantDesignation",
  nric: "tenantNric",
  nationality: "tenantNationality",
  address: "tenantAddress",
  contactMobile: "tenantContactMobile",
  contactHome: "tenantContactHome",
  contactOffice: "tenantContactOffice",
};

export interface TenantFieldUpdate {
  key: FireReportFieldKey;
  value: string;
}

export interface MergeTenantFieldsResult {
  updates: TenantFieldUpdate[];
  extractedKeys: Set<FireReportFieldKey>;
}

export function mergeTenantFields(
  fields: FireReportData,
  extracted: InterviewDetailsResult | null | undefined,
  overwriteKeys?: Set<FireReportFieldKey>
): MergeTenantFieldsResult {
  const updates: TenantFieldUpdate[] = [];
  const extractedKeys = new Set<FireReportFieldKey>();

  if (!extracted?.fields) {
    return { updates, extractedKeys };
  }

  for (const [interviewField, tenantKey] of Object.entries(
    INTERVIEW_TO_TENANT_FIELD
  ) as [InterviewExtractableField, FireReportFieldKey][]) {
    const currentValue = `${fields[tenantKey] ?? ""}`.trim();
    const incomingValue = `${extracted.fields[interviewField] ?? ""}`.trim();
    if (!incomingValue) {
      continue;
    }
    if (currentValue && !overwriteKeys?.has(tenantKey)) {
      continue;
    }
    if (currentValue === incomingValue) {
      continue;
    }
    updates.push({ key: tenantKey, value: incomingValue });
    extractedKeys.add(tenantKey);
  }

  return { updates, extractedKeys };
}
