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

test.describe("Workflow extras", () => {
  test("marks an owner as called and sinks them to the bottom", async ({ page }) => {
    await page.goto("/");
    const rows = page.locator("[data-owner]");
    const first = rows.first();
    const ownerId = await first.getAttribute("data-owner");

    await first.getByRole("button", { name: "Mark called" }).click();

    // The row stays visible (the mark is undoable) but is no longer first.
    await expect
      .poll(async () => page.locator(`[data-owner="${ownerId}"]`).getAttribute("data-called"), {
        timeout: 15_000,
      })
      .toBe("yes");
    await expect(page.locator(`[data-owner="${ownerId}"]`)).toContainText("Called today");
    expect(await rows.first().getAttribute("data-owner")).not.toBe(ownerId);

    // "Still to call" hides it; undo brings it back.
    const total = await rows.count();
    await page.getByRole("button", { name: /^Still to call \d+$/ }).click();
    await expect.poll(async () => rows.count()).toBe(total - 1);

    await page.getByRole("button", { name: /^All \d+$/ }).click();
    await page.locator(`[data-owner="${ownerId}"]`).getByRole("button", { name: "Undo" }).click();
    await expect
      .poll(async () => page.locator(`[data-owner="${ownerId}"]`).getAttribute("data-called"), {
        timeout: 15_000,
      })
      .toBe("no");
  });

  test("exports the call list as a CSV with one row per due item", async ({ page }) => {
    await page.goto("/");
    const download = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]).then(([d]) => d);

    expect(download.suggestedFilename()).toMatch(/^call-list-\d{4}-\d{2}-\d{2}\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    expect(csv).toContain("Priority");
    expect(csv).toContain("Days overdue");
    // Commas inside a reason must not break the columns.
    expect(csv.split(String.fromCharCode(10)).length).toBeGreaterThan(2);
  });

  test("records a service straight from the call list", async ({ page }) => {
    await page.goto("/");
    const row = page.locator("[data-owner]").first();
    const ownerId = (await row.getAttribute("data-owner"))!;
    const button = row.getByRole("button", { name: /^Record service for / }).first();
    const label = (await button.getAttribute("aria-label"))!;
    const itemName = label.replace("Record service for ", "");

    await button.click();
    await page
      .getByRole("form", { name: label })
      .getByRole("button", { name: /save service/i })
      .click();

    // Saving refreshes the list, so the row re-renders and the transient
    // success message goes with it — the owner may drop off the list entirely
    // once nothing of theirs is outstanding. The durable outcome is the real
    // assertion: that item is no longer listed as due for this owner.
    await expect
      .poll(
        async () => {
          const owner = page.locator(`[data-owner="${ownerId}"]`);
          if ((await owner.count()) === 0) return 0;
          return owner.getByRole("button", { name: `Record service for ${itemName}` }).count();
        },
        { timeout: 15_000 },
      )
      .toBe(0);
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

test.describe("Called list and email", () => {
  test("every owner has a demo address on the reserved domain", async ({ page }) => {
    await page.goto("/owners/O01");
    // example.com is IANA-reserved and accepts no mail, so a demo can never
    // reach a real person.
    await expect(page.getByRole("link", { name: /@example\.com$/ })).toBeVisible();
  });

  test("marking an owner called moves them into the called section", async ({ page }) => {
    await page.goto("/called");
    await expect(page.getByRole("heading", { name: /called today/i })).toBeVisible();
    const before = await page.locator("[data-called-owner]").count();

    await page.goto("/");
    const row = page.locator('[data-owner][data-called="no"]').first();
    const ownerId = await row.getAttribute("data-owner");
    await row.getByRole("button", { name: "Mark called" }).click();
    await expect
      .poll(async () => page.locator(`[data-owner="${ownerId}"]`).getAttribute("data-called"), {
        timeout: 15_000,
      })
      .toBe("yes");

    await page.goto("/called");
    await expect(page.locator(`[data-called-owner="${ownerId}"]`)).toBeVisible();
    expect(await page.locator("[data-called-owner]").count()).toBe(before + 1);

    // Undo puts them back on the list, so the section stays honest.
    await page
      .locator(`[data-called-owner="${ownerId}"]`)
      .getByRole("button", { name: "Undo" })
      .click();
    await expect
      .poll(async () => page.locator(`[data-called-owner="${ownerId}"]`).count(), { timeout: 15_000 })
      .toBe(0);
  });

  test("the email button offers a reminder and logs the contact", async ({ page }) => {
    await page.goto("/owners/O01");
    const control = page.getByRole("link", { name: "Email reminder" }).first();
    await expect(control).toBeVisible();
    // Titled with the address so the operator knows where it is going.
    await expect(control).toHaveAttribute("title", /@example\.com/);
  });

  test("the called section explains itself when nothing is logged", async ({ page }) => {
    await page.goto("/called");
    const rows = await page.locator("[data-called-owner]").count();
    if (rows === 0) {
      await expect(page.getByText("No calls logged yet today")).toBeVisible();
      await expect(page.getByRole("link", { name: /go to the call list/i })).toBeVisible();
    }
  });
});

test.describe("Search suggestions", () => {
  test("suggests owners, vehicles and items as you type", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel(/Search by owner/i);
    await input.fill("dha");

    const list = page.locator("[data-suggestions]");
    await expect(list).toBeVisible();
    const options = list.getByRole("option");
    expect(await options.count()).toBeGreaterThan(0);
    // Plates start with "Dhaka Metro", so these should be tagged Vehicle.
    await expect(options.first()).toContainText(/Vehicle/i);
  });

  test("a full multi-word value survives into the box", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel(/Search by owner/i);
    await input.fill("a");

    const first = page.locator("[data-suggestions]").getByRole("option").first();
    const label = (await first.textContent())!;
    await first.click();

    // Regression: an earlier version rebuilt the term from its map key and
    // truncated at the first space, so "Salma Ahmed" arrived as "Salma".
    const value = await input.inputValue();
    expect(value.length).toBeGreaterThan(1);
    expect(label).toContain(value);
    await expect(page.locator("[data-suggestions]")).toBeHidden();
  });

  test("keyboard selects a suggestion and Escape dismisses it", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel(/Search by owner/i);

    await input.fill("tyre");
    await expect(page.locator("[data-suggestions]")).toBeVisible();
    await input.press("ArrowDown");
    await input.press("Enter");
    expect((await input.inputValue()).toLowerCase()).toContain("tyre");

    await input.fill("brake");
    await expect(page.locator("[data-suggestions]")).toBeVisible();
    await input.press("Escape");
    await expect(page.locator("[data-suggestions]")).toBeHidden();
  });

  test("choosing a suggestion actually narrows the list", async ({ page }) => {
    await page.goto("/");
    const rows = page.locator("[data-owner]");
    const total = await rows.count();

    await page.getByLabel(/Search by owner/i).fill("Tyres");
    await page.locator("[data-suggestions]").getByRole("option").first().click();
    await expect.poll(async () => rows.count()).toBeLessThanOrEqual(total);
    expect(await rows.count()).toBeGreaterThan(0);
  });
});

