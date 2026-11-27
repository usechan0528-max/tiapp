const routes = new Set(["/v1/responses", "/v1/chat/completions"]);

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!routes.has(path)) return new Response(null, { status: 404 });
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    if (!env.APP_SECRET || !env.OPENAI_API_KEY) return new Response(null, { status: 503 });
    if (request.headers.get("Authorization") !== "Bearer " + env.APP_SECRET) {
      return new Response(null, { status: 401 });
    }
    const result = await fetch("https://api.openai.com" + path, {
      method: "POST",
      redirect: "manual",
      headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: request.body,
    });
    return new Response(result.body, {
      status: result.status,
      headers: { "Content-Type": result.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" },
    });
  },
};
