import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../database";

export type MemberInput = { name: string; role: string; availability: string };
export type TeamInput = { name: string; goal: string; deadline: string; member: MemberInput };
export type Membership = { teamId: string; memberId: string; role: "leader" | "member" };
export type TeamInfo = Omit<TeamInput, "member"> & { id: string; members: (MemberInput & {id: string})[] };
export class TeamError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const token = () => randomBytes(32).toString("base64url");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function access<T>(write: boolean, action: (db: DatabaseSync) => T): T {
  const db = openDatabase();
  try {
    db.exec(`PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS tf_teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, goal TEXT NOT NULL, deadline TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tf_members (
        id TEXT PRIMARY KEY, team_id TEXT NOT NULL REFERENCES tf_teams(id), name TEXT NOT NULL,
        job TEXT NOT NULL, availability TEXT NOT NULL, permission TEXT NOT NULL, session_hash TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS tf_profile_members (
        owner_hash TEXT NOT NULL, team_id TEXT NOT NULL REFERENCES tf_teams(id),
        member_id TEXT NOT NULL UNIQUE REFERENCES tf_members(id), PRIMARY KEY(owner_hash,team_id));
      CREATE VIEW IF NOT EXISTS tf_profile_roles AS
        SELECT session_hash AS owner_hash, id AS member_id FROM tf_members
        UNION ALL SELECT owner_hash, member_id FROM tf_profile_members;
      CREATE TABLE IF NOT EXISTS tf_invites (token TEXT PRIMARY KEY, team_id TEXT NOT NULL REFERENCES tf_teams(id), active INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS tf_active_invite ON tf_invites(team_id) WHERE active=1;`);
    db.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
    const result = action(db);
    db.exec("COMMIT");
    return result;
  } finally { db.close(); } // Closing an uncommitted transaction rolls it back.
}

function field(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new TeamError(`${label} 항목을 1~${max}자로 입력해 주세요.`);
  return value.trim();
}
// A legacy cookie identifies the first membership. A suffix selects another team
// only after the database verifies it belongs to the same browser profile.
function lookup(db: DatabaseSync, session?: string, teamId?: string): Membership | null {
  if (!session) return null;
  const [secret, selected] = session.split(".");
  const target = teamId ?? selected;
  const hash = digest(secret);
  const row = db.prepare(`SELECT m.team_id AS teamId, m.id AS memberId, m.permission AS role
    FROM tf_profile_roles p JOIN tf_members m ON m.id=p.member_id
    WHERE p.owner_hash=? AND ${target ? "m.team_id=?" : "m.session_hash=?"}`).get(hash, target || hash);
  return row as Membership | undefined ?? null;
}
export function membership(session?: string) { return access(false, db => lookup(db, session)); }

export function personalTeams(session?: string) {
  if (!session) return [];
  return access(false, db => db.prepare(`SELECT t.id, t.name, t.deadline, m.permission AS role
    FROM tf_profile_roles p JOIN tf_members m ON m.id=p.member_id JOIN tf_teams t ON t.id=m.team_id
    WHERE p.owner_hash=? ORDER BY m.rowid`).all(digest(session.split(".")[0])) as
    {id:string; name:string; deadline:string; role:Membership["role"]}[]);
}

export function selectTeam(session: string, teamId: string) {
  if (!teamId || !access(false, db => lookup(db, session, teamId))) throw new TeamError("참여 중인 팀을 선택해 주세요.",403);
  return session.split(".")[0] + "." + teamId;
}

function addMember(db: DatabaseSync, teamId: string, data: MemberInput, permission: Membership["role"], previous?: string) {
  const owner = lookup(db, previous) ? previous!.split(".")[0] : null;
  const secret = token();
  const memberId = randomUUID();
  db.prepare("INSERT INTO tf_members(id,team_id,name,job,availability,permission,session_hash) VALUES (?,?,?,?,?,?,?)")
    .run(memberId, teamId, field(data?.name,"이름",60), field(data?.role,"역할",100),
      field(data?.availability,"가능 일정",300), permission, digest(secret));
  if (owner) db.prepare("INSERT INTO tf_profile_members VALUES (?,?,?)").run(digest(owner),teamId,memberId);
  return { teamId, memberId, session: owner ? owner + "." + teamId : secret };
}

