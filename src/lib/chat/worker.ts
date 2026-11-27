import { generateNote } from "./model";
import { pendingMessages, pendingTeams, saveNote } from "./store";

export async function summarizePending(generate = generateNote) {
  for (const team of pendingTeams()) {
    try {
      const batch = pendingMessages(team);
      if (batch.length) saveNote(team, batch, await generate(batch));
    } catch {
      console.warn("팀 대화 요약 실패. 다음 주기에 다시 시도합니다.");
    }
  }
}

export function startChatWorker() {
  const state = globalThis as typeof globalThis & { chatNoteTimer?: NodeJS.Timeout };
  if (state.chatNoteTimer) return;
  let busy = false;
  state.chatNoteTimer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await summarizePending(); }
    catch { console.warn("팀 대화 요약 대기열 조회 실패"); }
    finally { busy = false; }
  }, process.env.TF_TEST_MODEL === "1" ? 1000 : 300_000);
  state.chatNoteTimer.unref();
}
