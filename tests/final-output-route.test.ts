import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { GET, POST } from "../src/app/api/output/route";
import { createTeam } from "../src/lib/team/store";
import { generatePlan } from "../src/lib/plan/model";
import { saveVersion, confirmPlan } from "../src/lib/plan/store";
import { teamInfo } from "../src/lib/team/auth";
import { assignTasks } from "../src/lib/tasks/assign";
import { submitTask } from "../src/lib/tasks/submit";

const cookie = vi.hoisted(() => ({ value: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie }) }));
afterEach(() => vi.unstubAllEnvs());

it("세션에서 확정 계획과 원본을 읽고 보완 후 같은 확정본을 다시 조회한다", async () => {
  vi.stubEnv("TF_DATABASE_PATH", join(mkdtempSync(join(tmpdir(), "output-route-")), "test.sqlite"));
  vi.stubEnv("TF_TEST_MODEL", "1");
  const data = { name: "시제품 팀", goal: "모바일 시제품", deadline: "2026-12-01",
    member: { name: "민지", role: "팀장", availability: "오후" } };
  const { teamId, memberId, session } = createTeam(data);
  expect((await GET()).status).toBe(401);
  cookie.value = session;
  const actor = { teamId, memberId, role: "leader" as const };
  const plan = await generatePlan(teamInfo(teamId));
  saveVersion(actor, 0, 0, plan);
  confirmPlan(actor, 1, assignTasks);
  const act = (action: string, version?: number) => POST(new Request("http://local/api/output", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, version }) }));
  const incomplete = await (await act("assemble")).json();
  expect(incomplete.latest.issues.length).toBeGreaterThan(0);
  submitTask(teamId, memberId, plan.tasks[0].id, { text: "시제품", url: "https://example.org/run" });
  submitTask(teamId, memberId, plan.tasks[1].id, { text: "기기 세 대에서 실행을 확인했습니다." });
  const draft = await (await act("assemble")).json();
  expect(draft.latest.issues).toEqual([]);
  const confirmed = await act("confirm", draft.latest.version);
  expect(confirmed.status).toBe(200);
  expect((await (await GET()).json()).final).toEqual(draft.latest);
});
