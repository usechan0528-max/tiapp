import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(path = process.env.TF_DATABASE_PATH || join(process.cwd(), "data", "tf.sqlite")) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    const version = db.prepare("PRAGMA user_version").get()?.user_version;
    if (version === 0) db.exec("PRAGMA user_version = 1");
    else if (version !== 1) throw new Error("지원하지 않는 DB 버전입니다.");
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
