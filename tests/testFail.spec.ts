import { test, expect } from "../utils/allure";

import { HomePage } from '../pages/HomePage';

import { LoginPage } from '../pages/LoginPage';
import { ProductsPage } from "../pages/ProductsPage";

test("test login failed", async ({ page }) => {

  const home = new HomePage(page);

const login=new LoginPage(page);

await home.openWebsite();

await home.clickLogin();

await login.login("testingninura@gmail.com","");

await expect(page.locator("text=Logged in as")).toBeVisible();

});

test("Test Fail Checkout product", async ({ page }) => {
  const home = new HomePage(page);

  const product = new ProductsPage(page);
  await test.step("Open Website and login", async () => {
    await home.openWebsite();

    const login = new LoginPage(page);

    await home.clickLogin();

    await login.login("testingninura@gmail.com", "5465765Qwert/-");
  });
  await test.step("Verify successful login", async () => {
    await expect(page.locator("text=Logged in as")).toBeVisible();
  });
  await test.step("search product, add to cart and proceed to checkout", async () => {
    await page.locator("a[href='/products']").click();

    await product.search("Blue shirt");

    await page.locator("[href='/product_details/1']").click();

    await product.addToCart();

    await product.viewcart();
    await product.btnProceedToCheckout();
  });
  await test.step("Click place order button without input order message", async () => {
    await product.orderMessage("");
    await product.placeOrder();
  });
  await test.step("Verify alert messahe appear", async () => {
    await expect(page.locator("text=Pay and Confirm Order")).toBeVisible();
  });
});
