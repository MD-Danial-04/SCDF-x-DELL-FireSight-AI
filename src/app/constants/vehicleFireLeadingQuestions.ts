import type { LeadingQuestion } from "./leadingQuestions";

export const VEHICLE_FIRE_LEADING_QUESTIONS_TITLE =
  "Vehicle fire — Leading questions";

export const VEHICLE_FIRE_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "vehicle-role",
    section: "Vehicle role",
    prompt:
      "Is this the main affected vehicle (first to catch fire, likely AOFO) or other damaged vehicle?",
    hint: "Other damaged vehicle = affected by fire from another vehicle or other source",
  },
  {
    id: "is-ev",
    section: "Vehicle role",
    prompt: "Is the affected vehicle an electric vehicle?",
    hint: "Includes EV cars and EV utility vehicles (refuse trucks, maintenance vehicles)",
  },
  {
    id: "purpose",
    section: "Vehicle information",
    prompt: "What is the purpose of the vehicle?",
    hint: "e.g. Personal, Personal (Rental/Leased), Private Hire, Taxi, Company Vehicle, Personal + Commercial",
  },
  {
    id: "plate-visible",
    section: "Vehicle information",
    prompt: "Is the vehicle registration plate still visible on the affected vehicle?",
  },
  {
    id: "plate-number",
    section: "Vehicle information",
    prompt: "What is the vehicle registration plate number?",
  },
  {
    id: "ownership-status",
    section: "Vehicle information",
    prompt: "What is the vehicle ownership status?",
    hint: "1st owner, 2nd owner onwards, or rented/leased",
  },
  {
    id: "vehicle-type",
    section: "Vehicle information",
    prompt: "What type of vehicle is it?",
  },
  {
    id: "vehicle-model",
    section: "Vehicle information",
    prompt: "What is the model of the vehicle?",
    hint: "e.g. Camry, Panigale V4, Carrera",
  },
  {
    id: "vehicle-model-extra",
    section: "Vehicle information",
    prompt: "Any additional vehicle model information?",
    hint: "e.g. Hyundai Ioniq 5 Electric → Exclusive 58 kWh; Honda Fit → 1.3, 1.5",
  },
  {
    id: "vehicle-colour",
    section: "Vehicle information",
    prompt: "What is the colour of the vehicle?",
  },
  {
    id: "vehicle-age",
    section: "Vehicle information",
    prompt: "What is the age of the vehicle (in years)?",
    hint: 'If unknown, indicate "NA"',
  },
  {
    id: "fuel-type",
    section: "Vehicle information",
    prompt: "What type of fuel does the vehicle use?",
  },
  {
    id: "state-at-fire",
    section: "Vehicle information",
    prompt: "What was the state of the vehicle at the time of fire?",
    hint: "Stationary (engine off or on) or in motion",
  },
  {
    id: "mileage",
    section: "Vehicle information",
    prompt: "What is the mileage (odometer reading in km)?",
    hint: 'If unable to recall or heavily damaged, indicate "0"',
  },
  {
    id: "origin-locations",
    section: "Driver observations",
    prompt: "What was the point of origin and which locations were visited?",
  },
  {
    id: "distance-travelled",
    section: "Driver observations",
    prompt: "What distance was travelled?",
  },
  {
    id: "duration-travel",
    section: "Driver observations",
    prompt: "What was the duration of travel?",
  },
  {
    id: "idle-duration",
    section: "Driver observations",
    prompt: "If the vehicle was idle or stationary, how long was it parked?",
  },
  {
    id: "usage-frequency",
    section: "Driver observations",
    prompt: "What is the frequency of usage of the vehicle?",
  },
  {
    id: "abnormalities",
    section: "Driver observations",
    prompt: "Were there any abnormalities before the fire?",
    hint: "Dashboard indicators, warning signs, flickering lights, electrical issues, etc.",
  },
  {
    id: "modifications",
    section: "Modifications",
    prompt: "Were there any modifications or additions to the vehicle?",
  },
  {
    id: "insurance-available",
    section: "Insurance & servicing",
    prompt: "Is vehicle insurance information available at the time of incident?",
  },
  {
    id: "servicing-available",
    section: "Insurance & servicing",
    prompt: "Is vehicle servicing information available at the time of incident?",
    hint: "If not, follow up with affected parties at earliest availability",
  },
  {
    id: "vehicle-destination",
    section: "Follow-up",
    prompt: "Where will the vehicle be sent to now?",
  },
  {
    id: "other-information",
    section: "Follow-up",
    prompt: "Is there any other relevant information?",
  },
];
