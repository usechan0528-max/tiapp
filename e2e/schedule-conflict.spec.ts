import { devices, expect, test } from "@playwright/test";

test("두 모바일 팀원이 동시 수정 및 재연결 후에도 양쪽의 운영표 내용을 보존한다", async ({ browser, page: minseo, baseURL }) => {
  const peer = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  const jiwoo = await peer.newPage();
  const schedule = "10:00 | 접수 부스 | 지우";
  try {
    await minseo.goto("/");
    await minseo.getByRole("button", { name: "예시 채우기" }).click();
    await minseo.getByRole("button", { name: "TF 만들기" }).click();
    const invite = minseo.getByLabel("초대 링크");
    await expect(invite).toHaveValue(/\/join\//);
    await jiwoo.goto(await invite.inputValue());
    await jiwoo.getByRole("button", { name: "예시 채우기" }).click();
    await jiwoo.getByRole("button", { name: "팀 참여하기" }).click();
    await expect(jiwoo.getByText("지우 (나)", { exact: true })).toBeVisible();

    await minseo.goto("/plan");
    await minseo.getByRole("button", { name: "계획 초안 생성" }).click();
    await minseo.getByRole("button", { name: "계획 확정 및 업무 배정" }).click();
    await expect(minseo.getByText("버전 1 · 확정")).toBeVisible();
    await jiwoo.goto("/board");
    await jiwoo.getByText("자료 제출", { exact: true }).click();
    await jiwoo.getByLabel("제출 본문").fill(schedule);

    await minseo.goto("/board");
    const card = minseo.getByRole("region", { name: "업무 목록" }).getByRole("article");
    await expect(card.getByText("선행 업무 대기", { exact: true })).toBeVisible();
    await jiwoo.getByRole("button", {name:"제출하고 완료"}).click();
    await expect(jiwoo.getByText("제출물을 저장했습니다.")).toBeVisible();
    await minseo.getByRole("button", {name:"팀 전체"}).click();
    const source = card.filter({has:minseo.getByText("제출물 보완", {exact:true})});
    await source.getByText("제출물 보완", {exact:true}).click();
    const editor = jiwoo.getByLabel("제출 본문");
    const leaderEditor = source.getByLabel("제출 본문");
    if (!await editor.isVisible()) await jiwoo.getByText("제출물 보완", {exact:true}).click();
    for (const offline of [false, true]) {
      const before = await leaderEditor.inputValue();
      const venue = before + (offline ? "\n접수대 추가" : "\n동문으로 이동");
      const staff = before + (offline ? "\n인원 3명" : "\n담당 지우");
      await leaderEditor.fill(venue);
      if (offline) {
        await peer.setOffline(true);
        await expect(jiwoo.getByText(/오프라인 ·/)).toBeVisible();
      }
      await editor.fill(staff);
      let release = () => {};
      const held = new Promise<void>(resolve => { release = resolve; });
      const staleSave = offline ? null : jiwoo.waitForResponse(r => r.url().endsWith("/api/tasks") && r.request().method() === "POST", {timeout:10000});
      if (!offline) {
        await jiwoo.route("**/api/tasks", async route => {
          if (route.request().method() === "POST") await held;
          await route.continue();
        });
        const request = jiwoo.waitForRequest(r => r.url().endsWith("/api/tasks") && r.method() === "POST");
        await jiwoo.getByRole("button", {name:"보완 자료 저장"}).click();
        await request;
      }
      await source.getByRole("button", {name:"보완 자료 저장"}).click();
      await expect(source.getByText("제출물을 저장했습니다.")).toBeVisible();
      release();
      if (staleSave) {
        expect((await staleSave).status()).toBe(409);
        await jiwoo.unroute("**/api/tasks");
      }
      if (offline) {
        await peer.setOffline(false);
        await jiwoo.reload();
        await jiwoo.getByText("제출물 보완", {exact:true}).click();
      }
      await expect(editor).toHaveValue(staff);
      await expect(jiwoo.getByRole("region", {name:"운영표 변경 비교"}).getByText(/최신본이 변경/)).toBeVisible();
      await expect(jiwoo.getByRole("button", {name:"보완 자료 저장"})).toBeDisabled();
      await jiwoo.getByRole("button", {name:"최신본과 비교해 편집"}).click();
      await expect(editor).toHaveValue(staff);
      const merged = venue + staff.slice(before.length);
      await editor.fill(merged);
      await jiwoo.getByRole("button", {name:"보완 자료 저장"}).click();
      await expect(jiwoo.getByText("제출물을 저장했습니다.")).toBeVisible();
      await expect(leaderEditor).toHaveValue(merged);
    }
  } finally { await peer.close(); }
});
