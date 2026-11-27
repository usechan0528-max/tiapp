import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../database";
import { TeamError } from "../team/store";
import type { ChatMessage, NoteItem, SharedNote } from "./types";

function access<T>(action: (db: DatabaseSync) => T): T {
  const db = openDatabase();
  try {
    db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY, team TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS chat_room ON chat_messages(team,id);
      CREATE TABLE IF NOT EXISTS chat_notes (
        team TEXT NOT NULL, firstId INTEGER NOT NULL, lastId INTEGER NOT NULL, createdAt TEXT NOT NULL,
        items TEXT NOT NULL, PRIMARY KEY(team,firstId));`);
    return action(db);
  } finally { db.close(); }
}

const messages = `SELECT c.id,m.name,c.body,c.createdAt FROM chat_messages c
  JOIN tf_members m ON m.id=c.author AND m.team_id=c.team WHERE c.team=?`;

export function addMessage(actor: {teamId:string; memberId:string}, body: unknown) {
  if (typeof body !== "string" || !body.trim() || body.trim().length > 2000)
    throw new TeamError("메시지를 1~2000자로 입력해 주세요.");
  access(db => db.prepare("INSERT INTO chat_messages(team,author,body,createdAt) VALUES(?,?,?,?)")
    .run(actor.teamId, actor.memberId, body.trim(), new Date().toISOString()));
}

export function readRoom(team: string) {
  return access(db => {
    const notes = db.prepare("SELECT firstId,lastId,createdAt,items FROM chat_notes WHERE team=? ORDER BY firstId DESC")
      .all(team).map(row => ({...row, items: JSON.parse(String(row.items))}) as SharedNote);
    return {messages: db.prepare(messages + " ORDER BY c.id").all(team) as ChatMessage[], notes};
  });
}

const cursor = "SELECT COALESCE(MAX(lastId),0) FROM chat_notes WHERE team=?";
export function pendingTeams() {
  return access(db => db.prepare(`SELECT DISTINCT c.team FROM chat_messages c
    WHERE c.id>(SELECT COALESCE(MAX(lastId),0) FROM chat_notes WHERE team=c.team)`).all().map(row => String(row.team)));
}

export function pendingMessages(team: string) {
  return access(db => db.prepare(messages + ` AND c.id>(${cursor}) ORDER BY c.id LIMIT 40`)
    .all(team, team) as ChatMessage[]);
}

export function saveNote(team: string, batch: ChatMessage[], items: NoteItem[]) {
  // Concurrent workers can see the same batch. The first message uniquely identifies its note.
  access(db => db.prepare(`INSERT INTO chat_notes(team,firstId,lastId,createdAt,items)
    VALUES(?,?,?,?,?) ON CONFLICT(team,firstId) DO NOTHING`)
    .run(team, batch[0].id, batch[batch.length-1].id, new Date().toISOString(), JSON.stringify(items)));
}
