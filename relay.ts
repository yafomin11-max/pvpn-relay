// ═══ parallelogram.vpn — Deno Deploy релей ═══
// Глупая труба: сайт/приложение → этот релей → воркер (workers.dev).
// Вся логика (JWT, панель, лимиты) остаётся в воркере.
// Релей нужен, потому что российские провайдеры режут TLS к *.workers.dev,
// а deno.dev — нет. Токен панели здесь не нужен и не хранится.

const UPSTREAM = "https://vpn.yafomin11.workers.dev";

const ALLOWED = new Set([
  "https://parallelogram.vpn",
  "https://www.parallelogram.vpn",
  "https://yafomin11-max.github.io",
  "https://parallelogram7.ru",
  "https://pvpn-69j.pages.dev",
  "http://localhost:8901",
  "http://localhost:8000",
  "http://127.0.0.1:8901",
]);

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get("Origin") || "";
  const headers = cors(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers });
  }

  // проксируем только API-пути; прочее — на главную страницу сайта
  const isApi =
    url.pathname.startsWith("/app/") ||
    url.pathname === "/api" ||
    url.pathname === "/";

  if (!isApi) {
    return new Response(null, {
      status: 302,
      headers: { Location: "https://yafomin11-max.github.io/VPN/" },
    });
  }

  // CORS: пропускаем whitelisted-origin и same-origin запросы
  const sameOrigin = origin === url.origin;
  if (origin && !sameOrigin && !ALLOWED.has(origin)) {
    return new Response(
      JSON.stringify({ ok: false, error: "forbidden_origin" }),
      { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  try {
    const upstream = new Request(UPSTREAM + url.pathname + url.search, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    });
    const res = await fetch(upstream);
    const out = new Response(res.body, {
      status: res.status,
      headers: { ...headers, "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
    return out;
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: "relay_upstream_failed" }),
      { status: 502, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
