import { requireMember, teamInfo } from "../../../lib/team/auth";
import { TeamError } from "../../../lib/team/store";
import { assignTasks } from "../../../lib/tasks/assign";
import { generatePlan } from "../../../lib/plan/model";
import { addFeedback, confirmPlan, getVersions, requireLeader, saveVersion } from "../../../lib/plan/store";
import { PlanError, type Actor } from "../../../lib/plan/types";

export const runtime = "nodejs";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

function state(actor: Actor) {
  return { actor, team: teamInfo(actor.teamId), versions: getVersions(actor.teamId) };
}
function failure(error: unknown) {
  if (error instanceof PlanError || error instanceof TeamError) return json({ error: error.message }, error.status);
  return json({ error: "요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
}

export async function GET() {
  try { return json(state(await requireMember())); } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireMember(request);
    const body = await request.json().catch(() => null);
    if (!body || !Number.isSafeInteger(body.version) || body.version < 0) throw new PlanError("계획 버전을 확인해 주세요.");
    const { action, version } = body;
    if (action === "feedback" && typeof body.text === "string") {
      addFeedback(actor, version, body.text);
    } else if (action === "confirm") {
      confirmPlan(actor, version, assignTasks);
    } else if (action === "draft" || action === "revise") {
      requireLeader(actor);
      const { team, versions } = state(actor);
      const previous = versions[0];
      if ((previous?.number ?? 0) !== version || previous?.confirmed || Boolean(previous) !== (action === "revise")) {
        throw new PlanError("최신 계획을 확인한 뒤 다시 시도해 주세요.", 409);
      }
      if (action === "revise" && !previous.feedback.length) throw new PlanError("수정할 의견을 먼저 등록해 주세요.");
      const plan = await generatePlan(team, previous);
      saveVersion(actor, version, previous?.feedback.length ?? 0, plan);
    } else {
      throw new PlanError("요청 종류를 확인해 주세요.");
    }
    return json(state(actor));
  } catch (error) { return failure(error); }
}
