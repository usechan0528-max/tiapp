"use client";

import { useEffect, useState, type FormEvent } from "react";
import { sourceBlocks, type BoardTask } from "../../lib/tasks/types";
import { Source } from "./Source";
import styles from "./tasks.module.css";

type Evidence = { sourceId: string; revision: number; header: string[]; cells: string[] };
type Draft = { text: string; url: string; baseRevision: number; comparing?: boolean; evidence?: Evidence };

function loadDraft(key: string): Draft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (value && typeof value.text === "string" && typeof value.url === "string" &&
        Number.isSafeInteger(value.baseRevision)) return value;
  } catch { /* Storage may be unavailable in private browsing. */ }
  return null;
}

export function SubmitForm({ task, sources, memberId, refresh }: {
  task: BoardTask; sources: BoardTask[]; memberId: string; refresh: () => Promise<void>;
}) {
  const key = JSON.stringify(["tf-submission", memberId, task.id]);
  const [draft, setDraft] = useState<Draft | null>(() => loadDraft(key));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const latest = { text: task.submission?.text ?? "", url: task.submission?.url ?? "", baseRevision: task.revision };
  const current: Draft = draft ?? latest;
  const groups = task.assigneeId === memberId && !task.rowEvidence?.pending ? sources.flatMap(source => {
    const blocks = sourceBlocks(source.submission?.text ?? "").filter(block => typeof block !== "string");
    const seen = new Map<string, number>();
    const options = blocks.flatMap(({ header, rows }) => rows.map(cells => {
      const identity = JSON.stringify([header, cells[0]]);
      seen.set(identity, (seen.get(identity) ?? 0) + 1);
      return { identity, evidence: { sourceId: source.id, revision: source.revision, header, cells } };
    }));
    const unique = options.filter(({ identity, evidence }) => evidence.cells[0] && seen.get(identity) === 1);
    return unique.length ? [{ source, options: unique }] : [];
  }) : [];
  const selected = current.evidence ? JSON.stringify(current.evidence) : "";
  const stale = !!selected && !groups.some(group =>
    group.options.some(option => JSON.stringify(option.evidence) === selected));
  const conflict = !!draft && draft.baseRevision !== task.revision &&
    (draft.text !== latest.text || draft.url.trim() !== latest.url || !!draft.evidence);

  function remember(value: Draft | null) {
    setDraft(value);
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
    } catch {
      setMessage("이 탭을 열어 두세요. 브라우저에 초안을 보관할 수 없습니다.");
    }
  }
  function change(values: Partial<Draft>) {
    setMessage("");
    remember({ ...current, ...values });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict || stale || !online) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/tasks", { method: "POST",
        headers: { "Content-Type": "application/json", "X-TF-Member": memberId },
        body: JSON.stringify({ id: task.id, text: current.text, url: current.url, baseRevision: current.baseRevision, evidence: current.evidence }),
      });
      if (!response.ok) {
        const result = await response.json();
        if (response.status === 409) await refresh();
        setMessage(result.error);
        return;
      }
      await refresh();
      remember(null);
      setMessage("제출물을 저장했습니다.");
    } catch {
      setMessage("저장을 확인하지 못했습니다. 연결 후 다시 저장해 주세요.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className={styles.form}>
    {!online && <p role="status">오프라인 · 작성 중인 초안은 연결 후 저장할 수 있습니다.</p>}
    {(conflict || draft?.comparing) && <section aria-label="운영표 변경 비교">
      <p role="status">{conflict ? "최신본이 변경되었습니다. 내 초안은 아래에 남아 있습니다." : "최신본과 내 초안을 비교하고 반영할 내용을 편집해 주세요."}</p>
      <strong>서버 최신본 · 버전 {task.revision}</strong>
      {task.submission && <Source submission={task.submission} />}
      {conflict && <button type="button" disabled={busy} onClick={() => change({ baseRevision: task.revision, comparing: true })}>최신본과 비교해 편집</button>}
    </section>}
    {(groups.length > 0 || selected) && <label>근거 행 (선택)
      <select value={selected} disabled={busy} onChange={event => change({
        evidence: event.target.value ? JSON.parse(event.target.value) : undefined,
      })}>
        <option value="">{task.rowEvidence ? "기존 근거 유지" : "근거 행 없이 제출"}</option>
        {stale && <option value={selected} disabled>이전 선택 · {current.evidence?.cells.join(" · ")}</option>}
        {groups.map(({ source, options }) => <optgroup key={source.id} label={source.title}>
          {options.map(({ identity, evidence }) =>
            <option key={identity} value={JSON.stringify(evidence)}>{evidence.cells.join(" · ")}</option>)}
        </optgroup>)}
      </select>
    </label>}
    {stale && <p role="status">근거 원본이 바뀌었습니다. 최신 행을 다시 선택해 주세요.</p>}
    <label>제출 본문<textarea name="text" rows={4} maxLength={50000} value={current.text}
      disabled={busy} onChange={e => change({ text:e.target.value })} placeholder="스프레드시트 표 붙여넣기 가능" /></label>
    <label>자료 링크 <span>(선택)</span><input type="url" name="url" maxLength={4096} placeholder="https://"
      value={current.url} disabled={busy} onChange={e => change({ url:e.target.value })} /></label>
    <button disabled={busy || conflict || stale || !online}>{busy ? "저장 중…" : task.submission ? "보완 자료 저장" : "제출하고 완료"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
