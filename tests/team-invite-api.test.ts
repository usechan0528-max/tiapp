import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET as teamHome, POST as create } from "../src/app/api/team/route";
import { POST as joinInvite } from "../src/app/api/team/join/route";
import { POST as manage } from "../src/app/api/team/invite/route";
import { requireMember, SESSION_COOKIE } from "../src/lib/team/auth";

const browser = vi.hoisted(()=>({ session: "" }));
vi.mock("next/headers", ()=>({ cookies:async()=>({get:()=>({value:browser.session})}) }));
beforeEach(() => {
  browser.session = "";
  vi.stubEnv("TF_DATABASE_PATH",join(mkdtempSync(join(tmpdir(),"tf-api-")),"teams.sqlite"));
});
afterEach(()=>vi.unstubAllEnvs());
function post(body:unknown) {
  return new Request("https://campus.example/api/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
const member = {name:"민서",role:"발표",availability:"오후"};
const team = {name:"행사 TF",goal:"시간표 완성",deadline:"2026-12-15",member};

it("팀 홈과 초대 관리는 쿠키 소속을 사용하고 초대 링크는 개인 세션 권한을 주지 않는다",async()=>{
  await expect(requireMember()).rejects.toMatchObject({status:401});
  const leader = await create(post(team));
  const cookie = leader.cookies.get(SESSION_COOKIE)!;
  expect(cookie).toMatchObject({httpOnly:true,secure:true,path:"/"});
  browser.session = cookie.value;
  const {invite,me} = await (await teamHome()).json();
  browser.session = invite;
  expect(await (await teamHome()).json()).toEqual({me:null});
  const newcomer = await joinInvite(post({token:invite,member,role:"leader"}));
  browser.session = newcomer.cookies.get(SESSION_COOKIE)!.value;
  const info = await (await teamHome()).json();
  expect(info.me).toMatchObject({teamId:me.teamId,role:"member"});
  expect(info.invite).toBeNull();
  expect((await manage(post({action:"close",role:"leader"}))).status).toBe(403);

  browser.session = "";
  const other = await create(post({...team,name:"별도 TF"}));
  browser.session = other.cookies.get(SESSION_COOKIE)!.value;
  expect((await (await teamHome()).json()).team.name).toBe("별도 TF");
  expect((await joinInvite(post({token:invite,member}))).status).toBe(200);
});

it("올바르지 않은 날짜와 참여 정보로 팀을 생성할 수 없다",async()=>{
  expect((await create(post({...team,deadline:"2026-02-30"}))).status).toBe(400);
  expect((await create(post({...team,member:{...member,name:"   "}}))).status).toBe(400);
});

it("다른 탭에서 팀을 전환하면 이전 팀의 초대 수정 요청은 거절한다", async () => {
  const first = await create(post(team));
  browser.session = first.cookies.get(SESSION_COOKIE)!.value;
  const before = await (await teamHome()).json();
  const second = await create(post({...team,name:"두 번째 팀"}));
  browser.session = second.cookies.get(SESSION_COOKIE)!.value;
  const request = post({action:"close"});
  request.headers.set("X-TF-Member", before.me.memberId);
  expect((await manage(request)).status).toBe(409);
  expect((await (await teamHome()).json()).invite).toBeTruthy();
});
