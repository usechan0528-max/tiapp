import { requireMember, teamInfo } from "../../../lib/team/auth";
import { TeamError } from "../../../lib/team/store";
import { listTasks } from "../../../lib/tasks/read";
import { acknowledgeSource, recheckRow, submitTask, TaskError } from "../../../lib/tasks/submit";

async function getMember() {
  try { return await requireMember(); }
  catch { throw new TaskError(401, "TF에 먼저 참여하세요."); }
}

function handleError(error: unknown) {
  if (error instanceof TaskError || error instanceof TeamError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "업무 정보를 처리하지 못했습니다." }, { status: 500 });
}

export async function GET() {
  try {
    const { teamId, memberId } = await getMember();
    const { members } = teamInfo(teamId);
    return Response.json({ memberId, members: members.map(({ id, name }) => ({ id, name })), tasks: listTasks(teamId, memberId) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request) {
  try {
    const { teamId, memberId } = await requireMember(request);
    const input = await request.json().catch(() => null);
    if (typeof input?.id !== "string") throw new TaskError(400, "업무를 선택하세요.");
    submitTask(teamId, memberId, input.id, input);
    return Response.json({ ok: true });
  } catch (error) { return handleError(error); }
}

export async function PATCH(request: Request) {
  try {
    const { teamId, memberId } = await getMember();
    if (request.headers.get("X-TF-Member") !== memberId)
      throw new TaskError(409, "현재 팀이 바뀌었습니다. 화면을 다시 열어 주세요.");
    const input = await request.json().catch(() => null);
    if (typeof input?.id !== "string") throw new TaskError(400, "원본을 선택하세요.");
    if (input.action === "recheckRow")
      recheckRow(teamId, memberId, input.id, input.resultRevision, input.targetRevision);
    else if (input.action === undefined)
      acknowledgeSource(teamId, memberId, input.id, input.revision);
    else throw new TaskError(400, "확인 동작을 선택하세요.");
    return Response.json({ ok: true });
  } catch (error) { return handleError(error); }
}
