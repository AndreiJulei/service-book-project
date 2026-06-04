import { test, expect } from '@playwright/test';

test('basic landing page test', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page).toHaveTitle(/Servicebook|Home/i);
});

test('basic auth page test', async ({ page }) => {
  await page.goto('http://localhost:5173/auth');
  await expect(page).toHaveURL(/.*\/auth/);
});

test('basic client search test', async ({ page }) => {
  await page.goto('http://localhost:5173/client/search');
  await expect(page).toHaveURL(/.*\/client\/search/);
});

test('basic dashboard test', async ({ page }) => {
  await page.goto('http://localhost:5173/firm/dashboard');
  await expect(page).toHaveURL(/.*\/firm\/dashboard/);
});