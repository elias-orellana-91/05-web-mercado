import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PredictionCard } from "@/components/PredictionCard";
import { PriceChart } from "@/components/PriceChart";
import { ProblemPanel } from "@/components/ProblemPanel";
import { headline, RankingTable } from "@/components/RankingTable";
import { clearCache, deps, P3Error } from "@/lib/p3";
import { predictionSchema, rankingSchema } from "@/lib/schemas";
import { errBody, item, json, mockP3, prediction, prices, ranking } from "./fixtures";

const ESC = String.fromCharCode(27);

beforeEach(() => {
  clearCache();
  deps.sleep = async () => {};
  process.env.P3_BASE_URL = "http://p3.test";
  process.env.P3_RETRIES = "0";
});
afterEach(() => vi.unstubAllGlobals());

describe("PredictionCard", () => {
  it("muestra el aviso in_sample de forma visible (role=alert) cuando corresponde", () => {
    render(<PredictionCard p={predictionSchema.parse(prediction({ in_sample: true }))} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/muestra de entrenamiento/);
    expect(alert).toHaveTextContent(/no es una predicción fuera de muestra/);
  });
  it("sin in_sample no muestra ese aviso, pero siempre avisa de no-asesoría", () => {
    render(<PredictionCard p={predictionSchema.parse(prediction())} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/62\s?%/)).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/No es asesoría ni recomendación de inversión/);
  });
});

describe("PriceChart", () => {
  const points = prices(30).items.reverse();
  it("es accesible: imagen con título descriptivo y tabla alternativa", () => {
    const { container } = render(<PriceChart symbol="AAPL" points={points} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg.querySelector("title")!.textContent).toMatch(/Cierre ajustado de AAPL/);
    const table = screen.getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(31);
    expect(container.querySelector("[style]")).toBeNull(); // sin estilos en línea (CSP)
  });
  it("con menos de 2 puntos no rompe", () => {
    render(<PriceChart symbol="AAPL" points={points.slice(0, 1)} />);
    expect(screen.getByText(/No hay suficientes precios/)).toBeInTheDocument();
  });
  it("no rompe con precios planos (rango 0)", () => {
    const flat = points.map((p) => ({ ...p, close: 100 }));
    const { container } = render(<PriceChart symbol="AAPL" points={flat} />);
    expect(container.querySelector("polyline")!.getAttribute("points")).not.toMatch(/NaN/);
  });
});

describe("RankingTable", () => {
  it("renderiza filas con enlaces codificados y encabezados de tabla", () => {
    render(<RankingTable ranking={rankingSchema.parse(ranking())} />);
    expect(screen.getByRole("link", { name: "GS" })).toHaveAttribute("href", "/ticker/GS");
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
    expect(screen.getByText(/\+7,6\s?%/)).toBeInTheDocument();
  });
  it("escapa/sanea texto hostil de la API (nada se interpreta como HTML)", () => {
    const evil = ranking({ items: [item(1, "GS", 0.1)] });
    evil.items[0]!.name = `<img src=x onerror=alert(1)>${ESC}[31m`;
    const { container } = render(<RankingTable ranking={rankingSchema.parse(evil)} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toContain(ESC);
    expect(container.textContent).toContain("<img src=x");
  });
  it("titular neutral según orden y métrica", () => {
    expect(headline(rankingSchema.parse(ranking()))).toBe("Mayor retorno del mes");
    expect(headline(rankingSchema.parse(ranking({ order: "asc", metric: "volatility" })))).toBe(
      "Menor volatilidad anualizada del mes",
    );
  });
  it("sin datos muestra mensaje", () => {
    render(<RankingTable ranking={rankingSchema.parse(ranking({ items: [], best: null }))} />);
    expect(screen.getByText(/No hay datos suficientes/)).toBeInTheDocument();
  });
});

describe("ProblemPanel", () => {
  it.each(["unavailable", "timeout", "server"] as const)("%s: estado de reintento", (kind) => {
    render(<ProblemPanel error={new P3Error(kind, "x")} path="/modelo" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Reintentar/ })).toHaveAttribute("href", "/modelo");
  });
  it("nunca muestra mensajes internos ni trazas; un error desconocido es 'respuesta inesperada'", () => {
    render(<ProblemPanel error={new Error("Traceback secreto at C:\\app")} />);
    expect(document.body).toHaveTextContent(/Respuesta inesperada/);
    expect(document.body).not.toHaveTextContent(/secreto/);
  });
  it("muestra el id de petición cuando existe", () => {
    render(<ProblemPanel error={new P3Error("server", "x", 500, "c", "rid-9")} />);
    expect(screen.getByText(/rid-9/)).toBeInTheDocument();
  });
});

