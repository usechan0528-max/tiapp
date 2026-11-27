import { afterEach, expect, it, vi } from "vitest";
import { generateNote } from "../src/lib/chat/model";
import { postOpenAI } from "../src/lib/openai";
vi.mock("../src/lib/openai", () => ({postOpenAI: vi.fn()}));

const messages = [{id: 7, name: "지우", body: "금요일까지 초안을 공유할게요.", createdAt: "2026-11-27T06:00:00Z"}];
const item = { kind: "할 일", text: "지우가 금요일까지 초안을 공유한다.", sourceId: 7 };
function response(items: unknown[]) {
  vi.mocked(postOpenAI).mockResolvedValue(Response.json({status:"completed", output:[
    {content:[{type:"output_text", text:JSON.stringify({items})}]}
  ]}));
}
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("모델의 공유 노트 항목에서 근거 메시지를 보존한다", async () => {
  vi.stubEnv("TF_TEST_MODEL", "0");
  response([item]);
  await expect(generateNote(messages)).resolves.toEqual([item]);
});
it.each([[{...item, sourceId:13}], [{...item, kind:"기타"}], [{...item, text:" "}], []])(
  "불완전한 요약은 저장할 수 없다", async (...items) => {
    vi.stubEnv("TF_TEST_MODEL", "0");
    response(items);
    await expect(generateNote(messages)).rejects.toThrow();
  });
it("테스트 모델은 외부 요청 없이 같은 근거를 반환한다", async () => {
  vi.stubEnv("TF_TEST_MODEL", "1");
  const result = await generateNote(messages);
  expect(result[0].sourceId).toBe(7);
  expect(await generateNote(messages)).toEqual(result);
  expect(postOpenAI).not.toHaveBeenCalled();
});
