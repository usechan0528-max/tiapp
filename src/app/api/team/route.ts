import { sessionToken } from "../../../lib/team/auth";
import { createTeam, currentInvite, membership, teamInfo } from "../../../lib/team/store";
import { json, respond, signedIn } from "../../../lib/team/http";

export function GET() {
  return respond(async () => {
    const session = await sessionToken();
    const me = membership(session);
    if (!me || !session) return json({me:null});
    return json({ me, team:teamInfo(me.teamId), invite:me.role === "leader" ? currentInvite(session) : null });
  });
}
export function POST(request: Request) {
  return respond(async () => signedIn(createTeam(await request.json(), await sessionToken()).session, request));
}
