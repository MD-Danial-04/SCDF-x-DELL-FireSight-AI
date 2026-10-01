import type { LeadingQuestion } from "./types";
import { loc } from "./types";

export const AMD_LEADING_QUESTIONS_TITLE = "AMD / PMD / PAB / PMA — Leading questions";

export const AMD_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "device-type",
    section: loc("Affected device", "Peranti terkesan", "இி் தைக", "回过代码"),
    prompt: loc("What type of mobility device is it?", "Apa jenis peranti kemasukanan yang ia?", "தைகி் அ௧சுகெகே?", "得为代码的精不组状态是。"),
    hint: loc("e.g. PMD, PAB, PMA", "contoh: PMD, PAB, PMA", "e.g. PMD, PAB, PMA", "反家： PMD, PAB, PMA"),
  },
  {
    id: "device-model",
    section: loc("Affected device", "Peranti terkesan", "இி் தைக", "回过代码"),
    prompt: loc("What is the device's model?", "Apa model peranti itu?", "அ௧சுகெகே தைக?", "得为代码的分组状态？"),
  },
  {
    id: "battery-type",
    section: loc("Affected device", "Peranti terkesan", "இி் தைக", "回过代码"),
    prompt: loc("What type of battery does the device use?", "Apa jenis bateri yang digunakan oleh peranti?", "அ௧சுகெகே தி்கே?", "得为代码用户的精不组状态？"),
    hint: loc("e.g. lithium-ion (Li-ion), lead acid", "contoh: lithium-ion (Li-ion), asid timbal", "e.g. lithium-ion (Li-ion), lead acid", "反家： lithium-ion (Li-ion), 苹里压称"),
  },
  {
    id: "battery-brand",
    section: loc("Affected device", "Peranti terkesan", "இி் தைக", "回过代码"),
    prompt: loc("What is the battery's brand?", "Apa jenama bateri itu?", "அ௧சுகெகே தி்?", "得为代码用户的名里？"),
  },
  {
    id: "battery-model",
    section: loc("Affected device", "Peranti terkesan", "இி் தைக", "回过代码"),
    prompt: loc("What is the battery's model?", "Apa model bateri itu?", "அ௧சுகெகே தி்?", "得为代码用户的分组状态？"),
  },
  {
    id: "battery-oem",
    section: loc("Affected device", "Peranti terkesan", "இி் தைக", "回过代码"),
    prompt: loc("Was the battery provided by the Original Equipment Manufacturer (OEM)?", "Adakah bateri disediakan oleh Pengeluar Asal (OEM)?", "அ௧சுகெகே தி்இைக஢ாண?", "得为代码用户是要发对手机的名称制本公司＿"),
  },
  {
    id: "modifications",
    section: loc("Affected device", "Peranti terkesan", "இி் தைக", "回过代码"),
    prompt: loc("Have any modifications been made to the device?", "Apakah perubahan yang dibuat kepada peranti?", "அ௧சுகெகே தி்இைக?", "得为代码有可以增分的化用？"),
  },
  {
    id: "main-use",
    section: loc("Affected device", "Peranti terkesan", "இி் தைக", "回过代码"),
    prompt: loc("What is the main use of the device?", "Apa penggunaan utama peranti itu?", "அ௧சுகெகே தி்இைக?", "得为代码的不各用皲？"),
  },
  {
    id: "last-used-date",
    section: loc("Affected device", "Peranti yang terkesan", "தைகி் இ௧ச", "回组器"),
    prompt: loc("When was the device last used?", "Bilakah peranti itu digunakan terakhir kali?", "தைகி் அ௧சுகெகே?", "年會会发警的日期？"),
  },
  {
    id: "last-used-duration",
    section: loc("Affected device", "Peranti yang terkesan", "தைகி் இ௧ச", "回组器"),
    prompt: loc("How long was the device used for before the incident?", "Berapa lama peranti itu digunakan sebelum kejadian berlaku?", "அ௧சுகெகே தைகி் ஗ெகே?", "年會会发警的间隐？"),
    hint: loc("e.g. 2 hours", "contoh: 2 jam", "இ௧ச: e.g. 2 ஙு", "代码。 2分"),
  },
  {
    id: "purchase-date",
    section: loc("Purchase history", "Sejarah pembelian", "தைகி் ச௧஝", "发警为帮"),
    prompt: loc("When was the device purchased?", "Bilakah peranti itu dibeli?", "அ௧சுகெகே தைகி்?", "发警的日期？"),
    hint: loc("e.g. 6 months ago, 18/02/2022, cannot be determined", "contoh: 6 bulan lalu, 18/02/2022, tidak dapat ditentukan", "இ௧ச: e.g. 6 ஙுஜ, 18/02/2022, தைகி் ஗ெகே", "代码。 6月前给，18/02/2022，否号到明称"),
  },
  {
    id: "purchase-type",
    section: loc("Purchase history", "Sejarah pembelian", "தைகி் ச௧஝", "发警为帮"),
    prompt: loc("What was the purchase type?", "Apa jenis pembelian?", "அ௧சுகெகே தைகி்?", "发警的类型？"),
  },
  {
    id: "purchase-location",
    section: loc("Purchase history", "Sejarah pembelian", "தைகி் ச௧஝", "发警为帮"),
    prompt: loc("Where was the device purchased from?", "Di mana peranti itu dibeli dari?", "அ௧சுகெகே தைகி்?", "发警的地点？"),
  },
  {
    id: "purchase-shop",
    section: loc("Purchase history", "Sejarah pembelian", "தைகி் ச௧஝", "发警为帮"),
    prompt: loc("What is the name of the retail shop or online platform?", "Apa nama kedai runcit atau platform dalam talian?", "அ௧சுகெகே தைகி்?", "发警的商客名称？"),
  },
  {
    id: "replacement-battery",
    section: loc("Replacement / add-on battery", "Bateri pengganti / tambahan", "தைகி் ஗ெகே", "金加判求"),
    prompt: loc("Have you purchased a replacement or add-on battery before?", "Adakah anda telah membeli bateri pengganti atau tambahan sebelum ini?", "அ௧சுகெகே தைகி் ஗ெகே?", "有会发警类的正在吃。"),
    hint: loc("If yes, ask for details", "Jika ya, tanyakan butiran lanjut", "இ௧ச: If yes, ask for details", "应有。 请查看吗"),
  },
  {
    id: "safety-mark-plug",
    section: loc("Battery charger", "Suis pengisi bateri", "தைகி் இ௧ச", "求加判"),
    prompt: loc("Does the battery charger plug have the Safety Mark logo?", "Adakah suis pengisi bateri mempunyai logo Safety Mark?", "அ௧சுகெகே தைகி் ஗ெகே?", "吃率号的帮回警类吃。"),
  },
  {
    id: "safety-mark-adapter",
    section: loc("Battery charger", "Pembekal Bateri", "ஂாயகெத்", "另常会的哂器"),
    prompt: loc("Does the power adapter of the battery charger have the Safety Mark logo?", "Adakah pengguna adapter kuasa pembekal bateri mempunyai logo Mark Keselamatan?", "தைகி் அ௧சுகெகேகைகெத்கிைஅ௧சு?", "常会发武的米哂器服加安全图标名ぢ？"),
  },
  {
    id: "last-charge-date",
    section: loc("Battery charger", "Pembekal Bateri", "ஂாயகெத்", "另常会的哂器"),
    prompt: loc("When was the battery last charged?", "Bilakah bateri terakhir dicas?", "அ௧சுகிைஅ௧சு த்கெகேகைகெ?", "笔常服加日期？"),
  },
  {
    id: "last-charge-time",
    section: loc("Battery charger", "Pembekal Bateri", "ஂாயகெத்", "另常会的哂器"),
    prompt: loc("What time was the battery last charged?", "Berapa masa bateri terakhir dicas?", "அ௧சுகிைஅ௧சு த்கெகேகைகெ?", "笔常服加时间？"),
    hint: loc("e.g. 2350hrs", "contoh: 2350 jam", "அ௧சு 2350த்", "代码。 2350十前"),
  },
  {
    id: "last-charge-duration",
    section: loc("Battery charger", "Pembekal Bateri", "ஂாயகெத்", "另常会的哂器"),
    prompt: loc("How long was the battery charged for?", "Bilakah lama bateri dicaj?", "அ௧சுகிைஅ௧சு த்கெகேகைகெ?", "笔常服加时间？"),
    hint: loc("e.g. 6 hours", "contoh: 6 jam", "அ௧சு 6 த்கிை", "代码。 6分"),
  },
  {
    id: "fire-location",
    section: loc("Events leading to fire", "Peristiwa yang menyebabkan kebakaran", "சிைஅ௧சு", "仅常深前图"),
    prompt: loc("Where did the fire occur?", "Di mana kebakaran berlaku?", "சிைஅ௧சு த்கெகேகைகெ?", "笔常图定地ぢ？"),
  },
  {
    id: "fire-spread",
    section: loc("Events leading to fire", "Peristiwa yang menyebabkan kebakaran", "சிைஅ௧சு", "仅常深前图"),
    prompt: loc("Did the fire spread beyond the device?", "Adakah kebakaran menyebar melebihi peranti?", "சிைஅ௧சு த்கெகேகைகெ?", "笔常图全台天将常个图为代码不要深前？"),
  },
  {
    id: "device-status",
    section: loc("Events leading to fire", "Peristiwa yang menyebabkan kebakaran", "சிைஅ௧சு", "仅常深前图"),
    prompt: loc("What was the status of the device prior to the fire?", "Bilakah status peranti sebelum kebakaran berlaku?", "த்கெகேகைகெ சிைஅ௧சு?", "笔常为代码状态？"),
  },
  {
    id: "other-information",
    section: loc("Events leading to fire", "Peristiwa yang menyebabkan kebakaran", "சிைஅ௧சு", "仅常深前图"),
    prompt: loc("Is there any other relevant information?", "Adakah maklumat lain yang relevan?", "த்கெகேகைகெ ி௧சு?", "有可代码的其子数据？"),
  },
];
