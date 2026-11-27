import { requireMember, sessionToken } from "../../../../lib/team/auth";
import { rotateInvite, closeInvite, TeamError } from "../../../../lib/team/store";
import { json, respond } from "../../../../lib/team/http";

export function POST(request: Request) {
  return respond(async () => {
    const action = (await request.json())?.action;
    await requireMember(request);
    const session = await sessionToken() || "";
    if (action === "rotate") return json({invite:rotateInvite(session)});
    if (action === "close") { closeInvite(session); return json({invite:null}); }
    throw new TeamError("초대 설정을 확인해 주세요.");
  });
}
