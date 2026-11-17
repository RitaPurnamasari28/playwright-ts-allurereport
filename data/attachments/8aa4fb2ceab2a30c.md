# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/logout.spec.ts >> Logout
- Location: tests/logout.spec.ts:7:5

# Error details

```
TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('a[href=\'/logout\']')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e5]:
      - link "Website for automation practice" [ref=e8] [cursor=pointer]:
        - /url: /
        - img "Website for automation practice" [ref=e9]
      - list [ref=e12]:
        - listitem [ref=e13]:
          - link " Home" [ref=e14] [cursor=pointer]:
            - /url: /
            - generic [ref=e15]: 
            - text: Home
        - listitem [ref=e16]:
          - link " Products" [ref=e17] [cursor=pointer]:
            - /url: /products
            - generic [ref=e18]: 
            - text: Products
        - listitem [ref=e19]:
          - link " Cart" [ref=e20] [cursor=pointer]:
            - /url: /view_cart
            - generic [ref=e21]: 
            - text: Cart
        - listitem [ref=e22]:
          - link " Signup / Login" [ref=e23] [cursor=pointer]:
            - /url: /login
            - generic [ref=e24]: 
            - text: Signup / Login
        - listitem [ref=e25]:
          - link " Test Cases" [ref=e26] [cursor=pointer]:
            - /url: /test_cases
            - generic [ref=e27]: 
            - text: Test Cases
        - listitem [ref=e28]:
          - link " API Testing" [ref=e29] [cursor=pointer]:
            - /url: /api_list
            - generic [ref=e30]: 
            - text: API Testing
        - listitem [ref=e31]:
          - link " Video Tutorials" [ref=e32] [cursor=pointer]:
            - /url: https://www.youtube.com/c/AutomationExercise
            - generic [ref=e33]: 
            - text: Video Tutorials
        - listitem [ref=e34]:
          - link " Contact us" [ref=e35] [cursor=pointer]:
            - /url: /contact_us
            - generic [ref=e36]: 
            - text: Contact us
  - generic [ref=e38]:
    - generic [ref=e39]:
      - generic [ref=e41]:
        - heading "Login to your account" [level=2] [ref=e42]
        - generic [ref=e43]:
          - textbox "Email Address" [ref=e44]: testingninura@gmail.com
          - textbox "Password" [ref=e45]: 5465765Qwert/-
          - paragraph [ref=e46]: Your email or password is incorrect!
          - button "Login" [ref=e47] [cursor=pointer]
      - heading "OR" [level=2] [ref=e49]
      - generic [ref=e51]:
        - heading "New User Signup!" [level=2] [ref=e52]
        - generic [ref=e53]:
          - textbox "Name" [ref=e54]
          - textbox "Email Address" [ref=e55]
          - button "Signup" [ref=e56] [cursor=pointer]
    - insertion [ref=e58]:
      - generic [ref=e61]:
        - heading "These are topics related to the article that might interest you" [level=2] [ref=e63]: Discover more
        - link "Secure login systems" [ref=e64] [cursor=pointer]:
          - generic "Secure login systems" [ref=e65]
          - img [ref=e67]
        - link "User authentication service" [ref=e69] [cursor=pointer]:
          - generic "User authentication service" [ref=e70]
          - img [ref=e72]
        - link "Automated testing tools" [ref=e74] [cursor=pointer]:
          - generic "Automated testing tools" [ref=e75]
          - img [ref=e77]
  - generic:
    - insertion:
      - iframe [ref=e80]:
        
  - contentinfo [ref=e81]:
    - generic [ref=e86]:
      - heading "Subscription" [level=2] [ref=e87]
      - generic [ref=e88]:
        - textbox "Your email address" [ref=e89]
        - button "" [ref=e90] [cursor=pointer]:
          - generic [ref=e91]: 
        - paragraph [ref=e92]:
          - text: Get the most recent updates from
          - text: our site and be updated your self...
    - paragraph [ref=e96]:
      - text: Copyright © 2021 All rights reserved
      - link "File a Trademark" [ref=e97] [cursor=pointer]:
        - img [ref=e99]
        - text: File a Trademark
  - text: 
```

# Test source

```ts
  1  | import { expect, Page } from "@playwright/test";
  2  | 
  3  | export class HomePage {
  4  |   constructor(private page: Page) {}
  5  | 
  6  |   async openWebsite() {
  7  |     await this.page.goto("https://automationexercise.com/", {
  8  |       waitUntil: "domcontentloaded",
  9  |     });
  10 | 
  11 |     await this.page.screenshot({
  12 |       path: "reports/homepage.png",
  13 |       fullPage: true,
  14 |     });
  15 | 
  16 |     await expect(this.page.locator("a[href='/login']")).toBeVisible({
  17 |       timeout: 60000,
  18 |     });
  19 |   }
  20 | 
  21 |   async clickLogin() {
  22 |     await this.page.locator("a[href='/login']").click();
  23 |   }
  24 | 
  25 |   async clickLogout() {
> 26 |     await this.page.locator("a[href='/logout']").click();
     |                                                  ^ TimeoutError: locator.click: Timeout 30000ms exceeded.
  27 |   }
  28 | 
  29 |   async deleteAccount() {
  30 |     await this.page.locator("[data-qa='continue-button']").click();
  31 | 
  32 |     await this.page.locator("a[href='/delete_account']").click();
  33 |   }
  34 | }
  35 | 
```