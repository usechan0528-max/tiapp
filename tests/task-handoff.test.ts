import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openDatabase } from "../src/lib/database";
import { assignTasks } from "../src/lib/tasks/assign";
import { listTasks } from "../src/lib/tasks/read";
import { submitTask, acknowledgeSource, recheckRow } from "../src/lib/tasks/submit";

const plan = [
  { id: "survey", title: "수요 조사", assigneeId: "b", dependsOn: [] },
  { id: "prices", title: "가격 조사", assigneeId: "c", dependsOn: [] },
  { id: "report", title: "보고서", assigneeId: "a", dependsOn: ["survey", "prices"] },
].map(task => ({ ...task, due: "2026-11-28", criteria: "자료와 출처" }));
const table = "|항목|응답|\n|---|---|\n|참여|12명|";

function assign(team = "team") {
  const db = openDatabase();
  try { assignTasks(db, team, plan); } finally { db.close(); }
}
beforeEach(() => {
  vi.stubEnv("TF_DATABASE_PATH", join(mkdtempSync(join(tmpdir(), "tf-tasks-")), "test.sqlite"));
  assign();
});
afterEach(() => vi.unstubAllEnvs());

it("모든 선행 과제가 끝나야 후속 업무가 열리고 두 원본을 조회한다", () => {
  submitTask("team", "b", "survey", { text: table, url: "https://example.org/survey" });
  expect(listTasks("team").find(t => t.id === "report")?.status).toBe("waiting");
  expect(() => submitTask("team", "a", "report", { text: "초안" })).toThrow();
  submitTask("team", "c", "prices", { text: "5천 원" });
  const tasks = listTasks("team");
  const report = tasks.find(t => t.id === "report")!;
  expect(report.status).toBe("ready");
  expect(report.dependsOn.map(id => tasks.find(t => t.id === id)?.submission)).toEqual([
    { text: table, url: "https://example.org/survey" }, { text: "5천 원" },
  ]);
});

it("재확정과 제출 재전송은 배정과 원본을 복제하지 않는다", () => {
  submitTask("team", "b", "survey", { text: table });
  assign();
  submitTask("team", "b", "survey", { text: table });
  expect(listTasks("team")).toHaveLength(3);
  expect(listTasks("team")[0]).toMatchObject({ id: "survey", status: "completed", submission: { text: table } });
});

it("담당자와 팀을 검사하고 링크 단독 제출을 허용한다", () => {
  assign("other");
  expect(() => submitTask("team", "a", "survey", { text: "임의 제출" })).toThrow();
  expect(() => submitTask("team", "b", "survey", { text: "", url: "javascript:alert(1)" })).toThrow();
  expect(() => submitTask("team", "b", "survey", { text: " " })).toThrow();
  submitTask("other", "b", "survey", { text: "", url: "https://example.org" });
  expect(listTasks("team")[0].submission).toBeNull();
});

it("계획 확정 트랜잭션을 롤백하면 업무도 사라진다", () => {
  const db = openDatabase();
  try {
    db.exec("BEGIN");
    assignTasks(db, "rollback", plan);
    db.exec("ROLLBACK");
    expect(listTasks("rollback")).toEqual([]);
  } finally { db.close(); }
});

it("기존 원본과 멤버별 확인 기록을 보존하고 실제 수정만 알린다", () => {
  const db = openDatabase();
  try {
    db.prepare("UPDATE tf_assigned_tasks SET submission = ? WHERE team = ? AND id = ?")
      .run(JSON.stringify({text: "초안"}), "team", "survey");
    assignTasks(db, "team", [{ ...plan[2], id: "second", assigneeId: "c" }]);
  } finally { db.close(); }
  const source = (member: string) => listTasks("team", member)[0];
  const seen = (member: string, revision: number) => acknowledgeSource("team", member, "survey", revision);
  expect(source("a")).toMatchObject({ revision: 1, sourceChanged: false });
  seen("a", 1);
  submitTask("team", "b", "survey", {text: "초안", url: ""});
  expect(source("a")).toMatchObject({ revision: 1, sourceChanged: false });
  submitTask("team", "b", "survey", {text: "최종안", baseRevision: 1});
  expect(source("a")).toMatchObject({ revision: 2, sourceChanged: true });
  expect(source("c").sourceChanged).toBe(false);
  seen("c", 2);
  submitTask("team", "b", "survey", {text: "최종안", baseRevision: 2, url: "https://example.org"});
  seen("a", 2);
  expect(source("a")).toMatchObject({revision: 3, sourceChanged: true});
  expect(source("c").sourceChanged).toBe(true);
  seen("a", 3);
  seen("a", 1);
  expect(source("a").sourceChanged).toBe(false);
  expect(source("c").sourceChanged).toBe(true);
  expect(() => seen("b", 3)).toThrow();
  expect(() => seen("c", 4)).toThrow();
});

