import { cookies } from "next/headers";
import { membership, TeamError } from "./store";
export { teamInfo } from "./store";

export const SESSION_COOKIE = "tf_session";
export async function sessionToken() { return (await cookies()).get(SESSION_COOKIE)?.value; }
export async function requireMember(request?: Request) {
  const member = membership(await sessionToken());
  if (!member) throw new TeamError("먼저 TF를 만들거나 초대 링크로 참여해 주세요.",401);
  const expected = request?.headers.get("X-TF-Member");
  if (expected && expected !== member.memberId) throw new TeamError("현재 팀이 바뀌었습니다. 화면을 다시 열어 주세요.",409);
  return member;
}
