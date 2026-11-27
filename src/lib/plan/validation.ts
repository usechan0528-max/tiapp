import { PlanError, type Plan, type PlanTeam, type Task } from "./types";

export class InvalidPlan extends PlanError {
  constructor(path: string, rule: string) {
    super(`${path} — ${rule}`, 502);
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new InvalidPlan(path, "객체가 필요합니다.");
  return value as Record<string, unknown>;
}
function list(value: unknown, path: string, min = 1): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > 100) throw new InvalidPlan(path, `항목이 ${min}~100개인 배열이 필요합니다.`);
  return value;
}
function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 4000) throw new InvalidPlan(path, "1~4,000자의 문자열이 필요합니다.");
  return value.trim();
}

export function validatePlan(value: unknown, team: PlanTeam): Plan {
  const body = record(value, "plan");
  const title = string(body.title, "title");
  const sections = list(body.sections, "sections").map((value, i) => {
    const path = `sections[${i}]`;
    const row = record(value, path);
    return { title: string(row.title, path + ".title"), criteria: string(row.criteria, path + ".criteria") };
  });
  const indices = new Map<string, number>();
  const tasks = list(body.tasks, "tasks").map((value, i) => {
    const path = `tasks[${i}]`;
    const row = record(value, path);
    const task: Task = {
      id: string(row.id, path + ".id"), title: string(row.title, path + ".title"),
      assigneeId: string(row.assigneeId, path + ".assigneeId"), due: string(row.due, path + ".due"),
      criteria: string(row.criteria, path + ".criteria"),
      dependsOn: list(row.dependsOn, path + ".dependsOn", 0).map((id, j) => string(id, `${path}.dependsOn[${j}]`)),
    };
    if (indices.has(task.id)) throw new InvalidPlan(path + ".id", "업무 ID가 중복됩니다.");
    indices.set(task.id, i);
    if (!team.members.some(member => member.id === task.assigneeId)) throw new InvalidPlan(path + ".assigneeId", "팀원의 ID를 지정해야 합니다.");
    const date = new Date(task.due + "T00:00:00Z");
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== task.due) throw new InvalidPlan(path + ".due", "유효한 YYYY-MM-DD 날짜가 필요합니다.");
    if (task.due > team.deadline.slice(0, 10)) throw new InvalidPlan(path + ".due", "팀 마감일을 초과합니다.");
    if (new Set(task.dependsOn).size !== task.dependsOn.length) throw new InvalidPlan(path + ".dependsOn", "중복된 선행 업무가 있습니다.");
    return task;
  });
  const visited = new Set<number>();
  const active = new Set<number>();
  function visit(i: number) {
    if (visited.has(i)) return;
    active.add(i);
    for (const id of tasks[i].dependsOn) {
      const before = indices.get(id);
      const path = `tasks[${i}]`;
      if (before === undefined) throw new InvalidPlan(path + ".dependsOn", "선행 업무 ID가 존재하지 않습니다.");
      if (active.has(before)) throw new InvalidPlan(path + ".dependsOn", "업무 간 순환 의존성이 있습니다.");
      if (tasks[before].due > tasks[i].due) throw new InvalidPlan(path + ".due", `선행 업무 tasks[${before}]보다 마감이 빠릅니다.`);
      visit(before);
    }
    active.delete(i);
    visited.add(i);
  }
  tasks.forEach((_, i) => visit(i));
  const changes = list(body.changes, "changes", 0).map((v, i) => string(v, `changes[${i}]`));
  return { title, sections, tasks, changes };
}
