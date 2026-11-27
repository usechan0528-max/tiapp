import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../database";
import { readTasks } from "./read";
import { canEditSubmission, sourceBlocks, type BoardTask, type RowEvidence, type Submission } from "./types";

export class TaskError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function parseSubmission(input: unknown): Submission {
  if (!input || typeof input !== "object") throw new TaskError(400, "제출할 자료를 입력하세요.");
  const { text, url } = input as Record<string, unknown>;
  if (typeof text !== "string" || (url != null && typeof url !== "string"))
    throw new TaskError(400, "본문과 링크 형식을 확인하세요.");
  const link = typeof url === "string" ? url.trim() : "";
  if (!text.trim() && !link) throw new TaskError(400, "본문이나 자료 링크를 입력하세요.");
  if (text.length > 50000 || link.length > 4096) throw new TaskError(400, "제출 자료가 너무 깁니다.");
  if (link && (!URL.canParse(link) || !["https:", "http:"].includes(new URL(link).protocol)))
    throw new TaskError(400, "http 또는 https 자료 링크를 입력하세요.");
  return link ? { text, url: link } : { text };
}

function equalCells(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, i) => value === right[i]);
}

function matchingRows(blocks: ReturnType<typeof sourceBlocks>, header: string[], key: string) {
  return blocks.flatMap(block => typeof block === "string" || !equalCells(block.header, header)
    ? [] : block.rows.filter(row => row[0] === key));
}

function selectedEvidence(task: BoardTask, tasks: BoardTask[], member: string, input: unknown): RowEvidence {
  if (task.assigneeId !== member) throw new TaskError(403, "결과 담당자만 근거를 선택할 수 있습니다.");
  if (!input || typeof input !== "object") throw new TaskError(400, "근거 행을 선택하세요.");
  const { sourceId, revision, header, cells } = input as Record<string, unknown>;
  if (typeof sourceId !== "string" || !task.dependsOn.includes(sourceId) ||
      !Number.isSafeInteger(revision) || !Array.isArray(header) || !Array.isArray(cells) ||
      !cells.every(cell => typeof cell === "string") || !header.every(cell => typeof cell === "string") ||
      !cells[0]) throw new TaskError(400, "선행 업무와 근거 행을 확인하세요.");
  const source = tasks.find(item => item.id === sourceId);
  if (!source?.submission || revision !== source.revision)
    throw new TaskError(409, "근거 원본의 최신본을 확인하세요.");
  const matches = matchingRows(sourceBlocks(source.submission.text), header, cells[0]);
  if (matches.length !== 1 || !equalCells(matches[0], cells))
    throw new TaskError(400, "원본에서 근거 행을 하나로 식별할 수 없습니다.");
  return { sourceId, header, previous: cells, latest: cells, targetRevision: source.revision,
    pending: false, reason: null };
}

function saveEvidence(db: DatabaseSync, team: string, result: string, evidence: RowEvidence) {
  db.prepare(`INSERT INTO tf_row_evidence(team, result, evidence) VALUES (?, ?, ?)
    ON CONFLICT(team, result) DO UPDATE SET evidence = excluded.evidence`).run(team, result, JSON.stringify(evidence));
}

function updateLinkedResults(db: DatabaseSync, team: string, source: string, tasks: BoardTask[], text: string, revision: number) {
  const blocks = sourceBlocks(text);
  for (const result of tasks) {
    const evidence = result.rowEvidence;
    if (evidence?.sourceId !== source || !evidence.latest) continue;
    const matches = matchingRows(blocks, evidence.header, evidence.latest[0]);
    const latest = matches.length === 1 ? matches[0] : null;
    if (latest && equalCells(evidence.latest, latest)) continue;
    const reason = latest ? "changed" : matches.length ? "ambiguous" : "deleted";
    saveEvidence(db, team, result.id, { ...evidence, latest, reason, pending: true, targetRevision: revision });
  }
}

