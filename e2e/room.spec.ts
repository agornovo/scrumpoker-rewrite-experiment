/**
 * End-to-end tests for the Scrum Poker voting room.
 *
 * Tests cover:
 *  - Joining a room (single user & multi-user)
 *  - Voting and vote masking
 *  - Reveal cards + statistics
 *  - Reset round + round history
 *  - Observer mode
 *  - Story title (host sets, non-host sees)
 *  - Auto-reveal
 *  - Leave room
 *  - Host-only controls
 *  - Remove participant
 *  - Card set selection
 *  - URL synchronisation (?room= parameter)
 */
import { test, expect } from '@playwright/test';
import { joinRoom, joinRoomAsSecondUser, uniqueRoom } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

test.describe('Joining a room', () => {
  test('creates a new room and shows room ID', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });
    await expect(page.locator('.room-value')).toContainText(rid);
    await expect(page.locator('.participant-name').first()).toContainText('Alice');
  });

  test('updates the URL with ?room= parameter after joining', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });
    await expect(page).toHaveURL(new RegExp(`[?&]room=${encodeURIComponent(rid)}`));
  });

  test('two users can join the same room and see each other', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      await expect(page.locator('.participant-name').filter({ hasText: 'Bob' })).toBeVisible();
      await expect(bob.page.locator('.participant-name').filter({ hasText: 'Alice' })).toBeVisible();
    } finally {
      await bob.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Card selection and vote masking
// ---------------------------------------------------------------------------

test.describe('Voting', () => {
  test('user can select a card and it appears selected', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    await page.click('[aria-label="Vote 5"]');
    await expect(page.locator('[aria-label="Vote 5"]')).toHaveClass(/selected/);
  });

  test('user can change their vote by clicking another card', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    await page.click('[aria-label="Vote 5"]');
    await page.click('[aria-label="Vote 8"]');

    await expect(page.locator('[aria-label="Vote 5"]')).not.toHaveClass(/selected/);
    await expect(page.locator('[aria-label="Vote 8"]')).toHaveClass(/selected/);
  });

  test('votes are masked as ✓ for other participants before reveal', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      // Alice votes
      await page.click('[aria-label="Vote 5"]');

      // Bob should see a voted indicator (✓) for Alice, not the actual value
      await expect(
        bob.page.locator('.participant-card').filter({ hasText: 'Alice' }).locator('.vote-indicator'),
      ).toContainText('✓');
    } finally {
      await bob.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Reveal, statistics, reset, history
// ---------------------------------------------------------------------------

test.describe('Reveal and reset', () => {
  test('host can reveal cards and see statistics', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    await page.click('[aria-label="Vote 5"]');
    await page.click('button:has-text("Reveal Cards")');

    await expect(page.locator('.statistics')).toBeVisible();
    // Stats for a single vote of 5: avg=5, median=5, min=5, max=5
    const statValues = page.locator('.stat-value');
    await expect(statValues.nth(0)).toContainText('5'); // average
    await expect(statValues.nth(2)).toContainText('5'); // min
    await expect(statValues.nth(3)).toContainText('5'); // max
  });

  test('two users vote different values; stats show correct average', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      await page.click('[aria-label="Vote 3"]');
      await bob.page.click('[aria-label="Vote 5"]');

      // Alice (host) reveals
      await page.click('button:has-text("Reveal Cards")');

      await expect(page.locator('.statistics')).toBeVisible();
      await expect(bob.page.locator('.statistics')).toBeVisible();

      // avg = (3+5)/2 = 4.0
      await expect(page.locator('.stat-value').first()).toContainText('4.0');
    } finally {
      await bob.close();
    }
  });

  test('non-host cannot see Reveal or Reset buttons', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      await expect(bob.page.locator('button:has-text("Reveal Cards")')).not.toBeVisible();
      await expect(bob.page.locator('button:has-text("Reset Round")')).not.toBeVisible();
    } finally {
      await bob.close();
    }
  });

  test('reset round clears votes and appears in round history', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    await page.click('[aria-label="Vote 8"]');
    await page.click('button:has-text("Reveal Cards")');
    await page.click('button:has-text("Reset Round")');

    // Round history should appear after reset
    await expect(page.locator('.round-history')).toBeVisible();
    await expect(page.locator('.history-item')).toHaveCount(1);

    // Votes should be cleared – card buttons no longer show "selected"
    await expect(page.locator('.card.selected')).toHaveCount(0);

    // Statistics panel should be gone
    await expect(page.locator('.statistics')).not.toBeVisible();
  });

  test('round history accumulates across multiple rounds', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    for (let i = 0; i < 3; i++) {
      await page.click('[aria-label="Vote 5"]');
      await page.click('button:has-text("Reveal Cards")');
      await page.click('button:has-text("Reset Round")');
    }

    await expect(page.locator('.history-item')).toHaveCount(3);
  });

  test('cards are disabled after reveal and re-enabled after reset', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    await page.click('[aria-label="Vote 5"]');
    await page.click('button:has-text("Reveal Cards")');

    // Cards should be disabled
    await expect(page.locator('[aria-label="Vote 1"]')).toBeDisabled();

    // After reset
    await page.click('button:has-text("Reset Round")');
    await expect(page.locator('[aria-label="Vote 1"]')).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Observer mode
// ---------------------------------------------------------------------------

test.describe('Observer mode', () => {
  test('observer sees the room but has no card selection', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Watcher', roomId: rid, observer: true });

    await expect(page.locator('.room-value')).toContainText(rid);
    await expect(page.locator('.card-selection')).not.toBeVisible();
  });

  test('observer badge is shown in participant list', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const observer = await joinRoomAsSecondUser(browser, 'Watcher', rid);
    try {
      // join as observer (we need to do it manually since joinRoomAsSecondUser uses joinRoom)
    } finally {
      await observer.close();
    }

    // Let's test with a fresh observer session
    const ctx = await browser.newContext();
    const obsPage = await ctx.newPage();
    await obsPage.goto('/');
    await obsPage.fill('#name', 'ObsUser');
    await obsPage.fill('#roomId', rid);
    await obsPage.check('#observer');
    await obsPage.click('button[type="submit"]');
    await expect(obsPage.locator('.room-value')).toContainText(rid, { timeout: 15_000 });

    // Alice should see the OBS badge for ObsUser
    await expect(
      page.locator('.participant-card').filter({ hasText: 'ObsUser' }).locator('.observer-badge'),
    ).toBeVisible();

    await ctx.close();
  });

  test('observer votes are excluded from statistics', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    // Join as observer in a second context
    const ctx = await browser.newContext();
    const obsPage = await ctx.newPage();
    await obsPage.goto('/');
    await obsPage.fill('#name', 'ObsUser');
    await obsPage.fill('#roomId', rid);
    await obsPage.check('#observer');
    await obsPage.click('button[type="submit"]');
    await expect(obsPage.locator('.room-value')).toContainText(rid, { timeout: 15_000 });

    try {
      await page.click('[aria-label="Vote 5"]');
      await page.click('button:has-text("Reveal Cards")');

      // Stats should show Alice's vote (5) only
      await expect(page.locator('.statistics')).toBeVisible();
      const statValues = page.locator('.stat-value');
      await expect(statValues.nth(0)).toContainText('5'); // average
    } finally {
      await ctx.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Story title
// ---------------------------------------------------------------------------

test.describe('Story title', () => {
  test('host can set a story title and it propagates to other participants', async ({
    browser,
    page,
  }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      // Alice (host) types a story title
      await page.fill('[aria-label="Story title"]', 'SCRUM-42');
      await page.press('[aria-label="Story title"]', 'Enter');

      // Bob should see the story title (as a read-only display)
      await expect(bob.page.locator('[aria-label="Story title"]')).toContainText('SCRUM-42');
    } finally {
      await bob.close();
    }
  });

  test('non-host sees story title as display text', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      // Bob should not have an editable story title input
      await expect(bob.page.locator('input[aria-label="Story title"]')).not.toBeVisible();
    } finally {
      await bob.close();
    }
  });

  test('story title is cleared after reset round', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    await page.fill('[aria-label="Story title"]', 'US-100');
    await page.press('[aria-label="Story title"]', 'Enter');
    await page.click('[aria-label="Vote 5"]');
    await page.click('button:has-text("Reveal Cards")');
    await page.click('button:has-text("Reset Round")');

    await expect(page.locator('[aria-label="Story title"]')).toHaveValue('');
  });
});

