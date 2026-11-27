import { devices, expect, test, type Page } from "@playwright/test";

async function prepareTeam(minseo: Page, jiwoo: Page) {
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
}

test("지우가 운영표를 제출하면 열린 민서 업무 카드에 3초 안에 시작 가능 상태를 확인하고 원본을 연다", async ({ browser, page: minseo, baseURL }) => {
  const peer = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  const jiwoo = await peer.newPage();
  const schedule = "10:00 | 접수 부스 | 지우";
  try {
    await prepareTeam(minseo, jiwoo);
    await jiwoo.goto("/board");
    await jiwoo.getByText("자료 제출", { exact: true }).click();
    await jiwoo.getByLabel("제출 본문").fill(schedule);

    await minseo.goto("/board");
    const card = minseo.getByRole("region", { name: "업무 목록" }).getByRole("article");
    await expect(card.getByText("선행 업무 대기", { exact: true })).toBeVisible();
    const stored = jiwoo.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/tasks" && response.request().method() === "POST");
    const started = performance.now();
    const submit = jiwoo.getByRole("button", { name: "제출하고 완료" }).click();
    expect((await stored).ok()).toBe(true);
    const source = card.getByText(/원본 열기/);
    await Promise.all([
      expect(card.getByText("시작 가능", { exact: true })).toBeVisible({ timeout: 3000 }),
      expect(source).toBeVisible({ timeout: 3000 }),
    ]);
    await submit;
    await source.click();
    await expect(card.getByText(schedule, { exact: true })).toBeVisible();
    const elapsed = Math.ceil(performance.now() - started);
    console.info(`운영표 제출 클릭부터 민서의 원본 본문 확인까지 ${elapsed}ms`);
    expect(elapsed).toBeLessThanOrEqual(3000);
  } finally {
    await peer.close();
  }
});

test("연결한 운영표 행이 바뀌면 두 업무판에 재확인이 뜨고 담당자의 조치로 해제된다", async ({ browser, page: minseo, baseURL }) => {
  const peer = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  const jiwoo = await peer.newPage();
  const schedule = "시간\t장소\n10:00\t정문\n11:00\t강당";
  const result = "10:00 정문 안내 인력 2명 배치 확인";
  const notice = "다시 확인할 일 1건";
  try {
    await prepareTeam(minseo, jiwoo);
    await jiwoo.goto("/board");
    const source = jiwoo.getByRole("article").filter({ has: jiwoo.getByText("자료 제출", { exact: true }) });
    await source.getByText("자료 제출", { exact: true }).click();
    await source.getByLabel("제출 본문").fill(schedule);
    await source.getByRole("button", { name: "제출하고 완료" }).click();
    await expect(jiwoo.getByText("제출물을 저장했습니다.")).toBeVisible();

    await minseo.goto("/board");
    const card = minseo.getByRole("region", { name: "업무 목록" }).getByRole("article");
    await card.getByText(/원본 열기/).click();
    await card.getByText("자료 제출", { exact: true }).click();
    await card.getByLabel("근거 행").selectOption({ label: "10:00 · 정문" });
    await card.getByLabel("제출 본문").fill(result);
    await card.getByRole("button", { name: "제출하고 완료" }).click();
    await expect(card.getByText("완료", { exact: true })).toBeVisible();
    await jiwoo.getByRole("button", { name: "팀 전체" }).click();

    const editor = jiwoo.getByRole("region", { name: "업무 목록" }).getByLabel("제출 본문");
    if (!await editor.isVisible()) await jiwoo.getByText("제출물 보완", { exact: true }).click();
    const unrelated = schedule.replace("강당", "운동장");
    await editor.fill(unrelated);
    await jiwoo.getByRole("button", { name: "보완 자료 저장" }).click();
    await expect(card.getByText("원본 변경됨")).toBeVisible();
    await expect(card.getByText(notice)).toHaveCount(0);

    await editor.fill(unrelated.replace("정문", "동문"));
    await jiwoo.getByRole("button", { name: "보완 자료 저장" }).click();
    const request = card.getByRole("region", { name: notice });
    await expect(request.getByText("정문", { exact: true })).toBeVisible();
    await expect(request.getByText("동문", { exact: true })).toBeVisible();
    await expect(request.getByText(result)).toBeVisible();
    await expect(jiwoo.getByText(notice)).toBeVisible();
    await expect(jiwoo.getByRole("button", { name: "조치 완료" })).toHaveCount(0);
    await card.getByText(/원본 열기/).click();
    await expect(card.getByText("원본 변경됨")).toHaveCount(0);
    await expect(request).toBeVisible();
    await request.getByRole("button", { name: "조치 완료" }).click();
    await expect(request).toHaveCount(0);
    await expect(jiwoo.getByText(notice)).toHaveCount(0);
  } finally {
    await peer.close();
  }
});
