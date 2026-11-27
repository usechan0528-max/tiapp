"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, SharedNote } from "../../lib/chat/types";
import styles from "./chat.module.css";

type Room = {messages:ChatMessage[]; notes:SharedNote[]};

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month:"short", day:"numeric", hour:"numeric", minute:"2-digit", timeZone:"Asia/Seoul",
});

export default function ChatRoom({memberId, teamName}:{memberId:string; teamName:string}) {
  const [room, setRoom] = useState<Room>();
  const [notesOpen, setNotesOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [readyToSend, setReadyToSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const log = useRef<HTMLOListElement>(null);
  const followLatest = useRef(true);
  const sequence = useRef(0);
  const submitting = useRef(false);
  const refresh = useCallback(async (signal?:AbortSignal) => {
    const request = ++sequence.current;
    try {
      const response = await fetch("/api/chat", {headers:{"X-TF-Member":memberId},cache:"no-store",signal});
      const result = await response.json();
      if (request !== sequence.current || signal?.aborted) return;
      if (!response.ok) {
        if (response.status === 401 || response.status === 409) setRoom(undefined);
        throw new Error(result.error || "대화를 불러오지 못했어요.");
      }
      setRoom(result);
      setLoadError("");
    } catch (error) {
      if (!signal?.aborted && request === sequence.current) setLoadError(error instanceof Error ? error.message : "연결을 확인해 주세요.");
    }
  }, [memberId]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!document.hidden) await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(poll, 1200);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);

  useEffect(() => {
    if (!notesOpen && log.current && followLatest.current) log.current.scrollTop = log.current.scrollHeight;
  }, [room?.messages.length, notesOpen]);

  async function send(event:FormEvent) {
    event.preventDefault();
    const draft = input.current?.value.trim();
    if (!draft || composing.current || submitting.current) return;
    submitting.current = true;
    setSending(true);
    setSendError("");
    try {
      const response = await fetch("/api/chat", {method:"POST",headers:{"Content-Type":"application/json","X-TF-Member":memberId},
        body:JSON.stringify({body:draft})});
      if (!response.ok) throw new Error((await response.json()).error || "메시지를 보내지 못했어요.");
      if (input.current) input.current.value = "";
      setReadyToSend(false);
      followLatest.current = true;
      await refresh();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "연결을 확인해 주세요.");
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  function showSource(id:number) {
    followLatest.current = false;
    setNotesOpen(false);
    requestAnimationFrame(() => {
      const row = document.getElementById("chat-message-" + id);
      row?.focus({preventScroll:true});
      row?.scrollIntoView({block:"nearest"});
    });
  }

  return <div className={styles.room}>
    <p className={styles.team}>{teamName}</p>
    <div className={styles.switcher} role="group" aria-label="채팅방 보기">
      <button type="button" aria-pressed={!notesOpen} onClick={() => setNotesOpen(false)}>대화</button>
      <button type="button" aria-pressed={notesOpen} onClick={() => setNotesOpen(true)}>공유 노트 {room?.notes.length || ""}</button>
    </div>
    {loadError && <p role="alert">{loadError}</p>}
    {!room && !loadError && <p role="status">채팅방을 여는 중이에요.</p>}
    {room && <><section hidden={notesOpen} aria-label="팀 대화">
      <ol className={styles.log} aria-label="메시지 목록" ref={log} onScroll={e => {
        const el = e.currentTarget;
        followLatest.current = el.scrollHeight - el.clientHeight - el.scrollTop < 50;
      }}>
        {room.messages.map(message => <li key={message.id} id={"chat-message-" + message.id} tabIndex={-1}>
          <header><strong>{message.name}</strong><time dateTime={message.createdAt}>{dateFormat.format(new Date(message.createdAt))}</time></header>
          <p>{message.body}</p>
        </li>)}
      </ol>
      {!room.messages.length && <p className={styles.empty}>팀원에게 첫 메시지를 보내 보세요.</p>}
      <form onSubmit={send} className={styles.composer}>
        <label>메시지<textarea ref={input} rows={2} disabled={sending} maxLength={2000}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={event => {
            composing.current = false;
            setReadyToSend(Boolean(event.currentTarget.value.trim()));
          }}
          onInput={event => {
            setReadyToSend(Boolean(event.currentTarget.value.trim()));
          }} placeholder="팀에 전할 내용을 입력하세요"/></label>
        <button type="submit" disabled={sending || !readyToSend}>{sending ? "보내는 중" : "보내기"}</button>
        {sendError && <p role="alert">{sendError}</p>}
      </form>
    </section><section hidden={!notesOpen} aria-label="팀 공유 노트">
      <p className={styles.interval}>에이전트가 5분마다 새 대화를 확인해 공유 노트로 정리해요.</p>
      {!room.notes.length && <p className={styles.empty}>첫 공유 노트가 여기에 표시돼요.</p>}
      {room.notes.map(note => <article className={styles.note} key={note.firstId}>
        <h2><time dateTime={note.createdAt}>{dateFormat.format(new Date(note.createdAt))}</time> 공유 노트</h2>
        {note.items.map((item, index) => <div key={index}>
          <strong>{item.kind}</strong><p>{item.text}</p>
          <button type="button" onClick={() => showSource(item.sourceId)}>근거 메시지</button>
        </div>)}
      </article>)}
    </section></>}
  </div>;
}
