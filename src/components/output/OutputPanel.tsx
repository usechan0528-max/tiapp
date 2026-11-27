"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { History, Version } from "../../lib/output/types";
import styles from "./output.module.css";

type State = History & { role: string; memberId: string; planned: boolean; submitted: number; total: number };

export function Review({ doc, memberId }: { doc: Version; memberId: string }) {
  const sources = new Map(doc.sources.map(s => [s.id, s]));
  return <article className={styles.paper}>
    <h2>{doc.title}</h2>
    {doc.sections.map((s, index) => <section key={index} className={styles.section}>
      <h3>{s.title}</h3>
      <p className={styles.criteria}>완료 기준 · {s.criteria}</p>
      {s.body && <p className={styles.body}>{s.body}</p>}
      {s.kind === "table" && s.rows.length > 0 && <div className={styles.tableWrap}><table aria-label={s.title}><tbody>
        {s.rows.map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j}>{cell}</td>)}</tr>)}
      </tbody></table></div>}
      {s.sourceIds.map(id => {
        const source = sources.get(id);
        if (!source) return null;
        return <div key={id}>
          {s.kind === "links" && source.url && <a href={source.url} target="_blank" rel="noreferrer">{source.title} 링크 열기 ↗</a>}
          <details><summary>원본 · {source.title} · {source.assignee}</summary>
            <p className={styles.body}>{source.text || (source.url ? "" : "제출 대기 중")}</p>
            {source.url && <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>}
          </details>
        </div>;
      })}
      {doc.issues.filter(i => i.section === index).map((issue, i) => {
        const owner = sources.get(issue.taskId);
        return <div key={i} className={styles.issue}><strong>보완 요청 · {owner?.assignee}</strong>
          <p>{owner?.title} — {issue.reason}</p>
          {owner?.assigneeId === memberId && <Link href="/board">내 업무에서 자료 보완하기 →</Link>}
        </div>;
      })}
    </section>)}
  </article>;
}

export default function OutputPanel() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [join, setJoin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finalView, setFinalView] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/output", { signal: abort.signal, cache: "no-store" }).then(async res => {
      const data = await res.json();
      if (!res.ok) { setJoin(res.status === 401); throw new Error(data.error); }
      setState(data);
      setError("");
    }).catch(e => { if (!abort.signal.aborted) setError(e.message || "결과물을 불러오지 못했습니다."); });
    return () => abort.abort();
  }, [reload]);
  async function change(action: "assemble" | "confirm") {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/output", { method: "POST", headers: { "Content-Type": "application/json", "X-TF-Member": state?.memberId ?? "" },
        body: JSON.stringify({ action, version: state?.latest?.version }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(data); setFinalView(action === "confirm");
    } catch (e) { setError(e instanceof Error ? e.message : "다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  const doc = finalView ? state?.final : state?.latest;
  const isFinal = doc && doc.version === state?.final?.version;
  return <main className={styles.panel}>
    <h1>최종 결과물</h1>
    {error && <p role="alert">{error} {join ? <Link href="/">TF 참여하기</Link> :
      <button type="button" onClick={() => setReload(n => n + 1)}>다시 불러오기</button>}</p>}
    {!state && !error && <p role="status">제출 현황을 불러오는 중…</p>}
    {state && <>
      <div className={styles.status}><span>제출 자료</span><strong>{state.submitted} / {state.total}건</strong></div>
      {!state.planned ? <p>계획을 확정하면 취합을 시작할 수 있습니다. <Link href="/plan">계획 보기 →</Link></p> :
        <div className={styles.actions}><button disabled={busy} onClick={() => change("assemble")}>
          {busy ? "처리 중…" : state.latest ? "최신 자료로 다시 취합" : "취합본 생성"}</button>
          <Link href="/board">제출 자료 확인</Link></div>}
      {state.latest && state.final && state.latest.version !== state.final.version &&
        <button onClick={() => setFinalView(v => !v)}>{finalView ? "최신 검수본 보기" : "이전 확정본 보기"}</button>}
      {doc && <><div className={styles.stamp}>버전 {doc.version} · {isFinal ? "확정본" : "검수 중"}</div>
        <Review doc={doc} memberId={state.memberId}/>
        {!isFinal && state.role === "leader" && <button disabled={busy || doc.issues.length > 0}
          onClick={() => change("confirm")}>이 버전 확정</button>}
      </>}
    </>}
  </main>;
}
