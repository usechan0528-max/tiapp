export type ChatMessage = { id: number; name: string; body: string; createdAt: string };
export type NoteItem = { kind: "주요 논의" | "결정 사항" | "할 일" | "미해결 질문"; text: string; sourceId: number };
export type SharedNote = { firstId: number; lastId: number; createdAt: string; items: NoteItem[] };