export function createTeam(data: TeamInput, session?: string) {
  return access(true, db => {
    const deadline = field(data?.deadline,"마감일",10);
    const parsed = new Date(deadline);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(+parsed) || parsed.toISOString().slice(0,10) !== deadline)
      throw new TeamError("마감일을 확인해 주세요.");
    const id = randomUUID();
    db.prepare("INSERT INTO tf_teams VALUES (?,?,?,?)").run(id, field(data.name,"팀 이름",100), field(data.goal,"팀 목표",1000), deadline);
    db.prepare("INSERT INTO tf_invites VALUES (?,?,1)").run(token(), id);
    return addMember(db, id, data.member, "leader", session);
  });
}

export function joinTeam(invite: string, data: MemberInput, session?: string) {
  return access(true, db => {
    const row = db.prepare("SELECT team_id,active FROM tf_invites WHERE token=?").get(invite);
    const existing = row && lookup(db, session, String(row.team_id));
    if (session && existing) {
      const active = lookup(db, session);
      const selected = active?.teamId === existing.teamId ? session : session.split(".")[0] + "." + existing.teamId;
      return { teamId: existing.teamId, memberId: existing.memberId, session: selected };
    }
    if (!row?.active) throw new TeamError("사용이 종료된 초대 링크입니다. 팀장에게 새 링크를 요청해 주세요.", 410);
    return addMember(db, String(row.team_id), data, "member", session);
  });
}

export function invitePreview(invite: string, session?: string) {
  return access(false, db => {
    const row = db.prepare("SELECT t.name, t.id, i.active FROM tf_invites i JOIN tf_teams t ON t.id=i.team_id WHERE i.token=?").get(invite);
    const user = lookup(db, session);
    if (user && row?.id === user.teamId) return { name: String(row.name), joined: true };
    if (row && lookup(db, session, String(row.id))) return { name: String(row.name), joined: true, switchTeam: String(row.id) };
    if (!row?.active) throw new TeamError("사용이 종료된 초대 링크입니다. 팀장에게 새 링크를 요청해 주세요.", 410);
    return { name: String(row.name) };
  });
}

function leaderTeam(db: DatabaseSync, session: string) {
  const user = lookup(db, session);
  if (!user || user.role !== "leader") throw new TeamError("팀장만 초대를 관리할 수 있습니다.", 403);
  return user.teamId;
}
export function currentInvite(session: string) {
  return access(false, db => db.prepare("SELECT token FROM tf_invites WHERE team_id=? AND active=1")
    .get(leaderTeam(db, session))?.token as string | undefined ?? null);
}
export function closeInvite(session: string) {
  access(true, db => db.prepare("UPDATE tf_invites SET active=0 WHERE team_id=? AND active=1").run(leaderTeam(db, session)));
}
export function rotateInvite(session: string) {
  return access(true, db => {
    const id = leaderTeam(db, session);
    db.prepare("UPDATE tf_invites SET active=0 WHERE team_id=? AND active=1").run(id);
    const next = token();
    db.prepare("INSERT INTO tf_invites VALUES (?,?,1)").run(next, id);
    return next;
  });
}
export function teamInfo(teamId: string): TeamInfo {
  return access(false, db => {
    const team = db.prepare("SELECT id,name,goal,deadline FROM tf_teams WHERE id=?").get(teamId);
    if (!team) throw new TeamError("팀을 찾을 수 없습니다.",404);
    const members = db.prepare("SELECT id,name,job AS role,availability FROM tf_members WHERE team_id=? ORDER BY rowid").all(teamId);
    return { ...team, members } as TeamInfo;
  });
}
