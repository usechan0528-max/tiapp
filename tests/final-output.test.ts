import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleOutput, confirmOutput, getOutput } from "../src/lib/output/service";
import type { OutputInput } from "../src/lib/output/types";

const event = (): OutputInput => ({
  title: "행사 운영안", sections: [{ title: "시간대별 운영표", criteria: "운영 시간을 표로 정리" }],
  sources: [{ id: "run", title: "운영 일정", assigneeId: "kim", assignee: "김민지", text: "시간 | 담당\n14:00 | 안내팀", url: "" }],
});
beforeEach(() => {
  vi.stubEnv("TF_DATABASE_PATH", join(mkdtempSync(join(tmpdir(), "tf-output-")), "test.sqlite"));
  vi.stubEnv("TF_TEST_MODEL", "1");
});
afterEach(() => vi.unstubAllEnvs());

it("계획에 맞는 표와 실행 링크를 만들고 원본을 보존한다", async () => {
  const input = event();
  const result = await assembleOutput("event", () => input);
  expect(result.sections[0]).toMatchObject({ kind: "table", sourceIds: ["run"] });
  expect(result.sources).toEqual(input.sources);
  input.sections = [{ title: "시제품 실행 링크", criteria: "실행 가능한 URL" }];
  input.sources[0].url = "https://example.org/demo";
  const prototype = await assembleOutput("prototype", () => input);
  expect(prototype.sections[0].kind).toBe("links");
  expect(prototype.sources[0].url).toBe("https://example.org/demo");
});

it("빈 자료와 상충하는 값을 담당자에게 연결하고 같은 요청을 재사용한다", async () => {
  const input = event();
  input.sources[0].text = "행사 시작: 14시";
  input.sources.push({ ...input.sources[0], id: "venue", title: "장소 예약", assigneeId: "lee", text: "행사 시작: 15시" },
    { ...input.sources[0], id: "guest", title: "초청장", assigneeId: "park", text: "" });
  const draft = await assembleOutput("t", () => input);
  expect(draft.issues.map(issue => issue.taskId).sort()).toEqual(["guest", "run", "venue"]);
  expect((await assembleOutput("t", () => input)).version).toBe(draft.version);
  expect(() => confirmOutput("t", "leader", draft.version, () => input)).toThrow();
  input.sources[1].text = input.sources[0].text;
  input.sources[2].text = "초대 확인";
  const revised = await assembleOutput("t", () => input);
  expect(revised.issues).toEqual([]);
  expect(() => confirmOutput("t", "member", revised.version, () => input)).toThrow();
  expect(() => confirmOutput("t", "leader", draft.version, () => input)).toThrow();
  confirmOutput("t", "leader", revised.version, () => input);
  expect(getOutput("t").final?.version).toBe(revised.version);
  expect(getOutput("other").final).toBeNull();
  input.sources[1].text = "자료가 변경됨";
  expect(() => confirmOutput("t", "leader", revised.version, () => input)).toThrow();
  expect(getOutput("t").final?.sources[1].text).toBe("행사 시작: 14시");
});

it("모델 응답이 알 수 없는 원본을 가리키면 이전 검수본을 보존한다", async () => {
  const input = event();
  const previous = await assembleOutput("t", () => input);
  input.sources[0].text = "수정한 운영 시간표";
  vi.stubEnv("TF_TEST_MODEL", "");
  vi.stubEnv("OPENAI_API_KEY", "unit-test-placeholder");
  const generated = { sections: [{ kind: "table", body: "", rows: [], sourceIds: ["unknown"] }], issues: [] };
  const fetchModel = vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify(generated) } }] }));
  vi.stubGlobal("fetch", fetchModel);
  try {
    await expect(assembleOutput("t", () => input)).rejects.toThrow("형식");
    expect(fetchModel).toHaveBeenCalledTimes(1);
    expect(getOutput("t").latest).toEqual(previous);
  } finally { vi.unstubAllGlobals(); }
});

it("실행 링크 옆에 검증 원문을 표시하고, 결과가 없으면 검증 담당자에게 요청한다", async () => {
  const input: OutputInput = {
    title: "모바일 시제품", sections: [{ title: "실행 링크", criteria: "URL과 검증 결과" }],
    sources: [
      { id: "demo", title: "실행 링크", assigneeId: "dev", assignee: "준", text: "배포 주소", url: "https://example.org/demo" },
      { id: "qa", title: "기기 검증", assigneeId: "qa-member", assignee: "민지", text: "안드로이드 기기 3대에서 실행 확인", url: "" },
    ],
  };
  const complete = await assembleOutput("demo-team", () => input);
  expect(complete.sections[0].body).toContain("검증 결과 · 안드로이드 기기 3대에서 실행 확인");
  expect(complete.sections[0].sourceIds).toEqual(expect.arrayContaining(["demo", "qa"]));
  expect(complete.issues).toEqual([]);
  input.sources[1].text = "내일 검증 예정";
  const missing = await assembleOutput("demo-team", () => input);
  expect(missing.issues).toEqual([{ section: 0, taskId: "qa", reason: "시제품 실행 검증 결과를 제출해 주세요." }]);
  expect(() => confirmOutput("demo-team", "leader", missing.version, () => input)).toThrow();
});
