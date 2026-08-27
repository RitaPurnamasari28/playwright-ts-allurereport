import { test, expect} from "../utils/allure";

import { HomePage } from '../pages/HomePage';

import { SignInPage } from '../pages/SignInPage';
const random = Math.floor(Math.random() * 1000000);
const email = `testingninura${random}@gmail.com`;

const random1 = Math.floor(Math.random() * 1000000);
const email1 = `testingninura${random1}@gmail.com`;

const random2 = Math.floor(Math.random() * 1000000);
const email2 = `testingninura${random2}@gmail.com`;

test("Sign In", async ({ page },) => {

  const home = new HomePage(page);

const signIn =new SignInPage(page);

await home.openWebsite();

await home.clickLogin();

await signIn.signIn("Ninura",email);

await expect(page.locator("text=Enter Account Information")).toBeVisible();

await signIn.infoPassword("5465765Qwert/-");
await signIn.infoDays("22");
await signIn.infoMonth("5");
await signIn.infoYear("2005");
await signIn.checkboxAccountInfo();
await signIn.info("Alexis", "Loh", "UCC", "Manggis Street NO. 45", "Papaya street No 90", "one");
await signIn.infoCountry("Singapore");
await signIn.info2("Waterway park", "675656", "6534215");

await expect(page.locator("text=Account Created!")).toBeVisible();

});

test("Sign In use registered email", async ({ page },) => {

  const home = new HomePage(page);

const signIn =new SignInPage(page);

await home.openWebsite();

await home.clickLogin();

await signIn.signIn("Nadia","testingninura@gmail.com");

await expect(page.locator("text=Email Address already exist!")).toBeVisible();

});
test("Sign In with invalid email", async ({ page },) => {

  const home = new HomePage(page);

const signIn =new SignInPage(page);

await home.openWebsite();

await home.clickLogin();

await signIn.signIn("Nadia","testingnin");

const email = page.locator("[data-qa='signup-email']");

  const validationMessage = await email.evaluate(
    (el: HTMLInputElement) => el.validationMessage
  );

  expect(validationMessage).toContain("Please include an '@'");

});


test("Sign In without input account information", async ({ page }) => {

  const home = new HomePage(page);

const signIn =new SignInPage(page);

await home.openWebsite();

await home.clickLogin();

await signIn.signIn("Ninura",email1);

await expect(page.locator("text=Enter Account Information")).toBeVisible();

await page.locator("[data-qa='create-account']").click();

const password = page.locator("[data-qa='password']");

  const message = await password.evaluate((el: HTMLInputElement) => {
    return el.validationMessage;
  });

  expect(message).toBe('Please fill out this field.');

});

test("Sign In without input name and email", async ({ page }) => {

  const home = new HomePage(page);

const signIn =new SignInPage(page);

await home.openWebsite();

await home.clickLogin();

await page.locator("[data-qa='signup-button']").click();

const signupName = page.locator("[data-qa='signup-name']");

  const message = await signupName.evaluate((el: HTMLInputElement) => {
    return el.validationMessage;
  });

  expect(message).toBe('Please fill out this field.');

});

test("Sign In without input first name", async ({ page }) => {

  const home = new HomePage(page);

const signIn =new SignInPage(page);

await home.openWebsite();

await home.clickLogin();

await signIn.signIn("Ninura",email2);

await expect(page.locator("text=Enter Account Information")).toBeVisible();

await signIn.infoPassword("5465765Qwert/-");
await signIn.infoDays("22");
await signIn.infoMonth("5");
await signIn.infoYear("2005");
await signIn.checkboxAccountInfo();
await signIn.info("", "kai", "UCC", "Manggis Street NO. 45", "Papaya street No 90", "one");
await signIn.infoCountry("Singapore");
await signIn.info2("Waterway park", "675656", "6534215");

const firstName = page.locator("[data-qa='first_name']");

  const message = await firstName.evaluate((el: HTMLInputElement) => {
    return el.validationMessage;
  });

  expect(message).toBe('Please fill out this field.');

});
