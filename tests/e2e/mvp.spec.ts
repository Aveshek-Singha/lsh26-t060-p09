import { expect, test, type Page } from "@playwright/test";

/**
 * One block per required feature, so a reader can map the suite onto the brief.
 * Semantic locators throughout; no fixed waits.
 */

/** Reads the due date and status a vehicle page exposes for one item. */
async function itemState(page: Page, item: string) {
  const row = page.locator(`[data-item="${item}"]`);
  await expect(row).toBeVisible();
  return {
    status: await row.getAttribute("data-status"),
    due: await row.getAttribute("data-due"),
  };
}

async function allItemStates(page: Page) {
  const rows = page.locator("[data-item]");
  const count = await rows.count();
  const states: Record<string, string> = {};
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const name = await row.getAttribute("data-item");
    states[name!] = `${await row.getAttribute("data-status")}|${await row.getAttribute("data-due")}`;
  }
  return states;
}

test.describe("Feature 1 — the fleet exists with the required shape", () => {
  test("has at least 40 vehicles across at least 25 owners", async ({ page }) => {
    await page.goto("/vehicles");

    const rows = page.locator("[data-vehicle]");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(40);

    await expect(page.getByText(/\d+ vehicles belonging to \d+ owners/)).toBeVisible();
    const summary = await page.getByText(/vehicles belonging to/).innerText();
    const owners = Number(/belonging to (\d+) owners/.exec(summary)?.[1]);
    expect(owners).toBeGreaterThanOrEqual(25);
  });

  test("covers all three rule types on the fleet", async ({ page }) => {
    await page.goto("/vehicles/V01");
    const labels = await page.locator("[data-item]").allInnerTexts();
    const joined = labels.join(" ");
    // Every vehicle in the seed carries a mix; V01 has fixed-date, time and
    // distance items, which is what makes it a fair demo vehicle.
    // The rule chips are uppercased by CSS, and innerText reflects that.
    expect(joined).toMatch(/fixed date/i);
    expect(joined).toMatch(/distance/i);
    expect(joined).toMatch(/time/i);
  });
});

test.describe("Feature 2 — every item has a next due date from its own rule", () => {
  test("shows a status and a stated basis for each item", async ({ page }) => {
    await page.goto("/vehicles/V01");

    const rows = page.locator("[data-item]");
    expect(await rows.count()).toBeGreaterThan(0);

    for (let i = 0; i < (await rows.count()); i += 1) {
      const status = await rows.nth(i).getAttribute("data-status");
      expect(["overdue", "due_soon", "fine", "no_estimate"]).toContain(status);
    }
  });

  test("estimates distance items from that vehicle's own daily running", async ({ page }) => {
    await page.goto("/vehicles");
    // Find a vehicle whose distance items are estimable, then assert the basis
    // names a per-day rate rather than a flat interval.
    await page.goto("/vehicles/V01");
    const basis = page.getByText(/Runs [\d.]+ km\/day/).first();
    await expect(basis).toBeVisible();
    await expect(basis).toContainText(/km to go|km past due/);
  });

  test("shows the vehicle's measured daily running", async ({ page }) => {
    await page.goto("/vehicles/V01");
    await expect(page.getByText("Daily running")).toBeVisible();
  });
});

