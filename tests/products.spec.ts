import { test, expect} from "../utils/allure";

import { HomePage } from "../pages/HomePage";

import { LoginPage } from "../pages/LoginPage";

import { ProductsPage } from "../pages/ProductsPage";


test("Checkout flow", async ({ page }) => {

  const home = new HomePage(page);

  const product = new ProductsPage(page);

  await home.openWebsite();

  await page.keyboard.press("Escape");

  const login = new LoginPage(page);

  await home.clickLogin();

  await login.login("testingninura@gmail.com", "5465765Qwert/-");

  await page.locator("a[href='/products']").click();

  await product.search("Blue Top");

  await page.locator("[href='/product_details/1']").click();

  await product.addToCart();

  await product.viewcart();
  await product.btnProceedToCheckout();

  
  await product.orderMessage("dont sent to wrong address");
  await product.placeOrder();
  await product.checkoutProduct(
    "Alexis Loh",
    "4324343",
    "333333",
    "12",
    "2030",
  );
  
  await product.paybutton();
  
  await expect(page.locator("text=Order Placed!")).toBeVisible();

});

test("checkout 2 items", async ({ page }) => {


  const home = new HomePage(page);

  const product = new ProductsPage(page);

  await home.openWebsite();

  const login = new LoginPage(page);

  await home.clickLogin();

  await login.login("testingninura@gmail.com", "5465765Qwert/-");

  await page.locator("a[href='/products']").click();

  await product.search("Blue Top");

  //open detail blue top
  await page.locator("[href='/product_details/1']").click();

  await product.addToCart();

  await page.locator("a[href='/products']").click();

  await product.search("Winter Top");

  //open detail winter top
  await page.locator("[href='/product_details/5']").click();

  await product.addToCart();

  await product.viewcart();
  await product.btnProceedToCheckout();
  await product.orderMessage("dont sent to wrong address");
  await product.placeOrder();
  await product.checkoutProduct(
    "Ninuloh",
    "432166",
    "3233",
    "12",
    "2030",
  );
    
  await product.paybutton();

  await expect(page.locator("text=Order Placed!")).toBeVisible();

});

test("Checkout without input payment details", async ({ page }) => {

  const home = new HomePage(page);

  const product = new ProductsPage(page);

  await home.openWebsite();

  const login = new LoginPage(page);

  await home.clickLogin();

  await login.login("testingninura@gmail.com", "5465765Qwert/-");

  await page.locator("a[href='/products']").click();

  await product.search("Blue Top");

  //open detail blue top
  await page.locator("[href='/product_details/1']").click();

  await product.addToCart();

  await product.viewcart();

  await product.btnProceedToCheckout();

  await product.orderMessage("dont sent to wrong address");
  await product.placeOrder();
  await product.paybutton();
  
  const nameOnCard = page.locator("[data-qa='name-on-card']");

  const message = await nameOnCard.evaluate((el: HTMLInputElement) => {
    return el.validationMessage;
  });

  expect(message).toBe('Please fill out this field.');

});

test("Checkout without input card number", async ({ page }) => {

  const home = new HomePage(page);

  const product = new ProductsPage(page);

  await home.openWebsite();

  const login = new LoginPage(page);

  await home.clickLogin();

  await login.login("testingninura@gmail.com", "5465765Qwert/-");

  await page.locator("a[href='/products']").click();

  await product.search("Blue Top");

  await page.locator("[href='/product_details/1']").click();

  await product.addToCart();

  await product.viewcart();
  await product.btnProceedToCheckout();
  await product.orderMessage("dont sent to wrong address");
  await product.placeOrder();
  await product.checkoutProduct(
    "Alexis Loh",
    "",
    "333333",
    "12",
    "2030",
  );
  
  await product.paybutton();
  
  const cardNumber = page.locator("[data-qa='card-number']");

  const message = await cardNumber.evaluate((el: HTMLInputElement) => {
    return el.validationMessage;
  });

  expect(message).toBe('Please fill out this field.');

});

test("Checkout without input order message", async ({ page }) => {

  const home = new HomePage(page);

  const product = new ProductsPage(page);

  await home.openWebsite();

  const login = new LoginPage(page);

  await home.clickLogin();

  await login.login("testingninura@gmail.com", "5465765Qwert/-");

  await page.locator("a[href='/products']").click();

  await product.search("Blue Top");

  await page.locator("[href='/product_details/1']").click();

  await product.addToCart();

  await product.viewcart();
  await product.btnProceedToCheckout();
  await product.orderMessage("");
  await product.placeOrder();

  await expect(page.locator("text=Pay and Confirm Order")).toBeVisible();

});
