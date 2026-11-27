import { expect, test } from "@playwright/test";
import { fork } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

test("생성 버튼 한 번으로 일정 오류를 교정하고 새로고침 후에도 초안 한 건만 유지한다", async ({ page }, info) => {
  const database = info.outputPath("repair.sqlite");
  const server = fork(resolve("e2e/fixtures/plan-repair-server.cjs"), {
    env: { ...process.env, TF_DATABASE_PATH: database, TF_TEST_MODEL: "0", OPENAI_API_KEY: "e2e-unused",
      OPENAI_WORKER_URL: "", OPENAI_WORKER_SECRET: "" },
    execArgv: [],
  });
  const prompts: string[] = [];
  server.on("message", message => {
    if (typeof message === "string") prompts.push(message);
  });
  try {
    const [port] = await Promise.race([
      once(server, "message"),
      once(server, "exit").then(([code]) => { throw Error("테스트 서버 시작 실패 " + code); }),
    ]);
    expect(typeof port).toBe("number");
    const origin = "http://127.0.0.1:" + port;
    await page.goto(origin);
    await page.getByRole("button", { name: "예시 채우기" }).click();
    await page.getByLabel("마감일").fill("2027-05-30");
    await page.getByRole("button", { name: "TF 만들기" }).click();
    await expect(page.getByLabel("초대 링크")).toHaveValue(/\/join\//);
    await page.goto(origin + "/plan");

    const drafts: unknown[] = [];
    page.on("request", request => {
      if (request.url() === origin + "/api/plan" && request.method() === "POST") drafts.push(request.postDataJSON());
    });
    await page.getByRole("button", { name: "계획 초안 생성" }).click();
    const version = page.getByText("버전 1 · 검토 중", { exact: true });
    const task = page.getByRole("article").filter({ hasText: "운영표 작성" });
    await expect(version).toBeVisible();
    await expect(task).toContainText("2027-05-29 마감");

    await page.reload();
    await expect(version).toBeVisible();
    await expect(task).toContainText("2027-05-29 마감");
    expect(drafts).toEqual([expect.objectContaining({ action: "draft", version: 0 })]);
    expect(prompts).toHaveLength(2);
    const repair = JSON.parse(prompts[1].split("\n").at(-1)!);
    expect(repair.rule).toMatch(/tasks\[0\]\.due.*팀 마감일/);
    expect(JSON.parse(repair.rejectedPlan).tasks[0].due).toBe("2027-05-31");

    const db = new DatabaseSync(database, { readOnly: true });
    try {
      const versions = db.prepare("SELECT number, confirmed, body FROM plan_versions").all();
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({ number: 1, confirmed: 0 });
      expect(JSON.parse(String(versions[0].body)).tasks[0].due).toBe("2027-05-29");
    } finally { db.close(); }
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const stopped = once(server, "exit");
      server.kill();
      await stopped;
    }
  }
});