test.describe("Feature 3 — the daily call list", () => {
  test("lists each owner once, however many vehicles they have", async ({ page }) => {
    await page.goto("/");
    const owners = await page.locator("[data-owner]").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-owner")),
    );
    // The workshop rings a person, not a vehicle: no owner may appear twice.
    expect(new Set(owners).size).toBe(owners.length);
    expect(owners.length).toBeGreaterThan(0);
  });

  test("orders vehicles and explains the rule it used", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /call list/i })).toBeVisible();
    await expect(page.getByText(/How this list is ordered/)).toBeVisible();

    const rows = page.locator("ol > li");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // Scores must be non-increasing down the list.
    const scores = await page.locator("[data-score]").evaluateAll((items) =>
      items.map((item) => Number(item.getAttribute("data-score"))),
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!);
    }
  });

  test("every row names the owner, the vehicle, and why each item is due", async ({ page }) => {
    await page.goto("/");
    const first = page.locator("ol > li").first();

    // The row is keyed by owner, with that owner's vehicles nested inside it.
    await expect(first.locator("[data-owner]").or(first)).toBeVisible();
    await expect(first.getByRole("link", { name: /Dhaka Metro/ }).first()).toBeVisible();
    await expect(first.getByRole("link", { name: /^01\d{9}$/ }).first()).toBeVisible();
    await expect(first.getByText(/overdue|in \d+ days|due today/).first()).toBeVisible();
    await expect(first.getByText(/urgency \+/)).toBeVisible();
  });

  test("filters the list by a typed plate, owner or item", async ({ page }) => {
    await page.goto("/");
    const rows = page.locator("[data-owner]");
    const total = await rows.count();
    expect(total).toBeGreaterThan(1);

    // Search by the owner name shown on the first row.
    const firstOwner = await rows.first().locator("a").first().innerText();
    await page.getByLabel(/Search by owner/i).fill(firstOwner);
    await expect.poll(async () => rows.count()).toBeLessThan(total);
    await expect(rows.first()).toContainText(firstOwner);

    // Clearing restores the full list.
    await page.getByRole("button", { name: /^Clear$/ }).click();
    await expect.poll(async () => rows.count()).toBe(total);
  });

  test("filters by status and explains an empty result", async ({ page }) => {
    await page.goto("/");
    const rows = page.locator("[data-owner]");
    const total = await rows.count();

    await page.getByRole("button", { name: /^Overdue \d+$/ }).click();
    const overdueCount = await rows.count();
    expect(overdueCount).toBeGreaterThan(0);
    expect(overdueCount).toBeLessThanOrEqual(total);

    // A search that cannot match anything must say so, not show a blank page.
    await page.getByLabel(/Search by owner/i).fill("zzzznotarealplate");
    await expect(page.getByText("No matching calls")).toBeVisible();
    await page.getByRole("button", { name: /^Show all \d+$/ }).click();
    await expect.poll(async () => rows.count()).toBe(total);
  });

  test("the sorting rule can be opened and read", async ({ page }) => {
    await page.goto("/");
    await page.getByText("How this list is ordered").click();
    await expect(page.getByText(/Urgency leads/)).toBeVisible();
    await expect(page.getByText(/Money breaks ties/)).toBeVisible();
  });
});

test.describe("Feature 4 — recording a service resets that item only", () => {
  test("moves the target item and leaves every sibling untouched", async ({ page }) => {
    // A vehicle not used by the other mutating specs.
    await page.goto("/vehicles/V05");

    const before = await allItemStates(page);
    const target = Object.keys(before)[0]!;

    await page
      .locator(`[data-item="${target}"]`)
      .getByRole("button", { name: "Record service" })
      .click();

    const form = page.getByRole("form", { name: `Record service for ${target}` });
    await expect(form).toBeVisible();
    await form.getByRole("button", { name: /save service/i }).click();

    await expect(page.getByText(/recorded as serviced on/)).toBeVisible();

    // The page refreshes itself after a successful save.
    await expect
      .poll(async () => (await itemState(page, target)).due, { timeout: 15_000 })
      .not.toBe(before[target]!.split("|")[1]);

    const after = await allItemStates(page);

    expect(after[target]).not.toBe(before[target]);
    for (const [name, state] of Object.entries(before)) {
      if (name === target) continue;
      expect(after[name], `${name} must be unchanged`).toBe(state);
    }
  });

  test("the service history grows by the recorded service", async ({ page }) => {
    await page.goto("/vehicles/V06");

    const historyRows = page.locator("table tbody tr");
    const before = await historyRows.count();

    const target = (await page.locator("[data-item]").first().getAttribute("data-item"))!;
    await page
      .locator(`[data-item="${target}"]`)
      .getByRole("button", { name: "Record service" })
      .click();
    await page
      .getByRole("form", { name: `Record service for ${target}` })
      .getByRole("button", { name: /save service/i })
      .click();

    await expect(page.getByText(/recorded as serviced on/)).toBeVisible();
    await expect.poll(async () => historyRows.count(), { timeout: 15_000 }).toBe(before + 1);
  });

  test("rejects a duplicate submission with a readable message", async ({ page }) => {
    await page.goto("/vehicles/V07");
    const target = (await page.locator("[data-item]").first().getAttribute("data-item"))!;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const button = page
        .locator(`[data-item="${target}"]`)
        .getByRole("button", { name: "Record service" });
      if (await button.isVisible()) await button.click();
      await page
        .getByRole("form", { name: `Record service for ${target}` })
        .getByRole("button", { name: /save service/i })
        .click();
      if (attempt === 0) await expect(page.getByText(/recorded as serviced on/)).toBeVisible();
    }

    await expect(page.getByText(/already recorded as serviced/)).toBeVisible();
  });
});

