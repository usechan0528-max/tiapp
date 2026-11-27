"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PlanState, Version } from "../../lib/plan/types";
import styles from "./plan.module.css";

function Contents({ plan, team }: { plan: Version; team: PlanState["team"] }) {
  const name = (id: string) => team.members.find(member => member.id === id)?.name ?? "팀원";
  return <>
    <section className={styles.section}><h3>결과물 구성</h3>
      {plan.sections.map((section, index) => <div className={styles.row} key={index}><strong>{section.title}</strong><p>{section.criteria}</p></div>)}
    </section>
    <section className={styles.section}><h3>업무별 계획</h3>
      {plan.tasks.map(task => <article key={task.id} className={styles.row}>
        <strong>{task.title}</strong><div className={styles.meta}>{name(task.assigneeId)} · {task.due} 마감</div>
        <p>{task.criteria}</p>
        {!!task.dependsOn.length && <small>선행 업무 · {task.dependsOn.map(id => plan.tasks.find(t => t.id === id)?.title).join(", ")}</small>}
      </article>)}
    </section>
    {!!plan.changes.length && <section className={styles.section}><h3>이전 버전에서 바뀐 점</h3><ul>{plan.changes.map((change, i) => <li key={i}>{change}</li>)}</ul></section>}
    <section className={styles.section}><h3>팀원 피드백 <small>{plan.feedback.length}</small></h3>
      {plan.feedback.map((f, i) => <div className={styles.row} key={i}><strong>{name(f.memberId)}</strong><p>{f.text}</p></div>)}
    </section>
  </>;
}

export default function PlanScreen() {
  const [data, setData] = useState<PlanState>();
  const [error, setError] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reload, setReload] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const serial = ++generation.current;
      try {
        const res = await fetch("/api/plan", { cache: "no-store" });
        const result = await res.json();
        if (!active || serial !== generation.current) return;
        setAnonymous(res.status === 401);
        if (!res.ok) throw Error(result.error);
        setData(result);
        setError("");
      } catch (e) {
        if (active && serial === generation.current) setError(e instanceof Error ? e.message : "계획을 불러오지 못했습니다.");
      }
    }
    void load();
    window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [reload]);

  const version = data?.versions[0];
  const leader = data?.actor.role === "leader";
  async function submit(action: string) {
    ++generation.current;
    setPending(action);
    setError("");
    try {
      const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json", "X-TF-Member": data?.actor.memberId ?? "" },
        body: JSON.stringify({ action, version: version?.number ?? 0, text: feedback }) });
      const result = await res.json();
      if (!res.ok) throw Error(result.error);
      ++generation.current;
      setData(result);
      if (action === "feedback") setFeedback("");
    } catch (e) { setError(e instanceof Error ? e.message : "요청을 다시 시도해 주세요."); }
    finally { setPending(""); }
  }

  return <main className={styles.plan}>
    <div className={styles.heading}><h1>계획</h1>
      {data && <button className={styles.secondary} disabled={!!pending} onClick={() => setReload(n => n + 1)}>새로고침</button>}
    </div>
    {error && <div className={styles.notice} role="alert">{error} {anonymous ? <Link href="/">TF 참여하기</Link> : <button className={styles.secondary} onClick={() => setReload(n => n + 1)}>다시 불러오기</button>}</div>}
    {!data && !error && <p role="status">팀 계획을 불러오는 중입니다.</p>}
    {data && <>
      <p className={styles.context}>{data.team.name} · {data.team.deadline} 마감</p>
      {!version ? <section className={styles.card}><h2>{data.team.goal}</h2>
        {!leader && <p>팀장 초안 대기 중</p>}
        {leader && <button disabled={!!pending} onClick={() => submit("draft")}>계획 초안 생성</button>}
      </section> : <>
        <div className={styles.card}><small>버전 {version.number} · {version.confirmed ? "확정" : "검토 중"}</small><h2>{version.title}</h2>
          {version.confirmed && <Link href="/board">배정된 업무 보기 →</Link>}
        </div>
        <Contents plan={version} team={data.team} />
        {!version.confirmed && <>
          <form onSubmit={e => { e.preventDefault(); void submit("feedback"); }}>
            <label>피드백<textarea value={feedback} maxLength={2000} required onChange={e => setFeedback(e.target.value)} /></label>
            <button className={styles.secondary} disabled={!feedback.trim() || !!pending}>피드백 등록</button>
          </form>
          {leader && <div className={styles.actions}>
            <button className={styles.secondary} disabled={!version.feedback.length || !!pending} onClick={() => submit("revise")}>피드백 반영해 수정안 생성</button>
            <button disabled={!!pending} onClick={() => submit("confirm")}>계획 확정 및 업무 배정</button>
          </div>}
        </>}
        {data.versions.slice(1).map(old => <details key={old.number} className={styles.history}><summary>버전 {old.number} · {old.title}</summary><Contents plan={old} team={data.team} /></details>)}
      </>}
    </>}
    {pending && <p role="status">{["draft", "revise"].includes(pending) ? "계획 작성 중…" : "저장 중입니다…"}</p>}
  </main>;
}
