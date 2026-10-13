import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache, deps, p3Get, P3Error } from "@/lib/p3";
import { errBody, json, mockP3, TICKERS } from "./fixtures";

beforeEach(() => {
  clearCache();
  deps.sleep = async () => {};
  process.env.P3_BASE_URL = "http://p3.test";
  process.env.P3_RETRIES = "2";
  delete process.env.P3_TIMEOUT_MS;
  delete process.env.P3_API_KEY;
});
afterEach(() => vi.unstubAllGlobals());

const kind = async (p: Promise<unknown>) => (await p.catch((e: unknown) => e)) as P3Error;

describe("p3Get", () => {
  it("devuelve el JSON y cachea solo respuestas correctas (ttl)", async () => {
    const { fn } = mockP3();
    expect(await p3Get("/tickers", { ttlMs: 1000 })).toEqual(TICKERS);
    await p3Get("/tickers", { ttlMs: 1000 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("envía Accept-Encoding: identity y X-API-Key solo si hay clave", async () => {
    const { fn } = mockP3();
    await p3Get("/tickers");
    const h1 = (fn.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(h1["Accept-Encoding"]).toBe("identity");
    expect(h1["X-API-Key"]).toBeUndefined();
    process.env.P3_API_KEY = "SECRETA";
    await p3Get("/ranking");
    const h2 = (fn.mock.calls[1]![1] as RequestInit).headers as Record<string, string>;
    expect(h2["X-API-Key"]).toBe("SECRETA");
  });

  it("no sigue redirecciones (la clave no viaja a otro host)", async () => {
    const { fn } = mockP3();
    await p3Get("/tickers");
    expect((fn.mock.calls[0]![1] as RequestInit).redirect).toBe("error");
  });

  it("traduce el sobre de error de P3 y sanea el mensaje", async () => {
    mockP3({ "/ranking": () => json(errBody("invalid_range\n\x1b[31m", "malo\u202e\nfake"), 422) });
    const e = await kind(p3Get("/ranking"));
    expect(e).toBeInstanceOf(P3Error);
    expect(e.kind).toBe("invalid");
    expect(e.requestId).toBe("rid-1");
    expect(`${e.code}${e.message}`).not.toMatch(/[\n\x1b\u202e]/);
  });

  it("404 -> not_found, 429 -> rate_limited con Retry-After, sin reintento", async () => {
    const m404 = mockP3({ "/x": () => json(errBody("not_found", "no"), 404) });
    expect((await kind(p3Get("/x"))).kind).toBe("not_found");
    expect(m404.fn).toHaveBeenCalledTimes(1);
    const m429 = mockP3({ "/x": () => json(errBody("rate_limited", "x"), 429, { "retry-after": "30" }) });
    const e = await kind(p3Get("/x"));
    expect(e.kind).toBe("rate_limited");
    expect(e.retryAfter).toBe(30);
    expect(m429.fn).toHaveBeenCalledTimes(1);
  });

  it("reintenta 503 de forma acotada y luego tiene éxito", async () => {
    let n = 0;
    const { fn } = mockP3({ "/x": () => (++n < 3 ? json(errBody("database_unavailable", "x"), 503) : json({ ok: 1 })) });
    expect(await p3Get("/x")).toEqual({ ok: 1 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("503 persistente: error 'server' tras agotar los reintentos (3 intentos)", async () => {
    const { fn } = mockP3({ "/x": () => json(errBody("model_unavailable", "x"), 503) });
    const e = await kind(p3Get("/x"));
    expect(e.kind).toBe("server");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("API caída (fetch lanza) -> unavailable, con reintentos", async () => {
    const fn = vi.fn(async () => { throw new TypeError("fetch failed"); });
    vi.stubGlobal("fetch", fn);
    const e = await kind(p3Get("/x"));
    expect(e.kind).toBe("unavailable");
    expect(e.message).not.toMatch(/fetch failed/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("plazo total: una respuesta que nunca llega termina en 'timeout'", async () => {
    process.env.P3_TIMEOUT_MS = "1000";
    vi.stubGlobal("fetch", (_u: unknown, init: RequestInit) =>
      new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(init.signal!.reason))));
    const t0 = Date.now();
    const e = await kind(p3Get("/x"));
    expect(e.kind).toBe("timeout");
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("respuesta goteante: se corta por el plazo total aunque lleguen trozos", async () => {
    process.env.P3_TIMEOUT_MS = "1000";
    vi.stubGlobal("fetch", async () => {
      const body = new ReadableStream<Uint8Array>({
        async pull(c) { await new Promise((r) => setTimeout(r, 200)); c.enqueue(new Uint8Array([32])); },
      });
      return new Response(body, { status: 200 });
    });
    const e = await kind(p3Get("/x"));
    expect(e.kind).toBe("timeout");
  });

  it("tope de tamaño: cuerpo infinito se aborta sin leerlo entero", async () => {
    let chunks = 0;
    vi.stubGlobal("fetch", async () => new Response(new ReadableStream<Uint8Array>({
      pull(c) { chunks++; c.enqueue(new Uint8Array(100_000)); },
    })));
    const e = await kind(p3Get("/x"));
    expect(e.kind).toBe("too_large");
    expect(chunks).toBeLessThan(40);
  });

  it("Content-Length enorme se rechaza sin leer el cuerpo", async () => {
    let pulled = false;
    vi.stubGlobal("fetch", async () => new Response(new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 }), { headers: { "content-length": "999999999" } }));
    expect((await kind(p3Get("/x"))).kind).toBe("too_large");
    expect(pulled).toBe(false);
  });

  it("rechaza Content-Encoding distinto de identity (bomba de descompresión)", async () => {
    let pulled = false;
    vi.stubGlobal("fetch", async () => new Response(new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 }), { headers: { "content-encoding": "gzip" } }));
    const e = await kind(p3Get("/x"));
    expect(e.kind).toBe("unexpected");
    expect(pulled).toBe(false);
  });

  it.each([["", "vacío"], ["<html>", "no JSON"]])("cuerpo %j (%s) -> unexpected", async (body) => {
    vi.stubGlobal("fetch", async () => new Response(body, { status: 200 }));
    expect((await kind(p3Get("/x"))).kind).toBe("unexpected");
  });

  it("configuración inválida -> error 'config' sin llamar a la red", async () => {
    const { fn } = mockP3();
    for (const bad of ["ftp://x", "http://u:p@h", "http://h\r\nX: 1", "no es url"]) {
      process.env.P3_BASE_URL = bad;
      expect((await kind(p3Get("/tickers"))).kind).toBe("config");
    }
    expect(fn).not.toHaveBeenCalled();
  });
});