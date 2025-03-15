export class NetworkManager {
    constructor(playerNickname) {
        this.playerNickname = playerNickname;
        this.socket = null;
        this.eventListeners = {};
        this.connect();
    }

    connect() {
        try {
            console.log("Connecting to server with nickname:", this.playerNickname);
            this.socket = io();
            this.setupBaseHandlers();
            this.socket.emit("joinGame", { nickname: this.playerNickname });
        } catch (error) {
            console.error("Error connecting to server:", error);
            this.trigger('error', error.message);
        }
    }

    setupBaseHandlers() {
        this.socket.on('connect', () => {
            console.log("Connected to server with ID:", this.socket.id);
            this.trigger('connected', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log("Disconnected from server");
            this.trigger('disconnected');
        });

        this.socket.on('reconnect', () => {
            console.log("Reconnected to server");
            this.trigger('reconnected');
            this.socket.emit("joinGame", { nickname: this.playerNickname });
        });

        this.socket.on('worldInfo', (data) => {
            this.trigger('worldInfo', data);
        });

        this.socket.on('currentPlayers', (data) => {
            this.trigger('currentPlayers', data);
        });

        this.socket.on('playerInfo', (data) => {
            this.trigger('playerInfo', data);
        });

        this.socket.on('newBalls', (data) => {
            this.trigger('newBalls', data);
        });

        this.socket.on('playerMoved', (data) => {
            this.trigger('playerMoved', data);
        });

        this.socket.on('newPlayer', (data) => {
            this.trigger('newPlayer', data);
        });

        this.socket.on('playerDisconnected', (playerId) => {
            this.trigger('playerDisconnected', playerId);
        });

        this.socket.on('updateScores', (scores) => {
            this.trigger('updateScores', scores);
        });

        this.socket.on('playerCount', (count) => {
            this.trigger('playerCount', count);
        });

        this.socket.on('ballCollected', (data) => {
            this.trigger('ballCollected', data);
        });
    }

    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    off(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }

    trigger(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }

    sendPlayerMovement(position) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('playerMovement', { position });
        }
    }

    sendBallCollection(ballId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('collectBall', { ballId });
        }
    }

    updateNickname(nickname) {
        this.playerNickname = nickname;
        if (this.socket && this.socket.connected) {
            this.socket.emit('updateNickname', { nickname });
        }
    }
}