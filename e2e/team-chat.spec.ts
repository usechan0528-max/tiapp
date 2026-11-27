import { devices, expect, test } from "@playwright/test";

test("두 팀원이 팀 채팅의 자동 공유 노트를 열고 근거 메시지를 확인한다", async ({ browser, page, baseURL }) => {
  const peer = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  const other = await peer.newPage();
  const body = "발표 시간은 3분으로 확정합니다.";
  try {
    await page.goto("/");
    await page.getByRole("button", {name:"예시 채우기"}).click();
    await page.getByRole("button", {name:"TF 만들기"}).click();
    const invite = page.getByLabel("초대 링크");
    await expect(invite).toHaveValue(/\/join\//);
    await other.goto(await invite.inputValue());
    await other.getByRole("button", {name:"예시 채우기"}).click();
    await other.getByRole("button", {name:"팀 참여하기"}).click();
    await expect(other.getByText("지우 (나)", {exact:true})).toBeVisible();
    await page.goto("/board");
    await page.getByRole("link", {name:"팀 채팅"}).click();
    await page.getByRole("textbox", {name:"메시지", exact:true}).fill(body);
    await page.getByRole("button", {name:"보내기"}).click();
    await expect(page.getByRole("listitem").filter({hasText:body})).toBeVisible();
    await page.goto("/board");
    await expect.poll(async () => (await (await page.request.get("/api/chat")).json()).notes.length, {timeout: 18000}).toBe(1);
    for (const participant of [other, page]) {
      await participant.goto("/chat");
      await participant.getByRole("button", {name:/공유 노트/}).click();
      await participant.getByRole("button", {name:"근거 메시지"}).first().click();
      await expect(participant.getByRole("listitem").filter({hasText:body})).toBeFocused();
    }
  } finally {
    await peer.close();
  }
});

test("새 대화를 조회하는 동안 한글 조합을 유지하고 확정한 문장만 보낸다", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", {name:"예시 채우기"}).click();
  await page.getByRole("button", {name:"TF 만들기"}).click();
  await expect(page.getByLabel("초대 링크")).toHaveValue(/\/join\//);
  await page.goto("/chat");
  const input = page.getByRole("textbox", {name:"메시지", exact:true});
  await input.focus();
  const ime = await context.newCDPSession(page);
  await ime.send("Input.imeSetComposition", {text:"업무르", selectionStart:3, selectionEnd:3});
  await page.waitForResponse(response => response.url().endsWith("/api/chat") && response.request().method() === "GET");
  await expect(input).toHaveValue("업무르");
  await input.evaluate(el => (el as HTMLTextAreaElement).form!.requestSubmit());
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue("업무르");
  await ime.send("Input.insertText", {text:"업무를"});
  await expect(input).toHaveValue("업무를");
  await page.getByRole("button", {name:"보내기"}).click();
  await expect(page.getByRole("listitem").getByText("업무를", {exact:true})).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("listitem").getByText("업무르", {exact:true})).toHaveCount(0);
});
