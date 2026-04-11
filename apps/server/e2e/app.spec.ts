import { expect, test } from '@playwright/test';

test.describe('Pega Bola Frontend', () => {
  test('controles de trilha no menu respondem a volume e mute', async ({ page }) => {
    await page.goto('/');

    const volumeValue = page.locator('#music-volume-value');
    const muteButton = page.locator('#music-mute-button');
    const volumeInput = page.locator('#music-volume-input');

    await expect(volumeValue).toHaveText('8%');
    await expect(muteButton).toHaveAttribute('aria-pressed', 'false');

    await volumeInput.fill('33');
    await volumeInput.dispatchEvent('input');

    await expect(volumeValue).toHaveText('33%');

    await muteButton.click();
    await expect(muteButton).toHaveAttribute('aria-pressed', 'true');
    await expect(muteButton).toHaveText('Som off');
    await expect(volumeValue).toHaveText('0%');
  });

  test('carrega menu e conecta com nickname', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Pega Bola 3000' })).toBeVisible();

    const nicknameInput = page.locator('#nickname-input');
    await nicknameInput.fill('E2EPlayer');

    await page.getByRole('button', { name: 'Aceitar meu destino' }).click();

    await expect(page.locator('#hud')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#score-value')).toHaveText(/\d+/);
  });

  test('renderiza o mesh do jogador local após entrar', async ({ page }) => {
    await page.goto('/');

    await page.locator('#nickname-input').fill('RenderCheck');
    await page.getByRole('button', { name: 'Aceitar meu destino' }).click();

    await expect(page.locator('#hud')).toBeVisible({ timeout: 15_000 });

    await page.waitForFunction(() => {
      const app = globalThis.__pegaBolaApp;
      return Boolean(app?.scene?.playerMeshes?.size > 0);
    }, null, { timeout: 15_000 });

    const sceneState = await page.evaluate(() => ({
      playerMeshCount: globalThis.__pegaBolaApp?.scene?.playerMeshes?.size ?? 0,
      ballMeshCount: globalThis.__pegaBolaApp?.scene?.ballMeshes?.size ?? 0,
      hasLocalPlayer: Boolean(globalThis.__pegaBolaApp?.players?.get?.(globalThis.__pegaBolaApp?.localPlayerId)),
    }));

    expect(sceneState.playerMeshCount).toBeGreaterThan(0);
    expect(sceneState.ballMeshCount).toBeGreaterThan(0);
    expect(sceneState.hasLocalPlayer).toBe(true);
  });
});
