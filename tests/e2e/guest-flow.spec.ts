import { test, expect } from '@playwright/test';

test.describe('Guest journey', () => {
  test('table guest can place an order', async ({ page }) => {
    await page.goto('/t/1');

    const addButton = page.locator('.counter__btn--accent').first();
    await addButton.waitFor();
    await addButton.click();

    const sendButton = page.getByRole('button', { name: 'Send to kitchen' });
    await sendButton.click();

    await expect(page.getByText('Order sent to the kitchen')).toBeVisible();
  });

  test('guest can submit a dish review', async ({ page }) => {
    const menuResponse = await page.request.get('/api/menu');
    const menuItems = await menuResponse.json();
    expect(Array.isArray(menuItems)).toBe(true);
    expect(menuItems.length).toBeGreaterThan(0);

    const firstDishId = menuItems[0]._id as string;
    const dishResponse = await page.request.get(`/api/menu/${firstDishId}`);
    expect(dishResponse.status()).toBe(200);

    await page.goto(`/dish/${firstDishId}`);
    await page.getByRole('heading', { name: 'Add your rating' }).waitFor();

    const ratingButtons = page.locator('button[aria-label^="Set rating"]');
    await ratingButtons.first().waitFor();
    await ratingButtons.nth(4).click();

    const comment = `Automation review ${Date.now()}`;
    await page.getByPlaceholder('Optional short comment').fill(comment);

    await page.getByRole('button', { name: 'Submit review' }).click();

    await expect(page.getByText(comment)).toBeVisible({ timeout: 10_000 });
  });
});
