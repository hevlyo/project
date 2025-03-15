export class PlayerManager {
    constructor(settingsManager, sceneManager, networkManager) {
      this.settingsManager = settingsManager;
      this.sceneManager = sceneManager;
      this.networkManager = networkManager;
      this.players = {};
      this.localPlayerId = null;
      this.interpolationData = {};
      this.currentVelocity = new THREE.Vector3(0, 0, 0);
      this.targetVelocity = new THREE.Vector3(0, 0, 0);
      this.bobTimer = 0;
      this.leaderboardPlayers = [];
      this.powerUps = {
        SPEED: { active: false, duration: 5000 }
      };
    }
  
    setLocalPlayerId(id) {
      this.localPlayerId = id;
    }
  
    getLocalPlayer() {
      return this.players[this.localPlayerId];
    }
  
    addPlayer(playerInfo) {
      if (this.players[playerInfo.id]) {
        this.players[playerInfo.id].mesh.position.set(
          playerInfo.position.x,
          playerInfo.position.y + this.settingsManager.SETTINGS.PLAYER_HEIGHT,
          playerInfo.position.z
        );
        return;
      }
  
      console.log("Adding player:", playerInfo.id);
      
      const settings = this.settingsManager.SETTINGS;
      const playerGeometry = new THREE.CylinderGeometry(
        settings.PLAYER_RADIUS,
        settings.PLAYER_RADIUS,
        settings.PLAYER_HEIGHT * 2,
        settings.PLAYER_SEGMENTS
      );
      
      const playerMaterial = new THREE.MeshStandardMaterial({
        color: playerInfo.color || this.sceneManager.getRandomColor(),
        roughness: 0.5,
        metalness: 0.5,
      });
      
      const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
      playerMesh.castShadow = true;
      playerMesh.receiveShadow = true;
      playerMesh.position.set(
        playerInfo.position.x,
        playerInfo.position.y + settings.PLAYER_HEIGHT,
        playerInfo.position.z
      );
      
      const nickname = playerInfo.nickname || `Player ${playerInfo.id.substring(0, 4)}`;
      const nametagGroup = this.sceneManager.createNametag(nickname);
      nametagGroup.position.set(0, settings.NAMETAG_OFFSET_Y, 0);
      playerMesh.add(nametagGroup);
      
      this.players[playerInfo.id] = {
        mesh: playerMesh,
        id: playerInfo.id,
        nickname: nickname,
        score: playerInfo.score || 0,
        color: playerMaterial.color.getHex(),
        sizeMultiplier: playerInfo.sizeMultiplier || 1.0,
        nametagGroup: nametagGroup,
        baseHeight: playerInfo.position.y || 0,
      };
      
      this.sceneManager.addToScene(playerMesh);
      
      if (playerInfo.id === this.localPlayerId) {
        this.updateCameraPosition();
      }
    }
  
    removePlayer(playerId) {
      if (this.players[playerId]) {
        if (this.players[playerId].mesh) {
          this.sceneManager.removeFromScene(this.players[playerId].mesh);
        }
        delete this.players[playerId];
        
        if (this.interpolationData[playerId]) {
          delete this.interpolationData[playerId];
        }
        
        console.log(`Player ${playerId} removed from scene`);
      }
    }
  
    updatePlayerSize(playerId) {
      if (!this.players[playerId] || !this.players[playerId].mesh) return;
      
      const settings = this.settingsManager.SETTINGS;
      const player = this.players[playerId];
      const score = player.score || 0;
      const ballsCollected = score / settings.BALL_VALUE;
      const sizeMultiplier = Math.min(
        1.0 + ballsCollected * settings.SIZE_INCREASE_PER_BALL,
        settings.MAX_SIZE_MULTIPLIER
      );
      
      player.sizeMultiplier = sizeMultiplier;
      player.mesh.scale.set(sizeMultiplier, sizeMultiplier, sizeMultiplier);
      
      console.log(
        `Updated player ${playerId} size: ${sizeMultiplier.toFixed(2)}x (score: ${score})`
      );
      
      if (playerId === this.localPlayerId) {
        this.updateCameraPosition();
      }
    }
  
    updateCameraPosition() {
      if (!this.players[this.localPlayerId]) return;
      
      const playerMesh = this.players[this.localPlayerId].mesh;
      const sizeMultiplier = this.players[this.localPlayerId].sizeMultiplier || 1.0;
      const baseHeight = this.players[this.localPlayerId].baseHeight;
      
      this.sceneManager.updateCameraForPlayer(playerMesh, sizeMultiplier, baseHeight);
    }
  
    updatePlayerMovement(keys, worldSize) {
      if (!this.players[this.localPlayerId]) return;
      
      const settings = this.settingsManager.SETTINGS;
      const playerMesh = this.players[this.localPlayerId].mesh;
      
      const cameraDirection = this.sceneManager.camera.getWorldDirection(new THREE.Vector3());
      cameraDirection.y = 0;
      cameraDirection.normalize();
      
      const forwardVector = cameraDirection.clone();
      const rightVector = new THREE.Vector3().crossVectors(
        cameraDirection,
        new THREE.Vector3(0, 1, 0)
      ).normalize();
      
      let maxSpeed = keys.sprint
        ? settings.MOVE_SPEED * settings.SPRINT_MULTIPLIER
        : settings.MOVE_SPEED;
      
      if (this.powerUps.SPEED.active) {
        maxSpeed *= settings.SPEED_BOOST_MULTIPLIER;
      }
      
      this.targetVelocity.set(0, 0, 0);
      
      if (keys.forward) this.targetVelocity.add(forwardVector);
      if (keys.backward) this.targetVelocity.sub(forwardVector);
      if (keys.left) this.targetVelocity.sub(rightVector);
      if (keys.right) this.targetVelocity.add(rightVector);
      
      if (this.targetVelocity.length() > 0) {
        this.targetVelocity.normalize().multiplyScalar(maxSpeed);
      }
      
      if (this.targetVelocity.length() > 0) {
        this.currentVelocity.lerp(this.targetVelocity, settings.ACCELERATION);
      } else {
        if (this.currentVelocity.length() > 0.001) {
          this.currentVelocity.multiplyScalar(1 - settings.DECELERATION);
        } else {
          this.currentVelocity.set(0, 0, 0);
        }
      }
      
      if (this.currentVelocity.length() > 0.001) {
        playerMesh.position.x += this.currentVelocity.x;
        playerMesh.position.z += this.currentVelocity.z;
        
        this.bobTimer += this.currentVelocity.length() * settings.BOB_FREQUENCY * settings.BOB_SPEED_SCALING;
        const bobOffset = Math.sin(this.bobTimer) * settings.BOB_AMPLITUDE * (this.currentVelocity.length() / maxSpeed);
        
        playerMesh.position.y = this.players[this.localPlayerId].baseHeight + settings.PLAYER_HEIGHT + bobOffset;
        
        const movementAngle = Math.atan2(this.currentVelocity.x, this.currentVelocity.z);
        const tiltIntensity = (this.currentVelocity.length() / maxSpeed) * settings.TILT_INTENSITY;
        
        const targetRotationY = movementAngle;
        playerMesh.rotation.y = targetRotationY;
        playerMesh.rotation.x = tiltIntensity;
        
        // Clamp to world boundaries
        playerMesh.position.x = Math.max(-worldSize, Math.min(worldSize, playerMesh.position.x));
        playerMesh.position.z = Math.max(-worldSize, Math.min(worldSize, playerMesh.position.z));
        
        this.updateCameraPosition();
        
        this.networkManager.socket.emit("playerMovement", {
          position: {
            x: playerMesh.position.x,
            y: playerMesh.position.y - settings.PLAYER_HEIGHT,
            z: playerMesh.position.z,
          },
        });
      } else {
        playerMesh.position.y = this.players[this.localPlayerId].baseHeight + settings.PLAYER_HEIGHT;
        playerMesh.rotation.x *= 1 - settings.TILT_RECOVERY_SPEED;
      }
    }
  
    updatePlayerInterpolation() {
      const settings = this.settingsManager.SETTINGS;
      
      Object.keys(this.interpolationData).forEach((playerId) => {
        if (playerId !== this.localPlayerId && this.players[playerId]) {
          const data = this.interpolationData[playerId];
          const playerMesh = this.players[playerId].mesh;
          const ping = data.ping || 100;
          
          const speedFactor = Math.max(
            0,
            Math.min(1, settings.PING_WEIGHT * (1000 / ping))
          );
          
          const interpolationSpeed = settings.MIN_INTERPOLATION_SPEED +
            (settings.MAX_INTERPOLATION_SPEED - settings.MIN_INTERPOLATION_SPEED) * speedFactor;
          
          playerMesh.position.lerp(data.targetPosition, interpolationSpeed);
        }
      });
    }
  
    updateLeaderboard(uiManager) {
      this.leaderboardPlayers = Object.values(this.players).sort((a, b) => b.score - a.score);
      uiManager.updateLeaderboardDisplay(this.leaderboardPlayers, this.localPlayerId);
    }
  
    activatePowerup(type, duration) {
      if (this.powerUps[type]) {
        this.powerUps[type].active = true;
        
        setTimeout(() => {
          this.powerUps[type].active = false;
        }, duration);
      }
    }
  }