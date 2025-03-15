export class InputManager {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            sprint: false,
        };
        this.powerUps = {
            SPEED: { active: false, duration: 5000 }
        };
    }

    initialize() {
        window.addEventListener("keydown", (event) => this.handleKeyDown(event));
        window.addEventListener("keyup", (event) => this.handleKeyUp(event));
        window.addEventListener("blur", () => this.resetKeys());
    }

    handleKeyDown(event) {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", "Shift"].includes(event.key)) {
            event.preventDefault();
        }
        
        switch (event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.keys.forward = true;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.keys.backward = true;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.keys.left = true;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.keys.right = true;
                break;
            case 'Shift':
                this.keys.sprint = true;
                break;
        }
    }

    handleKeyUp(event) {
        switch (event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.keys.forward = false;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.keys.backward = false;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.keys.left = false;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.keys.right = false;
                break;
            case 'Shift':
                this.keys.sprint = false;
                break;
        }
    }

    resetKeys() {
        Object.keys(this.keys).forEach(key => {
            this.keys[key] = false;
        });
    }

    activatePowerUp(type, duration) {
        if (this.powerUps[type]) {
            this.powerUps[type].active = true;
            
            // Automatically deactivate after duration
            setTimeout(() => {
                this.powerUps[type].active = false;
            }, duration || this.powerUps[type].duration);
        }
    }

    getInputState() {
        return {
            ...this.keys,
            powerUps: this.powerUps
        };
    }
}