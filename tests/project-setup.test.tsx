import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { openDatabase } from "../src/lib/database";
import { Navigation, destinations } from "../src/components/AppShell";

it("파일 DB를 다시 초기화해도 저장한 행과 스키마가 유지된다", () => {
  const path = join(mkdtempSync(join(tmpdir(), "tf-")), "data", "test.sqlite");
  const db = openDatabase(path);
  try {
    db.exec("CREATE TABLE probe (value TEXT); INSERT INTO probe VALUES ('보존')");
  } finally {
    db.close();
  }
  const reopened = openDatabase(path);
  try {
    expect(reopened.prepare("SELECT value FROM probe").get()).toEqual({ value: "보존" });
    expect(reopened.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(reopened.prepare("PRAGMA user_version").get()).toEqual({ user_version: 1 });
  } finally {
    reopened.close();
  }
});

it.each(destinations)("$href 화면에서 네 경로로 이동하고 현재 위치를 확인한다", ({ href: path }) => {
  const html = renderToStaticMarkup(<Navigation path={path} />);
  for (const href of ["/", "/plan", "/board", "/output"]) expect(html).toContain(`href="${href}"`);
  const currentLinks = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
  expect(currentLinks).toHaveLength(1);
  expect(currentLinks[0]).toContain(`href="${path}"`);
});