describe("páginas (servidor, con P3 simulada)", () => {
  it("home: ranking por defecto y parámetros inválidos vuelven al valor por defecto", async () => {
    const { default: Home } = await import("@/app/(inicio)/page");
    const { calls } = mockP3();
    render(await Home({ searchParams: Promise.resolve({ period: "DROP TABLE", metric: ["sharpe"], order: "zzz" }) }));
    const q = calls.find((u) => u.pathname === "/ranking")!.searchParams;
    expect([q.get("period"), q.get("metric"), q.get("order")]).toEqual(["month", "sharpe", "desc"]);
    expect(screen.getByRole("heading", { name: /Mayor Sharpe del mes/ })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/no un juicio de calidad/);
  });

  it("home: P3 caída -> estado amigable, no excepción", async () => {
    const { default: Home } = await import("@/app/(inicio)/page");
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    render(await Home({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/no responde/);
    expect(screen.getByRole("link", { name: /Reintentar/ })).toBeInTheDocument();
  });

  it("ficha: muestra gráfico, métricas, predicción con in_sample y avisos", async () => {
    const { default: Ticker } = await import("@/app/ticker/[symbol]/page");
    mockP3({ "/predictions/AAPL": () => json(prediction({ in_sample: true })) });
    render(await Ticker({ params: Promise.resolve({ symbol: "aapl" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("AAPL");
    expect(document.querySelector("svg[role=img]")).not.toBeNull();
    expect(document.body).toHaveTextContent(/Volatilidad anualizada/);
    expect(document.body).toHaveTextContent(/dentro de la muestra de entrenamiento/);
    expect(document.body).toHaveTextContent(/No es asesoría ni recomendación de inversión/);
  });

  it("ficha: si falla solo la predicción, el resto se muestra", async () => {
    const { default: Ticker } = await import("@/app/ticker/[symbol]/page");
    mockP3({ "/predictions/AAPL": () => json(errBody("model_unavailable", "Modelo no disponible."), 503) });
    render(await Ticker({ params: Promise.resolve({ symbol: "AAPL" }) }));
    expect(document.querySelector("svg[role=img]")).not.toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("ficha: símbolo inexistente o malicioso -> notFound (404) sin pedir nada más a P3", async () => {
    const { default: Ticker } = await import("@/app/ticker/[symbol]/page");
    for (const symbol of ["ZZZZ", "..%2F..%2Fetc", "AAPL%3Fx%3D1", "%E0%A4%A"]) {
      const { calls } = mockP3();
      await expect(Ticker({ params: Promise.resolve({ symbol }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
      expect(calls.every((u) => u.pathname === "/tickers")).toBe(true);
    }
  });

  it("sectores y modelo: render y datos públicos únicamente", async () => {
    const { default: Sectores } = await import("@/app/sectores/page");
    const { default: Modelo } = await import("@/app/modelo/page");
    mockP3();
    const a = render(await Sectores());
    expect(screen.getByRole("columnheader", { name: /Retorno total/ })).toBeInTheDocument();
    a.unmount();
    render(await Modelo());
    expect(document.body).toHaveTextContent(/roc_auc/);
    expect(document.body).not.toHaveTextContent(/deadbeef|numpy/);
  });
});
