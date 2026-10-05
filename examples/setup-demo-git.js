import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, 'demo-project');

console.log('Setting up realistic demo repository at:', demoDir);

// Reset demo directory
if (fs.existsSync(demoDir)) {
  fs.rmSync(demoDir, { recursive: true, force: true });
}
fs.mkdirSync(demoDir, { recursive: true });

function git(args) {
  execFileSync('git', args, { cwd: demoDir, stdio: 'inherit' });
}

// 1. Initialize git repo
git(['init']);
git(['config', 'user.name', 'Alex Chen']);
git(['config', 'user.email', 'alex.chen@example.com']);

// Create directory tree
const srcDir = path.join(demoDir, 'src');
fs.mkdirSync(path.join(srcDir, 'pricing'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'cart'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'checkout'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'payment'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'invoice'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'subscription'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'user'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'order'), { recursive: true });
fs.mkdirSync(path.join(srcDir, 'legacy'), { recursive: true });
fs.mkdirSync(path.join(demoDir, 'tests'), { recursive: true });

// Commit 1: v1 basic subtotal calculation
fs.writeFileSync(
  path.join(srcDir, 'pricing', 'PricingService.ts'),
  `export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * Calculate cart subtotal before tax.
 */
export function calculatePrice(items: CartItem[]): number {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.price * item.quantity;
  }
  return subtotal;
}
`
);

fs.writeFileSync(
  path.join(srcDir, 'cart', 'CartService.ts'),
  `import { calculatePrice, CartItem } from '../pricing/PricingService.js';

export class CartService {
  private items: CartItem[] = [];

  public getCartTotal(): number {
    return calculatePrice(this.items);
  }
}
`
);

git(['add', '.']);
git(['commit', '-m', 'Initial subtotal calculation for cart checkout']);

// Commit 2: v2 discount support added
fs.writeFileSync(
  path.join(srcDir, 'pricing', 'PricingService.ts'),
  `export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * Calculate cart subtotal with optional discount codes.
 */
export function calculatePrice(items: CartItem[], discountPercent: number = 0): number {
  let subtotal = 0;
  for (const item of items) {
    if (item.price < 0 || item.quantity <= 0) {
      throw new Error('Invalid cart item dimensions');
    }
    subtotal += item.price * item.quantity;
  }
  if (discountPercent > 0) {
    subtotal = subtotal * (1 - Math.min(100, discountPercent) / 100);
  }
  return subtotal;
}
`
);

fs.writeFileSync(
  path.join(demoDir, 'tests', 'pricing.test.ts'),
  `import { calculatePrice } from '../src/pricing/PricingService.js';

export function testCalculatePrice() {
  const items = [{ id: '1', name: 'Item A', price: 50, quantity: 2 }];
  if (calculatePrice(items) !== 100) throw new Error('Test failed');
}
`
);

git(['add', '.']);
git(['commit', '-m', 'Discount support added to checkout pricing']);

// Commit 3: v3 currency conversion added
fs.writeFileSync(
  path.join(srcDir, 'pricing', 'PricingService.ts'),
  `export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type Currency = 'USD' | 'EUR' | 'GBP';

const RATES: Record<Currency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78
};

/**
 * Calculate cart subtotal with discount and currency conversion.
 */
export function calculatePrice(
  items: CartItem[],
  discountPercent: number = 0,
  currency: Currency = 'USD'
): number {
  let subtotal = 0;
  for (const item of items) {
    if (!item || item.price < 0 || item.quantity <= 0) {
      throw new Error('Invalid cart item dimensions');
    }
    subtotal += item.price * item.quantity;
  }
  if (discountPercent > 0) {
    subtotal = subtotal * (1 - Math.min(100, discountPercent) / 100);
  }
  const rate = RATES[currency] || 1.0;
  return Math.round(subtotal * rate * 100) / 100;
}
`
);

git(['add', '.']);
git(['commit', '-m', 'Currency conversion added for international orders']);

