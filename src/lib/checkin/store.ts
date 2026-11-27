import { randomUUID } from "node:crypto";
import { openDatabase } from "../database";

type Actor = { teamId: string; memberId: string };
type Task = { id: string; title: string; assigneeId: string; dependsOn: string[]; status: string; submission?: unknown };
type Report = {
  id: string; taskId: string; memberId: string; text: string; blocker: string;
  reportedAt: string; nextCheckAt: string | null;
};
export type CheckInInput = {
  taskId: string; text: string; blocker: string; nextCheckAt: string | null; previousId: string | null;
};
export class CheckInError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function connect() {
  const db = openDatabase();
  try {
    db.exec(`PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS checkin_reports (
      seq INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, teamId TEXT NOT NULL,
      taskId TEXT NOT NULL, memberId TEXT NOT NULL, text TEXT NOT NULL,
      blocker TEXT NOT NULL, reportedAt TEXT NOT NULL, nextCheckAt TEXT
    );
    CREATE INDEX IF NOT EXISTS checkin_latest ON checkin_reports(teamId, taskId, seq)`);
    return db;
  } catch (error) { db.close(); throw error; }
}

function finished(task: Task) {
  return Boolean(task.submission) || task.status === "completed";
}

export function recordCheckIn(actor: Actor, tasks: Task[], input: CheckInInput, now = new Date()) {
  if (!input || typeof input !== "object") throw new CheckInError("체크인 내용을 확인해 주세요.");
  const task = tasks.find(t => t.id === input.taskId);
  if (!task || task.assigneeId !== actor.memberId) throw new CheckInError("내 담당 업무에만 체크인할 수 있어요.", 403);
  if (finished(task)) throw new CheckInError("이미 제출한 업무예요.", 409);
  if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 1000 ||
      typeof input.blocker !== "string" || input.blocker.length > 500) throw new CheckInError("진척은 1~1000자, 막힌 이유는 500자 이내로 입력해 주세요.");
  const next = typeof input.nextCheckAt === "string" ? new Date(input.nextCheckAt) : null;
  if (input.nextCheckAt !== null && !(next && +next > +now)) throw new CheckInError("다음 확인 시각을 현재보다 뒤로 설정해 주세요.");
  const record: Report = {
    id: randomUUID(), taskId: task.id, memberId: actor.memberId, text: input.text.trim(),
    blocker: input.blocker.trim(), reportedAt: now.toISOString(), nextCheckAt: next?.toISOString() ?? null,
  };
  const db = connect();
  try {
    db.exec("BEGIN IMMEDIATE");
    const prev = db.prepare("SELECT id FROM checkin_reports WHERE teamId=? AND taskId=? AND memberId=? ORDER BY seq DESC LIMIT 1")
      .get(actor.teamId, task.id, actor.memberId);
    if ((prev?.id ?? null) !== input.previousId) throw new CheckInError("새 체크인이 있어요. 최신 보고를 확인한 뒤 다시 기록해 주세요.", 409);
    db.prepare("INSERT INTO checkin_reports (id,teamId,taskId,memberId,text,blocker,reportedAt,nextCheckAt) VALUES (?,?,?,?,?,?,?,?)")
      .run(record.id, actor.teamId, record.taskId, record.memberId, record.text, record.blocker, record.reportedAt, record.nextCheckAt);
    db.exec("COMMIT");
    return record;
  } finally { db.close(); }
}

type ProgressTask = Pick<Task, "id" | "title" | "assigneeId"> & {
  closed: boolean; latest: Report | null; affected: Pick<Task, "id" | "title" | "assigneeId">[];
};

export function dueQuestions(tasks: ProgressTask[], memberId: string, now: Date) {
  return tasks.flatMap(({ latest, id, assigneeId, closed }) => {
    if (closed || assigneeId !== memberId || !latest?.nextCheckAt || latest.nextCheckAt > now.toISOString()) return [];
    const prompt = latest.blocker
      ? `지난번에 ‘${latest.blocker}’라고 했어요. 지금은 해결됐나요?`
      : `지난번에 ‘${latest.text}’라고 했어요. 그 뒤로 어디까지 진행했나요?`;
    return [{ id: latest.id, taskId: id, prompt }];
  });
}

export function checkInBoard(actor: Actor, tasks: Task[], now = new Date()) {
  const db = connect();
  try {
    const rows = db.prepare(`SELECT id, taskId, memberId, text, blocker, reportedAt, nextCheckAt
      FROM checkin_reports WHERE seq IN (SELECT MAX(seq) FROM checkin_reports WHERE teamId=? GROUP BY taskId,memberId)`)
      .all(actor.teamId) as Report[];
    const items = tasks.map(task => ({
      id: task.id, title: task.title, assigneeId: task.assigneeId, closed: finished(task),
      latest: rows.find(r => r.taskId === task.id && r.memberId === task.assigneeId) ?? null,
      affected: finished(task) ? [] : tasks.filter(t => !finished(t) && t.dependsOn.includes(task.id))
        .map(({ id, title, assigneeId }) => ({ id, title, assigneeId })),
    }));
    return { tasks: items, questions: dueQuestions(items, actor.memberId, now), memberId: actor.memberId };
  } finally { db.close(); }
}

export type BoardData = ReturnType<typeof checkInBoard> & { names: Record<string, string> };
