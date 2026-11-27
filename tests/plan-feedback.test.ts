import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/lib/database";
import { generatePlan, validatePlan } from "../src/lib/plan/model";
import { addFeedback, confirmPlan, getVersions, saveVersion } from "../src/lib/plan/store";
import { confirmedPlan } from "../src/lib/plan/read";

const team = { id: "tf", name: "TF", goal: "학과 행사 준비", deadline: "2027-05-30", members: [
  { id: "A", name: "민서", role: "leader", availability: "오후" },
  { id: "B", name: "지우", role: "member", availability: "주말" },
] };
const leader = { teamId: "tf", memberId: "A", role: "leader" as const };
const member = { teamId: "tf", memberId: "B", role: "member" as const };
beforeEach(() => {
  vi.stubEnv("TF_TEST_MODEL", "1");
  vi.stubEnv("TF_DATABASE_PATH", join(mkdtempSync(join(tmpdir(), "tf-plan-")), "plan.sqlite"));
});
afterEach(() => vi.unstubAllEnvs());

it("목표에 따라 결과물 구성이 달라지고 팀원의 일정 의견을 수정안에 반영한다", async () => {
  const first = await generatePlan(team);
  const other = await generatePlan({ ...team, goal: "시제품 검증" });
  expect(first.sections).not.toEqual(other.sections);
  saveVersion(leader, 0, 0, first);
  addFeedback(member, 1, "5월 29일까지 가능해요 (2027-05-29)");
  const previous = getVersions("tf")[0];
  const revised = await generatePlan(team, previous);
  expect(revised.tasks.find(t => t.assigneeId === "B")?.due).toBe("2027-05-29");
  expect(revised.changes.join(" ")).toContain("2027-05-29");
  saveVersion(leader, 1, 1, revised);
  expect(getVersions("tf").map(v => v.number)).toEqual([2, 1]);
  expect(getVersions("other")).toEqual([]);
});

it("잘못된 모델 응답을 거절하고 기존 초안과 피드백을 보존한다", async () => {
  const plan = await generatePlan(team);
  saveVersion(leader, 0, 0, plan);
  addFeedback(member, 1, "오후만 가능");
  const previous = getVersions("tf")[0];
  expect(() => validatePlan({ ...plan, tasks: plan.tasks.map(t => ({ ...t, assigneeId: "외부" })) }, team)).toThrow();
  expect(() => validatePlan({ ...plan, tasks: plan.tasks.map(t => ({ ...t, dependsOn: [t.id] })) }, team)).toThrow();
  vi.stubEnv("TF_TEST_MODEL", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  await expect(generatePlan(team, previous)).rejects.toThrow();
  expect(getVersions("tf")).toEqual([previous]);
});

it("최신 버전만 팀장이 확정하며 배정 실패도 함께 롤백한다", async () => {
  const plan = await generatePlan(team);
  saveVersion(leader, 0, 0, plan);
  addFeedback(member, 1, "자료 확인");
  expect(() => saveVersion(leader, 1, 0, plan)).toThrow();
  saveVersion(leader, 1, 1, plan);
  const assign = vi.fn();
  expect(confirmedPlan("tf")).toBeNull();
  expect(() => confirmPlan(member, 2, assign)).toThrow();
  expect(() => confirmPlan(leader, 1, assign)).toThrow();
  expect(assign).not.toHaveBeenCalled();
  expect(() => confirmPlan(leader, 2, db => {
    db.exec("CREATE TABLE rollback_probe(x)");
    throw Error("failed");
  })).toThrow();
  const db = openDatabase();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name='rollback_probe'").get()).toBeUndefined();
  db.close();
  expect(confirmedPlan("tf")).toBeNull();
  confirmPlan(leader, 2, assign);
  confirmPlan(leader, 2, assign);
  expect(assign).toHaveBeenCalledTimes(1);
  expect(confirmedPlan("tf")?.tasks).toEqual(plan.tasks);
  expect(() => addFeedback(member, 2, "늦은 의견")).toThrow();
});

it("Responses API의 생성 결과를 검증하고 수정 요청에 원본 초안과 피드백을 전달한다", async () => {
  const plan = await generatePlan(team);
  vi.stubEnv("TF_TEST_MODEL", "0");
  vi.stubEnv("OPENAI_API_KEY", "unit-test");
  const fetchModel = vi.fn(async (_url: string, init: RequestInit) => {
    const request = JSON.parse(String(init.body));
    const { previous } = JSON.parse(request.input.slice(request.input.indexOf("{")));
    const tasks = previous?.tasks ?? plan.tasks;
    const output = { ...plan, tasks, changes: previous ? ["일정 조정"] : [] };
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(output) }] }] });
  });
  vi.stubGlobal("fetch", fetchModel);
  try {
    const draft = await generatePlan(team);
    const previous = { ...draft, confirmed: false, number: 1, feedback: [{ memberId: "B", text: "일정 조정" }] };
    const revised = await generatePlan(team, previous);
    expect(revised.tasks).toEqual(draft.tasks);
    const [url, init] = fetchModel.mock.calls[1];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(JSON.parse(String(init.body)).input).toContain(JSON.stringify({ team, previous }));
  } finally { vi.unstubAllGlobals(); }
});

it("선행 업무보다 빠른 마감을 진단하고 한 요청 안에서 교정한다", async () => {
  const good = await generatePlan(team);
  const bad = structuredClone(good);
  bad.tasks[1].due = "2027-05-29";
  expect(() => validatePlan(bad, team)).toThrow(/tasks\[1\]\.due.*선행/);
  vi.stubEnv("TF_TEST_MODEL", "0");
  vi.stubEnv("OPENAI_API_KEY", "unit-test");
  const response = (value: unknown) => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
  const request = vi.fn().mockResolvedValueOnce(response(bad)).mockResolvedValueOnce(response(good));
  vi.stubGlobal("fetch", request);
  try {
    const result = await generatePlan(team);
    expect(result.tasks[1].due).toBe(good.tasks[1].due);
    expect(request).toHaveBeenCalledTimes(2);
    const fix = JSON.parse(request.mock.calls[1][1].body);
    expect(fix.input).toContain("tasks[1].due");
    expect(fix.input).toContain(bad.tasks[1].id);
    expect(fix.text.format).toMatchObject({ type: "json_schema", strict: true });
  } finally { vi.unstubAllGlobals(); }
});

it("자동 교정 후에도 담당자가 유효하지 않으면 초안과 의견을 보존하고 정확한 실패 조건을 반환한다", async () => {
  const plan = await generatePlan(team);
  saveVersion(leader, 0, 0, plan);
  addFeedback(member, 1, "오후 일정으로 조정");
  const previous = getVersions(team.id)[0];
  vi.stubEnv("TF_TEST_MODEL", "0");
  vi.stubEnv("OPENAI_API_KEY", "unit-test");
  const bad = { ...plan, tasks: [{ ...plan.tasks[0], assigneeId: "외부" }] };
  const request = vi.fn(async () => Response.json({ status: "completed", output: [
    { content: [{ type: "output_text", text: JSON.stringify(bad) }] },
  ] }));
  vi.stubGlobal("fetch", request);
  try {
    await expect(generatePlan(team, previous)).rejects.toThrow(/tasks\[0\]\.assigneeId.*팀원/);
    expect(request).toHaveBeenCalledTimes(2);
    expect(getVersions(team.id)).toEqual([previous]);
  } finally { vi.unstubAllGlobals(); }
});
