import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";
import { getConfig } from "@/lib/env";
import { day, num, numericEntries, pct } from "@/lib/format";
import { clean } from "@/lib/text";

describe("csp", () => {
  it("es estricta: nonce, sin unsafe-inline ni unsafe-eval en producción, frame-ancestors none", () => {
    const csp = buildCsp("abc123");
    expect(csp).toContain("'nonce-abc123'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });
  it("solo en desarrollo permite unsafe-eval", () => {
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
    expect(buildCsp("n", true)).not.toContain("unsafe-inline");
  });
});

describe("env", () => {
  it("valores por defecto y rangos", () => {
    const c = getConfig({});
    expect(c).toMatchObject({ baseUrl: "http://127.0.0.1:8000", timeoutMs: 8000, retries: 2, apiKey: undefined });
    expect(getConfig({ P3_BASE_URL: "https://x.onrender.com/", P3_API_KEY: " k " })).toMatchObject({ baseUrl: "https://x.onrender.com", apiKey: "k" });
  });
  it.each([
    { P3_TIMEOUT_MS: "5" }, { P3_TIMEOUT_MS: "abc" }, { P3_TIMEOUT_MS: "999999" }, { P3_RETRIES: "-1" }, { P3_RETRIES: "9" },
    { P3_RETRIES: "1.5" }, { P3_BASE_URL: "ftp://h" }, { P3_BASE_URL: "http://u:p@h" }, { P3_BASE_URL: "http://h\r\nX: 1" },
  ])("rechaza %j", (env) => {
    expect(() => getConfig(env)).toThrow();
  });
});

describe("texto y formato", () => {
  it("clean elimina control/bidi, acota y muestra n/d para null y estructuras", () => {
    expect(clean("a\u202eb\u2028c\u200bd\x1be")).toBe("a b c d e");
    expect(clean("x".repeat(500), 10)).toHaveLength(10);
    expect(clean(null)).toBe("n/d");
    expect(clean([null])).toBe("n/d");
    expect(clean({ a: 1 })).toBe("n/d");
  });
  it("pct/num/day toleran valores no numéricos", () => {
    expect(pct(0.076)).toMatch(/^\+7,6\s?%$/);
    expect(pct(-0.0306)).toMatch(/^-3,1\s?%$/);
    expect(pct(0.62, 0, false)).toMatch(/^62\s?%$/);
    expect(pct(null)).toBe("n/d");
    expect(pct("x")).toBe("n/d");
    expect(num(NaN)).toBe("n/d");
    expect(num(1234.5)).toMatch(/1\.?234,50/);
    expect(day("2025-12-30\n<x>")).toBe("2025-12-30");
  });
  it("numericEntries descarta lo que no es número y acota", () => {
    expect(numericEntries({ a: 1, b: "x", c: null, d: NaN, e: 2 })).toEqual([["a", 1], ["e", 2]]);
  });
});