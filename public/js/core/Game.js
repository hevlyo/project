
import { SceneManager } from '../managers/SceneManager.js';
import { PlayerManager } from '../managers/PlayerManager.js';
import { NetworkManager } from '../managers/NetworkManager.js';
import { UIManager } from '../managers/UIManager.js';
import { SETTINGS } from '../utils/Settings.js';

export class Game {
    constructor() {
        this.sceneManager = new SceneManager();
        this.playerManager = new PlayerManager();
        this.networkManager = new NetworkManager();
        this.uiManager = new UIManager();
        this.isRunning = false;
    }

    async initialize() {
        await this.sceneManager.initialize();
        await this.playerManager.initialize();
        await this.networkManager.initialize();
        await this.uiManager.initialize();
        this.isRunning = true;
        this.animate();
    }

    animate() {
        if (!this.isRunning) return;
        
        requestAnimationFrame(() => this.animate());
        this.sceneManager.update();
        this.playerManager.update();
        this.uiManager.update();
    }
}
