import { requireMember, teamInfo } from "../../../lib/team/auth";
import { TeamError } from "../../../lib/team/store";
import { json } from "../../../lib/team/http";
import { confirmedPlan } from "../../../lib/plan/read";
import { listTasks } from "../../../lib/tasks/read";
import { assembleOutput, confirmOutput, getOutput, OutputError } from "../../../lib/output/service";

export const runtime = "nodejs";

function input(teamId: string) {
  const plan = confirmedPlan(teamId);
  if (!plan) return null;
  const members = new Map(teamInfo(teamId).members.map(m => [m.id, m.name]));
  const sources = listTasks(teamId).map(t => ({ id: t.id, title: t.title, assigneeId: t.assigneeId,
    assignee: members.get(t.assigneeId) ?? "담당자", text: t.submission?.text ?? "", url: t.submission?.url ?? "" }));
  return { title: plan.title, sections: plan.sections, sources };
}

async function handle(request?: Request) {
  try {
    const actor = await requireMember(request);
    const read = () => input(actor.teamId);
    if (request) {
      const body = await request.json().catch(() => null);
      if (body?.action === "assemble") await assembleOutput(actor.teamId, read);
      else if (body?.action === "confirm" && Number.isSafeInteger(body.version)) confirmOutput(actor.teamId, actor.role, body.version, read);
      else return json({ error: "작업과 버전을 확인해 주세요." }, 400);
    }
    const plan = read();
    return json({ ...getOutput(actor.teamId), role: actor.role, memberId: actor.memberId, planned: !!plan,
      total: plan?.sources.length ?? 0, submitted: plan?.sources.filter(s => s.text || s.url).length ?? 0 });
  } catch (e) {
    if (e instanceof TeamError || e instanceof OutputError) return json({ error: e.message }, e.status);
    return json({ error: "결과물을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }
}

export function GET() { return handle(); }
export function POST(request: Request) { return handle(request); }
