import { type Browser, type Page, expect } from '@playwright/test';

/** Generate a unique room ID to avoid test cross-contamination. */
export function uniqueRoom(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Fill the welcome form and submit to join/create a room. */
export async function joinRoom(
  page: Page,
  opts: {
    name: string;
    roomId: string;
    observer?: boolean;
    cardSet?: string;
  },
): Promise<void> {
  await page.goto('/');
  await page.fill('#name', opts.name);
  await page.fill('#roomId', opts.roomId);
  if (opts.observer) {
    await page.check('#observer');
  }
  if (opts.cardSet) {
    await page.selectOption('#cardSet', opts.cardSet);
  }
  await page.click('button[type="submit"]');
  // Wait for room view to appear
  await expect(page.locator('.room-value')).toContainText(opts.roomId, { timeout: 15_000 });
}

/**
 * Open a second isolated browser context and join the same room as a second user.
 * Returns the context and page so the caller can close them after the test.
 */
export async function joinRoomAsSecondUser(
  browser: Browser,
  name: string,
  roomId: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await joinRoom(page, { name, roomId });
  return { page, close: () => ctx.close() };
}
