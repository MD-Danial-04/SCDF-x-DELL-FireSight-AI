import type { LeadingQuestion } from "./types";
import { loc } from "./types";

export const VEHICLE_FIRE_LEADING_QUESTIONS_TITLE = "Vehicle fire — Leading questions";

export const VEHICLE_FIRE_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "vehicle-role",
    section: loc("Vehicle role", "Peranan Kenderaan", "இலெகிை", "路存器名"),
    prompt: loc("Is this the main affected vehicle (first to catch fire, likely AOFO) or other damaged vehicle?", "Adakah kenderaan ini kenderaan yang terjejas utama (kenderaan pertama yang terbakar, mungkin AOFO) atau kenderaan lain yang rosak?", "பைகி் ட௧ோகழு (இலெகிைம்) அெச௧ோகழு?", "是否的常发前路存器（给小代题得消。终切得消。一台得消。）"),
    hint: loc("Other damaged vehicle = affected by fire from another vehicle or other source", "Kenderaan lain yang rosak = terjejas oleh api dari kenderaan lain atau sumber lain", "இலெகிைம் = ட௧ோகழுகிைம் இலெகிைம் ச௧ோகழு", "其代器存器=对消消是了器合成的给。一台得消是了消消。"),
  },
  {
    id: "is-ev",
    section: loc("Vehicle role", "Peranan Kenderaan", "இலெகிை", "路存器名"),
    prompt: loc("Is the affected vehicle an electric vehicle?", "Adakah kenderaan yang terjejas adalah kenderaan elektrik?", "பைகி் ட௧ோகழுஅெச௧ோகழு?", "是否的常发前路存器是区代题（图给成制。终切成制。。"),
    hint: loc("Includes EV cars and EV utility vehicles (refuse trucks, maintenance vehicles)", "Termasuk kereta dan kenderaan utiliti elektrik (truk sampah, kenderaan pembaikan)", "பைகி் இலெகிைம்: EV ச௧ோகழு, EV ச௧ோகழு (இ஢்அெட௧ோகழு, ஍கிைம்)", "存器成制了区代题、发前成制器。"),
  },
  {
    id: "purpose",
    section: loc("Vehicle information", "Maklumat Kenderaan", "இலெகிை", "路存器会回"),
    prompt: loc("What is the purpose of the vehicle?", "Apa tujuan kenderaan?", "ட௧ோகழு பைகி்?", "是否的路存器的复制？"),
    hint: loc("e.g. Personal, Personal (Rental/Leased), Private Hire, Taxi, Company Vehicle, Personal + Commercial", "contohnya: Peribadi, Peribadi (Rental/Leased), Sewa Kereta, Teksi, Kenderaan Syarikat, Peribadi + Komersial", "இலெகிை: e.g. ட௧ோகழு, ட௧ோகழு (இ஢்அெட௧ோகழு, ஍கிைம்)", "、、、、、、、、、、、、、、、、、、、"),
  },
  {
    id: "plate-visible",
    section: loc("Vehicle information", "Maklumat Kenderaan", "இலெகிை", "路存器会回"),
    prompt: loc("Is the vehicle registration plate still visible on the affected vehicle?", "Adakah nombor pendaftaran kenderaan masih kelihatan pada kenderaan yang terjejas?", "ட௧ோகழு பைகி்அெச௧ோகழு?", "是否的路存器给台元本在一。"),
  },
  {
    id: "plate-number",
    section: loc("Vehicle information", "Maklumat Kenderaan", "இலெகிை", "路存器会回"),
    prompt: loc("What is the vehicle registration plate number?", "Apa nombor pendaftaran kenderaan?", "பைகி் ட௧ோகழு?", "是否的路存器给台元数。"),
  },
  {
    id: "ownership-status",
    section: loc("Vehicle information", "Maklumat Kenderaan", "இலெகிை", "路存器会回"),
    prompt: loc("What is the vehicle ownership status?", "Apa status pemilikan kenderaan?", "ட௧ோகழு பைகி்அெச௧ோகழு?", "是否的路存器的商噐状态？"),
    hint: loc("1st owner, 2nd owner onwards, or rented/leased", "Pemilik pertama, pemilik kedua ke atas, atau disewa/ ditempah", "இலெகிை: 1st பைகி், 2nd பைகி் ௧ோகழு, ஝அெட௧ோகழு", "、、、、、、、、、、、、、、、、、、、"),
  },
  {
    id: "vehicle-type",
    section: loc("Vehicle information", "Maklumat Kenderaan", "இலெகிை", "路存器会回"),
    prompt: loc("What type of vehicle is it?", "Apa jenis kenderaan?", "பைகி் ட௧ோகழு?", "是否的路存器精型？"),
  },
  {
    id: "vehicle-model",
    section: loc("Vehicle information", "Maklumat Kenderaan", "இலெகிை", "路存器会回"),
    prompt: loc("What is the model of the vehicle?", "Apa model kenderaan?", "பைகி் ட௧ோகழு?", "是否的路存器精型？"),
    hint: loc("e.g. Camry, Panigale V4, Carrera", "contohnya: Camry, Panigale V4, Carrera", "இலெகிை: e.g. Camry, Panigale V4, Carrera", "、、、、、、、、、、、、、、、、、、、"),
  },
  {
    id: "vehicle-model-extra",
    section: loc("Vehicle information", "Maklumat kenderaan", "தைகி்", "车元一中台"),
    prompt: loc("Any additional vehicle model information?", "Apakah maklumat tambahan mengenai model kenderaan?", "தைகி் அ௧சுகெகைகு?", "带代的车元米图一中台数证?"),
    hint: loc("e.g. Hyundai Ioniq 5 Electric → Exclusive 58 kWh; Honda Fit → 1.3, 1.5", "contoh: Hyundai Ioniq 5 Elektrik → Khas 58 kWh; Honda Fit → 1.3, 1.5", "தைகி்: e.g. இ௧சு 5 அ௧சு → தைகி் 58 kWh; இ௧சு கெகைகு → 1.3, 1.5", "亚丁，张欢丸切前、张欢丸切前"),
  },
  {
    id: "vehicle-colour",
    section: loc("Vehicle information", "Maklumat kenderaan", "தைகி்", "车元一中台"),
    prompt: loc("What is the colour of the vehicle?", "Warna apa yang digunakan oleh kenderaan?", "அ௧சு கெகைகு?", "带的车元→名有颜?"),
  },
  {
    id: "vehicle-age",
    section: loc("Vehicle information", "Maklumat kenderaan", "தைகி்", "车元一中台"),
    prompt: loc("What is the age of the vehicle (in years)?", "Berapa umur kenderaan (dalam tahun-tahun)?", "அ௧சு கெகைகு (in years)?", "带的车元→有代前日?"),
    hint: loc("If unknown, indicate \"NA\"", "Jika tidak diketahui, tunjukkan \"Tidak Diketahui\"", "If unknown, indicate \"NA\"", "存求，笔一、笔丁"),
  },
  {
    id: "fuel-type",
    section: loc("Vehicle information", "Maklumat kenderaan", "தைகி்", "车元一中台"),
    prompt: loc("What type of fuel does the vehicle use?", "Apa jenis bahan api yang digunakan oleh kenderaan?", "அ௧சு கெகைகு?", "带的车元→名有気米图?"),
  },
  {
    id: "state-at-fire",
    section: loc("Vehicle information", "Maklumat kenderaan", "தைகி்", "车元一中台"),
    prompt: loc("What was the state of the vehicle at the time of fire?", "Dalam keadaan apa kenderaan ketika kebakaran berlaku?", "அ௧சு கெகைகு தி் இ௧சு?", "带的车元→有代状组?"),
    hint: loc("Stationary (engine off or on) or in motion", "Berhenti (motor mati atau hidup) atau dalam pergerakan", "அ௧சு (engine off or on) or in motion", "回层，发加、发加"),
  },
  {
    id: "mileage",
    section: loc("Vehicle information", "Maklumat kenderaan", "தைகி்", "车元一中台"),
    prompt: loc("What is the mileage (odometer reading in km)?", "Bilangan kilometer yang telah ditempuh?", "அ௧சு கெகைகு (odometer reading in km)?", "带的车元→有前笔求?"),
    hint: loc("If unable to recall or heavily damaged, indicate \"0\"", "Jika tidak dapat diingat atau rosak teruk, tunjukkan \"0\"", "If unable to recall or heavily damaged, indicate \"0\"", "存求，、发加"),
  },
  {
    id: "origin-locations",
    section: loc("Driver observations", "Oleh pengemudi", "கெகைகு", "回层发加"),
    prompt: loc("What was the point of origin and which locations were visited?", "Pada titik asal mana dan lokasi-lokasi manakah yang dikunjungi?", "அ௧சு இ௧சுதி்?", "带的笔丁→有代车元、笔丁?"),
  },
  {
    id: "distance-travelled",
    section: loc("Driver observations", "Oleh pengemudi", "கெகைகு", "回层发加"),
    prompt: loc("What distance was travelled?", "Berapa jarak yang ditempuh?", "அ௧சு இ௧சுதி்?", "带的笔丁→有代车元?"),
  },
  {
    id: "duration-travel",
    section: loc("Driver observations", "Pengamatan pengemudi", "தைகி் அ௧ச", "运图描跹"),
    prompt: loc("What was the duration of travel?", "Berapa lama tempoh perjalanan?", "தைகி் அ௧சுகெகே?", "得为經安时朝是、?"),
  },
  {
    id: "idle-duration",
    section: loc("Driver observations", "Pengamatan pengemudi", "தைகி் அ௧ச", "运图描跹"),
    prompt: loc("If the vehicle was idle or stationary, how long was it parked?", "Jika kenderaan itu diam atau tidak bergerak, berapa lama ia diparkir?", "ஆெகுதைகி் ௧சுகெகே?", "常代經安时朝是、?"),
  },
  {
    id: "usage-frequency",
    section: loc("Driver observations", "Pengamatan pengemudi", "தைகி் அ௧ச", "运图描跹"),
    prompt: loc("What is the frequency of usage of the vehicle?", "Apa frekuensi penggunaan kenderaan itu?", "ஆெகுதைகி் ௧சுகெகே?", "用户王的朝模得、?"),
  },
  {
    id: "abnormalities",
    section: loc("Driver observations", "Pengamatan pengemudi", "தைகி் அ௧ச", "运图描跹"),
    prompt: loc("Were there any abnormalities before the fire?", "Adakah ada keanehan sebelum kebakaran berlaku?", "ஆெகுதைகி் ௧சுகெகே?", "服务得有一个精直、?"),
    hint: loc("Dashboard indicators, warning signs, flickering lights, electrical issues, etc.", "Indikator dashboard, tanda peringatan, lampu yang berkedip-kedip, isu elektrik dan lain-lain.", "அ௧தைகி் இெச, ஆு஝ெகுஅ௧தைகி், இெசுஅ௧தைகி், ஆு஝ெகுஅ௧தைகி், etc.", "欢迎描跹、反应經安、消息經安、代理經安、成功經安、反诹經安、再用經安、求为經安、成功經安、反诹經安"),
  },
  {
    id: "modifications",
    section: loc("Modifications", "Modifikasi", "தைகி் ௧ச", "服务"),
    prompt: loc("Were there any modifications or additions to the vehicle?", "Adakah ada modifikasi atau penambahan kepada kenderaan?", "ஆெகுதைகி் ௧சுகெகே?", "服务为、?"),
  },
  {
    id: "insurance-available",
    section: loc("Insurance & servicing", "Insuran & penyelenggaraan", "தைகி் ௧ச", "账号和应武"),
    prompt: loc("Is vehicle insurance information available at the time of incident?", "Adakah maklumat insurans kenderaan tersedia pada masa kejadian?", "ஆெகுதைகி் ௧சுகெகே?", "用户账号信息是、?"),
  },
  {
    id: "servicing-available",
    section: loc("Insurance & servicing", "Insuran & penyelenggaraan", "தைகி் ௧ச", "账号和应武"),
    prompt: loc("Is vehicle servicing information available at the time of incident?", "Adakah maklumat penyelenggaraan kenderaan tersedia pada masa kejadian?", "ஆெகுதைகி் ௧சுகெகே?", "用户应武信息是、?"),
    hint: loc("If not, follow up with affected parties at earliest availability", "Jika tidak, ikuti dengan pihak yang terkesan secepat mungkin.", "அ௧தைகி் இெச, ஆு஝ெகுஅ௧தைகி்", "反诹我在服务前得、"),
  },
  {
    id: "vehicle-destination",
    section: loc("Follow-up", "Langkah lanjut", "தைகி் ௧ச", "扭求"),
    prompt: loc("Where will the vehicle be sent to now?", "Kenderaan itu akan dihantar ke mana?", "ஆெகுதைகி் ௧சுகெகே?", "用户代在已送买、?"),
  },
  {
    id: "other-information",
    section: loc("Follow-up", "Pemantauan Lanjutan", "ஆைகி்", "报还"),
    prompt: loc("Is there any other relevant information?", "Adakah maklumat lain yang relevan?", "தைகி் அ௧லுசான்?", "是不有参考的其子信息？"),
  },
];
