import { test, expect } from "../utils/allure";

import { HomePage } from "../pages/HomePage";

import { LoginPage } from "../pages/LoginPage";

test("Logout", async ({ page }) => {
  const home = new HomePage(page);

  const login = new LoginPage(page);
  await test.step("Open Website and open login page", async () => {
    await home.openWebsite();
    await home.clickLogin();
  });
  await test.step("Input email, password and click login button", async () => {
    await login.login("testingninura@gmail.com", "5465765Qwert/-");
  });
  await test.step("Click logout button and verify logout success", async () => {
    await home.clickLogout();

    await expect(page.locator("text= Signup / Login")).toBeVisible();
  });
});
