/** Política CSP estricta con nonce por petición (sin 'unsafe-inline'). */
export function buildCsp(nonce: string, isDev = false): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
const BAD_REQUEST_HTML =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Solicitud no válida</title></head>' +
  "<body><h1>Solicitud no válida</h1><p>La dirección pedida no es válida.</p>" +
  '<p><a href="/">Volver al ranking</a></p></body></html>';

/** 400 amigable con las mismas cabeceras de seguridad (página estática: sin scripts ni estilos). */
export function badRequestResponse(): Response {
  return new Response(BAD_REQUEST_HTML, {
    status: 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store",
    },
  });
}