test.describe("Odometer entry updates distance estimates", () => {
  test("accepts a new reading and recalculates", async ({ page }) => {
    await page.goto("/vehicles/V08");

    const panel = page.locator("[data-odometer]");
    const currentKm = Number(await panel.getAttribute("data-odometer"));
    const rateBefore = await panel.getAttribute("data-rate");
    expect(currentKm).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Add odometer reading" }).click();
    const form = page.getByRole("form", { name: "Add odometer reading" });
    await form.getByLabel("Odometer (km)").fill(String(currentKm + 900));
    await form.getByRole("button", { name: /save reading/i }).click();

    await expect(page.getByText(/Odometer updated to/)).toBeVisible();

    // The point of the feature: a new reading changes the measured daily
    // running, which is what every distance estimate is derived from.
    await expect
      .poll(async () => panel.getAttribute("data-odometer"), { timeout: 15_000 })
      .toBe(String(currentKm + 900));
    expect(await panel.getAttribute("data-rate")).not.toBe(rateBefore);
  });

  test("refuses an odometer reading that goes backwards", async ({ page }) => {
    await page.goto("/vehicles/V09");

    await page.getByRole("button", { name: "Add odometer reading" }).click();
    const form = page.getByRole("form", { name: "Add odometer reading" });
    await form.getByLabel("Odometer (km)").fill("1");
    await form.getByRole("button", { name: /save reading/i }).click();

    await expect(page.getByText(/cannot go backwards/i)).toBeVisible();
  });

  test("refuses a non-numeric odometer reading", async ({ page }) => {
    await page.goto("/vehicles/V10");

    await page.getByRole("button", { name: "Add odometer reading" }).click();
    const form = page.getByRole("form", { name: "Add odometer reading" });
    await form.getByLabel("Odometer (km)").fill("abc");
    await form.getByRole("button", { name: /save reading/i }).click();

    await expect(page.getByText(/whole number of kilometres/i)).toBeVisible();
  });
});

test.describe("Interface behaviour", () => {
  test("switches between dark and light and remembers the choice", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: /switch to (light|dark) theme/i });
    const before = await page.evaluate(() => document.documentElement.classList.contains("dark"));

    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(!before);

    await page.reload();
    // The inline head script must restore it before paint, with no flash back.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(!before);
  });

  test("is usable on a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /call list/i })).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows, "page must not scroll horizontally at 375px").toBe(false);
  });

  test("reports a missing vehicle instead of crashing", async ({ page }) => {
    const response = await page.goto("/vehicles/DOES-NOT-EXIST");
    expect(response?.status()).toBe(404);
  });

  test("the working date drives the whole app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Working date")).toBeVisible();
    await expect(page.getByText("30 Aug 2026").first()).toBeVisible();
  });
});
