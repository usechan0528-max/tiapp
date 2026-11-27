import { requireMember, teamInfo } from "../../../lib/team/auth";
import { listTasks } from "../../../lib/tasks/read";
import { checkInBoard, CheckInError, recordCheckIn } from "../../../lib/checkin/store";

async function handle(request?: Request) {
  try {
    const actor = await requireMember(request);
    if (request) {
      const input = await request.json().catch(() => { throw new CheckInError("체크인 형식이 올바르지 않아요."); });
      recordCheckIn(actor, listTasks(actor.teamId), input);
    }
    const names = Object.fromEntries(teamInfo(actor.teamId).members.map(m => [m.id, m.name]));
    return Response.json({ ...checkInBoard(actor, listTasks(actor.teamId)), names }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof CheckInError ? error.status :
      error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
    return Response.json({ error: status === 401 ? "팀에 참여하면 체크인할 수 있어요." :
      error instanceof CheckInError ? error.message : "체크인을 불러올 수 없어요." }, { status });
  }
}

export function GET() { return handle(); }
export function POST(request: Request) { return handle(request); }
