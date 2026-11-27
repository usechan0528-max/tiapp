import { expect, test } from "@playwright/test";

test("예시 입력 결과를 표시하고 편집 후 다시 채울 수 있다", async ({ page }) => {
  await page.goto("/");
  const fill = page.getByRole("button", { name: "예시 채우기" });
  const status = page.locator("form").getByRole("status");
  await fill.click();
  await expect(page.getByLabel("팀 이름")).toHaveValue("가을 축제 운영 TF");
  await expect(status).toHaveText(/예시 입력을 마쳤습니다.*TF 만들기/);
  await expect(status).toBeInViewport();
  await page.getByLabel("팀 이름").fill("우리 팀");
  await expect(status).toBeEmpty();
  await fill.click();
  await expect(status).toBeVisible();
});

test("모바일 첫 화면의 조작 요소는 44px 이상이고 입력칸은 축소된 화면에 보인다", async ({ page }) => {
  await page.goto("/");
  for (const control of await page.locator("header a, form button, form input, form textarea, nav a").all()) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  for (const label of ["팀 목표", "가능 일정"]) {
    await page.setViewportSize({ width: 390, height: 820 });
    const field = page.getByLabel(label);
    await field.focus();
    await page.setViewportSize({ width: 390, height: 320 });
    await expect.poll(async () => {
      const box = await field.boundingBox();
      const nav = await page.getByRole("navigation").boundingBox();
      return !!box && !!nav && box.y >= 0 && box.y + box.height <= Math.min(320, nav.y);
    }).toBe(true);
  }
});
