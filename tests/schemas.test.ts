import { describe, expect, it } from "vitest";
import { modelSchema, predictionSchema, rankingSchema } from "@/lib/schemas";
import { model, prediction, ranking } from "./fixtures";

describe("esquemas", () => {
  it("ranking válido pasa; valores fuera de lo permitido fallan", () => {
    expect(rankingSchema.safeParse(ranking()).success).toBe(true);
    expect(rankingSchema.safeParse(ranking({ metric: "otra" })).success).toBe(false);
    expect(rankingSchema.safeParse(ranking({ items: [{ rank: "1" }] })).success).toBe(false);
    expect(rankingSchema.safeParse(ranking({ start: "ayer" })).success).toBe(false);
  });

  it("ranking admite value nulo y best nulo", () => {
    expect(rankingSchema.safeParse(ranking({ best: null, items: [] })).success).toBe(true);
  });

  it("predicción: probabilidad fuera de [0,1], NaN o in_sample ausente fallan", () => {
    expect(predictionSchema.safeParse(prediction()).success).toBe(true);
    expect(predictionSchema.safeParse(prediction({ probability_high_vol: 1.5 })).success).toBe(false);
    expect(predictionSchema.safeParse(prediction({ probability_high_vol: NaN })).success).toBe(false);
    const { in_sample: _drop, ...sin } = prediction();
    void _drop;
    expect(predictionSchema.safeParse(sin).success).toBe(false);
  });

  it("textos con largo desmesurado fallan", () => {
    expect(rankingSchema.safeParse(ranking({ items: [{ rank: 1, ticker: "X".repeat(500), name: "n", sector: "s", value: 1 }] })).success).toBe(false);
  });

  it("modelo: descarta campos sensibles", () => {
    const r = modelSchema.parse(model);
    expect(Object.keys(r)).not.toContain("sha256");
    expect(Object.keys(r)).not.toContain("library_versions");
  });
});