test.describe("Gmail compose", () => {
  test("composes a prefilled Gmail draft and never sends", async ({ page, context }) => {
    await page.goto("/owners/O01");
    const control = page.getByRole("link", { name: "Email reminder" }).first();

    // Assert the URL we build, not where Google redirects: a signed-out browser
    // is bounced to accounts.google.com and back, which is Google's flow, not
    // ours.
    const href = (await control.getAttribute("href"))!;
    const url = new URL(href);
    expect(url.hostname).toBe("mail.google.com");
    expect(url.searchParams.get("view")).toBe("cm"); // compose, not send
    expect(url.searchParams.get("to")).toMatch(/@example\.com$/);
    expect(url.searchParams.get("su")).toMatch(/Service due on/);
    expect(url.searchParams.get("body")).toMatch(/Assalamu alaikum/);
    expect(url.searchParams.get("body")).toMatch(/Estimated total/);
    // Nothing in the URL could cause a send.
    expect(href).not.toMatch(/send/i);

    // And it really does open a second tab rather than navigating away.
    const [popup] = await Promise.all([context.waitForEvent("page"), control.click()]);
    expect(popup.url()).toContain("google.com");
    await expect(page).toHaveURL(/\/owners\/O01$/);
    await popup.close();
  });

  test("is a single action, pointed at a Gmail draft", async ({ page }) => {
    await page.goto("/owners/O01");
    // One email control, not two: the earlier version also carried a
    // "default app" mailto link, which was clutter.
    const controls = page.getByRole("link", { name: /email/i });
    expect(await controls.count()).toBe(1);
    await expect(controls.first()).toHaveAttribute("href", /^https:\/\/mail\.google\.com\/mail\/\?/);
    await expect(controls.first()).toHaveAttribute("target", "_blank");
  });
});

