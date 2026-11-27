import { createHash } from "node:crypto";
import { openDatabase } from "../database";
import { generate, requiresVerification } from "./model";
import type { History, Issue, OutputInput, Version } from "./types";

export class OutputError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

function withStore<T>(fn: (db: ReturnType<typeof openDatabase>) => T) {
  const db = openDatabase();
  try {
    db.exec(`PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS output_versions (
      team TEXT NOT NULL, version INTEGER NOT NULL, fingerprint TEXT NOT NULL,
      content TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(team,version))`);
    return fn(db);
  } finally { db.close(); }
}
type Row = { fingerprint: string; content: string; version: number };
function latest(db: ReturnType<typeof openDatabase>, team: string) {
  return db.prepare("SELECT * FROM output_versions WHERE team=? ORDER BY version DESC LIMIT 1").get(team) as Row | undefined;
}
function unpack(row?: Row): Version | null { return row ? JSON.parse(row.content) : null; }

export function getOutput(team: string): History {
  return withStore(db => ({
    latest: unpack(latest(db, team)),
    final: unpack(db.prepare("SELECT * FROM output_versions WHERE team=? AND confirmed=1 ORDER BY version DESC LIMIT 1").get(team) as Row | undefined),
  }));
}

const hash = (input: OutputInput | null) => createHash("sha256").update(input?.sections.some((_, i) => requiresVerification(input, i)) ? "prototype-verification-v1:" : "").update(JSON.stringify(input)).digest("hex");

export async function assembleOutput(team: string, read: () => OutputInput | null): Promise<Version> {
  const input = structuredClone(read());
  if (!input?.sections.length || !input.sources.length) throw new OutputError("업무가 배정된 계획을 먼저 확정해 주세요.");
  const fingerprint = hash(input);
  const previous = withStore(db => latest(db, team));
  if (previous?.fingerprint === fingerprint) return unpack(previous)!;

  const assembly = await generate(input);
  const issues: Issue[] = [];
  function addIssue(issue: Issue) {
    if (!issues.some(i => i.taskId === issue.taskId && i.section === issue.section && i.reason === issue.reason)) issues.push(issue);
  }
  assembly.issues.forEach(addIssue);
  for (const source of input.sources) {
    if (!source.text.trim() && !source.url) addIssue({ section: Math.max(0, assembly.sections.findIndex(s => s.sourceIds.includes(source.id))),
      taskId: source.id, reason: "원본 자료를 제출해 주세요." });
  }
  const sections = assembly.sections.map(({ verification = [], ...s }, i) => {
    if (requiresVerification(input, i)) {
      s.kind = "links";
      const evidence = verification.filter(v => {
        const quote = v.quote.trim();
        return quote && !/^https?:\/\/\S+$/i.test(quote)
          && input.sources.some(source => source.id === v.taskId && source.text.includes(quote));
      });
      s.sourceIds = [...new Set([...s.sourceIds, ...evidence.map(v => v.taskId)])];
      s.body = [...new Set(evidence.map(v => "검증 결과 · " + v.quote.trim()))].join("\n");
      if (!evidence.length) {
        const candidates = input.sources.filter(source => /검증|테스트|시험|QA/i.test(source.title));
        const owner = candidates.find(source => s.sourceIds.includes(source.id)) ?? candidates[0]
          ?? input.sources.find(source => s.sourceIds.includes(source.id) && source.url) ?? input.sources[0];
        addIssue({ section: i, taskId: owner.id, reason: "시제품 실행 검증 결과를 제출해 주세요." });
      }
    }
    const related = input.sources.filter(source => s.sourceIds.includes(source.id));
    if (!related.length || (s.kind === "links" && !related.some(source => source.url))) {
      addIssue({ section: i, taskId: related[0]?.id ?? input.sources[0].id,
        reason: s.kind === "links" ? "확인 가능한 링크를 제출해 주세요." : "이 구성의 근거가 될 자료를 제출해 주세요." });
    }
    return { ...input.sections[i], ...s };
  });
  return withStore(db => {
    db.exec("BEGIN IMMEDIATE");
    if (hash(read()) !== fingerprint) throw new OutputError("취합 중 원본이 변경되었습니다. 다시 생성해 주세요.");
    const current = latest(db, team);
    if (current?.fingerprint === fingerprint) {
      db.exec("COMMIT");
      return unpack(current)!;
    }
    const version = (current?.version ?? 0) + 1;
    const result = { title: input.title, sources: input.sources, sections, issues, version };
    db.prepare("INSERT INTO output_versions(team,version,fingerprint,content) VALUES(?,?,?,?)")
      .run(team, version, fingerprint, JSON.stringify(result));
    db.exec("COMMIT");
    return result;
  });
}

export function confirmOutput(team: string, role: string, version: number, read: () => OutputInput | null) {
  if (role !== "leader") throw new OutputError("팀장만 최종본을 확정할 수 있습니다.", 403);
  withStore(db => {
    db.exec("BEGIN IMMEDIATE");
    const current = latest(db, team);
    if (!current || current.version !== version || current.fingerprint !== hash(read()))
      throw new OutputError("원본이나 버전이 변경되었습니다. 최신 자료를 취합해 주세요.");
    if (unpack(current)!.issues.length) throw new OutputError("담당자가 자료를 보완한 뒤 다시 취합해 주세요.");
    db.prepare("UPDATE output_versions SET confirmed=1 WHERE team=? AND version=?").run(team, version);
    db.exec("COMMIT");
  });
}
