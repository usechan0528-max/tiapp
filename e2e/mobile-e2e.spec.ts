import { expect, test, devices, type Page } from "@playwright/test";

test("두 팀원이 초대부터 계획 수정, 자료 인계, 최종 검수를 함께 마친다", async ({ browser, page: lead, baseURL }) => {
  const peer = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  const member = await peer.newPage();
  const note = "현장 동선을 먼저 확인하고 2026-12-01까지 자료를 정리합니다.";
  const source = "10:00 | 접수 부스 | 지우";
  const checklist = "현장 점검표 · 정문 안내 인력 배치 확인";
  try {
    await lead.goto("/");
    await lead.getByRole("button", { name: "예시 채우기" }).click();
    await lead.getByLabel("마감일").fill("2026-12-15");
    await lead.getByRole("button", { name: "TF 만들기" }).click();
    const invite = lead.getByLabel("초대 링크");
    await expect(invite).toHaveValue(/\/join\//);
    await member.goto(await invite.inputValue());
    await member.getByRole("button", { name: "예시 채우기" }).click();
    await member.getByRole("button", { name: "팀 참여하기" }).click();
    await expect(member.getByText("지우 (나)", { exact: true })).toBeVisible();

    await lead.goto("/plan");
    await lead.getByRole("button", { name: "계획 초안 생성" }).click();
    await expect(lead.getByText("버전 1 · 검토 중")).toBeVisible();
    await member.goto("/plan");
    await member.getByLabel("피드백", { exact: true }).fill(note);
    await member.getByRole("button", { name: "피드백 등록" }).click();
    await expect(member.getByText(note, { exact: false }).first()).toBeVisible();
    await lead.reload();
    await lead.getByRole("button", { name: "피드백 반영해 수정안 생성" }).click();
    await expect(lead.getByText("버전 2 · 검토 중")).toBeVisible();
    await expect(lead.getByText(/2026-12-01/).first()).toBeVisible();
    await lead.getByRole("button", { name: "계획 확정 및 업무 배정" }).click();
    await expect(lead.getByText("버전 2 · 확정")).toBeVisible();

    await member.goto("/board");
    await member.getByLabel("한 줄 체크인").fill("동선을 확인하고 있습니다.");
    await member.getByLabel(/막힌 이유/).fill("입구 위치 확인 대기");
    const nextCheck = member.getByRole("combobox", { name: /다음 확인/ });
    await expect(nextCheck).toBeVisible();
    await nextCheck.selectOption("10");
    await member.getByRole("button", { name: "체크인 공유" }).click();
    await lead.goto("/board");
    for (const page of [lead, member]) await expect(page.getByText(/입구 위치 확인 대기/).first()).toBeVisible();
    await expect(member.getByLabel("후속 질문 답변")).toBeVisible({timeout:22000});
    await member.getByLabel("후속 질문 답변").fill("정문으로 확정했습니다.");
    await member.getByRole("combobox", { name: /다음 확인/ }).selectOption("0");
    await member.getByRole("button", { name: "답변 공유" }).click();
    for (const page of [lead, member]) {
      await expect(page.getByText("정문으로 확정했습니다.", {exact:true})).toBeVisible({timeout:12000});
      await expect(page.getByText(/입구 위치 확인 대기/)).toHaveCount(0);
    }

    async function submit(page: Page, text: string) {
      await page.getByText("자료 제출", {exact:true}).click();
      await page.getByLabel("제출 본문").fill(text);
      await page.getByRole("button", {name:"제출하고 완료"}).click();
      await expect(page.getByText("제출한 원본", {exact:true})).toBeVisible();
    }
    await submit(member, source);
    await lead.reload();
    const openSource = lead.getByText(/원본 열기 ·/).first();
    const readResponse = () => lead.waitForResponse(response =>
      response.url().endsWith("/api/tasks") && response.request().method() === "PATCH" && response.ok());
    await Promise.all([readResponse(), openSource.click()]);
    await expect(lead.getByText(source, {exact:true})).toBeVisible();
    await member.reload();
    await member.getByText("제출물 보완", { exact: true }).click();
    const updated = source + " (수정)";
    await member.getByLabel("제출 본문").fill(updated);
    await member.getByRole("button", { name: "보완 자료 저장" }).click();
    await expect(member.getByText("제출물을 저장했습니다.")).toBeVisible();
    await lead.reload();
    const change = lead.getByText("원본 변경됨", { exact: true });
    await expect(change).toBeVisible();
    await Promise.all([readResponse(), openSource.click()]);
    await expect(lead.getByText(updated, { exact: true })).toBeVisible();
    await expect(change).toHaveCount(0);
    await lead.reload();
    await expect(openSource).toBeVisible();
    await expect(change).toHaveCount(0);
    await submit(lead, checklist);
    await lead.goto("/output");
    await lead.getByRole("button", {name:"취합본 생성"}).click();
    await lead.getByRole("button", {name:"이 버전 확정"}).click();
    await expect(lead.getByText(/버전 1 · 확정본/)).toBeVisible();
    await member.goto("/output");
    await expect(member.getByText(/버전 1 · 확정본/)).toBeVisible();
    const confirmedText = await lead.getByRole("article").innerText();
    for (const page of [lead, member]) {
      const output = page.getByRole("article");
      await expect(output).toHaveText(confirmedText, { useInnerText: true });
      for (const original of [updated, checklist]) {
        const detail = output.locator("details").filter({ has: page.getByText(original, { exact: true }) }).first();
        await detail.locator("summary").click();
        await expect(detail.getByText(original, { exact: true })).toBeVisible();
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  } finally { await peer.close(); }
});
