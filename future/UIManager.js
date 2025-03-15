// managers/UIManager.js
export class UIManager {
    constructor(settingsManager) {
      this.settingsManager = settingsManager;
      this.elements = {
        menuScreen: null,
        nicknameInput: null,
        playButton: null,
        scoreDisplay: null,
        topScoreDisplay: null,
        playerCountDisplay: null,
        messageDisplay: null,
        settingsButton: null,
        settingsPanel: null,
        minimap: null
      };
      this.callbacks = {
        onPlay: null,
        onSettingsChanged: null
      };
    }
    
    initialize() {
      // Get existing elements
      this.elements.menuScreen = document.getElementById("menu-screen");
      this.elements.nicknameInput = document.getElementById("nickname-input");
      this.elements.playButton = document.getElementById("play-button");
      
      if (this.elements.playButton) {
        this.elements.playButton.addEventListener("click", () => {
          if (this.callbacks.onPlay) {
            this.callbacks.onPlay(this.elements.nicknameInput.value);
          }
        });
      }
      
      if (this.elements.nicknameInput) {
        this.elements.nicknameInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter" && this.callbacks.onPlay) {
            this.callbacks.onPlay(this.elements.nicknameInput.value);
          }
        });
      }
      
      // Add settings button
      this.createSettingsButton();
    }
    
    createGameUI() {
      const settings = this.settingsManager.SETTINGS;
      
      // Score display
      this.elements.scoreDisplay = this.createUIElement("div", {
        id: "score-display",
        className: "game-ui",
        styles: {
          position: "absolute",
          top: "10px",
          left: "10px",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: "18px",
          padding: "5px 10px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          borderRadius: "5px",
          transition: `opacity ${settings.UI_TRANSITION_DURATION} ease-in`,
          opacity: "0"
        },
        innerHTML: "Score: 0"
      });
      
      // Leaderboard display
      this.elements.topScoreDisplay = this.createUIElement("div", {
        id: "leaderboard-display",
        className: "game-ui",
        styles: {
          position: "absolute",
          top: "10px",
          right: "10px",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: "16px",
          padding: "5px 10px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          borderRadius: "5px",
          transition: `opacity ${settings.UI_TRANSITION_DURATION} ease-in`,
          opacity: "0",
          minWidth: "230px"
        },
        innerHTML: '<div style="text-align: center; margin-bottom: 5px; font-weight: bold;">🏆 Leaderboard</div><div id="leaderboard-entries"></div>'
      });
      
      // Player count display
      this.elements.playerCountDisplay = this.createUIElement("div", {
        id: "player-count-display",
        className: "game-ui",
        styles: {
          position: "absolute",
          bottom: "10px",
          left: "10px",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: "16px",
          padding: "5px 10px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          borderRadius: "5px",
          transition: `opacity ${settings.UI_TRANSITION_DURATION} ease-in`,
          opacity: "0"
        },
        innerHTML: "Players: 0"
      });
      
      // Message display
      this.elements.messageDisplay = this.createUIElement("div", {
        id: "message-display",
        className: "game-ui",
        styles: {
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: "24px",
          padding: "10px 20px",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          borderRadius: "5px",
          display: "none",
          transition: `opacity ${settings.UI_TRANSITION_DURATION} ease-in-out`,
          opacity: "0"
        }
      });
      
      // Minimap
      this.elements.minimap = this.createUIElement("div", {
        id: "minimap",
        className: "game-ui",
        styles: {
          position: "absolute",
          bottom: "10px",
          right: "10px",
          width: "150px",
          height: "150px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          borderRadius: "5px",
          transition: `opacity ${settings.UI_TRANSITION_DURATION} ease-in`,
          opacity: "0",
          overflow: "hidden"
        }
      });
      
      // Create a canvas for the minimap
      const minimapCanvas = document.createElement("canvas");
      minimapCanvas.width = 150;
      minimapCanvas.height = 150;
      minimapCanvas.style.width = "100%";
      minimapCanvas.style.height = "100%";
      this.elements.minimap.appendChild(minimapCanvas);
      this.minimapContext = minimapCanvas.getContext("2d");
      
      // Make UI visible after a short delay
      setTimeout(() => {
        this.elements.scoreDisplay.style.opacity = "1";
        this.elements.topScoreDisplay.style.opacity = "1";
        this.elements.playerCountDisplay.style.opacity = "1";
        this.elements.minimap.style.opacity = "1";
      }, 50);
    }
    
    createSettingsButton() {
      // Create settings button
      this.elements.settingsButton = this.createUIElement("button", {
        id: "settings-button",
        className: "game-ui",
        styles: {
          position: "absolute",
          top: "10px",
          right: "10px",
          padding: "5px 10px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          zIndex: "1000"
        },
        innerHTML: "⚙️ Settings"
      });
      
      // Create settings panel (hidden by default)
      this.elements.settingsPanel = this.createUIElement("div", {
        id: "settings-panel",
        className: "game-ui",
        styles: {
          position: "absolute",
          top: "50px",
          right: "10px",
          padding: "15px",
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "white",
          borderRadius: "5px",
          zIndex: "1000",
          display: "none",
          width: "300px",
          maxHeight: "80vh",
          overflowY: "auto"
        },
        innerHTML: '<h3 style="margin-top:0">Game Settings</h3>'
      });
      
      // Add settings controls
      this.createSettingsControls();
      
      // Toggle settings panel when button is clicked
      this.elements.settingsButton.addEventListener("click", () => {
        if (this.elements.settingsPanel.style.display === "none") {
          this.elements.settingsPanel.style.display = "block";
        } else {
          this.elements.settingsPanel.style.display = "none";
        }
      });
    }
    
    createSettingsControls() {
      const settings = this.settingsManager.SETTINGS;
      
      // Visual settings section
      const visualSection = document.createElement("div");
      visualSection.innerHTML = '<h4>Visual Settings</h4>';
      
      // Sky color picker
      const skyColorContainer = document.createElement("div");
      skyColorContainer.style.marginBottom = "10px";
      skyColorContainer.innerHTML = '<label for="sky-color">Sky Color: </label>';
      
      const skyColorPicker = document.createElement("input");
      skyColorPicker.type = "color";
      skyColorPicker.id = "sky-color";
      skyColorPicker.value = "#" + settings.SKY_COLOR.toString(16).padStart(6, '0');
      skyColorPicker.addEventListener("change", (e) => {
        const colorValue = parseInt(e.target.value.substring(1), 16);
        this.settingsManager.updateSetting("SKY_COLOR", colorValue);
        if (this.callbacks.onSettingsChanged) {
          this.callbacks.onSettingsChanged("SKY_COLOR", colorValue);
        }
      });
      
      skyColorContainer.appendChild(skyColorPicker);
      visualSection.appendChild(skyColorContainer);
      
      // Player speed slider
      const speedContainer = document.createElement("div");
      speedContainer.style.marginBottom = "10px";
      speedContainer.innerHTML = '<label for="move-speed">Movement Speed: </label>';
      
      const speedSlider = document.createElement("input");
      speedSlider.type = "range";
      speedSlider.id = "move-speed";
      speedSlider.min = "0.1";
      speedSlider.max = "0.5";
      speedSlider.step = "0.05";
      speedSlider.value = settings.MOVE_SPEED;
      speedSlider.addEventListener("change", (e) => {
        const speedValue = parseFloat(e.target.value);
        this.settingsManager.updateSetting("MOVE_SPEED", speedValue);
        if (this.callbacks.onSettingsChanged) {
          this.callbacks.onSettingsChanged("MOVE_SPEED", speedValue);
        }
      });
      
      speedContainer.appendChild(speedSlider);
      visualSection.appendChild(speedContainer);
      
      this.elements.settingsPanel.appendChild(visualSection);
      
      // Audio section
      const audioSection = document.createElement("div");
      audioSection.innerHTML = '<h4>Audio Settings</h4>';
      
      // Volume slider
      const volumeContainer = document.createElement("div");
      volumeContainer.style.marginBottom = "10px";
      volumeContainer.innerHTML = '<label for="volume">Volume: </label>';
      
      const volumeSlider = document.createElement("input");
      volumeSlider.type = "range";
      volumeSlider.id = "volume";
      volumeSlider.min = "0";
      volumeSlider.max = "1";
      volumeSlider.step = "0.1";
      volumeSlider.value = "0.1"; // Default volume
      volumeSlider.addEventListener("change", (e) => {
        const volumeValue = parseFloat(e.target.value);
        if (this.callbacks.onSettingsChanged) {
          this.callbacks.onSettingsChanged("VOLUME", volumeValue);
        }
      });
      
      volumeContainer.appendChild(volumeSlider);
      audioSection.appendChild(volumeContainer);
      
      this.elements.settingsPanel.appendChild(audioSection);
    }
    
    createUIElement(type, options) {
      const element = document.createElement(type);
      
      if (options.id) element.id = options.id;
      if (options.className) element.className = options.className;
      if (options.innerHTML) element.innerHTML = options.innerHTML;
      
      if (options.styles) {
        Object.entries(options.styles).forEach(([property, value]) => {
          element.style[property] = value;
        });
      }
      
      document.body.appendChild(element);
      return element;
    }
    
    hideMenu() {
      if (this.elements.menuScreen) {
        const duration = this.settingsManager.getSetting("UI_TRANSITION_DURATION");
        this.elements.menuScreen.style.transition = `opacity ${duration} ease-out`;
        this.elements.menuScreen.style.opacity = "0";
        
        setTimeout(() => {
          this.elements.menuScreen.style.display = "none";
        }, parseFloat(duration) * 1000);
      }
    }
    
    updateScore(score) {
      if (this.elements.scoreDisplay) {
        this.elements.scoreDisplay.innerHTML = `Score: ${score}`;
      }
    }
    
    updatePlayerCount(count) {
      if (this.elements.playerCountDisplay) {
        this.elements.playerCountDisplay.innerHTML = `Players: ${count}`;
      }
    }
    
    updateLeaderboard(players) {
      const leaderboardEntries = document.getElementById("leaderboard-entries");
      if (!leaderboardEntries) return;
      
      leaderboardEntries.innerHTML = "";
      const medals = ["🥇", "🥈", "🥉"];
      
      const topPlayers = players.slice(0, 3);
      topPlayers.forEach((player, index) => {
        const entry = document.createElement("div");
        entry.className = "leaderboard-entry";
        entry.style.margin = "3px 0";
        entry.style.display = "flex";
        entry.style.justifyContent = "space-between";
        
        if (player.isLocalPlayer) {
          entry.style.fontWeight = "bold";
          entry.style.color = "#ffff00";
        }
        
        const nameSpan = document.createElement("span");
        nameSpan.innerHTML = `${medals[index] || "•"} ${player.nickname}`;
        nameSpan.style.textOverflow = "ellipsis";
        nameSpan.style.overflow = "hidden";
        nameSpan.style.whiteSpace = "nowrap";
        nameSpan.style.maxWidth = "170px";
        
        const scoreSpan = document.createElement("span");
        scoreSpan.innerHTML = `${player.score}`;
        scoreSpan.style.marginLeft = "10px";
        
        entry.appendChild(nameSpan);
        entry.appendChild(scoreSpan);
        leaderboardEntries.appendChild(entry);
      });
      
      // Fill empty slots
      for (let i = topPlayers.length; i < 3; i++) {
        const emptyEntry = document.createElement("div");
        emptyEntry.className = "leaderboard-entry";
        emptyEntry.style.margin = "3px 0";
        emptyEntry.style.color = "#888";
        emptyEntry.innerHTML = `${medals[i] || "•"} ---`;
        leaderboardEntries.appendChild(emptyEntry);
      }
    }
    
    showMessage(message, duration = 3000) {
      if (!this.elements.messageDisplay) return;
      
      this.elements.messageDisplay.innerHTML = message;
      this.elements.messageDisplay.style.display = "block";
      this.elements.messageDisplay.style.opacity = "1";
      
      if (duration > 0) {
        setTimeout(() => {
          this.elements.messageDisplay.style.opacity = "0";
          setTimeout(() => {
            this.elements.messageDisplay.style.display = "none";
          }, parseFloat(this.settingsManager.getSetting("UI_TRANSITION_DURATION")) * 1000);
        }, duration);
      }
    }
    
    updateMinimap(localPlayer, players, balls, worldSize) {
      if (!this.minimapContext) return;
      
      const ctx = this.minimapContext;
      const canvas = ctx.canvas;
      const scale = canvas.width / (worldSize * 2);
      
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      // Draw the balls
      ctx.fillStyle = '#ffff00';
      Object.values(balls).forEach(ball => {
        if (!ball.collected) {
          const x = (ball.mesh.position.x + worldSize) * scale;
          const z = (ball.mesh.position.z + worldSize) * scale;
          ctx.beginPath();
          ctx.arc(x, z, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      // Draw other players
      ctx.fillStyle = '#ff0000';
      Object.values(players).forEach(player => {
        if (player.id !== localPlayer.id) {
          const x = (player.mesh.position.x + worldSize) * scale;
          const z = (player.mesh.position.z + worldSize) * scale;
          ctx.beginPath();
          ctx.arc(x, z, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      // Draw local player (larger and different color)
      ctx.fillStyle = '#00ff00';
      const localX = (localPlayer.mesh.position.x + worldSize) * scale;
      const localZ = (localPlayer.mesh.position.z + worldSize) * scale;
      ctx.beginPath();
      ctx.arc(localX, localZ, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    setCallback(type, callback) {
      if (type in this.callbacks) {
        this.callbacks[type] = callback;
      }
    }
  }