export function submitTask(teamId: string, memberId: string, taskId: string, input: unknown) {
  const db = openDatabase();
  try {
    db.exec("BEGIN IMMEDIATE");
    const tasks = readTasks(db, teamId);
    const task = tasks.find(task => task.id === taskId);
    if (!task) throw new TaskError(404, "업무를 찾을 수 없습니다.");
    if (task.status === "waiting") throw new TaskError(409, "선행 업무가 완료되어야 제출할 수 있습니다.");
    if (!canEditSubmission(task, memberId, tasks)) throw new TaskError(403, "담당자와 인계받은 팀원만 수정할 수 있습니다.");
    const submission = parseSubmission(input);
    const { evidence, baseRevision } = input as { evidence?: unknown; baseRevision?: number };
    const selected = evidence === undefined ? undefined : selectedEvidence(task, tasks, memberId, evidence);
    const current = task.rowEvidence;
    const newLink = selected && !(current?.latest && current.sourceId === selected.sourceId &&
      equalCells(current.header, selected.header) && equalCells(current.latest, selected.previous));
    if (newLink && current?.pending) throw new TaskError(409, "기존 근거를 먼저 재확인하세요.");
    if (newLink || submission.text !== task.submission?.text || submission.url !== task.submission?.url) {
      if ((baseRevision === undefined ? 0 : baseRevision) !== task.revision)
        throw new TaskError(409, "최신본이 변경되었습니다. 내 초안과 비교해 주세요.");
      if (newLink) saveEvidence(db, teamId, taskId, selected);
      updateLinkedResults(db, teamId, taskId, tasks, submission.text, task.revision + 1);
      db.prepare("UPDATE tf_assigned_tasks SET submission = ? WHERE team = ? AND id = ?")
        .run(JSON.stringify({ ...submission, revision: task.revision + 1 }), teamId, taskId);
    }
    db.exec("COMMIT");
  } finally {
    // Closing the connection also rolls back an unfinished submission.
    db.close();
  }
}

export function acknowledgeSource(teamId: string, memberId: string, sourceId: string, revision: number) {
  const db = openDatabase();
  try {
    db.exec("BEGIN IMMEDIATE");
    const tasks = readTasks(db, teamId);
    const source = tasks.find(task => task.id === sourceId);
    if (!source?.submission) throw new TaskError(404, "원본을 찾을 수 없습니다.");
    if (!tasks.some(task => task.assigneeId === memberId && task.dependsOn.includes(sourceId)))
      throw new TaskError(403, "후속 업무 담당자만 확인할 수 있습니다.");
    if (!Number.isSafeInteger(revision) || revision < 1 || revision > source.revision)
      throw new TaskError(400, "원본 버전을 확인하세요.");
    db.prepare(`INSERT INTO tf_source_views (team, source, member, revision) VALUES (?, ?, ?, ?)
      ON CONFLICT(team, source, member) DO UPDATE SET revision = MAX(revision, excluded.revision)`)
      .run(teamId, sourceId, memberId, revision);
    db.exec("COMMIT");
  } finally { db.close(); }
}

export function recheckRow(teamId: string, memberId: string, resultId: string, resultRevision: number, targetRevision: number) {
  const db = openDatabase();
  try {
    db.exec("BEGIN IMMEDIATE");
    const result = readTasks(db, teamId).find(task => task.id === resultId);
    const evidence = result?.rowEvidence;
    if (!result || !evidence) throw new TaskError(404, "연결된 근거를 찾을 수 없습니다.");
    if (result.assigneeId !== memberId) throw new TaskError(403, "결과 담당자만 재확인할 수 있습니다.");
    if (!Number.isSafeInteger(resultRevision) || !Number.isSafeInteger(targetRevision))
      throw new TaskError(400, "처리할 버전을 확인하세요.");
    if (result.revision !== resultRevision || evidence.targetRevision !== targetRevision)
      throw new TaskError(409, "최신 결과와 근거를 다시 확인하세요.");
    if (evidence.pending) saveEvidence(db, teamId, resultId, {
      ...evidence, previous: evidence.latest ?? evidence.previous, pending: false,
      reason: evidence.latest ? null : evidence.reason,
    });
    db.exec("COMMIT");
  } finally { db.close(); }
}
