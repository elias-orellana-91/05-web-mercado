import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMetrics, getModel, getPrediction, getPrices, getRanking, getSectors, resolveSymbol } from "@/lib/api";
import { clearCache, deps, P3Error } from "@/lib/p3";
import { json, mockP3, prediction } from "./fixtures";

beforeEach(() => {
  clearCache();
  deps.sleep = async () => {};
  process.env.P3_BASE_URL = "http://p3.test";
  process.env.P3_RETRIES = "0";
});
afterEach(() => vi.unstubAllGlobals());

describe("validación de símbolo", () => {
  it("acepta un símbolo conocido sin importar mayúsculas y símbolos con punto", async () => {
    mockP3();
    expect((await resolveSymbol("aapl")).symbol).toBe("AAPL");
    expect((await resolveSymbol("brk.b")).symbol).toBe("BRK.B");
  });

  it.each(["../etc/passwd", "AAPL/../x", "AAPL?x=1", "AAPL#", "A A", "", "ZZZZ", "AAPL%2f", "1AAPL", "a".repeat(40), "AAPL\n", "/metrics/AAPL"])(
    "rechaza %j y NUNCA pide nada distinto de /tickers",
    async (bad) => {
      const { calls } = mockP3();
      const e = (await resolveSymbol(bad).catch((x: unknown) => x)) as P3Error;
      expect(e).toBeInstanceOf(P3Error);
      expect(e.kind).toBe("not_found");
      expect(calls.every((u) => u.pathname === "/tickers")).toBe(true);
    },
  );

  it("las herramientas usan solo el símbolo canónico de la lista en la URL", async () => {
    const { calls } = mockP3();
    await getMetrics("aapl");
    await getPrediction("nvda");
    await getPrices("gs");
    const paths = calls.map((u) => u.pathname);
    expect(paths).toContain("/metrics/AAPL");
    expect(paths).toContain("/predictions/NVDA");
    expect(paths).toContain("/prices/GS");
  });

  it("un símbolo inválido no llega a metrics/prices/predictions", async () => {
    const { calls } = mockP3();
    await expect(getMetrics("../x")).rejects.toBeInstanceOf(P3Error);
    await expect(getPrices("ZZZ")).rejects.toBeInstanceOf(P3Error);
    expect(calls.some((u) => /metrics|prices|predictions/.test(u.pathname))).toBe(false);
  });
});

describe("getters", () => {
  it("ranking pasa los parámetros y valida la forma", async () => {
    const { calls } = mockP3();
    const r = await getRanking("quarter", "sharpe", "asc");
    expect(calls[0]!.searchParams.get("period")).toBe("quarter");
    expect(r.items[0]!.ticker).toBe("GS");
  });

  it("precios vienen en orden cronológico", async () => {
    mockP3();
    const p = await getPrices("AAPL");
    const dates = p.items.map((i) => i.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("sectores y modelo; el modelo NO expone sha256 ni versiones de librerías", async () => {
    mockP3();
    expect((await getSectors()).sectors).toHaveLength(2);
    const m = await getModel();
    expect(m).not.toHaveProperty("sha256");
    expect(m).not.toHaveProperty("library_versions");
    expect(m).not.toHaveProperty("warnings");
  });

  it("incluye in_sample en la predicción", async () => {
    mockP3({ "/predictions/AAPL": () => json(prediction({ in_sample: true })) });
    expect((await getPrediction("AAPL")).in_sample).toBe(true);
  });

  it.each([
    ["/predictions/AAPL", () => getPrediction("AAPL")],
    ["/metrics/AAPL", () => getMetrics("AAPL")],
    ["/prices/AAPL", () => getPrices("AAPL")],
    ["/ranking", () => getRanking("month", "return", "desc")],
    ["/sectors/summary", () => getSectors()],
    ["/model/info", () => getModel()],
    ["/tickers", () => resolveSymbol("AAPL")],
  ])("%s con cuerpo sin los campos esperados -> 'respuesta inesperada'", async (path, call) => {
    for (const body of path === "/tickers" ? [{}, null, { raro: 1 }, "texto"] : [{}, [], null, { raro: 1 }, "texto"]) {
      clearCache();
      mockP3({ [path]: () => json(body) });
      const e = (await call().catch((x: unknown) => x)) as P3Error;
      expect(e).toBeInstanceOf(P3Error);
      expect(e.kind).toBe("unexpected");
      expect(e.message).toMatch(/inesperada/);
    }
  });
});