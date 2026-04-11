import { expect, test } from '@playwright/test';

test.describe('Pega Bola Frontend', () => {
  test('carrega menu e conecta com nickname', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Pega Bola 3000' })).toBeVisible();

    const nicknameInput = page.locator('#nickname-input');
    await nicknameInput.fill('E2EPlayer');

    await page.getByRole('button', { name: 'Aceitar meu destino' }).click();

    await expect(page.locator('#hud')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#score-value')).toHaveText(/\d+/);
  });
});
