import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkInBoard, recordCheckIn } from "../src/lib/checkin/store";

const alice = { teamId: "one", memberId: "alice" };
const bob = { teamId: "one", memberId: "bob" };
const tasks = [
  { id: "data", title: "자료 조사", assigneeId: "alice", dependsOn: [], status: "ready" },
  { id: "slides", title: "발표 제작", assigneeId: "bob", dependsOn: ["data"], status: "waiting" },
];
const now = new Date("2026-11-27T05:00:00Z");
const due = new Date("2026-11-27T05:30:00Z");
const report = {
  taskId: "data", text: "세 곳에 견적을 요청했어요.", blocker: "업체 회신 대기",
  nextCheckAt: due.toISOString(), previousId: null,
};
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tf-checkin-"));
  vi.stubEnv("TF_DATABASE_PATH", join(dir, "test.sqlite"));
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true }); });

describe("업무 체크인", () => {
  it("예정 시점부터 같은 질문 하나를 유지하고 무응답 시각과 업무 상태를 보존한다", () => {
    recordCheckIn(alice, tasks, report, now);
    expect(checkInBoard(alice, tasks, now).questions).toEqual([]);
    const first = checkInBoard(alice, tasks, due);
    expect(first.questions).toHaveLength(1);
    expect(first.questions[0].prompt).toContain(report.blocker);
    expect(checkInBoard(alice, tasks, new Date(+due + 1000))).toEqual(first);
    expect(first.tasks[0].latest).toMatchObject({ text: report.text, reportedAt: now.toISOString() });
    expect(tasks[0].status).toBe("ready");
  });
  it("답변으로 팀 보기가 갱신되고 대기자와 담당자별 질문을 구분한다", () => {
    const last = recordCheckIn(alice, tasks, report, now);
    const view = checkInBoard(bob, tasks, due);
    expect(view.questions).toHaveLength(0);
    expect(view.tasks[0].affected.map(t => t.assigneeId)).toEqual(["bob"]);
    const answer = { ...report, previousId: last.id, text: "세 곳 모두 받았어요.", blocker: "", nextCheckAt: null };
    recordCheckIn(alice, tasks, answer, due);
    expect(checkInBoard(alice, tasks, due).questions).toHaveLength(0);
    expect(checkInBoard(bob, tasks, due).tasks[0].latest).toMatchObject({ text: answer.text, blocker: "" });
    expect(() => recordCheckIn(alice, tasks, answer, due)).toThrow();
  });
  it("다른 담당자의 기록, 잘못된 시각, 다른 팀의 기록 열람을 차단한다", () => {
    expect(() => recordCheckIn(bob, tasks, report, now)).toThrow();
    expect(() => recordCheckIn(alice, tasks, { ...report, nextCheckAt: now.toISOString() }, now)).toThrow();
    recordCheckIn(alice, tasks, report, now);
    const other = checkInBoard({ ...alice, teamId: "two" }, tasks, due);
    expect(other.tasks[0].latest).toBeNull();
    expect(other.questions).toEqual([]);
  });
});
