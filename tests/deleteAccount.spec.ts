import { test, expect } from "../utils/allure";
import { HomePage } from "../pages/HomePage";
import { SignInPage } from "../pages/SignInPage";

const random = Math.floor(Math.random() * 1000000);
const email = `testingninura${random}@gmail.com`;

test("Delete account", async ({ page }) => {
  const home = new HomePage(page);
  const signIn = new SignInPage(page);

  await test.step("Open Website and open login page", async () => {
    await home.openWebsite();
    await home.clickLogin();
  });

  await test.step(`Input name, email: ${email} and click signup button`, async () => {
    await signIn.signIn("Ninura", email);
    await expect(page.locator("text=Enter Account Information")).toBeVisible();
  });

  await test.step("Complete account information, personal details and click create account button", async () => {
    await signIn.infoPassword("5465765Qwert/-");
    await signIn.infoDays("22");
    await signIn.infoMonth("5");
    await signIn.infoYear("2005");
    await signIn.checkboxAccountInfo();
    await signIn.info(
      "Alexis",
      "Loh",
      "UCC",
      "Manggis Street NO. 45",
      "Papaya street No 90",
      "one",
    );
    await signIn.infoCountry("Singapore");
    await signIn.info2("Waterway park", "675656", "6534215");
  });

  await test.step("Delete account and ensure it is deleted successfully", async () => {
    await home.deleteAccount();
    await expect(page.locator("text=Account Deleted!")).toBeVisible();
  });
});
