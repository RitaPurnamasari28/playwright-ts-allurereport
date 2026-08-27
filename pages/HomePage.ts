import { expect, Page } from "@playwright/test";

export class HomePage {
  constructor(private page: Page) {}

  async openWebsite() {
    await this.page.goto("https://automationexercise.com/", {
      waitUntil: "domcontentloaded",
    });

    await this.page.screenshot({
      path: "reports/homepage.png",
      fullPage: true,
    });

    await expect(
      this.page.locator("a[href='/login']")
    ).toBeVisible({ timeout: 60000 });
  }

  async clickLogin() {
    await this.page.locator("a[href='/login']").click();
  }

  async clickLogout() {
    await this.page.locator("a[href='/logout']").click();
  }

  async deleteAccount() {
    await this.page.locator("[data-qa='continue-button']").click();

    await this.page.locator("a[href='/delete_account']").click();
  }
}
