import { test, expect } from "../utils/allure";

import { HomePage } from '../pages/HomePage';

import { LoginPage } from '../pages/LoginPage';

test("Test Fail Login with valid credential", async ({ page }) => {

  const home = new HomePage(page);

const login=new LoginPage(page);

await home.openWebsite();

await home.clickLogin();

await login.login("testingninura@gmail.com","");

await expect(page.locator("text=Logged in as")).toBeVisible();

});
