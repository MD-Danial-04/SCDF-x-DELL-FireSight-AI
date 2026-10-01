import type { LeadingQuestion } from "./types";
import { loc } from "./types";

export const LPG_FIRE_LEADING_QUESTIONS_TITLE = "LPG / Town Gas — Leading questions";

export const LPG_FIRE_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "stove-fuel",
    section: loc("Stove & fuel", "Peranti Dapur & Bahan Bakar", "஍தாஅெகை ி௧ச", "索深和加名"),
    prompt: loc("What is the stove fueled by?", "Apa yang digunakan untuk membakar peranti dapur?", "தைகி ச௧ோக்அெகை?", "得为索深参数是一中的？"),
    hint: loc("e.g. LPG, Town Gas", "contoh: LPG, Gas Bandar", "இதாகுகி ச௧ோக் (e.g. LPG, Town Gas)", "及代 LPG, Town Gas 这子"),
  },
  {
    id: "last-used",
    section: loc("Stove usage", "Penggunaan Peranti Dapur", "ச௧ோக் திு", "索深用权"),
    prompt: loc("When was the stove last used before the fire?", "Apakah peranti dapur digunakan terakhir kali sebelum kebakaran?", "ச௧ோக்அெகை திுகைகை?", "索深會前保存句一中的日期？"),
    hint: loc("e.g. 25/12/2022 at 1230H", "contoh: 25/12/2022 jam 1230H", "இதாகுகி (e.g. 25/12/2022 at 1230H)", "及代 25/12/2022 到 1230H"),
  },
  {
    id: "lighting-method",
    section: loc("Stove usage", "Penggunaan Peranti Dapur", "ச௧ோக் திு", "索深用权"),
    prompt: loc("What was used to light up the stove?", "Apa yang digunakan untuk menyalakan peranti dapur?", "஍தாஅெகைச௧ோக் ி௧ச?", "得为索深参数的分前器为一中的？"),
  },
  {
    id: "elbow-joint",
    section: loc("Stove usage", "Penggunaan Peranti Dapur", "ச௧ோக் திு", "索深用权"),
    prompt: loc("Was there an elbow joint at the stove?", "Adakah sambungan sudut di peranti dapur?", "஍தாஅெகைச௧ோக் ி௧ச?", "得为索深會前参数的合称是一中的？"),
  },
  {
    id: "ventilation",
    section: loc("Stove usage", "Penggunaan Peranti Dapur", "ச௧ோக் திு", "索深用权"),
    prompt: loc("Was the stove area well-ventilated?", "Apakah kawasan sekitar peranti dapur terbuka dengan baik?", "஍தாஅெகைச௧ோக் ி௧ச?", "得为索深地图有参数的合称？"),
  },
  {
    id: "multiple-attempts",
    section: loc("Stove usage", "Penggunaan Peranti Dapur", "ச௧ோக் திு", "索深用权"),
    prompt: loc("Were there multiple attempts to light up the stove?", "Adakah cubaan berulang untuk menyalakan peranti dapur?", "஍தாஅெகைச௧ோக் ி௧சஇதாகு?", "得为索深参数的分前图有一中的说明？"),
    hint: loc("e.g. 2 or more in total", "contoh: 2 atau lebih dalam keseluruhan", "இதாகுகி (e.g. 2 or more in total)", "及代 2 和征个为种"),
  },
  {
    id: "abnormalities",
    section: loc("Before the fire", "Sebelum Kebakaran", "திுகை", "前日保存"),
    prompt: loc("Were there any abnormalities of the gas and stove system observed before the fire?", "Adakah kecacatan sistem gas dan peranti dapur dilihat sebelum kebakaran?", "஍தாஅெகைச௧ோக் ி௧சஇதாகு?", "得为索深和加名的参数有一中的说明？"),
    hint: loc("e.g. hissing sounds, gas smell, larger fire size than normal", "contoh: bunyi hisap, bau gas, api yang lebih besar daripada biasa", "இதாகுகி (e.g. ஍ல், ச௧ோக் அெகை)", "及代 得深程, 加名和天大图有种的说明"),
  },
  {
    id: "tampering",
    section: loc("Before the fire", "Sebelum Kebakaran", "திுகை", "前日保存"),
    prompt: loc("Were the gas and/or stove system(s) tampered with before the arrival of SCDF?", "Adakah sistem gas dan/atau peranti dapur disentuh sebelum kedatangan SCDF?", "ச௧ோக் ி௧சஇதாகு?", "得为索深和加名的参数有一中的说明？"),
    hint: loc("e.g. gas system was disassembled or modified", "contoh: sistem gas telah dipisahkan atau dimodifikasi", "இதாகுகி (e.g. ஍ல் ச௧ோக்)", "及代 加名和深程左种的说明"),
  },
  {
    id: "faulty-equipment",
    section: loc("Findings", "Pemidanaan", "தைகி", "某割"),
    prompt: loc("Any faulty equipment?", "Apakah peralatan rosak?", "தைகி ச௧்அெகல?", "常台资产状态（回私战、班義、波明模本、常台海动状态）"),
    hint: loc("e.g. stove, regulator, hose", "contohnya: dapur, regulator, hos", "ஆாத் ச௧்: ஍ுக, ஈெகி, அெக", "代码、班義、波明模本"),
  },
  {
    id: "other-information",
    section: loc("Findings", "Pemidanaan", "தைகி", "某割"),
    prompt: loc("Is there any other relevant information?", "Adakah maklumat lain yang relevan?", "ச௧்அெகல தைகி?", "很有一个可代码的请求）"),
  },
];
