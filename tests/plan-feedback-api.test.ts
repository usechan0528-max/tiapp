import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { GET, POST } from "../src/app/api/plan/route";
import { createTeam, currentInvite, joinTeam } from "../src/lib/team/store";
import { listTasks } from "../src/lib/tasks/read";
import type { PlanState } from "../src/lib/plan/types";

let token = "";
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: token }) }) }));
afterEach(() => { vi.unstubAllEnvs(); token = ""; });

it("두 세션이 같은 계획을 검토하고 확정된 최신 업무만 실제 업무판에 배정된다", async () => {
  vi.stubEnv("TF_DATABASE_PATH", join(mkdtempSync(join(tmpdir(), "tf-plan-api-")), "plan.sqlite"));
  vi.stubEnv("TF_TEST_MODEL", "1");
  const member = { name: "민서", role: "총괄", availability: "오후" };
  const fields = { name: "공연팀", goal: "행사 운영표", deadline: "2027-05-30", member };
  const leader = createTeam(fields);
  const other = createTeam(fields);
  const b = joinTeam(currentInvite(leader.session)!, { ...member, name: "지우", role: "섭외" });
  const post = (action: string, version: number, text?: string) => POST(new Request("http://localhost/api/plan", {
    method: "POST", body: JSON.stringify({ action, version, text, teamId: leader.teamId, role: "leader" }),
  }));
  expect((await GET()).status).toBe(401);
  token = leader.session;
  expect((await post("draft", 0)).status).toBe(200);
  expect(listTasks(leader.teamId)).toEqual([]);
  token = other.session;
  expect((await (await GET()).json()).versions).toEqual([]);
  expect((await post("feedback", 1, "다른 팀")).status).toBe(409);
  token = b.session;
  expect((await post("confirm", 1)).status).toBe(403);
  expect((await post("feedback", 1, "2027-05-29까지 가능합니다.")).status).toBe(200);
  token = leader.session;
  expect((await post("revise", 1)).status).toBe(200);
  expect((await post("confirm", 1)).status).toBe(409);
  expect((await post("confirm", 2)).status).toBe(200);
  const tasks = listTasks(leader.teamId);
  expect(tasks.find(task => task.assigneeId === b.memberId)).toMatchObject({ due: "2027-05-29", status: "ready" });
  expect(tasks.find(task => task.assigneeId === leader.memberId)?.status).toBe("waiting");
  token = b.session;
  const result: PlanState = await (await GET()).json();
  expect(result.versions[0]).toMatchObject({ number: 2, confirmed: true });
});