// Commit 4: Add dependent services: Checkout, Payment, Invoice, Subscription
fs.writeFileSync(
  path.join(srcDir, 'checkout', 'CheckoutService.ts'),
  `import { CartService } from '../cart/CartService.js';
import { PaymentService } from '../payment/PaymentService.js';

export class CheckoutService {
  constructor(private cart: CartService, private payment: PaymentService) {}

  public async processCheckout(): Promise<boolean> {
    const total = this.cart.getCartTotal();
    return this.payment.charge(total);
  }
}
`
);

fs.writeFileSync(
  path.join(srcDir, 'payment', 'PaymentService.ts'),
  `export class PaymentService {
  public async charge(amount: number): Promise<boolean> {
    if (amount <= 0) return false;
    return true;
  }
}
`
);

fs.writeFileSync(
  path.join(srcDir, 'invoice', 'InvoiceService.ts'),
  `import { calculatePrice, CartItem } from '../pricing/PricingService.js';

export class InvoiceService {
  public generateInvoice(items: CartItem[]): number {
    return calculatePrice(items, 0, 'USD');
  }
}
`
);

fs.writeFileSync(
  path.join(srcDir, 'subscription', 'SubscriptionService.ts'),
  `import { calculatePrice, CartItem } from '../pricing/PricingService.js';

export class SubscriptionService {
  public billMonthly(items: CartItem[]): number {
    return calculatePrice(items, 15, 'USD');
  }
}
`
);

git(['add', '.']);
git(['commit', '-m', 'Integrate Invoice and Subscription services with central pricing']);

// Commit 5: Payment bug fix (v4)
fs.writeFileSync(
  path.join(srcDir, 'payment', 'PaymentService.ts'),
  `export class PaymentService {
  private retries = 3;

  public async charge(amount: number): Promise<boolean> {
    if (amount <= 0) throw new Error('Payment amount must be greater than zero');
    for (let i = 0; i < this.retries; i++) {
      try {
        return true;
      } catch (e) {
        if (i === this.retries - 1) throw e;
      }
    }
    return false;
  }
}
`
);

git(['add', '.']);
git(['commit', '-m', 'Temporary payment retry fix and timeout protection']);

// Commit 6: Add duplicate code and dead code
fs.writeFileSync(
  path.join(srcDir, 'user', 'UserService.ts'),
  `export interface UserRecord {
  id: string;
  email: string;
  role: string;
}

export class UserService {
  public validateUser(user: UserRecord | null): boolean {
    if (!user || user === null || user === undefined) {
      throw new Error('User record cannot be null');
    }
    if (!user.email || !user.email.includes('@')) {
      throw new Error('Invalid user email format');
    }
    if (!user.role) {
      throw new Error('User role missing');
    }
    return true;
  }
}
`
);

fs.writeFileSync(
  path.join(srcDir, 'order', 'OrderService.ts'),
  `export interface CustomerRecord {
  id: string;
  email: string;
  tier: string;
}

export class OrderService {
  public validateCustomer(customer: CustomerRecord | null): boolean {
    if (!customer || customer === null || customer === undefined) {
      throw new Error('Customer record cannot be null');
    }
    if (!customer.email || !customer.email.includes('@')) {
      throw new Error('Invalid customer email format');
    }
    if (!customer.tier) {
      throw new Error('Customer tier missing');
    }
    return true;
  }
}
`
);

fs.writeFileSync(
  path.join(srcDir, 'legacy', 'LegacyTax.ts'),
  `/**
 * Obsolete VAT calculator from 2021 before automated tax provider integration.
 */
export function calculateLegacyTax(amount: number, regionCode: string): number {
  if (regionCode === 'EU-NORTH') return amount * 0.25;
  if (regionCode === 'EU-SOUTH') return amount * 0.21;
  return amount * 0.18;
}
`
);

git(['add', '.']);
git(['commit', '-m', 'Add validation routines and legacy tax module']);

console.log('Demo repository successfully created with real Git commit history!');
