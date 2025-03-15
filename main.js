// main.js - Entry point
import { GameManager } from './managers/GameManager.js';
import { UIManager } from './future/UIManager.js';
import { SettingsManager } from './future/SettingsManager.js';
import { AudioManager } from './future/AudioManager.js';

document.addEventListener("DOMContentLoaded", () => {
  const settingsManager = new SettingsManager();
  const audioManager = new AudioManager();
  const uiManager = new UIManager(settingsManager);
  const gameManager = new GameManager(settingsManager, uiManager, audioManager);

  // Initialize game components
  uiManager.initialize();
  gameManager.initialize();

  // Handle window resize
  window.addEventListener("resize", () => gameManager.handleResize());
});