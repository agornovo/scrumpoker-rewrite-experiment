import { test, expect } from '@playwright/test';

test.describe('Welcome Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders all required form fields', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Scrum Poker');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#roomId')).toBeVisible();
    await expect(page.locator('#observer')).toBeVisible();
    await expect(page.locator('#cardSet')).toBeVisible();
    await expect(page.locator('#specialEffects')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Join Room');
  });

  test('shows validation error when name is empty', async ({ page }) => {
    await page.fill('#roomId', 'some-room');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"]')).toContainText('name');
  });

  test('shows validation error when room ID is empty', async ({ page }) => {
    await page.fill('#name', 'Alice');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"]')).toContainText('room');
  });

  test('help accordion opens and closes', async ({ page }) => {
    const content = page.locator('.help-accordion-content');
    await expect(content).not.toBeVisible();

    await page.click('.help-accordion-btn');
    await expect(content).toBeVisible();
    await expect(content).toContainText('Creating a room');

    await page.click('.help-accordion-btn');
    await expect(content).not.toBeVisible();
  });

  test('card set selector lists all card sets', async ({ page }) => {
    const options = page.locator('#cardSet option');
    await expect(options).toHaveCount(4);
    await expect(options.nth(0)).toHaveAttribute('value', 'standard');
    await expect(options.nth(1)).toHaveAttribute('value', 'fibonacci');
    await expect(options.nth(2)).toHaveAttribute('value', 'tshirt');
    await expect(options.nth(3)).toHaveAttribute('value', 'powers2');
  });

  test('hides card set when observer is checked', async ({ page }) => {
    await expect(page.locator('#cardSet')).toBeVisible();
    await page.check('#observer');
    await expect(page.locator('#cardSet')).not.toBeVisible();
  });

  test('pre-fills room ID from ?room= URL parameter', async ({ page }) => {
    await page.goto('/?room=my-room-123');
    await expect(page.locator('#roomId')).toHaveValue('my-room-123');
  });
});
