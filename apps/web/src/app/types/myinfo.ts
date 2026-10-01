/**
 * Normalized Singpass MyInfo (v4) person shape.
 *
 * Attribute names mirror the MyInfo v4 Person object so the mock provider can
 * later be swapped for a real coordinator-backed integration with minimal
 * changes to the mapping layer. Coded attributes (sex/nationality/marital/...)
 * are stored here as their resolved human-readable `desc` value rather than the
 * raw `{ code, desc }` pair MyInfo returns over the wire.
 */

export interface MyInfoRegisteredAddress {
  block?: string;
  building?: string;
  floor?: string;
  unit?: string;
  street?: string;
  postal?: string;
  country?: string;
}

export interface MyInfoVehicle {
  vehicleno?: string;
  make?: string;
  model?: string;
}

export interface MyInfoPerson {
  uinfin: string;
  name: string;
  /** Name in Chinese characters, when available. */
  nameChinese?: string;
  hanyupinyinname?: string;
  aliasname?: string;
  sex?: string;
  race?: string;
  /** ISO date string (YYYY-MM-DD). */
  dob?: string;
  residentialstatus?: string;
  nationality?: string;
  birthcountry?: string;
  passportnumber?: string;
  passportexpirydate?: string;
  marital?: string;
  childrenbirthrecords?: { count?: number };
  regadd?: MyInfoRegisteredAddress;
  mobileno?: string;
  email?: string;
  vehicles?: MyInfoVehicle[];
  occupation?: string;
  /** Employer name. */
  employment?: string;
}

/** The MyInfo person attributes this app knows how to request and map. */
export type MyInfoScope = keyof Omit<MyInfoPerson, never>;

/** Human-readable labels for the consent screen, keyed by attribute. */
export const MYINFO_ATTRIBUTE_LABELS: Record<string, string> = {
  uinfin: "NRIC / FIN",
  name: "Registered name",
  nameChinese: "Name in Chinese characters",
  hanyupinyinname: "Hanyu Pinyin name",
  aliasname: "Alias name",
  sex: "Sex",
  race: "Race",
  dob: "Date of birth",
  residentialstatus: "Residential status",
  nationality: "Nationality",
  birthcountry: "Country of birth",
  passportnumber: "Passport number",
  passportexpirydate: "Passport expiry date",
  marital: "Marital status",
  childrenbirthrecords: "Number of children",
  regadd: "Registered address",
  mobileno: "Mobile number",
  email: "Email",
  vehicles: "Vehicle(s)",
  occupation: "Occupation",
  employment: "Employer",
};

/** Attributes requested for the tenant section. */
export const TENANT_MYINFO_SCOPES: MyInfoScope[] = [
  "uinfin",
  "name",
  "nationality",
  "regadd",
  "mobileno",
  "occupation",
];

/** Attributes requested for an interviewee's Personal details section. */
export const PERSONAL_MYINFO_SCOPES: MyInfoScope[] = [
  "uinfin",
  "name",
  "nameChinese",
  "sex",
  "dob",
  "nationality",
  "passportnumber",
  "marital",
  "childrenbirthrecords",
  "regadd",
  "vehicles",
  "occupation",
  "employment",
];

/** Attributes requested for an interviewee's Contact numbers section. */
export const CONTACT_MYINFO_SCOPES: MyInfoScope[] = [
  "uinfin",
  "name",
  "mobileno",
];

/**
 * Combined attributes for a single interviewee Singpass retrieval. A Singpass
 * scan is authoritative one-shot data, so it fills every interviewee particular
 * (personal details + contact numbers) at once, regardless of which section
 * page triggered it.
 */
export const INTERVIEWEE_MYINFO_SCOPES: MyInfoScope[] = Array.from(
  new Set<MyInfoScope>([...PERSONAL_MYINFO_SCOPES, ...CONTACT_MYINFO_SCOPES])
);
