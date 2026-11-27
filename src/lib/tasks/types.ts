export interface Assignment {
  id: string;
  title: string;
  assigneeId: string;
  due: string;
  dependsOn: string[];
  criteria: string;
}

export interface Submission {
  text: string;
  url?: string;
}

export interface Task extends Assignment {
  status: "waiting" | "ready" | "completed";
  submission: Submission | null;
}

export interface RowEvidence {
  sourceId: string;
  header: string[];
  previous: string[];
  latest: string[] | null;
  targetRevision: number;
  pending: boolean;
  reason: "changed" | "deleted" | "ambiguous" | null;
}

export interface BoardTask extends Task {
  revision: number;
  sourceChanged: boolean;
  rowEvidence?: RowEvidence;
}

export function canEditSubmission(task: Task, memberId: string, tasks: Task[]) {
  if (task.assigneeId === memberId) return task.status !== "waiting";
  return !!task.submission && tasks.some(next => next.assigneeId === memberId && next.dependsOn.includes(task.id));
}

function splitRow(line: string, separator: string) {
  const content = separator === "|" ? line.trim().replace(/^\||\|$/g, "") : line;
  return content.split(separator).map(cell => cell.trim());
}

export function sourceBlocks(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: (string | {header: string[]; rows: string[][]})[] = [];
  let plain: string[] = [];
  function flush() {
    if (plain.some(line => line.trim())) blocks.push(plain.join("\n"));
    plain = [];
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const separator = line.includes("\t") ? "\t" : "|";
    const next = lines[i + 1] ?? "";
    const header = splitRow(line, separator);
    const dividers = splitRow(next, separator);
    const isTable = header.length > 1 && header.length === dividers.length &&
      (separator === "\t" || dividers.every(cell => /^:?-{3,}:?$/.test(cell)));
    if (!isTable) { plain.push(line); continue; }
    flush();
    if (separator === "|") i++;
    const rows = [];
    while (i + 1 < lines.length && splitRow(lines[i + 1], separator).length === header.length)
      rows.push(splitRow(lines[++i], separator));
    blocks.push({ header, rows });
  }
  flush();
  return blocks;
}
