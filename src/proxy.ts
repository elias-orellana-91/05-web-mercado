import { NextResponse, type NextRequest } from "next/server";
import { badRequestResponse, buildCsp } from "@/lib/csp";

/** Ruta con codificación porcentual inválida (p. ej. /ticker/%zz): Next respondería 500 en texto plano. */
function hasBadEncoding(request: NextRequest): boolean {
  try {
    decodeURIComponent(new URL(request.url).pathname);
    return false;
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  if (hasBadEncoding(request)) return badRequestResponse();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};