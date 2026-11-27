import type { Assignment as Task } from "../tasks/types";

export type Actor = { teamId: string; memberId: string; role: "leader" | "member" };
export type PlanTeam = { id: string; name: string; goal: string; deadline: string; members: { id: string; name: string; role: string; availability: string }[] };
export type { Assignment as Task } from "../tasks/types";
export type Plan = { title: string; sections: { title: string; criteria: string }[]; tasks: Task[]; changes: string[] };
export type Feedback = { memberId: string; text: string };
export type Version = Plan & { number: number; confirmed: boolean; feedback: Feedback[] };
export type PlanState = { team: PlanTeam; actor: Actor; versions: Version[] };

export class PlanError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
