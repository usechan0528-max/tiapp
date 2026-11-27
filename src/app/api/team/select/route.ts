import { sessionToken } from "../../../../lib/team/auth";
import { selectTeam, TeamError } from "../../../../lib/team/store";
import { respond, signedIn } from "../../../../lib/team/http";

export function POST(request: Request) {
  return respond(async () => {
    const { teamId } = await request.json() ?? {};
    if (typeof teamId !== "string") throw new TeamError("팀을 선택해 주세요.");
    return signedIn(selectTeam(await sessionToken() || "", teamId), request);
  });
}
