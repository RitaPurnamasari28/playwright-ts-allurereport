import { test, expect } from "../utils/allure";
import { HomePage } from '../pages/HomePage';
import { SignInPage } from '../pages/SignInPage';

const random = Math.floor(Math.random() * 1000000);
const email = `testingninura${random}@gmail.com`;

test("Delete account", async ({ page }) => {
  const home = new HomePage(page);
  const signIn = new SignInPage(page);

  await test.step('Akses website dan buka halaman Login', async () => {
    await home.openWebsite();
    await home.clickLogin();
  });

  await test.step(`Mulai proses pendaftaran dengan email: ${email}`, async () => {
    await signIn.signIn("Ninura", email);
    await expect(page.locator("text=Enter Account Information")).toBeVisible(); 
  });

  await test.step('Lengkapi formulir informasi akun dan data diri', async () => {
    await signIn.infoPassword("5465765Qwert/-");
    await signIn.infoDays("22");
    await signIn.infoMonth("5");
    await signIn.infoYear("2005");
    await signIn.checkboxAccountInfo();
    await signIn.info("Alexis", "Loh", "UCC", "Manggis Street NO. 45", "Papaya street No 90", "one");
    await signIn.infoCountry("Singapore");
    await signIn.info2("Waterway park", "675656", "6534215");
  });

  await test.step('Hapus akun dan pastikan berhasil dihapus', async () => {
    await home.deleteAccount();
    await expect(page.locator("text=Account Deleted!")).toBeVisible();
  });
});