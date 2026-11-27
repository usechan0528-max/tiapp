import { getVersions } from "./store";
import type { Plan } from "./types";

export function confirmedPlan(teamId: string): Pick<Plan, "title" | "sections" | "tasks"> | null {
  const latest = getVersions(teamId)[0];
  if (!latest?.confirmed) return null;
  const { title, sections, tasks } = latest;
  return { title, sections, tasks };
}
