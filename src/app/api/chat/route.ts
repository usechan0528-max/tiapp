import { requireMember } from "../../../lib/team/auth";
import { json, respond } from "../../../lib/team/http";
import { addMessage, readRoom } from "../../../lib/chat/store";

export function GET(request: Request) {
  return respond(async () => json(readRoom((await requireMember(request)).teamId)));
}

export function POST(request: Request) {
  return respond(async () => {
    const actor = await requireMember(request);
    const input = await request.json();
    addMessage(actor, input?.body);
    return json({ok:true}, 201);
  });
}
