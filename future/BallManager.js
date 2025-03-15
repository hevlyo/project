export class BallManager {
    constructor(settingsManager, scene) {
        this.settingsManager = settingsManager;
        this.scene = scene;
        this.balls = {};
        this.pendingCollections = new Set();
    }

    addBall(ballInfo) {
        if (this.balls[ballInfo.id]) {
            this.balls[ballInfo.id].mesh.position.set(
                ballInfo.position.x,
                ballInfo.position.y,
                ballInfo.position.z
            );
            return;
        }

        const settings = this.settingsManager.SETTINGS;
        
        const ballGeometry = new THREE.SphereGeometry(
            settings.BALL_RADIUS,
            settings.BALL_SEGMENTS,
            settings.BALL_SEGMENTS
        );
        
        const ballMaterial = new THREE.MeshStandardMaterial({
            color: ballInfo.color || 0xffffff,
            roughness: 0.2,
            metalness: 0.9,
            emissive: ballInfo.type === "GOLDEN" ? 0xffd700 : 0,
            emissiveIntensity: 0.5,
        });
        
        const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
        ballMesh.castShadow = true;
        ballMesh.receiveShadow = true;
        ballMesh.frustumCulled = false;
        ballMesh.position.set(
            ballInfo.position.x,
            ballInfo.position.y,
            ballInfo.position.z
        );
        
        this.balls[ballInfo.id] = {
            mesh: ballMesh,
            baseHeight: ballInfo.position.y,
            collected: false,
            value: ballInfo.value || settings.BALL_VALUE,
            type: ballInfo.type || "NORMAL",
        };
        
        this.scene.add(ballMesh);
    }

    removeBall(ballId) {
        if (this.balls[ballId]) {
            if (this.balls[ballId].mesh && this.scene) {
                this.scene.remove(this.balls[ballId].mesh);
            }
            delete this.balls[ballId];
            this.pendingCollections.delete(ballId);
            console.log(`Ball ${ballId} removed from scene`);
        }
    }

    animateBalls() {
        const settings = this.settingsManager.SETTINGS;
        
        Object.keys(this.balls).forEach(ballId => {
            const ball = this.balls[ballId];
            if (ball && ball.mesh) {
                ball.mesh.rotation.y += settings.BALL_ROTATION_SPEED;
                ball.mesh.rotation.x += settings.BALL_ROTATION_SPEED / 2;
                const hoverOffset = Math.sin(Date.now() * 0.002) * 0.1;
                ball.mesh.position.y = ball.baseHeight + hoverOffset;
            }
        });
    }

    checkCollisions(playerPosition) {
        const settings = this.settingsManager.SETTINGS;
        const collectedBalls = [];
        
        if (!playerPosition) return collectedBalls;
        
        // Clone and reset Y to check horizontal distance only
        const checkPosition = playerPosition.clone();
        checkPosition.y = 0;
        
        Object.keys(this.balls).forEach(ballId => {
            const ball = this.balls[ballId];
            if (ball && ball.mesh && !ball.collected && !this.pendingCollections.has(ballId)) {
                const ballPosition = ball.mesh.position.clone();
                ballPosition.y = 0;
                
                const distance = checkPosition.distanceTo(ballPosition);
                if (distance < settings.COLLECTION_DISTANCE) {
                    ball.collected = true;
                    ball.mesh.visible = false;
                    this.pendingCollections.add(ballId);
                    collectedBalls.push({
                        ballId: ballId,
                        value: ball.value,
                        type: ball.type
                    });
                    
                    // Safety cleanup timer in case server doesn't respond
                    setTimeout(() => {
                        this.pendingCollections.delete(ballId);
                    }, 5000);
                }
            }
        });
        
        return collectedBalls;
    }

    syncBalls(serverBalls) {
        // Clean up pending collections for balls that no longer exist on server
        const serverBallIds = new Set(serverBalls.map(ball => ball.id));
        this.pendingCollections.forEach(pendingBallId => {
            if (!serverBallIds.has(pendingBallId)) {
                this.pendingCollections.delete(pendingBallId);
            }
        });

        // Add or update balls from the server
        serverBalls.forEach(ballInfo => {
            this.addBall(ballInfo);
        });
    }

    getPendingCollections() {
        return this.pendingCollections;
    }
}