"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { BoardData, CheckInInput } from "../../lib/checkin/store";
import css from "./checkins.module.css";

const dateFormat = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function stamp(value: string) {
  return <time dateTime={value}>{dateFormat.format(new Date(value))}</time>;
}

type Task = BoardData["tasks"][number];

function Editor({ task, question, save }: {
  task: Task; question?: string; save: (input: CheckInInput) => Promise<void>;
}) {
  const delayId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const delay = Number(values.get("delay"));
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await save({
        taskId: task.id, previousId: task.latest?.id ?? null, text: String(values.get("text") ?? ""),
        blocker: String(values.get("blocker") ?? ""),
        nextCheckAt: delay ? new Date(Date.now() + delay * 1000).toISOString() : null,
      });
      form.reset();
      setNotice("팀에 공유했어요.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "기록하지 못했어요. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className={css.editor}>
    {question && <p className={css.question}><strong>후속 질문</strong>{question}</p>}
    <label>{question ? "후속 질문 답변" : "한 줄 체크인"}<textarea name="text" required maxLength={1000} rows={2} /></label>
    <label>막힌 이유 (선택)<input name="blocker" maxLength={500} placeholder="예: 업체의 견적 회신을 기다리고 있어요" /></label>
    <div><label htmlFor={delayId}>다음 확인</label><select id={delayId} name="delay" defaultValue="1800">
      <option value="10">10초 후</option><option value="1800">30분 후</option><option value="3600">1시간 후</option><option value="86400">하루 후</option><option value="0">예약 안 함</option>
    </select></div>
    <div><button disabled={busy}>{busy ? "저장 중…" : question ? "답변 공유" : "체크인 공유"}</button></div>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </form>;
}

export default function Checkins() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const version = ++latestRequest.current;
    try {
      const res = await fetch("/api/checkin", { cache: "no-store" });
      const data = await res.json();
      if (latestRequest.current !== version) return;
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setBoard(null);
        throw new Error(data.error);
      }
      setBoard(data); setError("");
    } catch (reason) {
      if (latestRequest.current === version) setError(reason instanceof Error ? reason.message : "진척을 불러올 수 없어요.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await load();
      if (active) timer = setTimeout(poll, 5000);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [load]);
  async function save(input: CheckInInput) {
    const res = await fetch("/api/checkin", { method: "POST", headers: { "Content-Type": "application/json", "X-TF-Member": board?.memberId ?? "" }, body: JSON.stringify(input) });
    if (!res.ok) {
      const data = await res.json();
      await load();
      throw new Error(data.error);
    }
    await load();
  }
  if (!error && board?.tasks.length === 0) return null;
  return <section className={css.section} aria-label="팀 체크인">
    <h2>팀 체크인</h2>
    {error && <p role="alert">{error}</p>}
    {!board && !error && <p>팀 진척을 불러오는 중…</p>}
    {board?.tasks.map(task => {
      const report = task.latest;
      const question = board.questions.find(q => q.taskId === task.id);
      return <article className={css.row} key={board.memberId + "/" + task.id}>
        <div className={css.heading}><h3>{task.title}</h3><span>{board.names[task.assigneeId]}</span></div>
        {report ? <>
          <p className={css.meta}>마지막 보고 {stamp(report.reportedAt)}</p><p>{report.text}</p>
          {report.blocker && !task.closed && <p><strong>막힌 이유</strong> · {report.blocker}</p>}
          {report.nextCheckAt && !task.closed && <p className={css.meta}>다음 확인 {stamp(report.nextCheckAt)}</p>}
        </> : <p className={css.meta}>아직 체크인이 없어요.</p>}
        {task.affected.length > 0 && <p className={css.meta}>자료를 기다리는 업무 · {task.affected.map(t => t.title + " (" + board.names[t.assigneeId] + ")").join(", ")}</p>}
        {task.assigneeId === board.memberId && !task.closed && <Editor task={task} save={save} question={question?.prompt} />}
      </article>;
    })}
  </section>;
}
