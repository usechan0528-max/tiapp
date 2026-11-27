// This server runs the built app with only the outbound Responses API replaced.
const { createServer } = require("node:http");
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (resource, init) => {
  const request = new Request(resource, init);
  if (request.url !== "https://api.openai.com/v1/responses") {
    if (new URL(request.url).hostname === "api.openai.com") throw Error("예상하지 않은 OpenAI 경로");
    return originalFetch(request);
  }
  const { input } = await request.json();
  process.send(input);
  if (++calls > 2) throw Error("예상하지 않은 모델 호출");
  const { team } = JSON.parse(input.split("\n").find(line => line.startsWith("{")));
  const plan = {
    title: "행사 준비", sections: [{ title: "운영표", criteria: "시간대별 담당자를 기재한다." }],
    tasks: [{ id: "schedule", title: "운영표 작성", assigneeId: team.members[0].id,
      due: calls === 1 ? "2027-05-31" : "2027-05-29", dependsOn: [], criteria: "운영표를 제출한다." }],
    changes: [],
  };
  return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(plan) }] }] });
};

async function start() {
  const app = require("next")({ dev: false, hostname: "127.0.0.1" });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  server.listen(0, "127.0.0.1", () => process.send(server.address().port));
}
start().catch(error => { console.error(error); process.exit(1); });
