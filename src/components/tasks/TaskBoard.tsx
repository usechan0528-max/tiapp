"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { canEditSubmission, type BoardTask } from "../../lib/tasks/types";
import { SubmitForm } from "./SubmitForm";
import { Source, SourceTable } from "./Source";
import styles from "./tasks.module.css";

type Board = { memberId: string; members: { id: string; name: string }[]; tasks: BoardTask[] };
const boardPollIntervalMs = 1000;
const labels = { waiting: "선행 업무 대기", ready: "시작 가능", completed: "완료" };

function Recheck({ task, memberId, refresh }: { task: BoardTask; memberId: string; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const evidence = task.rowEvidence;
  if (!evidence?.pending || task.status !== "completed" || !task.submission) return null;
  const isAssignee = task.assigneeId === memberId;
  const payload = { action: "recheckRow", id: task.id, resultRevision: task.revision, targetRevision: evidence.targetRevision };
  async function resolve() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH", headers: { "Content-Type": "application/json", "X-TF-Member": memberId },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json()).error);
    } catch (error) {
      setError(error instanceof Error ? error.message : "조치 완료를 저장하지 못했습니다.");
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  return <section aria-label="다시 확인할 일 1건" className={styles.recheck}>
    <h3>다시 확인할 일 1건</h3>
    <strong>변경 전</strong><SourceTable header={evidence.header} rows={[evidence.previous]} />
    <strong>변경 후</strong>{evidence.latest
      ? <SourceTable header={evidence.header} rows={[evidence.latest]} />
      : <p>{evidence.reason === "ambiguous" ? "같은 기준의 행이 여러 개입니다." : "근거 행이 삭제되었습니다."}</p>}
    <strong>{isAssignee ? "내 점검 결과" : "담당자의 점검 결과"}</strong><Source submission={task.submission} />
    {isAssignee && <button type="button" disabled={busy} onClick={resolve}>조치 완료</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export default function TaskBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [join, setJoin] = useState(false);
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const activeRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const response = await fetch("/api/tasks", { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      setJoin(response.status === 401);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setBoard(null);
        throw new Error(data.error);
      }
      setBoard(data);
      setError("");
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "업무를 불러오지 못했습니다.");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, []);
  useEffect(() => {
    function showLinkedTask() {
      if (location.hash.startsWith("#task-")) setScope("team");
    }
    function refreshVisibleBoard() {
      if (!document.hidden && !activeRequest.current) void refresh();
    }
    const initial = window.setTimeout(() => { showLinkedTask(); refreshVisibleBoard(); }, 0);
    const timer = window.setInterval(refreshVisibleBoard, boardPollIntervalMs);
    document.addEventListener("visibilitychange", refreshVisibleBoard);
    window.addEventListener("online", refreshVisibleBoard);
    window.addEventListener("focus", refreshVisibleBoard);
    window.addEventListener("hashchange", showLinkedTask);
    return () => {
      window.clearTimeout(initial);
      activeRequest.current?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisibleBoard);
      window.removeEventListener("online", refreshVisibleBoard);
      window.removeEventListener("focus", refreshVisibleBoard);
      window.removeEventListener("hashchange", showLinkedTask);
    };
  }, [refresh]);
  async function markOpened(id: string, revision: number, memberId: string) {
    try {
      const response = await fetch("/api/tasks", { method: "PATCH",
        headers: { "Content-Type": "application/json", "X-TF-Member": memberId },
        body: JSON.stringify({ id, revision }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "확인을 저장하지 못했습니다. 원본을 다시 열어 주세요.");
    }
  }
  const firstLoad = !!board;
  useEffect(() => {
    if (firstLoad && location.hash.startsWith("#task-"))
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [firstLoad]);
  const visible = board?.tasks.filter(task => scope === "team" || task.assigneeId === board.memberId) ?? [];
  return <section className={styles.board} aria-label="업무 목록">
    {error && <p role="alert">{error} {join ? <Link href="/">TF 생성·참여</Link> : <button onClick={refresh}>다시 불러오기</button>}</p>}
    {!board && !error && <p role="status">업무를 불러오는 중입니다.</p>}
    {board && <>
      <div className={styles.tabs} role="group" aria-label="업무 범위">
        <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>내 업무</button>
        <button aria-pressed={scope === "team"} onClick={() => setScope("team")}>팀 전체</button>
      </div>
      {!visible.length && <p>{board.tasks.length ? "내게 배정된 업무가 없습니다." : <>계획을 확정하면 담당 업무가 여기에 표시됩니다. <Link href="/plan">계획 보기</Link></>}</p>}
      {visible.map(task => <article className={styles.card} key={task.id} id={`task-${task.id}`}>
        <div className={styles.top}><span className={styles.status} data-state={task.status}>{labels[task.status]}</span>
          <span>{board.members.find(m => m.id === task.assigneeId)?.name ?? "미등록"} · {task.due || "기한 미등록"}</span></div>
        <h2>{task.title}</h2>
        <p><strong>제출 기준</strong> {task.criteria}</p>
        <Recheck task={task} memberId={board.memberId} refresh={refresh} />
        {task.dependsOn.map(id => {
          const source = board.tasks.find(t => t.id === id);
          if (!source) return null;
          const isAssignee = task.assigneeId === board.memberId;
          return source.submission ? <details className={styles.detail} key={`${id}-${source.revision}`}
            onToggle={event => {
              if (event.currentTarget.open && isAssignee) void markOpened(id, source.revision, board.memberId);
            }}>
            <summary>원본 열기 · {source.title}
              {isAssignee && source.sourceChanged && <span className={styles.changed}>원본 변경됨</span>}
            </summary><Source submission={source.submission} />
          </details> : <p className={styles.wait} key={id}>제출 대기 · {source.title}</p>;
        })}
        {task.submission && <details className={styles.detail}><summary>제출한 원본</summary><Source submission={task.submission} /></details>}
        {canEditSubmission(task, board.memberId, board.tasks) && <details className={styles.detail}>
          <summary>{task.submission ? "제출물 보완" : "자료 제출"}</summary>
          <SubmitForm key={board.memberId} task={task} sources={board.tasks.filter(source => task.dependsOn.includes(source.id))}
            memberId={board.memberId} refresh={refresh} />
        </details>}
      </article>)}
    </>}
  </section>;
}
