import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { GET, POST } from "../src/app/api/checkin/route";
import { openDatabase } from "../src/lib/database";
import { createTeam, currentInvite, joinTeam } from "../src/lib/team/store";
import { assignTasks } from "../src/lib/tasks/assign";
import { listTasks } from "../src/lib/tasks/read";

let token = "";
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: token }) }) }));
let dir: string;
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true }); token = ""; });

it("서버는 쿠키의 팀과 담당자를 사용하고 보고 후에도 업무는 미제출 상태다", async () => {
  dir = mkdtempSync(join(tmpdir(), "tf-checkin-api-"));
  vi.stubEnv("TF_DATABASE_PATH", join(dir, "test.sqlite"));
  const member = { name: "팀장", role: "기획", availability: "오후" };
  const fields = { name: "행사", goal: "운영표", deadline: "2026-11-30", member };
  const leader = createTeam(fields);
  const assignee = joinTeam(currentInvite(leader.session)!, { ...member, name: "팀원" });
  const other = createTeam(fields);
  const db = openDatabase();
  try {
    assignTasks(db, leader.teamId, [{ id: "task", title: "대관 문의", assigneeId: assignee.memberId, due: "", criteria: "", dependsOn: [] }]);
  } finally { db.close(); }
  const post = () => POST(new Request("http://localhost/api/checkin", { method: "POST",
    body: JSON.stringify({ taskId: "task", teamId: leader.teamId, memberId: assignee.memberId, text: "대관 문의 완료", blocker: "답변 대기", nextCheckAt: null, previousId: null }) }));
  expect((await post()).status).toBe(401);
  token = leader.session;
  expect((await post()).status).toBe(403);
  token = other.session;
  expect((await post()).status).toBe(403);
  expect((await (await GET()).json()).tasks).toEqual([]);
  token = assignee.session;
  expect((await post()).status).toBe(200);
  expect(listTasks(leader.teamId)[0].submission).toBeNull();
  token = leader.session;
  expect((await (await GET()).json()).tasks[0].latest.text).toBe("대관 문의 완료");
});
