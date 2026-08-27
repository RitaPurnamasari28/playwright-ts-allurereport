import { Page } from '@playwright/test';

export class SignInPage{

constructor(private page:Page){}

async signIn(name: string, email: string) {
    await this.page.locator("[data-qa='signup-name']").fill(name);
    await this.page.locator("[data-qa='signup-email']").fill(email);
    await this.page.locator("[data-qa='signup-button']").click();
}

async infoPassword(password: string) {
    await this.page.locator("[data-qa='password']").fill(password);
}

async infoDays(days: string) {
    await this.page.locator("#days").selectOption(days);
}

async infoMonth(month: string) {
    await this.page.locator("#months").selectOption(month);
}

async infoYear(year: string) {
    await this.page.locator("#years").selectOption(year);
}

async checkboxAccountInfo() {
    await this.page.locator("[name='newsletter']").click();
    await this.page.locator("[name='optin']").click();
    
}

async info(firstName: string, lastName: string, company: string, address: string, address2: string, state: string ) {
    await this.page.locator("[id='id_gender2']").click();
    await this.page.locator("[data-qa='first_name']").fill(firstName);
    await this.page.locator("[data-qa='last_name']").fill(lastName);
    await this.page.locator("[data-qa='company']").fill(company);
    await this.page.locator("[data-qa='address']").fill(address);
    await this.page.locator("[data-qa='address2']").fill(address2);
    await this.page.locator("[data-qa='state']").fill(state);
}

async infoCountry(country: string) {
    await this.page.locator("#country").selectOption(country);
}

async info2(city: string, zipCode: string, mobileNumber: string) {
    await this.page.locator("[data-qa='city']").fill(city);
    await this.page.locator("[data-qa='zipcode']").fill(zipCode);
    await this.page.locator("[data-qa='mobile_number']").fill(mobileNumber);    
    await this.page.locator("[data-qa='create-account']").click();
}

}