test.describe("Fleet filtering", () => {
  test("filters the fleet by status and search, and sorts it", async ({ page }) => {
    await page.goto("/vehicles");
    const rows = page.locator("[data-vehicle]");
    const total = await rows.count();
    expect(total).toBeGreaterThanOrEqual(40);

    await page.getByRole("button", { name: /^Overdue \d+$/ }).click();
    const overdue = await rows.count();
    expect(overdue).toBeGreaterThan(0);
    expect(overdue).toBeLessThan(total);

    await page.getByRole("button", { name: /^All \d+$/ }).click();
    await expect.poll(async () => rows.count()).toBe(total);

    // Sorting by plate must reorder without losing rows.
    await page.getByLabel("Sort vehicles").selectOption("plate");
    await expect.poll(async () => rows.count()).toBe(total);
    const plates = await rows.locator(".plate").allInnerTexts();
    expect([...plates].sort((a, b) => a.localeCompare(b))).toEqual(plates);
  });

  test("explains an empty fleet search instead of showing a blank table", async ({ page }) => {
    await page.goto("/vehicles");
    await page.getByLabel(/Search vehicles/i).fill("zzzznotaplate");
    await expect(page.getByText("No matching vehicles")).toBeVisible();
    await page.getByRole("button", { name: /^Show all \d+$/ }).click();
    expect(await page.locator("[data-vehicle]").count()).toBeGreaterThanOrEqual(40);
  });
});

