export type Source = { id: string; title: string; assigneeId: string; assignee: string; text: string; url: string };
export type OutputInput = {
  title: string;
  sections: { title: string; criteria: string }[];
  sources: Source[];
};
export type Section = {
  kind: "text" | "table" | "links";
  body: string;
  rows: string[][];
  sourceIds: string[];
};
export type Issue = { section: number; taskId: string; reason: string };
export type Verification = { taskId: string; quote: string };
export type Assembly = { sections: (Section & { verification?: Verification[] })[]; issues: Issue[] };
export type Version = Omit<OutputInput, "sections"> & {
  version: number;
  sections: (Section & OutputInput["sections"][number])[];
  issues: Issue[];
};
export type History = { latest: Version | null; final: Version | null };
