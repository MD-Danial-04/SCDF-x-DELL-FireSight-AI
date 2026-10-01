import type { MyInfoPerson } from "../types/myinfo";

export interface SingpassPersona {
  /** Stable id used by the mock provider to look up the person. */
  id: string;
  /** Display name shown in the mock login persona picker. */
  label: string;
  /** Short descriptor (e.g. residential status) for the picker. */
  caption: string;
  person: MyInfoPerson;
}

/**
 * Built-in, clearly fake personas used by the simulated Singpass flow. These
 * are loosely modelled on the well-known MyInfo sandbox test profiles but
 * contain no real personal data.
 */
export const SINGPASS_PERSONAS: SingpassPersona[] = [
  {
    id: "tan-xiao-hui",
    label: "Tan Xiao Hui",
    caption: "Singapore Citizen",
    person: {
      uinfin: "S9812381D",
      name: "TAN XIAO HUI",
      nameChinese: "陈晓慧",
      hanyupinyinname: "CHEN XIAO HUI",
      sex: "FEMALE",
      race: "CHINESE",
      dob: "1998-06-06",
      residentialstatus: "CITIZEN",
      nationality: "SINGAPORE CITIZEN",
      birthcountry: "SINGAPORE",
      marital: "SINGLE",
      childrenbirthrecords: { count: 0 },
      regadd: {
        block: "411",
        building: "",
        floor: "12",
        unit: "06",
        street: "CLEMENTI AVENUE 1",
        postal: "120411",
        country: "SINGAPORE",
      },
      mobileno: "+65 97324992",
      email: "tanxiaohui@example.com",
      occupation: "MARKETING EXECUTIVE",
      employment: "ACME DESIGN PTE LTD",
      vehicles: [],
    },
  },
  {
    id: "lim-jun-wei",
    label: "Lim Jun Wei",
    caption: "Singapore Citizen",
    person: {
      uinfin: "S8113769A",
      name: "LIM JUN WEI",
      nameChinese: "林俊伟",
      hanyupinyinname: "LIN JUN WEI",
      sex: "MALE",
      race: "CHINESE",
      dob: "1981-04-22",
      residentialstatus: "CITIZEN",
      nationality: "SINGAPORE CITIZEN",
      birthcountry: "SINGAPORE",
      marital: "MARRIED",
      childrenbirthrecords: { count: 2 },
      regadd: {
        block: "228",
        building: "",
        floor: "09",
        unit: "115",
        street: "ANG MO KIO AVENUE 1",
        postal: "560228",
        country: "SINGAPORE",
      },
      mobileno: "+65 81234567",
      email: "limjunwei@example.com",
      occupation: "RENOVATION CONTRACTOR",
      employment: "BUILDWELL CONTRACTS LLP",
      vehicles: [{ vehicleno: "SLA1234X", make: "TOYOTA", model: "HIACE" }],
    },
  },
  {
    id: "nur-aisyah",
    label: "Nur Aisyah Binte Hassan",
    caption: "Singapore Citizen",
    person: {
      uinfin: "T0066846F",
      name: "NUR AISYAH BINTE HASSAN",
      sex: "FEMALE",
      race: "MALAY",
      dob: "2000-11-15",
      residentialstatus: "CITIZEN",
      nationality: "SINGAPORE CITIZEN",
      birthcountry: "SINGAPORE",
      marital: "SINGLE",
      childrenbirthrecords: { count: 0 },
      regadd: {
        block: "682C",
        building: "",
        floor: "05",
        unit: "342",
        street: "JURONG WEST CENTRAL 1",
        postal: "643682",
        country: "SINGAPORE",
      },
      mobileno: "+65 90112233",
      email: "nuraisyah@example.com",
      occupation: "STUDENT",
      employment: "",
      vehicles: [],
    },
  },
  {
    id: "raj-kumar",
    label: "Raj Kumar S/O Muthu",
    caption: "Permanent Resident",
    person: {
      uinfin: "F2179387K",
      name: "RAJ KUMAR S/O MUTHU",
      sex: "MALE",
      race: "INDIAN",
      dob: "1975-02-09",
      residentialstatus: "PR",
      nationality: "INDIAN",
      birthcountry: "INDIA",
      passportnumber: "P1234567K",
      passportexpirydate: "2029-08-30",
      marital: "MARRIED",
      childrenbirthrecords: { count: 3 },
      regadd: {
        block: "59",
        building: "THE INTERLACE",
        floor: "21",
        unit: "08",
        street: "DEPOT ROAD",
        postal: "109681",
        country: "SINGAPORE",
      },
      mobileno: "+65 98887766",
      email: "rajkumar@example.com",
      occupation: "LOGISTICS SUPERVISOR",
      employment: "PORTSIDE LOGISTICS PTE LTD",
      vehicles: [{ vehicleno: "SMB7788Y", make: "HONDA", model: "VEZEL" }],
    },
  },
];

export function getPersonaById(id: string): SingpassPersona | undefined {
  return SINGPASS_PERSONAS.find((persona) => persona.id === id);
}
