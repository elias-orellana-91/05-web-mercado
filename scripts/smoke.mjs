// Humo contra la web YA levantada (npm run build && npm start) y una P3 real:
//   WEB_URL=http://127.0.0.1:3000 npm run smoke      (se omite sin WEB_URL)
const base = process.env.WEB_URL;
if (!base) {
  console.log("smoke: omitido (define WEB_URL).");
  process.exit(0);
}
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "OK  " : "FALLA"} ${msg}`);
  if (!ok) failed++;
};
const get = async (p) => {
  // fetch normaliza URLs: las rutas con % inválido se piden tal cual con http.request
  if (/%(?![0-9A-Fa-f]{2})/.test(p)) {
    const { request } = await import("node:http");
    const u = new URL(base);
    return await new Promise((resolve, reject) => {
      const req = request({ host: u.hostname, port: u.port, path: p, method: "GET" }, (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ r: { status: res.statusCode, headers: new Headers(Object.entries(res.headers).map(([k, v]) => [k, String(v)])) }, text }));
      });
      req.on("error", reject);
      req.end();
    });
  }
  const r = await fetch(base + p, { redirect: "manual" });
  return { r, text: await r.text() };
};

for (const [path, expected] of [["/", 200], ["/sectores", 200], ["/modelo", 200], ["/ticker/AAPL", 200], ["/ticker/ZZZZ", 404], ["/ticker/%zz", 400], ["/ticker/%", 400], ["/icon.svg", 200], ["/ticker/..%2F..%2Fetc", 404], ["/?period=zzz&metric=%3Cscript%3E", 200]]) {
  const { r, text } = await get(path);
  check(r.status === expected, `${path} -> ${r.status} (esperado ${expected})`);
  if (r.status === 400) {
    check(r.headers.get("x-content-type-options") === "nosniff" && /text\/html/.test(r.headers.get("content-type") ?? ""), `${path} 400 con nosniff y HTML`);
  }
  if (r.status === 200 && !path.endsWith(".svg")) {
    check(!/Traceback|at .*\.(js|ts):\d+/.test(text), `${path} sin trazas`);
    check(!text.includes("dangerouslySetInnerHTML"), `${path} sin dangerouslySetInnerHTML`);
  }
}
const { r, text } = await get("/");
const csp = r.headers.get("content-security-policy") ?? "";
check(/'nonce-[^']+'/.test(csp) && !csp.includes("unsafe-inline"), "CSP con nonce y sin unsafe-inline");
check(csp.includes("frame-ancestors 'none'"), "CSP frame-ancestors none");
check(r.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options nosniff");
check(r.headers.get("referrer-policy") === "no-referrer", "Referrer-Policy no-referrer");
check(!r.headers.has("x-powered-by"), "sin X-Powered-By");
check(!/P3_API_KEY|NEXT_PUBLIC/.test(text), "HTML sin nombres de variables secretas");
const p3 = process.env.P3_BASE_URL_PUBLIC_CHECK;
if (p3) check(!text.includes(p3), "el HTML no contiene la URL real de P3");
process.exit(failed ? 1 : 0);