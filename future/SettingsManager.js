// managers/SettingsManager.js
export class SettingsManager {
    constructor() {
      this.SETTINGS = {
        // Movement settings
        MOVE_SPEED: 0.2,
        SPRINT_MULTIPLIER: 1.5,
        ACCELERATION: 0.015,
        DECELERATION: 0.03,
        
        // Player settings
        PLAYER_HEIGHT: 1,
        PLAYER_RADIUS: 0.5,
        PLAYER_SEGMENTS: 32,
        SIZE_INCREASE_PER_BALL: 0.1,
        MAX_SIZE_MULTIPLIER: 2.5,
        
        // Camera settings
        CAMERA_HEIGHT: 3,
        CAMERA_DISTANCE: 5,
        CAMERA_FOV: 75,
        CAMERA_NEAR: 0.1,
        CAMERA_FAR: 1000,
        
        // Ball settings
        BALL_RADIUS: 0.3,
        BALL_SEGMENTS: 16,
        BALL_ROTATION_SPEED: 0.02,
        BALL_VALUE: 10,
        BALL_HOVER_HEIGHT: 0.2,
        BALL_HOVER_SPEED: 1.0,
        COLLECTION_DISTANCE: 1.5,
        
        // Network settings
        MIN_INTERPOLATION_SPEED: 0.05,
        MAX_INTERPOLATION_SPEED: 0.25,
        PING_WEIGHT: 0.01,
        
        // Animation settings
        TILT_INTENSITY: 0.15,
        TILT_RECOVERY_SPEED: 0.1,
        BOB_FREQUENCY: 0.1,
        BOB_AMPLITUDE: 0.05,
        BOB_SPEED_SCALING: 1.5,
        
        // Visual settings
        SKY_COLOR: 0x87cefa,
        DELTA_TIME: 1/60,
        
        // UI settings
        NAMETAG_OFFSET_Y: 2.2,
        NAMETAG_SCALE: 0.01,
        UI_TRANSITION_DURATION: "0.3s",
        
        // Nickname settings
        NICKNAME_MAX_LENGTH: 20,
        NICKNAME_MIN_LENGTH: 2,
        NICKNAME_PATTERN: /^[a-zA-Z0-9\s\-_]+$/,
        
        // Power-up settings
        SPEED_BOOST_MULTIPLIER: 2.0,
      };
      
      // Load any saved settings from localStorage
      this.loadSettings();
    }
    
    loadSettings() {
      const savedSettings = localStorage.getItem('gameSettings');
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          this.SETTINGS = { ...this.SETTINGS, ...parsedSettings };
        } catch (e) {
          console.error("Failed to load settings:", e);
        }
      }
    }
    
    saveSettings() {
      localStorage.setItem('gameSettings', JSON.stringify(this.SETTINGS));
    }
    
    updateSetting(key, value) {
      if (key in this.SETTINGS) {
        this.SETTINGS[key] = value;
        this.saveSettings();
        return true;
      }
      return false;
    }
    
    getSetting(key) {
      return this.SETTINGS[key];
    }
    
    getAllSettings() {
      return { ...this.SETTINGS };
    }
  }