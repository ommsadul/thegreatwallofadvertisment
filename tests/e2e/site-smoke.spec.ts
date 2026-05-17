import { expect, test } from "@playwright/test";

test("marketing pages keep the shared navigation and main headings", async ({ page }) => {
  await page.goto("/about");

  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "About" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByRole("heading", { name: "Own a tiny piece of internet space" }),
  ).toBeVisible();

  await page.goto("/faq");
  await expect(page.getByRole("link", { name: "FAQ" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByRole("heading", { name: "Answers before you claim your pixels" }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("claim wall renders the canvas, controls, and checkout panel", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("pixel-wall-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Claim pixels" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pixel view" })).toBeVisible();

  await expect(page.locator("canvas")).toHaveCount(3);
  const canvasSize = await page.locator("canvas").first().evaluate((element) => {
    const canvas = element as HTMLCanvasElement;

    return {
      backingHeight: canvas.height,
      backingWidth: canvas.width,
      displayHeight: canvas.clientHeight,
      displayWidth: canvas.clientWidth,
    };
  });

  expect(canvasSize.backingWidth).toBeGreaterThan(100);
  expect(canvasSize.backingHeight).toBeGreaterThan(100);
  expect(canvasSize.displayWidth).toBeGreaterThan(100);
  expect(canvasSize.displayHeight).toBeGreaterThan(100);
});
