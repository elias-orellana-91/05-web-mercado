// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const req = (path: string) => new NextRequest(`http://localhost:3000${path}`);

describe("proxy.ts (B2: rutas con codificación inválida)", () => {
  it.each(["/ticker/%", "/ticker/%zz", "/ticker/%E0%A4%A", "/%", "/modelo/%zz"])("%s -> 400 amigable con cabeceras de seguridad", async (p) => {
    const res = await proxy(req(p));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    const body = await res.text();
    expect(body).toMatch(/Solicitud no válida/);
    expect(body).not.toMatch(/Internal Server Error|Error:|at .*\.(js|ts)/);
  });

  it.each(["/", "/ticker/AAPL", "/ticker/BRK.B", "/ticker/%41APL", "/?period=month"])("%s válida -> sigue con CSP con nonce", (p) => {
    const res = proxy(req(p));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(res.headers.get("content-security-policy")).not.toContain("unsafe-inline");
  });
});