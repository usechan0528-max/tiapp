import type { DatabaseSync } from "node:sqlite";
import type { Assignment } from "./types";

export function initTasks(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS tf_assigned_tasks (
    team TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, assignee TEXT NOT NULL,
    due TEXT NOT NULL, dependencies TEXT NOT NULL, criteria TEXT NOT NULL,
    submission TEXT, PRIMARY KEY (team, id)
  );
  CREATE TABLE IF NOT EXISTS tf_row_evidence (
    team TEXT NOT NULL, result TEXT NOT NULL, evidence TEXT NOT NULL, PRIMARY KEY(team, result)
  );
  CREATE TABLE IF NOT EXISTS tf_source_views (
    team TEXT NOT NULL, source TEXT NOT NULL, member TEXT NOT NULL, revision INTEGER NOT NULL,
    PRIMARY KEY (team, source, member)
  )`);
}

export function assignTasks(db: DatabaseSync, teamId: string, tasks: Assignment[]) {
  initTasks(db);
  const insert = db.prepare(`INSERT INTO tf_assigned_tasks
    (team, id, title, assignee, due, dependencies, criteria)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (team, id) DO NOTHING`);
  for (const task of tasks) {
    insert.run(teamId, task.id, task.title, task.assigneeId, task.due, JSON.stringify(task.dependsOn), task.criteria);
  }
}
