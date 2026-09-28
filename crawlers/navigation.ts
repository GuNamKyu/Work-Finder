import type { Page } from 'playwright';

/** These government lists submit full HTML forms. Register the waiter BEFORE submitting. */
export async function submitList(page: Page, submit: () => Promise<unknown>, readySelector: string) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 }),
    submit(),
  ]);
  await page.locator(readySelector).first().waitFor({ state: 'attached', timeout: 10_000 });
}

export async function openList(page: Page, url: string, readySelector: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.locator(readySelector).first().waitFor({ state: 'attached', timeout: 10_000 });
      return;
    } catch (error) { lastError = error; }
  }
  throw lastError;
}
