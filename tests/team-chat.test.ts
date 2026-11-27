import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTeam } from "../src/lib/team/store";
import { addMessage, readRoom } from "../src/lib/chat/store";
import { summarizePending } from "../src/lib/chat/worker";

beforeEach(() => {
  vi.stubEnv("TF_DATABASE_PATH", join(mkdtempSync(join(tmpdir(), "tf-chat-")), "chat.sqlite"));
  vi.stubEnv("TF_TEST_MODEL", "1");
});
afterEach(() => vi.unstubAllEnvs());
const team = () => createTeam({ name:"팀", goal:"발표", deadline:"2026-12-20", member:{name:"민서",role:"팀장",availability:"오후"} });
it("실패한 대화를 재시도하고 새 메시지만 팀별 노트로 저장한다", async () => {
  const a = team(), b = team();
  expect(() => addMessage(a, " ")).toThrow();
  addMessage(a, "발표 시간은 3분입니다.");
  await summarizePending(async () => { throw Error("offline"); });
  expect(readRoom(a.teamId).notes).toHaveLength(0);
  await Promise.all([summarizePending(), summarizePending()]);
  expect(readRoom(a.teamId).notes).toHaveLength(1);
  addMessage(a, "제가 발표합니다.");
  await summarizePending();
  await summarizePending();
  const room = readRoom(a.teamId);
  expect(room.notes.map(note => note.firstId)).toEqual(room.messages.map(m => m.id).reverse());
  expect(readRoom(b.teamId)).toEqual({messages:[], notes:[]});
});

it("정리 중 도착한 메시지는 다음 노트에 남긴다", async () => {
  const actor = team();
  addMessage(actor, "첫 대화");
  await summarizePending(async ([first]) => {
    addMessage(actor, "정리 중 추가한 대화");
    return [{kind:"주요 논의", text:"첫 대화", sourceId:first.id}];
  });
  await summarizePending();
  const { messages, notes } = readRoom(actor.teamId);
  expect(notes.map(n => [n.firstId,n.lastId])).toEqual([
    [messages[1].id,messages[1].id], [messages[0].id,messages[0].id],
  ]);
});
