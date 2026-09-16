import { test, expect } from "@playwright/test";
import { createTestRequester, deleteTestRequester } from "./supabase-fixture";

let requesterId: string;
let categoryName: string;

test.beforeAll(async () => {
  const { requester, category } = await createTestRequester("QA E2E Items");
  requesterId = requester.id;
  categoryName = category.name;
});

test.afterAll(async () => {
  await deleteTestRequester(requesterId);
});

test("se puede agregar un ítem con producto y comentario", async ({ page }) => {
  await page.goto(`/${requesterId}`);
  await expect(page.getByRole("button", { name: categoryName })).toBeVisible();

  await page.getByRole("button", { name: "+ Agregar algo" }).click();
  await page.getByPlaceholder("Producto").fill("Perfume de prueba");
  await page
    .getByPlaceholder("Comentario (opcional) — talle, color, alguna aclaración")
    .fill("100ml, el de siempre");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText("Perfume de prueba")).toBeVisible();
  await expect(page.getByText("100ml, el de siempre")).toBeVisible();
});

test("se puede borrar un ítem deslizando y confirmando", async ({ page }) => {
  await page.goto(`/${requesterId}`);

  await page.getByRole("button", { name: "+ Agregar algo" }).click();
  await page.getByPlaceholder("Producto").fill("Ítem para borrar");
  await page.getByRole("button", { name: "Guardar" }).click();

  const row = page.getByTestId("item-row").filter({ hasText: "Ítem para borrar" });
  await expect(row).toBeVisible();

  // Desliza la fila hacia la izquierda con el mouse para revelar el tacho
  // (mismo gesto que el swipe táctil que implementa ItemRow con Pointer
  // Events).
  const box = await row.boundingBox();
  if (!box) throw new Error("No se encontró la fila del ítem a borrar.");
  const startX = box.x + box.width - 20;
  const y = box.y + box.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 100, y, { steps: 10 });
  await page.mouse.up();

  // Primer toque arma la confirmación, segundo toque borra de verdad.
  const trashButton = row.getByRole("button", { name: "Borrar (deslizado)" });
  await trashButton.click();
  await row.getByRole("button", { name: "Confirmar borrado" }).click();

  await expect(page.getByText("Ítem para borrar")).not.toBeVisible();
});
