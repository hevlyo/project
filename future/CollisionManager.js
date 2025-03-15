export class CollisionManager {
    constructor(settingsManager, playerManager, ballManager, networkManager) {
      this.settingsManager = settingsManager;
      this.playerManager = playerManager;
      this.ballManager = ballManager;
      this.networkManager = networkManager;
      this.pendingCollections = new Set();
    }
  
    checkCollisions() {
      if (!this.playerManager.getLocalPlayer()) return;
      
      const playerPosition = this.playerManager.getLocalPlayer().mesh.position.clone();
      playerPosition.y = 0;
      const settings = this.settingsManager.SETTINGS;
      
      Object.keys(this.ballManager.balls).forEach((ballId) => {
        const ball = this.ballManager.balls[ballId];
        
        if (ball && ball.mesh && !ball.collected) {
          const ballPosition = ball.mesh.position.clone();
          ballPosition.y = 0;
          
          const distance = playerPosition.distanceTo(ballPosition);
          
          if (distance < settings.COLLECTION_DISTANCE && !this.pendingCollections.has(ballId)) {
            ball.collected = true;
            ball.mesh.visible = false;
            this.pendingCollections.add(ballId);
            
            console.log(`Collecting ball ${ballId}, distance: ${distance}`);
            this.networkManager.socket.emit("collectBall", { ballId: ballId });
            
            // Clear pending collection after timeout
            setTimeout(() => {
              this.pendingCollections.delete(ballId);
            }, 5000);
          }
        }
      });
    }
  
    handleBallCollected(data) {
      this.pendingCollections.delete(data.ballId);
      
      if (this.ballManager.balls[data.ballId]) {
        this.ballManager.removeBall(data.ballId);
      }
      
      if (this.playerManager.players[data.playerId]) {
        const player = this.playerManager.players[data.playerId];
        player.score = player.score || 0;
        player.score += data.value;
        
        this.playerManager.updatePlayerSize(data.playerId);
        
        if (data.playerId === this.playerManager.localPlayerId) {
          const uiManager = this.playerManager.gameManager.uiManager;
          uiManager.updateScoreDisplay(player.score);
          uiManager.showMessage(`+${data.value} pontos! engrossando!`, 1000);
        }
      }
    }
  
    clearPendingCollections() {
      this.pendingCollections.clear();
    }
  
    isPendingCollection(ballId) {
      return this.pendingCollections.has(ballId);
    }
  }