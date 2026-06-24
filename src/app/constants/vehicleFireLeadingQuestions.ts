import type { LeadingQuestion } from "./leadingQuestions";
import { loc } from "./leadingQuestions";

export const VEHICLE_FIRE_LEADING_QUESTIONS_TITLE = "Vehicle fire — Leading questions";

export const VEHICLE_FIRE_LEADING_QUESTIONS: LeadingQuestion[] = [
  {
    id: "vehicle-role",
    section: loc("Vehicle role", "[MS] Vehicle role", "[TA] Vehicle role", "[ZH] Vehicle role"),
    prompt: loc("Is this the main affected vehicle (first to catch fire, likely AOFO) or other damaged vehicle?", "[MS] Is this the main affected vehicle (first to catch fire, likely AOFO) or other damaged vehicle?", "[TA] Is this the main affected vehicle (first to catch fire, likely AOFO) or other damaged vehicle?", "[ZH] Is this the main affected vehicle (first to catch fire, likely AOFO) or other damaged vehicle?"),
    hint: loc("Other damaged vehicle = affected by fire from another vehicle or other source", "[MS] Other damaged vehicle = affected by fire from another vehicle or other source", "[TA] Other damaged vehicle = affected by fire from another vehicle or other source", "[ZH] Other damaged vehicle = affected by fire from another vehicle or other source"),
  },
  {
    id: "is-ev",
    section: loc("Vehicle role", "[MS] Vehicle role", "[TA] Vehicle role", "[ZH] Vehicle role"),
    prompt: loc("Is the affected vehicle an electric vehicle?", "[MS] Is the affected vehicle an electric vehicle?", "[TA] Is the affected vehicle an electric vehicle?", "[ZH] Is the affected vehicle an electric vehicle?"),
    hint: loc("Includes EV cars and EV utility vehicles (refuse trucks, maintenance vehicles)", "[MS] Includes EV cars and EV utility vehicles (refuse trucks, maintenance vehicles)", "[TA] Includes EV cars and EV utility vehicles (refuse trucks, maintenance vehicles)", "[ZH] Includes EV cars and EV utility vehicles (refuse trucks, maintenance vehicles)"),
  },
  {
    id: "purpose",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What is the purpose of the vehicle?", "[MS] What is the purpose of the vehicle?", "[TA] What is the purpose of the vehicle?", "[ZH] What is the purpose of the vehicle?"),
    hint: loc("e.g. Personal, Personal (Rental/Leased), Private Hire, Taxi, Company Vehicle, Personal + Commercial", "[MS] e.g. Personal, Personal (Rental/Leased), Private Hire, Taxi, Company Vehicle, Personal + Commercial", "[TA] e.g. Personal, Personal (Rental/Leased), Private Hire, Taxi, Company Vehicle, Personal + Commercial", "[ZH] e.g. Personal, Personal (Rental/Leased), Private Hire, Taxi, Company Vehicle, Personal + Commercial"),
  },
  {
    id: "plate-visible",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("Is the vehicle registration plate still visible on the affected vehicle?", "[MS] Is the vehicle registration plate still visible on the affected vehicle?", "[TA] Is the vehicle registration plate still visible on the affected vehicle?", "[ZH] Is the vehicle registration plate still visible on the affected vehicle?"),
  },
  {
    id: "plate-number",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What is the vehicle registration plate number?", "[MS] What is the vehicle registration plate number?", "[TA] What is the vehicle registration plate number?", "[ZH] What is the vehicle registration plate number?"),
  },
  {
    id: "ownership-status",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What is the vehicle ownership status?", "[MS] What is the vehicle ownership status?", "[TA] What is the vehicle ownership status?", "[ZH] What is the vehicle ownership status?"),
    hint: loc("1st owner, 2nd owner onwards, or rented/leased", "[MS] 1st owner, 2nd owner onwards, or rented/leased", "[TA] 1st owner, 2nd owner onwards, or rented/leased", "[ZH] 1st owner, 2nd owner onwards, or rented/leased"),
  },
  {
    id: "vehicle-type",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What type of vehicle is it?", "[MS] What type of vehicle is it?", "[TA] What type of vehicle is it?", "[ZH] What type of vehicle is it?"),
  },
  {
    id: "vehicle-model",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What is the model of the vehicle?", "[MS] What is the model of the vehicle?", "[TA] What is the model of the vehicle?", "[ZH] What is the model of the vehicle?"),
    hint: loc("e.g. Camry, Panigale V4, Carrera", "[MS] e.g. Camry, Panigale V4, Carrera", "[TA] e.g. Camry, Panigale V4, Carrera", "[ZH] e.g. Camry, Panigale V4, Carrera"),
  },
  {
    id: "vehicle-model-extra",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("Any additional vehicle model information?", "[MS] Any additional vehicle model information?", "[TA] Any additional vehicle model information?", "[ZH] Any additional vehicle model information?"),
    hint: loc("e.g. Hyundai Ioniq 5 Electric → Exclusive 58 kWh; Honda Fit → 1.3, 1.5", "[MS] e.g. Hyundai Ioniq 5 Electric → Exclusive 58 kWh; Honda Fit → 1.3, 1.5", "[TA] e.g. Hyundai Ioniq 5 Electric → Exclusive 58 kWh; Honda Fit → 1.3, 1.5", "[ZH] e.g. Hyundai Ioniq 5 Electric → Exclusive 58 kWh; Honda Fit → 1.3, 1.5"),
  },
  {
    id: "vehicle-colour",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What is the colour of the vehicle?", "[MS] What is the colour of the vehicle?", "[TA] What is the colour of the vehicle?", "[ZH] What is the colour of the vehicle?"),
  },
  {
    id: "vehicle-age",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What is the age of the vehicle (in years)?", "[MS] What is the age of the vehicle (in years)?", "[TA] What is the age of the vehicle (in years)?", "[ZH] What is the age of the vehicle (in years)?"),
    hint: loc("If unknown, indicate \"NA\"", "[MS] If unknown, indicate \"NA\"", "[TA] If unknown, indicate \"NA\"", "[ZH] If unknown, indicate \"NA\""),
  },
  {
    id: "fuel-type",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What type of fuel does the vehicle use?", "[MS] What type of fuel does the vehicle use?", "[TA] What type of fuel does the vehicle use?", "[ZH] What type of fuel does the vehicle use?"),
  },
  {
    id: "state-at-fire",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What was the state of the vehicle at the time of fire?", "[MS] What was the state of the vehicle at the time of fire?", "[TA] What was the state of the vehicle at the time of fire?", "[ZH] What was the state of the vehicle at the time of fire?"),
    hint: loc("Stationary (engine off or on) or in motion", "[MS] Stationary (engine off or on) or in motion", "[TA] Stationary (engine off or on) or in motion", "[ZH] Stationary (engine off or on) or in motion"),
  },
  {
    id: "mileage",
    section: loc("Vehicle information", "[MS] Vehicle information", "[TA] Vehicle information", "[ZH] Vehicle information"),
    prompt: loc("What is the mileage (odometer reading in km)?", "[MS] What is the mileage (odometer reading in km)?", "[TA] What is the mileage (odometer reading in km)?", "[ZH] What is the mileage (odometer reading in km)?"),
    hint: loc("If unable to recall or heavily damaged, indicate \"0\"", "[MS] If unable to recall or heavily damaged, indicate \"0\"", "[TA] If unable to recall or heavily damaged, indicate \"0\"", "[ZH] If unable to recall or heavily damaged, indicate \"0\""),
  },
  {
    id: "origin-locations",
    section: loc("Driver observations", "[MS] Driver observations", "[TA] Driver observations", "[ZH] Driver observations"),
    prompt: loc("What was the point of origin and which locations were visited?", "[MS] What was the point of origin and which locations were visited?", "[TA] What was the point of origin and which locations were visited?", "[ZH] What was the point of origin and which locations were visited?"),
  },
  {
    id: "distance-travelled",
    section: loc("Driver observations", "[MS] Driver observations", "[TA] Driver observations", "[ZH] Driver observations"),
    prompt: loc("What distance was travelled?", "[MS] What distance was travelled?", "[TA] What distance was travelled?", "[ZH] What distance was travelled?"),
  },
  {
    id: "duration-travel",
    section: loc("Driver observations", "[MS] Driver observations", "[TA] Driver observations", "[ZH] Driver observations"),
    prompt: loc("What was the duration of travel?", "[MS] What was the duration of travel?", "[TA] What was the duration of travel?", "[ZH] What was the duration of travel?"),
  },
  {
    id: "idle-duration",
    section: loc("Driver observations", "[MS] Driver observations", "[TA] Driver observations", "[ZH] Driver observations"),
    prompt: loc("If the vehicle was idle or stationary, how long was it parked?", "[MS] If the vehicle was idle or stationary, how long was it parked?", "[TA] If the vehicle was idle or stationary, how long was it parked?", "[ZH] If the vehicle was idle or stationary, how long was it parked?"),
  },
  {
    id: "usage-frequency",
    section: loc("Driver observations", "[MS] Driver observations", "[TA] Driver observations", "[ZH] Driver observations"),
    prompt: loc("What is the frequency of usage of the vehicle?", "[MS] What is the frequency of usage of the vehicle?", "[TA] What is the frequency of usage of the vehicle?", "[ZH] What is the frequency of usage of the vehicle?"),
  },
  {
    id: "abnormalities",
    section: loc("Driver observations", "[MS] Driver observations", "[TA] Driver observations", "[ZH] Driver observations"),
    prompt: loc("Were there any abnormalities before the fire?", "[MS] Were there any abnormalities before the fire?", "[TA] Were there any abnormalities before the fire?", "[ZH] Were there any abnormalities before the fire?"),
    hint: loc("Dashboard indicators, warning signs, flickering lights, electrical issues, etc.", "[MS] Dashboard indicators, warning signs, flickering lights, electrical issues, etc.", "[TA] Dashboard indicators, warning signs, flickering lights, electrical issues, etc.", "[ZH] Dashboard indicators, warning signs, flickering lights, electrical issues, etc."),
  },
  {
    id: "modifications",
    section: loc("Modifications", "[MS] Modifications", "[TA] Modifications", "[ZH] Modifications"),
    prompt: loc("Were there any modifications or additions to the vehicle?", "[MS] Were there any modifications or additions to the vehicle?", "[TA] Were there any modifications or additions to the vehicle?", "[ZH] Were there any modifications or additions to the vehicle?"),
  },
  {
    id: "insurance-available",
    section: loc("Insurance & servicing", "[MS] Insurance & servicing", "[TA] Insurance & servicing", "[ZH] Insurance & servicing"),
    prompt: loc("Is vehicle insurance information available at the time of incident?", "[MS] Is vehicle insurance information available at the time of incident?", "[TA] Is vehicle insurance information available at the time of incident?", "[ZH] Is vehicle insurance information available at the time of incident?"),
  },
  {
    id: "servicing-available",
    section: loc("Insurance & servicing", "[MS] Insurance & servicing", "[TA] Insurance & servicing", "[ZH] Insurance & servicing"),
    prompt: loc("Is vehicle servicing information available at the time of incident?", "[MS] Is vehicle servicing information available at the time of incident?", "[TA] Is vehicle servicing information available at the time of incident?", "[ZH] Is vehicle servicing information available at the time of incident?"),
    hint: loc("If not, follow up with affected parties at earliest availability", "[MS] If not, follow up with affected parties at earliest availability", "[TA] If not, follow up with affected parties at earliest availability", "[ZH] If not, follow up with affected parties at earliest availability"),
  },
  {
    id: "vehicle-destination",
    section: loc("Follow-up", "[MS] Follow-up", "[TA] Follow-up", "[ZH] Follow-up"),
    prompt: loc("Where will the vehicle be sent to now?", "[MS] Where will the vehicle be sent to now?", "[TA] Where will the vehicle be sent to now?", "[ZH] Where will the vehicle be sent to now?"),
  },
  {
    id: "other-information",
    section: loc("Follow-up", "[MS] Follow-up", "[TA] Follow-up", "[ZH] Follow-up"),
    prompt: loc("Is there any other relevant information?", "[MS] Is there any other relevant information?", "[TA] Is there any other relevant information?", "[ZH] Is there any other relevant information?"),
  },
];
