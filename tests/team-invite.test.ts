import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createTeam, joinTeam, closeInvite, rotateInvite, invitePreview, membership, personalTeams, selectTeam, teamInfo, currentInvite } from "../src/lib/team/store";

const leader = { name: "민서", role: "기획", availability: "오후" };
const member = { name: "지우", role: "디자인", availability: "금요일 오전" };
const team = { name: "축제 운영 TF", goal: "야간 행사 운영표 완성", deadline: "2026-12-20", member: leader };
beforeEach(() => vi.stubEnv("TF_DATABASE_PATH", join(mkdtempSync(join(tmpdir(), "tf-invite-")), "test.sqlite")));
afterEach(() => vi.unstubAllEnvs());

it("두 개인 세션은 같은 팀에 합류하고 재접속과 재가입은 기존 멤버를 유지한다", () => {
  const a = createTeam(team);
  const invite = currentInvite(a.session)!;
  expect(membership(invite)).toBeNull();
  const b = joinTeam(invite, member);
  expect(a.session).not.toBe(b.session);
  expect(membership(a.session)).toMatchObject({teamId:a.teamId, role:"leader"});
  expect(membership(b.session)).toMatchObject({teamId:a.teamId, role:"member"});
  expect(joinTeam(invite, member, b.session)).toEqual(b);
  expect(teamInfo(a.teamId).members.map(m => m.role)).toEqual(["기획","디자인"]);
});

it("링크 교체·폐쇄는 새 가입만 차단하고 기존 멤버를 보존한다", () => {
  const a = createTeam(team);
  const first = currentInvite(a.session)!;
  const b = joinTeam(first, member);
  expect(() => rotateInvite(b.session)).toThrow();
  expect(() => closeInvite(b.session)).toThrow();
  const next = rotateInvite(a.session);
  expect(next).not.toBe(first);
  expect(() => joinTeam(first, member)).toThrow();
  expect(invitePreview(next)).toEqual({name:team.name});
  closeInvite(a.session);
  expect(currentInvite(a.session)).toBeNull();
  expect(() => joinTeam(next, member)).toThrow();
  expect(joinTeam(first, member, b.session)).toEqual(b);
  expect(teamInfo(a.teamId).members).toHaveLength(2);
});

it("개인 팀 목록과 팀별 권한은 전환·재참여 후에도 유지된다", () => {
  const a = createTeam(team);
  const b = createTeam({...team,name:"B"}, a.session);
  const host = createTeam({...team,name:"C"});
  const invite = currentInvite(host.session)!;
  const joined = joinTeam(invite, member, b.session);
  expect(personalTeams(joined.session).map(t => t.role)).toEqual(["leader","leader","member"]);
  expect(membership(joined.session)?.role).toBe("member");
  expect(() => rotateInvite(joined.session)).toThrow();
  expect(membership(selectTeam(joined.session, a.teamId))?.memberId).toBe(a.memberId);
  expect(() => selectTeam(host.session, a.teamId)).toThrow();
  expect(joinTeam(invite, member, a.session).memberId).toBe(joined.memberId);
  expect(teamInfo(host.teamId).members).toHaveLength(2);
});
