import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../database";
import { PlanError, type Actor, type Plan, type Task, type Version } from "./types";

function connection() {
  const db = openDatabase();
  try {
    db.exec(`PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS plan_versions (
        team TEXT NOT NULL, number INTEGER NOT NULL, body TEXT NOT NULL, confirmed INTEGER DEFAULT 0,
        PRIMARY KEY(team,number));
      CREATE TABLE IF NOT EXISTS plan_feedback (
        id INTEGER PRIMARY KEY, team TEXT NOT NULL, number INTEGER NOT NULL, member TEXT NOT NULL, text TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS feedback_by_version ON plan_feedback(team,number,id);`);
    return db;
  } catch (error) { db.close(); throw error; }
}

function write(action: (db: DatabaseSync) => void) {
  const db = connection();
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      action(db);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally { db.close(); }
}

export function getVersions(team: string): Version[] {
  const db = connection();
  try {
    db.exec("BEGIN");
    const rows = db.prepare("SELECT number, body, confirmed FROM plan_versions WHERE team=? ORDER BY number DESC").all(team);
    const feedback = db.prepare("SELECT member AS memberId, text FROM plan_feedback WHERE team=? AND number=? ORDER BY id");
    return rows.map(row => ({
      ...JSON.parse(String(row.body)), number: Number(row.number), confirmed: Boolean(row.confirmed),
      feedback: feedback.all(team, row.number),
    }));
  } finally { db.close(); }
}

function current(db: DatabaseSync, team: string, expected: number) {
  const row = db.prepare("SELECT number, confirmed FROM plan_versions WHERE team=? ORDER BY number DESC LIMIT 1").get(team);
  if ((row?.number ?? 0) !== expected) throw new PlanError("계획이 갱신되었습니다. 최신 버전을 확인해 주세요.", 409);
  return row;
}

function requireOpen(confirmed: unknown) {
  if (confirmed) throw new PlanError("이미 확정된 계획입니다.", 409);
}

export function requireLeader(actor: Actor) {
  if (actor.role !== "leader") throw new PlanError("팀장만 실행할 수 있습니다.", 403);
}

export function saveVersion(actor: Actor, expected: number, feedbackCount: number, plan: Plan) {
  requireLeader(actor);
  write(db => {
    requireOpen(current(db, actor.teamId, expected)?.confirmed);
    const count = db.prepare("SELECT count(*) AS n FROM plan_feedback WHERE team=? AND number=?").get(actor.teamId, expected);
    if (count?.n !== feedbackCount) throw new PlanError("새 의견이 등록되었습니다. 의견을 확인하고 다시 생성해 주세요.", 409);
    db.prepare("INSERT INTO plan_versions(team,number,body) VALUES(?,?,?)").run(actor.teamId, expected + 1, JSON.stringify(plan));
  });
}

export function addFeedback(actor: Actor, version: number, input: string) {
  const text = input.trim();
  if (!text || text.length > 2000) throw new PlanError("의견은 1~2,000자로 작성해 주세요.");
  write(db => {
    const row = current(db, actor.teamId, version);
    if (!row) throw new PlanError("계획 초안이 필요합니다.");
    requireOpen(row.confirmed);
    db.prepare("INSERT INTO plan_feedback(team,number,member,text) VALUES(?,?,?,?)").run(actor.teamId, version, actor.memberId, text);
  });
}

export function confirmPlan(actor: Actor, version: number, assignTasks: (db: DatabaseSync, teamId: string, tasks: Task[]) => void) {
  requireLeader(actor);
  write(db => {
    const row = current(db, actor.teamId, version);
    if (!row) throw new PlanError("계획 초안이 필요합니다.");
    if (row.confirmed) return;
    const plan = db.prepare("SELECT body FROM plan_versions WHERE team=? AND number=?").get(actor.teamId, version);
    assignTasks(db, actor.teamId, JSON.parse(String(plan?.body)).tasks);
    db.prepare("UPDATE plan_versions SET confirmed=1 WHERE team=? AND number=?").run(actor.teamId, version);
  });
}
