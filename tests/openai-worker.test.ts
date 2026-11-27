import { afterEach, expect, it, vi } from "vitest";
import worker from "../cloudflare/openai-worker.mjs";
import { postOpenAI } from "../src/lib/openai";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const env = { APP_SECRET: "app-secret", OPENAI_API_KEY: "provider-secret" };
it.each(["responses", "chat/completions"] as const)("Worker를 통해 %s 호출을 인증한다", async endpoint => {
  vi.stubEnv("OPENAI_WORKER_URL", "https://test.example");
  vi.stubEnv("OPENAI_WORKER_SECRET", env.APP_SECRET);
  const upstream = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url.startsWith("https://api.openai.com/")) return upstream(url, init);
    expect(url).toBe("https://test.example/v1/" + endpoint);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer app-secret");
    return worker.fetch(new Request(url, init), env);
  });
  expect((await postOpenAI(endpoint, "{}", AbortSignal.timeout(1000))).status).toBe(200);
  expect(upstream.mock.calls[0][0]).toBe("https://api.openai.com/v1/" + endpoint);
  expect(new Headers(upstream.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer provider-secret");
});
it("인증되지 않은 요청은 OpenAI를 호출하기 전에 거절한다", async () => {
  const send = vi.fn();
  vi.stubGlobal("fetch", send);
  expect((await worker.fetch(new Request("https://example.org/v1/responses", { method: "POST" }), env)).status).toBe(401);
  expect(send).not.toHaveBeenCalled();
});
