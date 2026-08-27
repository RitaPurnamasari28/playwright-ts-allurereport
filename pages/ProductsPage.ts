import { Page } from '@playwright/test';

export class ProductsPage{

constructor(private page:Page){}
async search(keyword: string) {
    await this.page.locator("#search_product").fill(keyword);
    await this.page.locator("#submit_search").click();
}


async addToCart() {
    await this.page.locator("[class='btn btn-default cart']").click();
}
async viewcart(){
    await this.page.locator("#cartModal a[href='/view_cart']").click();
}

async btnProceedToCheckout(){
    await this.page.locator("[class='btn btn-default check_out']").click();
}

async orderMessage(message: string){
    await this.page.locator("[name='message']").fill(message);
}
async placeOrder(){
    await this.page.locator("[href='/payment']").click();
}

async checkoutProduct(nameOnCard: string, cardNumber: string, cvc: string, expirationMonth: string, expirationYear: string ) {

    //Payment Page
    await this.page.locator("[data-qa='name-on-card']").fill(nameOnCard); 
    await this.page.locator("[data-qa='card-number']").fill(cardNumber);
    await this.page.locator("[data-qa='cvc']").fill(cvc);
    await this.page.locator("[data-qa='expiry-month']").fill(expirationMonth);
    await this.page.locator("[data-qa='expiry-year']").fill(expirationYear);
}

async paybutton() {
    await this.page.locator("[data-qa='pay-button']").click();
}

}