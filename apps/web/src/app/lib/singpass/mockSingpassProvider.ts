import {
  SINGPASS_PERSONAS,
  getPersonaById,
} from "../../constants/singpassPersonas";
import type { MyInfoPerson, MyInfoScope } from "../../types/myinfo";
import type {
  SingpassPersonaSummary,
  SingpassProvider,
} from "./SingpassProvider";

const SIMULATED_DELAY_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Returns a copy of `person` limited to the consented `scopes`. */
function filterToScopes(
  person: MyInfoPerson,
  scopes: MyInfoScope[]
): MyInfoPerson {
  const allowed = new Set<string>(scopes);
  // uinfin is always present so the record stays identifiable.
  allowed.add("uinfin");
  allowed.add("name");

  const filtered = { uinfin: person.uinfin, name: person.name } as MyInfoPerson;
  for (const key of Object.keys(person) as (keyof MyInfoPerson)[]) {
    if (allowed.has(key)) {
      (filtered as Record<string, unknown>)[key] = person[key];
    }
  }
  return filtered;
}

export const mockSingpassProvider: SingpassProvider = {
  mode: "mock",

  listPersonas(): SingpassPersonaSummary[] {
    return SINGPASS_PERSONAS.map(({ id, label, caption }) => ({
      id,
      label,
      caption,
    }));
  },

  async retrievePerson(
    personaId: string,
    scopes: MyInfoScope[]
  ): Promise<MyInfoPerson> {
    await delay(SIMULATED_DELAY_MS);
    const persona = getPersonaById(personaId);
    if (!persona) {
      throw new Error("Unknown Singpass persona");
    }
    return filterToScopes(persona.person, scopes);
  },
};
