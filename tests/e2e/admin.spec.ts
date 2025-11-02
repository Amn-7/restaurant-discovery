import { test, expect } from '@playwright/test';

test.describe('Admin login smoke test', () => {
  test('renders the admin login form', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Sign in to manage the floor' })).toBeVisible();
    await expect(page.getByLabel('Admin key')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});
