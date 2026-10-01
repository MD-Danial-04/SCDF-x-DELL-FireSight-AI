import type { MyInfoPerson, MyInfoScope } from "../../types/myinfo";
import { mockSingpassProvider } from "./mockSingpassProvider";

export interface SingpassPersonaSummary {
  id: string;
  label: string;
  caption: string;
}

/**
 * Abstraction over the Singpass MyInfo retrieval. The mock implementation
 * resolves built-in personas locally; a future `live` implementation would
 * drive the MyInfo v4 authorize/token/person flow via the coordinator backend.
 */
export interface SingpassProvider {
  readonly mode: "mock" | "live";
  /**
   * The selectable identities for the login step. For the live provider this
   * is empty (the user authenticates with their own Singpass instead).
   */
  listPersonas(): SingpassPersonaSummary[];
  /**
   * Retrieve a person's MyInfo data. `personaId` identifies the mock identity;
   * `scopes` limits the attributes returned (matching MyInfo consent).
   */
  retrievePerson(
    personaId: string,
    scopes: MyInfoScope[]
  ): Promise<MyInfoPerson>;
}

const singpassMode = (): "mock" | "live" =>
  (import.meta.env.VITE_SINGPASS_MODE as string | undefined) === "live"
    ? "live"
    : "mock";

export function getSingpassProvider(): SingpassProvider {
  // Only the mock provider exists today. A coordinator-backed live provider can
  // be selected here based on `singpassMode()` without touching the UI layer.
  void singpassMode();
  return mockSingpassProvider;
}
