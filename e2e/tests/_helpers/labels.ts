import { Page, Locator } from "@playwright/test";

// Scoring app uses <label>Text</label><input/select> as siblings (no `for`/`id`),
// so Playwright's getByLabel() doesn't link them. These helpers find the
// element immediately following a label with the given text.

export function fieldByLabel(page: Page, labelText: string): Locator {
  // Try select first, then input — matches the form layouts in scoring/.
  return page.locator(
    `xpath=//label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${labelText.toLowerCase()}')]/following-sibling::*[self::input or self::select or self::textarea][1]`
  ).first();
}

export function inputByType(page: Page, type: "email" | "password" | "text" | "number"): Locator {
  return page.locator(`input[type='${type}']`).first();
}
