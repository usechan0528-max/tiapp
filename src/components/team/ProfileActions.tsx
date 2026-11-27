"use client";
import { useState, type FormEvent } from "react";
import styles from "./team.module.css";

export function OpenTeam({teamId,current=false}:{teamId:string;current?:boolean}) {
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const result = await fetch("/api/team/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamId})});
      if (!result.ok) throw new Error((await result.json()).error);
      location.assign("/");
    } catch (e) { setError(e instanceof Error ? e.message : "팀을 열지 못했습니다."); setBusy(false); }
  }
  return <><button disabled={busy} onClick={open}>{current ? "현재 팀 열기" : "팀 열기"}</button>{error && <p role="alert">{error}</p>}</>;
}

export function InviteEntry() {
  const [error,setError] = useState("");
  function join(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const url = new URL(String(new FormData(event.currentTarget).get("invite")).trim(),location.origin);
      if (!/^\/join\/[A-Za-z0-9_-]+$/.test(url.pathname)) throw new Error();
      location.assign(url.pathname);
    } catch { setError("팀장이 보낸 초대 링크를 입력해 주세요."); }
  }
  return <form className={styles.block} onSubmit={join}><h2>초대로 팀 참여</h2>
    <label>초대 링크<input name="invite" required placeholder="팀장이 보낸 링크 붙여넣기"/></label>
    <button>초대 확인</button>{error && <p role="alert">{error}</p>}
  </form>;
}