// ---------------------------------------------------------------------------
// Auto-reveal
// ---------------------------------------------------------------------------

test.describe('Auto-reveal', () => {
  test('auto-reveal triggers when all voters have voted', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      // Host enables auto-reveal; click and wait for the server update to confirm
      const autoRevealCheckbox = page.locator('.auto-reveal-toggle input');
      await autoRevealCheckbox.click();
      await expect(autoRevealCheckbox).toBeChecked({ timeout: 5_000 });

      // Both vote
      await page.click('[aria-label="Vote 5"]');
      await bob.page.click('[aria-label="Vote 8"]');

      // Cards should auto-reveal
      await expect(page.locator('.statistics')).toBeVisible({ timeout: 10_000 });
      await expect(bob.page.locator('.statistics')).toBeVisible({ timeout: 10_000 });
    } finally {
      await bob.close();
    }
  });

  test('auto-reveal does not trigger if not all voters have voted', async ({
    browser,
    page,
  }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      // Host enables auto-reveal; click and wait for the server update to confirm
      const autoRevealCheckbox = page.locator('.auto-reveal-toggle input');
      await autoRevealCheckbox.click();
      await expect(autoRevealCheckbox).toBeChecked({ timeout: 5_000 });

      // Only Alice votes (Bob hasn't)
      await page.click('[aria-label="Vote 5"]');

      // Should NOT auto-reveal
      await expect(page.locator('.statistics')).not.toBeVisible();
    } finally {
      await bob.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Leave room
// ---------------------------------------------------------------------------

test.describe('Leave room', () => {
  test('clicking Leave returns the user to the welcome screen', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    await page.click('button:has-text("Leave")');

    await expect(page.locator('button[type="submit"]')).toContainText('Join Room');
    await expect(page.locator('#name')).toBeVisible();
  });

  test('leaving removes user from participant list for other users', async ({
    browser,
    page,
  }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      await expect(page.locator('.participant-name').filter({ hasText: 'Bob' })).toBeVisible();

      // Bob leaves
      await bob.page.click('button:has-text("Leave")');

      // Alice should no longer see Bob
      await expect(
        page.locator('.participant-name').filter({ hasText: 'Bob' }),
      ).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await bob.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Host controls – remove participant
// ---------------------------------------------------------------------------

test.describe('Host controls', () => {
  test('host can remove a participant', async ({ browser, page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      // Wait for Bob to appear
      await expect(page.locator('.participant-name').filter({ hasText: 'Bob' })).toBeVisible();

      // Alice (host) removes Bob
      await page
        .locator('.participant-card')
        .filter({ hasText: 'Bob' })
        .locator('.btn-remove')
        .click();

      // Bob should be taken back to the welcome screen
      await expect(bob.page.locator('button[type="submit"]')).toContainText('Join Room', {
        timeout: 10_000,
      });
      await expect(bob.page.locator('[role="alert"]')).toContainText('removed', {
        timeout: 10_000,
      });
    } finally {
      await bob.close();
    }
  });

  test('host cannot remove themselves', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid });

    // The remove button should not appear next to Alice's own name
    const aliceCard = page.locator('.participant-card').filter({ hasText: 'Alice' });
    await expect(aliceCard.locator('.btn-remove')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Card sets
// ---------------------------------------------------------------------------

test.describe('Card sets', () => {
  test('standard card set shows correct cards', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid, cardSet: 'standard' });

    await expect(page.locator('[aria-label="Vote 1"]')).toBeVisible();
    await expect(page.locator('[aria-label="Vote 100"]')).toBeVisible();
    await expect(page.locator('[aria-label="Vote ?"]')).toBeVisible();
  });

  test('fibonacci card set shows correct cards including ½ and ☕', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid, cardSet: 'fibonacci' });

    // 0.5 is displayed as ½
    await expect(page.locator('[aria-label="Vote ½"]')).toBeVisible();
    await expect(page.locator('[aria-label="Vote ☕"]')).toBeVisible();
    await expect(page.locator('[aria-label="Vote 55"]')).toBeVisible();
  });

  test('t-shirt card set shows size labels', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid, cardSet: 'tshirt' });

    await expect(page.locator('[aria-label="Vote XS"]')).toBeVisible();
    await expect(page.locator('[aria-label="Vote XXL"]')).toBeVisible();
  });

  test('powers-of-2 card set shows correct values', async ({ page }) => {
    const rid = uniqueRoom();
    await joinRoom(page, { name: 'Alice', roomId: rid, cardSet: 'powers2' });

    await expect(page.locator('[aria-label="Vote 1"]')).toBeVisible();
    await expect(page.locator('[aria-label="Vote 64"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Screenshots for README (taken once against the running app)
// ---------------------------------------------------------------------------

test.describe('README screenshots', () => {
  const screenshotsDir = path.join(__dirname, '..', 'docs', 'screenshots');

  test.beforeAll(() => {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  });

  test('capture welcome screen (light theme)', async ({ page }) => {
    await page.goto('/');
    await page.screenshot({
      path: path.join(screenshotsDir, 'welcome-light.png'),
      fullPage: false,
    });
  });

  test('capture welcome screen (dark theme)', async ({ page }) => {
    await page.goto('/');
    // Simulate dark theme by setting the data-theme attribute directly
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('scrumpoker_theme', 'dark');
    });
    await page.screenshot({
      path: path.join(screenshotsDir, 'welcome-dark.png'),
      fullPage: false,
    });
  });

  test('capture voting room with participants', async ({ browser, page }) => {
    const rid = `screenshot-${Date.now()}`;
    await joinRoom(page, { name: 'Alice', roomId: rid });

    // Add second participant
    const bob = await joinRoomAsSecondUser(browser, 'Bob', rid);
    try {
      await page.click('[aria-label="Vote 8"]');
      await bob.page.click('[aria-label="Vote 5"]');
      await page.screenshot({
        path: path.join(screenshotsDir, 'voting-room.png'),
        fullPage: false,
      });
    } finally {
      await bob.close();
    }
  });

  test('capture revealed results with statistics', async ({ page }) => {
    const rid = `screenshot-reveal-${Date.now()}`;
    await joinRoom(page, { name: 'Alice', roomId: rid });

    await page.fill('[aria-label="Story title"]', 'SCRUM-42: User Login');
    await page.press('[aria-label="Story title"]', 'Enter');
    await page.click('[aria-label="Vote 8"]');
    await page.click('button:has-text("Reveal Cards")');
    await expect(page.locator('.statistics')).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, 'revealed-results.png'),
      fullPage: false,
    });
  });
});
