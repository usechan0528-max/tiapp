import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../database";
import { initTasks } from "./assign";
import type { BoardTask, Submission } from "./types";

export function readTasks(db: DatabaseSync, teamId: string, memberId?: string): BoardTask[] {
  initTasks(db);
  const rows = db.prepare(`SELECT task.*, view.revision AS seen, link.evidence
    FROM tf_assigned_tasks task LEFT JOIN tf_source_views view
    ON view.team = task.team AND view.source = task.id AND view.member = ?
    LEFT JOIN tf_row_evidence link ON link.team = task.team AND link.result = task.id
    WHERE task.team = ? ORDER BY task.rowid`).all(memberId ?? null, teamId);
  const completed = new Set(rows.filter(row => row.submission !== null).map(row => String(row.id)));
  return rows.map(row => {
    const dependsOn: string[] = JSON.parse(String(row.dependencies));
    const stored: (Submission & { revision?: number }) | null = row.submission === null
      ? null : JSON.parse(String(row.submission));
    const revision = stored ? stored.revision ?? 1 : 0;
    const submission = stored && { text: stored.text, ...(stored.url && { url: stored.url }) };
    return {
      id: String(row.id), title: String(row.title), assigneeId: String(row.assignee),
      due: String(row.due), criteria: String(row.criteria), dependsOn, submission, revision,
      ...(row.evidence != null && { rowEvidence: JSON.parse(String(row.evidence)) }),
      sourceChanged: row.seen != null && Number(row.seen) < revision,
      status: submission ? "completed" : dependsOn.every(id => completed.has(id)) ? "ready" : "waiting",
    };
  });
}

export function listTasks(teamId: string, memberId?: string): BoardTask[] {
  const db = openDatabase();
  try { return readTasks(db, teamId, memberId); } finally { db.close(); }
}
