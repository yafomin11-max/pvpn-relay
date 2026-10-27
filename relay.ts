// ═══ parallelogram.vpn — Deno Deploy релей v2 ═══
// 1) /app/*, /api → воркер (логика и секреты там)
// 2) /subproxy?url= → скачивание подписки панели (телефон не достаёт до h1clayd.click)
// 3) прочее → редирект на сайт

const UPSTREAM = "https://vpn.yafomin11.workers.dev";

const ALLOWED = new Set([
  "https://parallelogram.vpn",
  "https://www.parallelogram.vpn",
  "https://yafomin11-max.github.io",
  "https://parallelogram7.ru",
  "http://localhost:8901",
  "http://localhost:8000",
  "http://127.0.0.1:8901",
]);

// хосты, с которых релей может скачать подписку
const SUB_HOSTS = ["h1clayd.click", "h1cloud.net", "h1cloud.ru"];

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get("Origin") || "";
  const headers = cors(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // ── прокси подписки: только доверенные хосты панели ──
  if (url.pathname === "/subproxy") {
    const target = url.searchParams.get("url") || "";
    let host = "";
    try {
      host = new URL(target).hostname;
    } catch (_e) {
      return new Response(JSON.stringify({ ok: false, error: "bad_url" }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!SUB_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
      return new Response(JSON.stringify({ ok: false, error: "host_not_allowed" }), {
        status: 403, headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    try {
      const res = await fetch(target, {
        headers: { "User-Agent": "parallelogram-vpn-app" },
      });
      return new Response(res.body, {
        status: res.status,
        headers: { ...headers, "Content-Type": res.headers.get("Content-Type") || "text/plain" },
      });
    } catch (_e) {
      return new Response(JSON.stringify({ ok: false, error: "sub_fetch_failed" }), {
        status: 502, headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  }

  // ── API воркера ──
  const isApi = url.pathname.startsWith("/app/") || url.pathname === "/api" || url.pathname === "/";

  if (!isApi) {
    return new Response(null, {
      status: 302,
      headers: { Location: "https://yafomin11-max.github.io/VPN/" },
    });
  }

  const sameOrigin = origin === url.origin;
  if (origin && !sameOrigin && !ALLOWED.has(origin)) {
    return new Response(
      JSON.stringify({ ok: false, error: "forbidden_origin" }),
      { status: 403, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  try {
    const upstream = new Request(UPSTREAM + url.pathname + url.search, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    });
    const res = await fetch(upstream);
    return new Response(res.body, {
      status: res.status,
      headers: { ...headers, "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
  } catch (_e) {
    return new Response(
      JSON.stringify({ ok: false, error: "relay_upstream_failed" }),
      { status: 502, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
