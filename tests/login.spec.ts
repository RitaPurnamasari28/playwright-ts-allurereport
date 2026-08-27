import { test, expect} from "../utils/allure";

import { HomePage } from '../pages/HomePage';

import { LoginPage } from '../pages/LoginPage';

test("Login with valid credential", async ({ page }) => {

  const home = new HomePage(page);

const login=new LoginPage(page);

await home.openWebsite();

await home.clickLogin();

await login.login("testingninura@gmail.com","5465765Qwert/-");

await expect(page.locator("text=Logged in as")).toBeVisible();

});

test("Login with unregistered email", async ({ page }) => {
  const home = new HomePage(page);

const login=new LoginPage(page);

await home.openWebsite();

await home.clickLogin();

await login.login("asdqwe34@gmail.com","5465765Qwert/-");

await expect(page.locator("text=Your email or password is incorrect!")).toBeVisible();

});

test("Login with wrong password", async ({ page }) => {
  const home = new HomePage(page);

const login=new LoginPage(page);

await home.openWebsite();

await home.clickLogin();

await login.login("testingninura@gmail.com","12345678");

await expect(page.locator("text=Your email or password is incorrect!")).toBeVisible();

});

test("Login with invalid email", async ({ page }) => {
  const home = new HomePage(page);

const login=new LoginPage(page);

await home.openWebsite();

await home.clickLogin();

await login.login("testingninura","5465765Qwert/-");

 const email = page.locator("[data-qa='login-email']");

  const validationMessage = await email.evaluate(
    (el: HTMLInputElement) => el.validationMessage
  );

  expect(validationMessage).toContain("Please include an '@'");

});

test("Login without input email and password", async ({ page }) => {
  const home = new HomePage(page);

const login=new LoginPage(page);

await home.openWebsite();

await home.clickLogin();

await page.locator("[data-qa='login-button']").click();

 const loginEmail = page.locator("[data-qa='login-email']");

  const message = await loginEmail.evaluate((el: HTMLInputElement) => {
    return el.validationMessage;
  });

  expect(message).toBe('Please fill out this field.');

});
