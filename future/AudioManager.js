// managers/AudioManager.js
export class AudioManager {
    constructor() {
      this.sounds = {};
      this.listener = null;
      this.volume = 0.1;
      this.muted = false;
    }
    
    initialize(camera) {
      // Create audio listener and attach to camera
      this.listener = new THREE.AudioListener();
      camera.add(this.listener);
      
      // Load sounds
      this.loadSounds();
    }
    
    loadSounds() {
      const audioLoader = new THREE.AudioLoader();
      
      // Load background music
      this.loadSound(audioLoader, "background", "./assets/background_sound.mp3", true, 0.1);
      
      // Load sound effects
      this.loadSound(audioLoader, "collect", "./assets/collect.mp3", false, 0.3);
      this.loadSound(audioLoader, "levelUp", "./assets/level_up.mp3", false, 0.4);
      this.loadSound(audioLoader, "join", "./assets/player_join.mp3", false, 0.2);
    }
    
    loadSound(audioLoader, name, path, loop, volume) {
      try {
        const sound = new THREE.Audio(this.listener);
        
        audioLoader.load(path, (buffer) => {
          sound.setBuffer(buffer);
          sound.setLoop(loop);
          sound.setVolume(volume * this.volume);
          
          if (name === "background") {
            sound.play();
          }
          
          console.log(`Loaded sound: ${name}`);
        }, 
        // onProgress callback
        (xhr) => {
          console.log(`${name} sound: ${(xhr.loaded / xhr.total * 100)}% loaded`);
        },
        // onError callback
        (error) => {
          console.error(`Error loading sound ${name}:`, error);
        });
        
        this.sounds[name] = sound;
      } catch (error) {
        console.error(`Failed to load sound ${name}:`, error);
      }
    }
    
    play(name) {
      if (this.muted) return;
      
      const sound = this.sounds[name];
      if (sound && !sound.isPlaying) {
        sound.play();
      }
    }
    
    stop(name) {
      const sound = this.sounds[name];
      if (sound && sound.isPlaying) {
        sound.stop();
      }
    }
    
    setVolume(volume) {
      this.volume = Math.max(0, Math.min(1, volume));
      
      Object.values(this.sounds).forEach(sound => {
        // Keep the original relative volumes of each sound
        const originalVolume = sound.userData.originalVolume || 0.5;
        sound.setVolume(originalVolume * this.volume);
      });
    }
    
    mute() {
      this.muted = true;
      Object.values(this.sounds).forEach(sound => {
        sound.setVolume(0);
      });
    }
    
    unmute() {
      this.muted = false;
      this.setVolume(this.volume);
    }
    
    toggleMute() {
      if (this.muted) {
        this.unmute();
      } else {
        this.mute();
      }
      return this.muted;
    }
  }