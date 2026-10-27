import assert from "node:assert/strict";
import { test } from "node:test";
import { clickSeries, demoDevices, demoGeography, demoLinks, demoPayments, demoSources, demoUsers, filterRecords, paidRevenue, totalClicks, totalScans } from "./demoData.js";

test("sample summaries agree across charts and records", () => {
  assert.equal(clickSeries.reduce((sum, value) => sum + value, 0), totalClicks);
  assert.equal(totalScans, 2030);
  assert.equal(paidRevenue, 4297);
  assert.equal(demoPayments.filter(payment => payment.status === "Paid").length, 3);
  for (const distribution of [demoDevices, demoGeography, demoSources]) {
    assert.equal(distribution.reduce((sum, item) => sum + item.value, 0), 100);
  }
});

test("search and status filters work together without modifying fixtures", () => {
  assert.equal(filterRecords(demoUsers, "  MIRA  ", "Active")[0].id, "sample-user-1");
  assert.equal(filterRecords(demoUsers, "mira", "Suspended").length, 0);
  assert.equal(filterRecords(demoUsers, "", "Active").length, 4);
  assert.equal(filterRecords(demoLinks, "missing-campaign").length, 0);
  assert.equal(demoUsers.length, 6);
  assert.throws(() => { demoLinks[0].clicks = 1; }, TypeError);
});

test("sample destinations and accounts use reserved example domains", () => {
  assert.ok(demoLinks.every(link => new URL(link.destination).hostname === "example.com"));
  assert.ok(demoUsers.every(user => user.email.endsWith("@example.com")));
});
