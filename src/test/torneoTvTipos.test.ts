import { describe, expect, it } from "vitest";
import { TIPOS_TORNEO_TV } from "@/lib/torneoTvTipos";

describe("tipos de torneo disponibles en TV conjunta", () => {
  it("incluye torneos oficiales y americanos individuales", () => {
    expect(TIPOS_TORNEO_TV).toContain("oficial");
    expect(TIPOS_TORNEO_TV).toContain("americano_individual");
  });
});
