import { test, expect} from "../utils/allure";

import { HomePage } from '../pages/HomePage';

import { LoginPage } from '../pages/LoginPage';

test("Logout", async ({ page }) => {

  const home = new HomePage(page);

const login=new LoginPage(page);

await home.openWebsite();

await home.clickLogin();

await login.login("testingninura@gmail.com","5465765Qwert/-");

await home.clickLogout();

await expect(page.locator("text= Signup / Login")).toBeVisible();

});
