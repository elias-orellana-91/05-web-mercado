import { render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PriceChart } from "@/components/PriceChart";
import { ProblemPanel } from "@/components/ProblemPanel";
import { getRanking } from "@/lib/api";
import { clearCache, deps, P3Error } from "@/lib/p3";
import { attemptFrom, MAX_AUTO_RETRIES, withAttempt } from "@/lib/retry";
import { rankingSchema } from "@/lib/schemas";
import { item, json, mockP3, ranking } from "./fixtures";

beforeEach(() => {
  clearCache();
  deps.sleep = async () => {};
  process.env.P3_BASE_URL = "http://p3.test";
  process.env.P3_RETRIES = "0";
});
afterEach(() => vi.unstubAllGlobals());

describe("B1: la caché solo guarda respuestas ya validadas", () => {
  it("200 malformado y luego corregido -> la siguiente petición ya muestra datos (sin esperar el TTL)", async () => {
    let good = false;
    const { fn } = mockP3({ "/ranking": () => (good ? json(ranking()) : json({ raro: true })) });
    await expect(getRanking("month", "return", "desc")).rejects.toMatchObject({ kind: "unexpected" });
    good = true;
    const r = await getRanking("month", "return", "desc");
    expect(r.items[0]!.ticker).toBe("GS");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("una respuesta válida sí se cachea (una sola llamada)", async () => {
    const { fn } = mockP3();
    await getRanking("month", "return", "desc");
    await getRanking("month", "return", "desc");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("también con tipos incorrectos y campos de más/menos", async () => {
    let n = 0;
    const { fn } = mockP3({ "/ranking": () => (++n === 1 ? json(ranking({ items: "no" })) : json(ranking())) });
    await expect(getRanking("month", "return", "desc")).rejects.toBeInstanceOf(P3Error);
    await expect(getRanking("month", "return", "desc")).resolves.toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("menores", () => {
  it("favicon propio (icon.svg) sin recursos externos, ni scripts ni fuentes", () => {
    expect(existsSync("src/app/icon.svg")).toBe(true);
    const svg = readFileSync("src/app/icon.svg", "utf8");
    expect(svg).toMatch(/^<svg /);
    expect(svg).not.toMatch(/<script|<style|font|href=|url\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  });

  it("PriceChart con serie plana: keys únicas (sin aviso de React) y sin NaN", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const flat = Array.from({ length: 10 }, (_, i) => ({ date: `2025-12-${String(i + 1).padStart(2, "0")}`, close: 100 }));
    const { container } = render(<PriceChart symbol="FLAT" points={flat} />);
    expect(container.querySelectorAll("g")).toHaveLength(3);
    expect(container.innerHTML).not.toMatch(/NaN/);
    expect(err.mock.calls.flat().join(" ")).not.toMatch(/same key|unique "key"/i);
    err.mockRestore();
  });

  it("los esquemas limpian bidi/ANSI/invisibles antes de que el texto llegue a los componentes (y al payload RSC)", () => {
    const esc = String.fromCharCode(27);
    const dirty = ranking({ items: [item(1, "GS", 0.1)] });
    dirty.items[0]!.name = `Evil\u202e${esc}[31m\u200bCo\nrp`;
    const parsed = rankingSchema.parse(dirty);
    expect(parsed.items[0]!.name).toBe("Evil  [31m Co rp");
    expect(JSON.stringify(parsed)).not.toMatch(/[\u202e\u200b\u001b]/);
  });
});

describe("límite de refrescos automáticos", () => {
  const meta = () => document.head.querySelector('meta[http-equiv="refresh"]');

  it("attemptFrom/withAttempt: valores raros cuentan como 0 y se acotan", () => {
    expect(attemptFrom(undefined)).toBe(0);
    expect(attemptFrom("abc")).toBe(0);
    expect(attemptFrom("-1")).toBe(0);
    expect(attemptFrom("1e3")).toBe(0);
    expect(attemptFrom("999")).toBe(MAX_AUTO_RETRIES);
    expect(attemptFrom(["3", "9"])).toBe(3);
    expect(withAttempt("/modelo", 2)).toBe("/modelo?r=2");
    expect(withAttempt("/?period=ytd", 2)).toBe("/?period=ytd&r=2");
    expect(withAttempt("/modelo", 0)).toBe("/modelo");
  });

  it("intentos 0..N-1: meta refresh con contador creciente", () => {
    const { unmount } = render(<ProblemPanel error={new P3Error("unavailable", "x")} path="/modelo" attempt={0} />);
    expect(meta()?.getAttribute("content")).toBe("20;url=/modelo?r=1");
    unmount();
    render(<ProblemPanel error={new P3Error("timeout", "x")} path="/modelo" attempt={MAX_AUTO_RETRIES - 1} />);
    expect(meta()?.getAttribute("content")).toBe(`20;url=/modelo?r=${MAX_AUTO_RETRIES}`);
  });

  it("al llegar al máximo: sin meta refresh y con mensaje estático; el botón manual reinicia el contador", () => {
    render(<ProblemPanel error={new P3Error("unavailable", "x")} path="/?period=ytd" attempt={MAX_AUTO_RETRIES} />);
    expect(meta()).toBeNull();
    expect(document.body).toHaveTextContent(/Se agotaron los reintentos automáticos/);
    expect(screen.getByRole("link", { name: /Reintentar ahora/ })).toHaveAttribute("href", "/?period=ytd");
  });

  it("429 no se refresca solo; errores no transitorios tampoco", () => {
    const { unmount } = render(<ProblemPanel error={new P3Error("rate_limited", "x")} path="/" attempt={0} />);
    expect(meta()).toBeNull();
    unmount();
    render(<ProblemPanel error={new P3Error("unexpected", "x")} path="/" attempt={0} />);
    expect(meta()).toBeNull();
    expect(document.body).not.toHaveTextContent(/Se agotaron/);
  });

  it("en una página real: con ?r=5 y P3 caída ya no hay meta refresh", async () => {
    const { default: Sectores } = await import("@/app/sectores/page");
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const a = render(await Sectores({ searchParams: Promise.resolve({ r: "0" }) }));
    expect(meta()?.getAttribute("content")).toBe("20;url=/sectores?r=1");
    a.unmount();
    render(await Sectores({ searchParams: Promise.resolve({ r: "5" }) }));
    expect(meta()).toBeNull();
    expect(document.body).toHaveTextContent(/Se agotaron/);
  });
});