it("같은 운영표를 인계받은 담당자가 수정해도 오래된 초안이 최신본을 덮지 않는다", () => {
  submitTask("team", "b", "survey", { text: "정문", baseRevision: 0 });
  const updated = { text: "동문", baseRevision: 1 };
  submitTask("team", "a", "survey", updated);
  submitTask("team", "a", "survey", updated);
  for (const baseRevision of [1, undefined]) {
    expect(() => submitTask("team", "b", "survey", {text: "서문", baseRevision})).toThrow(/최신본/);
  }
  expect(() => submitTask("team", "c", "survey", {text: "서문", baseRevision: 2})).toThrow();
  expect(listTasks("team")[0]).toMatchObject({ revision: 2, submission: {text: "동문"} });
});

const header = ["시간", "업무", "장소"];
const before = ["10:00", "안내", "정문"];
const after = ["10:00", "안내", "동문"];
const other = ["11:00", "철수", "서문"];
const selection = { sourceId: "survey", revision: 1, header, cells: before };
function schedule(rows: string[][], markdown = false) {
  return (markdown ? [header, header.map(() => "---"), ...rows] : [header, ...rows])
    .map(row => row.join(markdown ? "|" : "\t")).join("\n");
}
function prepare(rows = [before, other], markdown = false) {
  submitTask("team", "b", "survey", { text: schedule(rows, markdown) });
  submitTask("team", "c", "prices", { text: "금액" });
}
function report(evidence = selection) {
  submitTask("team", "a", "report", { text: "배치 완료", evidence });
}
const state = () => listTasks("team").find(t => t.id === "report")!.rowEvidence;
function edit(rows: string[][], baseRevision: number) {
  submitTask("team", "b", "survey", { text: schedule(rows), baseRevision });
}

it.each([true, false])("표 형식(%s)에서 선택한 행만 추적하고 지정 버전만 재확인한다", markdown => {
  prepare(undefined, markdown);
  report();
  edit([[other[0], "정리", "서문"], before], 1);
  expect(state()).toMatchObject({ previous: before, latest: before, pending: false });
  edit([other, after], 2);
  acknowledgeSource("team", "a", "survey", 3);
  expect(state()).toMatchObject({ previous: before, latest: after, targetRevision: 3, pending: true });
  const confirm = (who: string, revision: number) => recheckRow("team", who, "report", 1, revision);
  expect(() => confirm("b", 3)).toThrow();
  edit([other, [after[0], after[1], "북문"]], 3);
  expect(() => confirm("a", 3)).toThrow();
  expect(state()?.pending).toBe(true);
  confirm("a", 4);
  confirm("a", 4);
  expect(state()?.pending).toBe(false);
  edit([other], 4);
  expect(state()).toMatchObject({ previous: ["10:00", "안내", "북문"], latest: null, pending: true });
  edit([other, before], 5);
  expect(state()?.latest).toBeNull();
});

it("선행 관계, 원본 버전, 실제 셀, 중복 식별자를 검증한다", () => {
  prepare();
  for (const evidence of [{...selection, sourceId: "report"}, {...selection, revision: 2},
    {...selection, cells: after}, {...selection, header: ["시간"]}]) {
    expect(() => report(evidence)).toThrow();
  }
  report();
  edit([after, before], 1);
  expect(state()).toMatchObject({ latest: null, pending: true, reason: "ambiguous" });
  expect(() => report({...selection, revision: 2})).toThrow();
});
