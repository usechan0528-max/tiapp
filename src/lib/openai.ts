export function hasModelCredentials() {
  return Boolean(process.env.OPENAI_WORKER_URL ? process.env.OPENAI_WORKER_SECRET : process.env.OPENAI_API_KEY);
}

export async function postOpenAI(endpoint: "responses" | "chat/completions", body: string, signal: AbortSignal) {
  const worker = process.env.OPENAI_WORKER_URL;
  const origin = new URL(worker || "https://api.openai.com");
  if (origin.protocol !== "https:" || origin.origin !== (worker || origin.origin).replace(/\/$/, "")) {
    throw new Error("OpenAI Worker의 HTTPS 주소를 확인해 주세요.");
  }
  const key = worker ? process.env.OPENAI_WORKER_SECRET : process.env.OPENAI_API_KEY;
  if (!key) throw new Error("모델 호출을 위한 서버 인증 정보를 설정해 주세요.");
  return fetch(origin.origin + "/v1/" + endpoint, {
    method: "POST", cache: "no-store", redirect: "error", signal, body,
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
  });
}
