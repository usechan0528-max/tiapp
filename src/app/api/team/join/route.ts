import { sessionToken } from "../../../../lib/team/auth";
import { joinTeam, invitePreview, TeamError } from "../../../../lib/team/store";
import { json, respond, signedIn } from "../../../../lib/team/http";

export function GET(request: Request) {
  return respond(async () => json(invitePreview(new URL(request.url).searchParams.get("token") || "", await sessionToken())));
}
export function POST(request: Request) {
  return respond(async () => {
    const data = await request.json();
    if (typeof data?.token !== "string") throw new TeamError("초대 링크를 확인해 주세요.");
    return signedIn(joinTeam(data.token, data.member, await sessionToken()).session, request);
  });
}
