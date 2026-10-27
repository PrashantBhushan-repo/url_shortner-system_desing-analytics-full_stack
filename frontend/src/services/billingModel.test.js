import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cyclePrice, quotePrice, utilization, invoiceCSV, money, billingDate } from './billingModel.js';
test('prices preserve zero values and calculate discounts with integer rounding', () => {
  const plan = { key: 'pro', price_monthly: 101, price_yearly: 0 };
  assert.equal(cyclePrice(plan, 'YEARLY'), 0);
  assert.equal(cyclePrice(plan, 'QUARTERLY'), 303);
  assert.equal(quotePrice(plan, 'MONTHLY', { discountType: 'PERCENT', discountValue: 50, applicablePlans: ['pro'] }), 50);
  assert.equal(quotePrice(plan, 'MONTHLY', { discountType: 'FLAT', discountValue: 1000, applicablePlans: ['business'] }), 101);
});
test('usage distinguishes zero limits, unknown limits, unlimited plans and overages', () => {
  assert.equal(utilization(0, 0).severity, 'limit');
  assert.equal(utilization(3, 0).percent, 100);
  assert.equal(utilization(12, 10).percent, 100);
  assert.equal(utilization(8, 10).severity, 'near');
  assert.match(utilization(12, null).label, /Unlimited/);
  assert.equal(utilization(2, undefined).label, '2 used');
});
test('CSV quotes values and neutralizes spreadsheet formula injection', () => {
  const text = invoiceCSV([{ id: '=DANGEROUS()', plan: { name: 'A,"B"' }, amount: 0, refunded_amount: 0 }]);
  assert.match(text, /'=DANGEROUS/); assert.match(text, /A,""B""/); assert.match(text, /minor units/);
});
test('display helpers handle missing dates and non-INR currency without rounding away paise', () => {
  assert.equal(billingDate('invalid'), 'Not scheduled');
  assert.match(money(199, 'INR'), /1\.99/); assert.match(money(199, 'USD'), /1\.99/);
  assert.match(money(199, 'JPY'), /199/); assert.match(money(1990, 'KWD'), /1\.990/);
});
