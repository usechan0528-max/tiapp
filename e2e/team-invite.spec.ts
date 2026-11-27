import { devices, expect, test, type Page } from "@playwright/test";

const teamName = "가을 축제 운영 TF";
const expired = "사용이 종료된 초대 링크입니다. 팀장에게 새 링크를 요청해 주세요.";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function expectMemberHome(page: Page) {
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: teamName, exact: true })).toBeVisible();
  await expect(page.getByText("지우 (나)", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "참여 멤버 2", exact: true })).toBeVisible();
}

async function revisitInvite(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByText("이미 이 팀에 참여하고 있습니다.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "내 팀으로 돌아가기 →", exact: true }).click();
  await expectMemberHome(page);
}

test("TF 생성, 팀원 재접속, 초대 링크 교체와 폐쇄", async ({ browser, page: leader, baseURL }) => {
  const options = { ...devices["Pixel 7"], baseURL };
  const memberContext = await browser.newContext(options);
  const visitorContext = await browser.newContext(options);
  try {
    const member = await memberContext.newPage();
    const visitor = await visitorContext.newPage();
    const invite = leader.getByLabel("초대 링크", { exact: true });

    const first = await test.step("A가 TF를 만들고 초대 링크를 얻는다", async () => {
      const response = await leader.goto("/");
      expect(await response!.text()).toContain('name="teamName"');
      await expect(leader.getByRole("heading", { level: 1 })).toHaveText("팀장으로 팀 만들기");
      await button(leader, "예시 채우기").click();
      await button(leader, "TF 만들기").click();
      await expect(leader.getByRole("heading", { name: teamName, exact: true })).toBeVisible();
      await expect(leader.getByText("민서 (나)", { exact: true })).toBeVisible();
      await expect(leader.getByRole("heading", { name: "참여 멤버 1", exact: true })).toBeVisible();
      await expect(invite).toHaveValue(/\/join\/[^/]+$/);
      const url = new URL(await invite.inputValue());
      expect(url.origin).toBe(new URL(leader.url()).origin);
      return url.href;
    });

    await test.step("B가 가입하고 같은 세션으로 돌아온다", async () => {
      await member.goto(first);
      await button(member, "예시 채우기").click();
      await expect(member.locator("form").getByRole("status")).toHaveText(/예시 입력을 마쳤습니다.*팀 참여하기/);
      await button(member, "팀 참여하기").click();
      await expectMemberHome(member);
      await expect(member.getByText("민서", { exact: true })).toBeVisible();
      await expect(button(member, "링크 교체")).toHaveCount(0);
      await button(leader, "새로고침").click();
      await expect(leader.getByText("지우", { exact: true })).toBeVisible();
      await expect(leader.getByRole("heading", { name: "참여 멤버 2", exact: true })).toBeVisible();
      await member.reload();
      await expectMemberHome(member);
      await revisitInvite(member, first);
    });

    const second = await test.step("링크를 교체하면 C에게 새 링크만 열린다", async () => {
      await button(leader, "링크 교체").click();
      await expect(leader.getByText("새 링크가 준비됐습니다.", { exact: true })).toBeVisible();
      const url = await invite.inputValue();
      expect(url).not.toBe(first);
      await visitor.goto(first);
      await expect(visitor.getByRole("alert").filter({hasText:expired})).toHaveText(expired);
      await expect(button(visitor, "팀 참여하기")).toHaveCount(0);
      await visitor.goto(url);
      await expect(visitor.getByRole("heading", { name: teamName, exact: true })).toBeVisible();
      await expect(button(visitor, "팀 참여하기")).toBeVisible();
      return url;
    });

    await test.step("폐쇄 전 열린 폼에서도 신규 가입은 거절되고 기존 B는 유지된다", async () => {
      await button(leader, "초대 닫기").click();
      await expect(leader.getByText("초대가 닫혀 있습니다.", { exact: true })).toBeVisible();
      await expect(button(leader, "새 초대 링크 만들기")).toBeVisible();
      await button(visitor, "예시 채우기").click();
      await button(visitor, "팀 참여하기").click();
      await expect(visitor.getByRole("alert").filter({hasText:expired})).toHaveText(expired);
      await visitor.reload();
      await expect(visitor.getByRole("alert").filter({hasText:expired})).toHaveText(expired);
      await expect(button(visitor, "팀 참여하기")).toHaveCount(0);
      await revisitInvite(member, second);
    });
  } finally {
    await Promise.all([memberContext.close(), visitorContext.close()]);
  }
});

test("개인 페이지에서 팀장 팀과 초대로 가입한 팀을 오간다", async ({browser,page,baseURL}) => {
  const other = await browser.newContext({baseURL});
  try {
    const host = await other.newPage();
    for (const [client, name] of [[page,"운영팀"], [host,"홍보팀"]] as const) {
      await client.goto("/");
      await button(client,"예시 채우기").click();
      await client.getByLabel("팀 이름").fill(name);
      await button(client,"TF 만들기").click();
      await expect(client.getByLabel("초대 링크")).toBeVisible();
    }
    const invite = await host.getByLabel("초대 링크").inputValue();
    await page.getByRole("link",{name:"내 팀 관리"}).click();
    await page.getByLabel("초대 링크").fill(invite);
    await button(page,"초대 확인").click();
    await button(page,"예시 채우기").click();
    await button(page,"팀 참여하기").click();
    await expect(page.getByText("지우 (나)")).toBeVisible();
    await page.getByRole("link",{name:"내 팀 관리"}).click();
    const lead = page.getByRole("listitem").filter({hasText:"운영팀"});
    await expect(lead).toContainText("팀장");
    await expect(page.getByRole("listitem").filter({hasText:"홍보팀"})).toContainText("팀원");
    await lead.getByRole("button",{name:"팀 열기"}).click();
    await expect(page.getByRole("heading",{name:"운영팀"})).toBeVisible();
    await expect(page.getByLabel("초대 링크")).toBeVisible();
    await page.getByRole("link",{name:"내 팀 관리"}).click();
    await page.getByRole("link",{name:"새 팀 만들기"}).click();
    await button(page,"예시 채우기").click();
    await button(page,"TF 만들기").click();
    await expect(page.getByLabel("초대 링크")).toBeVisible();
    await page.goto("/me");
    await expect(page.getByRole("listitem")).toHaveCount(3);
    await host.goto("/me");
    await expect(host.getByRole("listitem")).toHaveCount(1);
  } finally { await other.close(); }
});