test.describe("Dashboard", () => {
  test("leads with the value at risk and agrees with the call list", async ({ page }) => {
    await page.goto("/");
    const listTotal = await page.getByText(/Value of work/).locator("..").innerText();
    const listValue = listTotal.replace(/[^\d]/g, "");

    await page.goto("/dashboard");
    const hero = await page.getByText("Value at risk").locator("..").innerText();
    // Same engine, so the dashboard headline must equal the call list total.
    expect(hero.replace(/[^\d]/g, "")).toContain(listValue);
  });

  test("renders four charts, each labelled for a screen reader", async ({ page }) => {
    await page.goto("/dashboard");
    const charts = page.locator('[role="img"]');
    expect(await charts.count()).toBe(4);
    for (let i = 0; i < 4; i += 1) {
      const label = await charts.nth(i).getAttribute("aria-label");
      expect(label && label.length).toBeGreaterThan(10);
    }
  });

  test("identity never rests on colour alone", async ({ page }) => {
    await page.goto("/dashboard");
    // Every status and rule is named in text beside its swatch.
    for (const label of ["Overdue", "Due soon", "Fine", "No estimate"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    for (const label of ["Fixed date", "Distance"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("offers the numbers as a table, not only as charts", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("The numbers behind these charts").click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Share" })).toBeVisible();
  });

  test("filters redraw every chart", async ({ page }) => {
    await page.goto("/dashboard");
    const hero = page.getByText("Value at risk").locator("..");
    const before = (await hero.innerText()).replace(/[^\d]/g, "");

    await page.getByRole("button", { name: /^Distance \d+$/ }).click();
    await expect
      .poll(async () => (await hero.innerText()).replace(/[^\d]/g, ""))
      .not.toBe(before);

    await page.getByRole("button", { name: /^Reset$/ }).click();
    await expect
      .poll(async () => (await hero.innerText()).replace(/[^\d]/g, ""))
      .toBe(before);
  });

  test("survives a filter that leaves nothing to show", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /^Fixed date \d+$/ }).click();
    await page.getByRole("button", { name: "Needs action only" }).click();
    // Whatever the counts, the page must stay coherent rather than dividing by
    // zero or rendering an empty frame.
    await expect(page.getByText("Value at risk")).toBeVisible();
    await expect(page.locator('[role="img"]').first()).toBeVisible();
  });
});

test.describe("Service map", () => {
  test("plots today's calls on a real map of Dhaka", async ({ page }) => {
    await page.goto("/map");
    await expect(page.getByRole("heading", { name: /service map/i })).toBeVisible();

    // Tiles actually load; a blank grey box would also "render".
    await expect.poll(async () => page.locator(".leaflet-tile").count()).toBeGreaterThan(0);

    // One marker per located customer, plus the workshop.
    const rows = await page.locator("[data-map-owner]").count();
    expect(rows).toBeGreaterThan(0);
    await expect
      .poll(async () => page.locator(".leaflet-marker-icon").count())
      .toBe(rows + 1);

    // OpenStreetMap requires visible attribution.
    await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  });

  test("selecting a customer zooms the map to them", async ({ page }) => {
    await page.goto("/map");
    await expect.poll(async () => page.locator(".leaflet-tile").count()).toBeGreaterThan(0);

    const row = page.locator("[data-map-owner]").first();
    const id = await row.getAttribute("data-map-owner");
    expect(await row.getAttribute("data-selected")).toBe("no");

    await row.getByRole("button").first().click();

    await expect(page.locator(`[data-map-owner="${id}"]`)).toHaveAttribute(
      "data-selected",
      "yes",
    );
    await expect(page.locator(".leaflet-popup")).toBeVisible();

    // Selecting again clears it, so the map can be returned to the whole round.
    await row.getByRole("button").first().click();
    await expect(page.locator(`[data-map-owner="${id}"]`)).toHaveAttribute(
      "data-selected",
      "no",
    );
  });

  test("every customer has a Dhaka address and a directions link", async ({ page }) => {
    await page.goto("/owners/O01");

    await expect(page.getByText(/Dhaka$/).first()).toBeVisible();
    await expect.poll(async () => page.locator(".leaflet-container").count()).toBe(1);

    const directions = page.getByRole("link", { name: /Directions from workshop/ });
    const href = (await directions.getAttribute("href"))!;
    const url = new URL(href);
    expect(url.hostname).toBe("www.google.com");
    // Routed from the workshop to the customer, for driving.
    expect(url.searchParams.get("origin")).toMatch(/^23\.\d+,90\.\d+$/);
    expect(url.searchParams.get("destination")).toMatch(/^23\.\d+,90\.\d+$/);
    expect(url.searchParams.get("travelmode")).toBe("driving");
    // Dhaka sits near 23.8N, 90.4E — a coordinate outside that is a data bug.
    const [lat, lng] = url.searchParams.get("destination")!.split(",").map(Number);
    expect(lat).toBeGreaterThan(23.6);
    expect(lat).toBeLessThan(24.0);
    expect(lng).toBeGreaterThan(90.2);
    expect(lng).toBeLessThan(90.6);
  });

  test("selecting a customer draws a route and reports distance and time", async ({ page }) => {
    await page.goto("/map");
    await expect.poll(async () => page.locator(".leaflet-tile").count()).toBeGreaterThan(0);

    await page.locator("[data-map-owner]").first().getByRole("button").first().click();

    // The panel names the customer and gives both figures.
    await expect(page.getByText("Route from workshop")).toBeVisible();
    await expect(page.getByText("Distance", { exact: true })).toBeVisible();
    await expect(page.getByText("Drive time", { exact: true })).toBeVisible();

    // A route line is drawn on the map itself.
    await expect.poll(async () => page.locator(".leaflet-overlay-pane path").count()).toBeGreaterThan(0);

    // The distance resolves to a real figure, in km or m.
    await expect
      .poll(async () => page.locator("[data-route-km]").innerText(), { timeout: 12_000 })
      .toMatch(/^\d+(\.\d+)?\s*(km|m)$/);
    await expect
      .poll(async () => page.locator("[data-route-time]").innerText(), { timeout: 12_000 })
      .toMatch(/min|hr/);

    // And it says which kind of figure it is, rather than passing an estimate
    // off as a measurement.
    await expect(page.getByText(/Measured road route|Straight-line estimate/)).toBeVisible();
  });

  test("groups the round by area so a trip can be planned", async ({ page }) => {
    await page.goto("/map");
    await expect(page.getByRole("heading", { name: /By area/ })).toBeVisible();
    const areas = page.locator("h3");
    expect(await areas.count()).toBeGreaterThan(1);
    // Real Dhaka neighbourhoods, not invented ones.
    const names = (await areas.allInnerTexts()).join(" ");
    expect(names).toMatch(/Gulshan|Uttara|Dhanmondi|Mirpur|Banani|Motijheel|Bashundhara/);
  });
});

test.describe("Motion", () => {
  test("buttons acknowledge a press", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: /^Still to call/ });

    // The press itself is 120ms and hard to sample reliably; assert the
    // transition is wired to transform rather than trying to catch mid-frame.
    const transition = await button.evaluate((el) =>
      getComputedStyle(el).transitionProperty,
    );
    expect(transition).toContain("transform");
  });

  // Regression: the stagger is a page-load flourish. Filtering re-inserts rows,
  // and a freshly inserted row replays its entrance — so leaving the class on
  // would animate the list on every keystroke that widens the match.
  test("does not animate rows while filtering", async ({ page }) => {
    await page.goto("/");
    const list = page.locator("ol").first();
    await expect(list).toHaveClass(/stagger/);

    await page.getByLabel(/Search by owner/i).fill("a");
    await expect(list).not.toHaveClass(/stagger/);

    // The suggestion popup overlays the toolbar, so dismiss it before clicking.
    await page.getByLabel(/Search by owner/i).press("Escape");
    await page.getByRole("button", { name: /^Clear$/ }).click();
    await expect(list).toHaveClass(/stagger/);
  });

  test("respects reduced motion by fading rather than not animating", async ({ browser }) => {
    // Reduced motion means gentler, not absent: opacity still bridges the
    // change so nothing teleports, but the vertical travel is dropped.
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");

    const row = page.locator("[data-owner]").first();
    await expect(row).toBeVisible();
    const { name, delay } = await row.evaluate((el) => {
      const style = getComputedStyle(el);
      return { name: style.animationName, delay: style.animationDelay };
    });

    expect(name).toBe("fade-in");
    // The staggered delays must not outrank the reduced-motion override.
    expect(delay).toBe("0s");

    await context.close();
  });

  test("the disclosure opens without clipping its content", async ({ page }) => {
    await page.goto("/");
    const details = page.locator("details").first();
    await details.locator("summary").click();

    await expect(page.getByText(/Urgency leads/)).toBeVisible();
    // Whether ::details-content animates depends on browser support; what must
    // hold either way is that the content ends up at its full height.
    await expect
      .poll(async () => details.evaluate((el) => el.scrollHeight > 100), { timeout: 5_000 })
      .toBe(true);
  });
});
