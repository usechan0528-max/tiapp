"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Membership, TeamInfo } from "../../lib/team/store";
import { OpenTeam } from "./ProfileActions";
import styles from "./team.module.css";

type State = {me:null} | {me:Membership; team:TeamInfo; invite:string|null};
async function api<T>(path:string, body?:unknown, signal?:AbortSignal, memberId?:string): Promise<T> {
  const response = await fetch(path, {
    method:body ? "POST" : "GET", headers:body ? {"Content-Type":"application/json", ...(memberId && {"X-TF-Member":memberId})} : undefined,
    body:body ? JSON.stringify(body) : undefined, cache:"no-store", signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "요청을 처리하지 못했습니다.");
  return result;
}
function message(error:unknown) { return error instanceof Error ? error.message : "연결을 확인해 주세요."; }

function TeamForm({joinToken, onSuccess}:{joinToken?:string; onSuccess:()=>Promise<void>}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [exampleFilled, setExampleFilled] = useState(false);
  function example() {
    if (!form.current) return;
    const date = new Date();
    date.setDate(date.getDate()+7);
    const deadline = [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
    const values = {teamName:"가을 축제 운영 TF",goal:"무대, 안내 부스, 교대 시간을 담은 축제 당일 운영표를 완성한다.",deadline,
      name:joinToken ? "지우" : "민서",role:joinToken ? "현장 동선 설계" : "운영 총괄",availability:joinToken ? "평일 오후 3시 이후" : "평일 오전"};
    for (const [name,value] of Object.entries(values)) {
      const element = form.current.elements.namedItem(name);
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.value = value;
    }
    setError("");
    setExampleFilled(true);
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const member = { name:fields.get("name"),role:fields.get("role"),availability:fields.get("availability") };
    setBusy(true); setError("");
    try {
      if (joinToken) await api("/api/team/join",{token:joinToken,member});
      else await api("/api/team",{name:fields.get("teamName"),goal:fields.get("goal"),deadline:fields.get("deadline"),member});
      await onSuccess();
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  return <form ref={form} onSubmit={submit} onInput={() => setExampleFilled(false)} className={styles.form}>
    <div className={styles.formHead}><h2>{joinToken ? "참여 정보" : "팀 정보"}</h2><button type="button" className={styles.secondary} onClick={example}>예시 채우기</button></div>
    <p role="status" className={styles.exampleStatus}>{exampleFilled &&
      `예시 입력을 마쳤습니다. 내용을 확인하고 ‘${joinToken ? "팀 참여하기" : "TF 만들기"}’를 눌러 주세요.`}</p>
    {!joinToken && <>
      <label>팀 이름<input required name="teamName" maxLength={100} placeholder="가을 축제 운영 TF" /></label>
      <label>팀 목표<textarea required name="goal" maxLength={1000} /></label>
      <label>마감일<input required type="date" name="deadline" /></label>
      <h3 className={styles.subheading}>팀장 정보</h3>
    </>}
    <div className={styles.pair}>
      <label>내 이름<input required name="name" autoComplete="given-name" maxLength={60} placeholder="민서" /></label>
      <label>담당 역할<input required name="role" maxLength={100} placeholder="운영 총괄" /></label>
    </div>
    <label>가능 일정<input required name="availability" maxLength={300} placeholder="평일 오전, 목요일 오후 등" /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? "저장 중…" : joinToken ? "팀 참여하기" : "TF 만들기"}</button>
  </form>;
}

export function NewTeamScreen() {
  return <main><h1>팀장으로 팀 만들기</h1><TeamForm onSuccess={async () => { location.assign("/"); }}/></main>;
}

function Dashboard({state,refresh}:{state:Extract<State,{team:TeamInfo}>; refresh:()=>Promise<void>}) {
  const {me,team,invite} = state;
  const [status,setStatus] = useState("");
  const [busy,setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = invite ? new URL("/join/"+encodeURIComponent(invite),window.location.origin).href : "";
  async function manage(action:"rotate"|"close") {
    setBusy(true); setStatus("");
    try { await api("/api/team/invite",{action},undefined,me.memberId); await refresh(); setStatus(action === "rotate" ? "새 링크가 준비됐습니다." : "초대를 닫았습니다."); }
    catch (e) {setStatus(message(e));} finally {setBusy(false);}
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setStatus("초대 링크를 복사했습니다."); }
    catch { input.current?.select(); setStatus("선택한 링크를 복사해 주세요."); }
  }
  return <>
    <div className={styles.summary}><h1>{team.name}</h1><p>{team.goal}</p><div className={styles.meta}>마감일 <strong>{team.deadline}</strong></div></div>
    <section className={styles.block}><div className={styles.formHead}><h2>참여 멤버 <small>{team.members.length}</small></h2><button className={styles.secondary} onClick={()=>refresh().catch(e=>setStatus(message(e)))}>새로고침</button></div>
      <ul className={styles.members}>{team.members.map(m=><li key={m.id}><span className={styles.avatar} aria-hidden="true">{Array.from(m.name)[0]}</span><div><strong>{m.name}{me.memberId===m.id && " (나)"}</strong><span> {m.role} · {m.availability}</span></div></li>)}</ul>
    </section>
    {me.role==="leader" && <section className={styles.block}><h2>팀원 초대</h2>
      {invite ? <><label>초대 링크<input readOnly ref={input} value={url} onFocus={e=>e.target.select()} /></label>
        <div className={styles.buttons}><button onClick={copy}>링크 복사</button><button className={styles.secondary} disabled={busy} onClick={()=>manage("rotate")}>링크 교체</button><button className={styles.secondary} disabled={busy} onClick={()=>manage("close")}>초대 닫기</button></div>
      </> : <><p>초대가 닫혀 있습니다.</p><button disabled={busy} onClick={()=>manage("rotate")}>새 초대 링크 만들기</button></>}
    </section>}
    <p aria-live="polite">{status}</p>
    <Link className={styles.next} href="/plan">계획으로 이동 <span aria-hidden="true">→</span></Link>
  </>;
}

export function TeamScreen({hasSession}:{hasSession:boolean}) {
  const [state,setState] = useState<State|null>(hasSession ? null : {me:null});
  const [error,setError] = useState("");
  const refresh = useCallback(async (signal?:AbortSignal) => {
    const next = await api<State>("/api/team",undefined,signal);
    setState(next); setError("");
  },[]);
  useEffect(()=>{
    const abort = new AbortController();
    const load = () => refresh(abort.signal).catch(e=>{if (!abort.signal.aborted) setError(message(e));});
    load(); window.addEventListener("focus",load);
    return ()=>{abort.abort();window.removeEventListener("focus",load);};
  },[refresh]);
  if (state?.me) return <Dashboard state={state as Extract<State,{team:TeamInfo}>} refresh={refresh}/>;
  return <><h1>{state ? "팀장으로 팀 만들기" : "내 팀"}</h1>
    {state && <p>팀을 만들면 팀원에게 보낼 초대 링크가 생깁니다.</p>}
    {state ? <TeamForm onSuccess={refresh}/> : error ? <p role="alert">{error} <button onClick={()=>refresh().catch(e=>setError(message(e)))}>다시 불러오기</button></p> : <p role="status">팀 정보를 불러오는 중…</p>}
  </>;
}

export function JoinScreen({token}:{token:string}) {
  const [preview,setPreview] = useState<{name:string;joined?:boolean;switchTeam?:string}|null>(null);
  const [error,setError] = useState("");
  useEffect(()=>{
    const abort = new AbortController();
    api<{name:string;joined?:boolean;switchTeam?:string}>("/api/team/join?token="+encodeURIComponent(token),undefined,abort.signal)
      .then(setPreview).catch(e=>{if (!abort.signal.aborted) setError(message(e));});
    return ()=>abort.abort();
  },[token]);
  return <><h1>{preview ? preview.name : "TF 초대"}</h1>
    {error ? <><p role="alert">{error}</p><Link href="/">팀 홈으로</Link></> : !preview ? <p role="status">초대를 확인하는 중…</p>
      : preview.joined ? <><p>이미 이 팀에 참여하고 있습니다.</p>{preview.switchTeam ? <OpenTeam teamId={preview.switchTeam}/> : <Link className={styles.next} href="/">내 팀으로 돌아가기 →</Link>}</>
      : <>
        <TeamForm joinToken={token} onSuccess={async()=>{window.location.assign("/");}}/></>}
  </>;
}
