// Prueba opcional contra una P3 REAL (se omite sin P3_E2E_URL):
//   P3_E2E_URL=http://127.0.0.1:8765 npm run test:e2e
import { describe, expect, it } from "vitest";
import { getMetrics, getModel, getPrediction, getPrices, getRanking, getSectors, getTickers, resolveSymbol } from "@/lib/api";

const url = process.env.P3_E2E_URL;
if (url) process.env.P3_BASE_URL = url;

describe.skipIf(!url)("contra P3 real", () => {
  it("las formas de respuesta reales cumplen los esquemas", async () => {
    const tickers = await getTickers();
    expect(tickers.length).toBeGreaterThan(5);
    const sym = tickers[0]!.symbol;
    expect((await getRanking("month", "return", "desc")).items.length).toBeGreaterThan(0);
    expect((await getMetrics(sym)).n_days).toBeGreaterThan(10);
    expect((await getPrices(sym)).items.length).toBeGreaterThan(10);
    expect(typeof (await getPrediction(sym)).in_sample).toBe("boolean");
    expect((await getSectors()).sectors.length).toBeGreaterThan(0);
    expect((await getModel()).features.length).toBeGreaterThan(0);
  });
  it("símbolo inventado -> not_found sin pedir más rutas", async () => {
    await expect(resolveSymbol("ZZZZ")).rejects.toMatchObject({ kind: "not_found" });
  });
});