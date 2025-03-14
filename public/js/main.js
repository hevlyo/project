// Window onload handler
document.addEventListener("DOMContentLoaded", onload);

// Initialize Socket.IO connection
let socket;

// Store all players (including local player)
const players = {};

// Store all collectible balls
const balls = {};

// Store interpolation data for smooth movement
const interpolationData = {};

// Track game state
let gameActive = false;
let localPlayerId = null;
let topScore = 0;
let topScorePlayer = null;
let worldSize = 50; // Will be updated from server

// Array para rastrear jogadores ordenados por pontuação (leaderboard)
let leaderboardPlayers = [];

// Variáveis para controle de aceleração/desaceleração
let currentVelocity = new THREE.Vector3(0, 0, 0);
let targetVelocity = new THREE.Vector3(0, 0, 0);
let bobTimer = 0; // Timer para o efeito de "bob" (salto)

// Set para rastrear bolas em processo de coleta (debounce)
const pendingCollections = new Set();

// Three.js global variables
let scene, camera, renderer;

// Game settings
const SETTINGS = {
  MOVE_SPEED: 0.2,
  SPRINT_MULTIPLIER: 1.5,
  PLAYER_HEIGHT: 1,
  PLAYER_RADIUS: 0.5,
  PLAYER_SEGMENTS: 32,
  CAMERA_HEIGHT: 3,
  CAMERA_DISTANCE: 5,
  COLLECTION_DISTANCE: 1.5,
  MIN_INTERPOLATION_SPEED: 0.05,
  MAX_INTERPOLATION_SPEED: 0.25,
  PING_WEIGHT: 0.01,
  BALL_RADIUS: 0.3,
  BALL_SEGMENTS: 16,
  BALL_ROTATION_SPEED: 0.02,
  BALL_VALUE: 10,
  BALL_HOVER_HEIGHT: 0.2,
  BALL_HOVER_SPEED: 1.0,
  CAMERA_FOV: 75,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  DELTA_TIME: 1 / 60,
  SKY_COLOR: 0x87cefa,
  SIZE_INCREASE_PER_BALL: 0.1, // Size increase multiplier per ball collected
  MAX_SIZE_MULTIPLIER: 2.5, // Maximum size multiplier for players
  NAMETAG_OFFSET_Y: 2.2, // Height above player for nametag
  NAMETAG_SCALE: 0.01, // Scale of the nametag text
  NICKNAME_MAX_LENGTH: 20,
  NICKNAME_MIN_LENGTH: 2,
  NICKNAME_PATTERN: /^[a-zA-Z0-9\s\-_]+$/, // Apenas letras, números, espaços, hífens e underscores
  UI_TRANSITION_DURATION: "0.3s",
  ACCELERATION: 0.015, // Velocidade de aceleração
  DECELERATION: 0.03, // Velocidade de desaceleração (mais rápida que aceleração)
  TILT_INTENSITY: 0.15, // Intensidade da inclinação do jogador durante o movimento
  TILT_RECOVERY_SPEED: 0.1, // Velocidade de recuperação da inclinação
  BOB_FREQUENCY: 0.1, // Frequência do efeito de salto
  BOB_AMPLITUDE: 0.05, // Amplitude do efeito de salto
  BOB_SPEED_SCALING: 1.5, // Escala da velocidade de bob baseada na velocidade de movimento
  SPEED_BOOST_MULTIPLIER: 2.0, // Multiplicador de velocidade para power-up
};

// Movement keys tracking
let keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
};

// UI elements
let scoreDisplay, topScoreDisplay, playerCountDisplay, messageDisplay;
let menuScreen, nicknameInput, playButton;
let playerNickname = sessionStorage.getItem("playerNickname") || "Player";
console.log("Retrieved nickname from session storage:", playerNickname);

// Power-up state
const powerUps = {
  SPEED: { active: false, duration: 5000 }, // Example speed boost power-up
};

// Wait for the DOM to load completely
function onload() {
  console.log("DOM loaded, initializing game");

  // Get menu elements
  menuScreen = document.getElementById("menu-screen");
  nicknameInput = document.getElementById("nickname-input");
  playButton = document.getElementById("play-button");

  console.log("Menu elements:", {
    menuScreen: !!menuScreen,
    nicknameInput: !!nicknameInput,
    playButton: !!playButton,
  });

  // Set a random fun placeholder
  setRandomNicknamePlaceholder();

  // Set up menu event listeners
  if (playButton) {
    // Add click event with direct function and logging
    playButton.onclick = function () {
      console.log("Play button clicked!");
      startGame();
    };
    console.log("Play button click handler attached");
  } else {
    console.error("Play button not found in the DOM");
  }

  // Focus the nickname input automatically
  if (nicknameInput) {
    nicknameInput.focus();

    // Start game when Enter key is pressed in the input field
    nicknameInput.addEventListener("keypress", function (e) {
      console.log("Key pressed in input:", e.key);
      if (e.key === "Enter") {
        console.log("Enter key pressed, starting game...");
        startGame();
      }
    });
    console.log("Nickname input keypress handler attached");
  }
}

// Start the game when the play button is clicked
function startGame() {
  try {
    console.log("startGame function called");

    // Get nickname from input or use placeholder if empty
    playerNickname = nicknameInput.value.trim();
    if (playerNickname.length === 0) {
      playerNickname = nicknameInput.placeholder;
    }

    // Sanitização do nickname
    playerNickname = playerNickname
      .replace(/[^a-zA-Z0-9\s\-_]/g, "") // Remove caracteres não permitidos
      .slice(0, SETTINGS.NICKNAME_MAX_LENGTH); // Limita o tamanho máximo

    // Validação final
    if (playerNickname.length < SETTINGS.NICKNAME_MIN_LENGTH) {
      playerNickname = "Player" + Math.floor(Math.random() * 1000);
    }

    console.log(`Starting game with nickname: ${playerNickname}`);

    // Hide the menu screen with transition
    if (menuScreen) {
      menuScreen.style.transition = `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-out`;
      menuScreen.style.opacity = "0";
      setTimeout(
        () => {
          menuScreen.style.display = "none";
        },
        parseFloat(SETTINGS.UI_TRANSITION_DURATION) * 1000,
      );
      console.log("Menu screen hidden with transition");
    } else {
      console.error("Menu screen element not found");
    }

    // Create UI elements for the game
    createUI();
    console.log("Game UI created");

    // Connect to the server
    connectToServer();
    console.log("Connected to server");

    // Start the animation loop
    animate();
    console.log("Animation loop started");

    gameActive = true;
  } catch (error) {
    console.error("Error starting game:", error);
    alert("Error starting game: " + error.message);
  }
}

// Create UI elements
function createUI() {
  // Create score display with transition
  scoreDisplay = document.createElement("div");
  scoreDisplay.id = "score-display";
  scoreDisplay.className = "game-ui";
  scoreDisplay.style.position = "absolute";
  scoreDisplay.style.top = "10px";
  scoreDisplay.style.left = "10px";
  scoreDisplay.style.color = "white";
  scoreDisplay.style.fontFamily = "Arial, sans-serif";
  scoreDisplay.style.fontSize = "18px";
  scoreDisplay.style.padding = "5px 10px";
  scoreDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  scoreDisplay.style.borderRadius = "5px";
  scoreDisplay.style.transition = `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-in`;
  scoreDisplay.style.opacity = "0";
  scoreDisplay.innerHTML = "Score: 0";
  document.body.appendChild(scoreDisplay);

  // Criar leaderboard que mostra os 3 melhores jogadores
  topScoreDisplay = document.createElement("div");
  topScoreDisplay.id = "leaderboard-display";
  topScoreDisplay.className = "game-ui";
  topScoreDisplay.style.position = "absolute";
  topScoreDisplay.style.top = "10px";
  topScoreDisplay.style.right = "10px";
  topScoreDisplay.style.color = "white";
  topScoreDisplay.style.fontFamily = "Arial, sans-serif";
  topScoreDisplay.style.fontSize = "16px";
  topScoreDisplay.style.padding = "5px 10px";
  topScoreDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  topScoreDisplay.style.borderRadius = "5px";
  topScoreDisplay.style.transition = `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-in`;
  topScoreDisplay.style.opacity = "0";
  topScoreDisplay.style.minWidth = "230px";
  topScoreDisplay.innerHTML =
    '<div style="text-align: center; margin-bottom: 5px; font-weight: bold;">🏆 Leaderboard</div><div id="leaderboard-entries"></div>';
  document.body.appendChild(topScoreDisplay);

  // Create player count display with transition
  playerCountDisplay = document.createElement("div");
  playerCountDisplay.id = "player-count-display";
  playerCountDisplay.className = "game-ui";
  playerCountDisplay.style.position = "absolute";
  playerCountDisplay.style.bottom = "10px";
  playerCountDisplay.style.left = "10px";
  playerCountDisplay.style.color = "white";
  playerCountDisplay.style.fontFamily = "Arial, sans-serif";
  playerCountDisplay.style.fontSize = "16px";
  playerCountDisplay.style.padding = "5px 10px";
  playerCountDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  playerCountDisplay.style.borderRadius = "5px";
  playerCountDisplay.style.transition = `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-in`;
  playerCountDisplay.style.opacity = "0";
  playerCountDisplay.innerHTML = "Players: 0";
  document.body.appendChild(playerCountDisplay);

  // Create message display with transition
  messageDisplay = document.createElement("div");
  messageDisplay.id = "message-display";
  messageDisplay.className = "game-ui";
  messageDisplay.style.position = "absolute";
  messageDisplay.style.top = "50%";
  messageDisplay.style.left = "50%";
  messageDisplay.style.transform = "translate(-50%, -50%)";
  messageDisplay.style.color = "white";
  messageDisplay.style.fontFamily = "Arial, sans-serif";
  messageDisplay.style.fontSize = "24px";
  messageDisplay.style.padding = "10px 20px";
  messageDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  messageDisplay.style.borderRadius = "5px";
  messageDisplay.style.display = "none";
  messageDisplay.style.transition = `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-in-out`;
  messageDisplay.style.opacity = "0";
  document.body.appendChild(messageDisplay);

  // Trigger fade-in for UI elements
  setTimeout(() => {
    scoreDisplay.style.opacity = "1";
    topScoreDisplay.style.opacity = "1";
    playerCountDisplay.style.opacity = "1";
  }, 50);
}

// Function to show a message to the player
function showMessage(message, duration = 3000) {
  if (!messageDisplay) return;

  messageDisplay.innerHTML = message;
  messageDisplay.style.display = "block";
  messageDisplay.style.opacity = "1";

  if (duration > 0) {
    setTimeout(() => {
      messageDisplay.style.opacity = "0";
      setTimeout(
        () => {
          messageDisplay.style.display = "none";
        },
        parseFloat(SETTINGS.UI_TRANSITION_DURATION) * 1000,
      );
    }, duration);
  }
}

// Initialize the scene
function initializeScene() {
  // Create a scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(SETTINGS.SKY_COLOR, 0.01);

  // Create a camera
  camera = new THREE.PerspectiveCamera(
    SETTINGS.CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    SETTINGS.CAMERA_NEAR,
    SETTINGS.CAMERA_FAR,
  );
  camera.position.set(0, SETTINGS.CAMERA_HEIGHT, SETTINGS.CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  // Create a renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(SETTINGS.SKY_COLOR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Melhor qualidade de sombras
  document.body.appendChild(renderer.domElement);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Aumentada a intensidade
  directionalLight.position.set(50, 200, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048; // Aumentada a resolução da sombra
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;
  scene.add(directionalLight);

  // Create the ground
  createGround(scene);

  // Add background music
  const audioLoader = new THREE.AudioLoader();
  const listener = new THREE.AudioListener();
  camera.add(listener);

  audioLoader.load("./assets/background_sound.mp3", function (buffer) {
    const sound = new THREE.Audio(listener);
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.1); // 10% volume
    sound.play();
  });

  // Start the animation loop
  animate();
}

// Initialize keyboard state and event listeners
function initControls() {
  // Initialize movement keys state
  keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };

  // Key down event listener
  window.addEventListener("keydown", (event) => {
    if (!gameActive) return;

    // Prevent default behavior for game control keys
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
        "W",
        "A",
        "S",
        "D",
        "Shift",
      ].includes(event.key)
    ) {
      event.preventDefault();
    }

    // Update key states
    switch (event.key) {
      case "ArrowUp":
      case "w":
      case "W":
        keys.forward = true;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        keys.backward = true;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        keys.left = true;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        keys.right = true;
        break;
      case "Shift":
        keys.sprint = true;
        break;
    }
  });

  // Key up event listener
  window.addEventListener("keyup", (event) => {
    // Update key states
    switch (event.key) {
      case "ArrowUp":
      case "w":
      case "W":
        keys.forward = false;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        keys.backward = false;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        keys.left = false;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        keys.right = false;
        break;
      case "Shift":
        keys.sprint = false;
        break;
    }
  });

  // Handle window blur (user tabs out)
  window.addEventListener("blur", () => {
    // Reset all keys when window loses focus
    Object.keys(keys).forEach((key) => {
      keys[key] = false;
    });
  });
}

// Connect to the server
function connectToServer() {
  try {
    console.log("Connecting to server with nickname:", playerNickname);

    // Connect to the server via Socket.IO
    socket = io();
    console.log("Socket.IO connection created");

    // Set up socket event handlers
    setupSocketHandlers();

    // Join the game with the selected nickname
    socket.emit("joinGame", { nickname: playerNickname });
  } catch (error) {
    console.error("Error connecting to server:", error);
  }
}

// Set up socket event handlers
function setupSocketHandlers() {
  // Remove any existing event listeners to prevent duplicates
  if (socket) {
    socket.removeAllListeners();
  }

  socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);
    localPlayerId = socket.id;
    showMessage("Connected to game server!", 3000);
    gameActive = true;
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    showMessage("Disconnected from server. Trying to reconnect...", 0);
    gameActive = false;

    // Limpar todas as coletas pendentes quando desconectar
    pendingCollections.clear();
  });

  socket.on("reconnect", () => {
    console.log("Reconnected to server");
    showMessage("Reconnected to server!", 3000);
    gameActive = true;
  });

  // Handle world info
  socket.on("worldInfo", (data) => {
    console.log("Received world info:", data);
    worldSize = data.worldSize;
  });

  // Handle current players
  socket.on("currentPlayers", (serverPlayers) => {
    console.log("Current players received:", serverPlayers);

    // Clear existing players first
    Object.keys(players).forEach((id) => {
      if (id !== localPlayerId) {
        removePlayer(id);
      }
    });

    // Add all players from server
    Object.values(serverPlayers).forEach((playerInfo) => {
      // If this is us and we don't have our player yet, create it
      if (playerInfo.id === localPlayerId && !players[localPlayerId]) {
        console.log("Creating local player");
        addPlayer(playerInfo);
      }
      // If this is another player and we don't have them yet, create them
      else if (playerInfo.id !== localPlayerId && !players[playerInfo.id]) {
        console.log("Adding existing player:", playerInfo.id);
        addPlayer(playerInfo);
      }
    });

    updatePlayerCount();

    // Inicializar o leaderboard com os jogadores conectados
    updateLeaderboard();
  });

  // Set up game event handlers
  setupGameEventHandlers();
}

// Set up game-related event handlers
function setupGameEventHandlers() {
  // Handle player info
  socket.on("playerInfo", (playerData) => {
    console.log("Player info received:", playerData);

    // If this is our player and we don't have it yet, create it
    if (playerData.id === localPlayerId && !players[localPlayerId]) {
      console.log("Creating local player mesh");
      addPlayer(playerData);
      showMessage(`Bem-vinde jogadore ${playerData.nickname}!`, 3000);
    }
  });

  // Handle new balls
  socket.on("newBalls", (serverBalls) => {
    console.log("Received new balls:", serverBalls);

    // Limpar qualquer coleta pendente para bolas que não existem mais no servidor
    const serverBallIds = new Set(serverBalls.map((ball) => ball.id));

    // Para cada coleta pendente, verificar se a bola ainda existe no servidor
    pendingCollections.forEach((pendingBallId) => {
      if (!serverBallIds.has(pendingBallId)) {
        pendingCollections.delete(pendingBallId);
      }
    });

    // Add the new balls to the scene
    serverBalls.forEach((ballInfo) => {
      addBall(ballInfo);
    });
  });

  // Handle player movement
  socket.on("playerMoved", (data) => {
    if (!interpolationData[data.id]) {
      interpolationData[data.id] = {
        targetPosition: new THREE.Vector3(),
        lastUpdateTime: Date.now(),
        ping: 100,
        sequence: 0,
        snapshots: []
      };
    }

    const playerData = interpolationData[data.id];
    playerData.ping = Date.now() - playerData.lastUpdateTime;
    playerData.lastUpdateTime = Date.now();

    // Store server snapshot
    playerData.snapshots.push({
      position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
      timestamp: Date.now(),
      sequence: playerData.sequence++
    });

    // Keep only last 10 snapshots
    if (playerData.snapshots.length > 10) {
      playerData.snapshots.shift();
    }

    // Reconcile state with server position
    const latestSnapshot = playerData.snapshots[playerData.snapshots.length - 1];
    if (data.id === localPlayerId) {
      const currentPos = players[localPlayerId].mesh.position;
      const serverPos = latestSnapshot.position;
      const distance = currentPos.distanceTo(serverPos);

      if (distance > 0.5) { // Threshold for correction
        currentPos.lerp(serverPos, 0.3); // Smooth correction
      }
    }
  });

  // Handle new player
  socket.on("newPlayer", (playerData) => {
    console.log("New player joined:", playerData);

    // Add the new player if we don't already have them
    if (!players[playerData.id]) {
      addPlayer(playerData);
      showMessage(`Player ${playerData.nickname} joined!`, 2000);
    }

    // Update player count
    updatePlayerCount();

    // Atualizar leaderboard quando um novo jogador se conecta
    updateLeaderboard();
  });

  // Handle player disconnection
  socket.on("playerDisconnected", (playerId) => {
    console.log("Player disconnected:", playerId);
    removePlayer(playerId);

    // Atualizar leaderboard quando um jogador desconecta
    updateLeaderboard();
  });

  // Handle score updates
  socket.on("updateScores", (scores) => {
    console.log("Score update received:", scores);

    // Update all player scores
    Object.entries(scores).forEach(([playerId, score]) => {
      if (players[playerId]) {
        players[playerId].score = score;

        // Update local display if it's our score
        if (playerId === localPlayerId) {
          scoreDisplay.innerHTML = `Score: ${score}`;
        }
      }
    });

    // Find top score
    let highestScore = 0;
    let highScorePlayerId = null;

    Object.entries(scores).forEach(([playerId, score]) => {
      if (score > highestScore) {
        highestScore = score;
        highScorePlayerId = playerId;
      }
    });

    // Update top score display
    if (highestScore > 0) {
      topScore = highestScore;
      topScorePlayer = highScorePlayerId;
    }

    // Atualizar o leaderboard com todas as pontuações
    updateLeaderboard();
  });

  // Handle player count updates
  socket.on("playerCount", (count) => {
    updatePlayerCount(count);
  });

  // Handle ball collection
  socket.on("ballCollected", (data) => {
    console.log("Ball collected:", data);

    // Remover o ID da bola da lista de coletas pendentes
    pendingCollections.delete(data.ballId);

    // Remove the ball if we still have it
    if (balls[data.ballId]) {
      removeBall(data.ballId);
    }

    // Update player score
    if (players[data.playerId]) {
      players[data.playerId].score = players[data.playerId].score || 0;
      players[data.playerId].score += data.value;

      // Update player size based on new score
      updatePlayerSize(data.playerId);

      // If it's our ball, update score display
      if (data.playerId === localPlayerId) {
        scoreDisplay.innerHTML = `Score: ${players[localPlayerId].score}`;
        showMessage(`+${data.value} pontos! engrossando!`, 1000);
      }
    }

    // Update top score if needed
    if (players[data.playerId] && players[data.playerId].score > topScore) {
      topScore = players[data.playerId].score;
      topScorePlayer = data.playerId;
    }

    // Atualizar o leaderboard
    updateLeaderboard();
  });
}

// Function to update player size based on their score
function updatePlayerSize(playerId) {
  if (!players[playerId] || !players[playerId].mesh) return;

  const player = players[playerId];
  const score = player.score || 0;

  // Calculate size multiplier based on score
  // Each ball is worth SETTINGS.BALL_VALUE points (10 by default)
  const ballsCollected = score / SETTINGS.BALL_VALUE;
  const sizeMultiplier = Math.min(
    1.0 + ballsCollected * SETTINGS.SIZE_INCREASE_PER_BALL,
    SETTINGS.MAX_SIZE_MULTIPLIER,
  );

  // Store the new size multiplier
  player.sizeMultiplier = sizeMultiplier;

  // Apply scaling to the mesh
  player.mesh.scale.set(sizeMultiplier, sizeMultiplier, sizeMultiplier);

  console.log(
    `Updated player ${playerId} size: ${sizeMultiplier.toFixed(2)}x (score: ${score})`,
  );

  // If this is the local player, update camera height too
  if (playerId === localPlayerId) {
    updateCameraPosition();
  }
}

// Create a player mesh
function addPlayer(playerInfo) {
  // If player already exists, just update it
  if (players[playerInfo.id]) {
    players[playerInfo.id].mesh.position.set(
      playerInfo.position.x,
      playerInfo.position.y + SETTINGS.PLAYER_HEIGHT,
      playerInfo.position.z,
    );
    return;
  }

  console.log("Adding player:", playerInfo.id);

  // Create player geometry and material
  const playerGeometry = new THREE.CylinderGeometry(
    SETTINGS.PLAYER_RADIUS,
    SETTINGS.PLAYER_RADIUS,
    SETTINGS.PLAYER_HEIGHT * 2,
    SETTINGS.PLAYER_SEGMENTS,
  );

  // Use player color from server or generate a random one
  const playerMaterial = new THREE.MeshStandardMaterial({
    color: playerInfo.color || getRandomColor(),
    roughness: 0.5,
    metalness: 0.5,
  });

  // Create player mesh
  const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
  playerMesh.castShadow = true; // Habilitar projeção de sombras
  playerMesh.receiveShadow = true; // Habilitar recebimento de sombras

  // Set player position
  playerMesh.position.set(
    playerInfo.position.x,
    playerInfo.position.y + SETTINGS.PLAYER_HEIGHT,
    playerInfo.position.z,
  );

  // Create player nametag
  const nickname =
    playerInfo.nickname || `Player ${playerInfo.id.substring(0, 4)}`;
  const nametagGroup = createNametag(nickname);

  // Position nametag above player
  nametagGroup.position.set(0, SETTINGS.NAMETAG_OFFSET_Y, 0);
  playerMesh.add(nametagGroup);

  // Store player mesh with ID
  players[playerInfo.id] = {
    mesh: playerMesh,
    id: playerInfo.id,
    nickname: nickname,
    score: playerInfo.score || 0,
    color: playerMaterial.color.getHex(),
    sizeMultiplier: playerInfo.sizeMultiplier || 1.0,
    nametagGroup: nametagGroup,
    baseHeight: playerInfo.position.y || 0, // Armazenar altura base para efeito de salto
  };

  // Add player mesh to scene
  scene.add(playerMesh);

  // If this is our player, position the camera
  if (playerInfo.id === localPlayerId) {
    updateCameraPosition();
  }
}

// Remove a player from the scene
function removePlayer(playerId) {
  if (players[playerId]) {
    // Remove the player mesh from the scene
    if (players[playerId].mesh && scene) {

      players[playerId].mesh.dispose();
      scene.remove(players[playerId].mesh);
    }

    // Remove the player from the players object
    delete players[playerId];

    // Clean up interpolation data
    if (interpolationData[playerId]) {
      delete interpolationData[playerId];
    }

    // Update player count display
    updatePlayerCount();

    console.log(`Player ${playerId} removed from scene`);
  }
}

// Create the ground
function createGround(scene) {
  // Criar textura do chão
  const textureLoader = new THREE.TextureLoader();
  const groundTexture = textureLoader.load("/assets/textures/grass.jpg");
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(16, 16); // Aumentar a repetição para cobrir mais área
  groundTexture.anisotropy = 16; // Melhorar a qualidade da textura

  // Criar material com a textura
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture,
    roughness: 0.8,
    metalness: 0.2,
    flatShading: true,
  });

  // Criar geometria do chão com menos detalhes para melhor desempenho em dispositivos móveis
  const groundGeometry = new THREE.PlaneGeometry(
    worldSize * 2,
    worldSize * 2,
    32,
    32,
  );

  // Adicionar variação de altura para mais realismo
  const vertices = groundGeometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 1] = Math.random() * 0.2; // Pequena variação aleatória na altura
  }
  groundGeometry.computeVertexNormals();

  // Criar mesh do chão
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true; // Habilitar recebimento de sombras
  groundMesh.name = "ground";
  scene.add(groundMesh);

  // Criar grid helper com opacidade reduzida
  const gridHelper = new THREE.GridHelper(
    worldSize * 2,
    20,
    0x000000,
    0x000000,
  );
  gridHelper.position.y = 0.01;
  gridHelper.material.opacity = 0.1;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);
}

// Function to add a ball to the scene
function addBall(ballInfo) {
  // If ball already exists, just update it
  if (balls[ballInfo.id]) {
    balls[ballInfo.id].mesh.position.set(
      ballInfo.position.x,
      ballInfo.position.y,
      ballInfo.position.z,
    );
    return;
  }

  console.log("Adding ball:", ballInfo.id);

  // Create ball geometry and material
  const ballGeometry = new THREE.SphereGeometry(
    SETTINGS.BALL_RADIUS,
    SETTINGS.BALL_SEGMENTS,
    SETTINGS.BALL_SEGMENTS,
  );

  const ballMaterial = new THREE.MeshStandardMaterial({
    color: ballInfo.color || 0xffffff,
    roughness: 0.2,
    metalness: 0.9,
    emissive: ballInfo.type === "GOLDEN" ? 0xffd700 : 0,
    emissiveIntensity: 0.5,
  });

  // Create ball mesh
  const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
  ballMesh.castShadow = true; // Habilitar projeção de sombras
  ballMesh.receiveShadow = true; // Habilitar recebimento de sombras
  ballMesh.frustumCulled = false; // Desabilitar culling para evitar flickering

  // Set ball position
  ballMesh.position.set(
    ballInfo.position.x,
    ballInfo.position.y,
    ballInfo.position.z,
  );

  // Store ball with ID and add to scene
  balls[ballInfo.id] = {
    mesh: ballMesh,
    baseHeight: ballInfo.position.y,
    collected: false,
    value: ballInfo.value || SETTINGS.BALL_VALUE,
    type: ballInfo.type || "NORMAL", // Add ball type
  };

  // Add to scene
  scene.add(ballMesh);
}

// Remove a ball from the scene
function removeBall(ballId) {
  if (balls[ballId]) {
    // Remover a mesh da cena
    if (balls[ballId].mesh && scene) {
      scene.remove(balls[ballId].mesh);
    }

    // Limpar referências
    delete balls[ballId];

    // Garantir que qualquer coleta pendente desta bola seja limpa
    pendingCollections.delete(ballId);

    console.log(`Ball ${ballId} removed from scene`);
  }
}

// Update camera position relative to player
function updateCameraPosition() {
  if (!players[localPlayerId]) return;

  const playerMesh = players[localPlayerId].mesh;
  const sizeMultiplier = players[localPlayerId].sizeMultiplier || 1.0;

  // Adjust camera distance based on player size
  const adjustedCameraDistance =
    SETTINGS.CAMERA_DISTANCE * Math.max(1, sizeMultiplier * 0.8) * 1.5; // Aumentado em 50%
  const adjustedCameraHeight =
    SETTINGS.CAMERA_HEIGHT * Math.max(1, sizeMultiplier * 0.5) * 1.2; // Aumentado em 20%

  // Get camera direction
  const cameraDirection = camera.getWorldDirection(new THREE.Vector3());

  // Position camera behind player
  camera.position
    .copy(playerMesh.position)
    .sub(cameraDirection.multiplyScalar(adjustedCameraDistance));

  // Set camera height
  camera.position.y = playerMesh.position.y + adjustedCameraHeight;

  // Look at player
  camera.lookAt(playerMesh.position);
}

// Update player count display
function updatePlayerCount(count) {
  const playerCount = count || Object.keys(players).length;
  playerCountDisplay.innerHTML = `Players: ${playerCount}`;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Log the first few frames for debugging
  if (!window.frameCount) {
    window.frameCount = 0;
  }
  if (window.frameCount < 10) {
    console.log(
      `Animation frame ${window.frameCount}, gameActive: ${gameActive}`,
    );
    window.frameCount++;
  }

  // Only process game logic if the game is active
  if (gameActive) {
    // Handle player movement
    updatePlayerMovement();

    // Interpolate other player positions
    updatePlayerInterpolation();

    // Animate balls
    animateBalls();

    // Check for ball collisions
    checkBallCollisions();
  }

  // Always render the scene
  if (scene && camera && renderer) {
    console.log("Rendering scene");
    renderer.render(scene, camera);
  } else {
    console.error("Cannot render: scene, camera, or renderer is not defined", {
      scene: !!scene,
      camera: !!camera,
      renderer: !!renderer,
    });
  }

  // Update nametag orientation to face camera
  updateNametagOrientations();
}

// Update player movement based on keys
function updatePlayerMovement() {
  if (!players[localPlayerId]) return;

  const playerMesh = players[localPlayerId].mesh;
  const cameraDirection = camera.getWorldDirection(new THREE.Vector3());

  // Normalize the direction for consistent movement speed
  cameraDirection.y = 0; // Keep movement on the xz plane
  cameraDirection.normalize();

  // Calculate forward/backward movement vector (based on camera direction)
  const forwardVector = cameraDirection.clone();

  // Calculate left/right movement vector (perpendicular to camera direction)
  const rightVector = new THREE.Vector3()
    .crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0))
    .normalize();

  // Determinar a velocidade máxima baseada no sprint
  let maxSpeed = keys.sprint
    ? SETTINGS.MOVE_SPEED * SETTINGS.SPRINT_MULTIPLIER
    : SETTINGS.MOVE_SPEED;
  if (powerUps.SPEED.active) {
    maxSpeed *= SETTINGS.SPEED_BOOST_MULTIPLIER;
  }

  // Calcular a direção desejada baseada nas teclas pressionadas
  targetVelocity.set(0, 0, 0);

  if (keys.forward) targetVelocity.add(forwardVector);
  if (keys.backward) targetVelocity.sub(forwardVector);
  if (keys.left) targetVelocity.sub(rightVector);
  if (keys.right) targetVelocity.add(rightVector);

  // Normalizar e aplicar velocidade máxima se houver entrada de movimento
  if (targetVelocity.length() > 0) {
    targetVelocity.normalize().multiplyScalar(maxSpeed);
  }

  // Aplicar aceleração ou desaceleração para cada componente
  if (targetVelocity.length() > 0) {
    // Acelerando na direção desejada
    currentVelocity.lerp(targetVelocity, SETTINGS.ACCELERATION);
  } else {
    // Desacelerando quando não há entrada
    if (currentVelocity.length() > 0.001) {
      currentVelocity.multiplyScalar(1 - SETTINGS.DECELERATION);
    } else {
      currentVelocity.set(0, 0, 0);
    }
  }

  // Aplicar movimento se houver alguma velocidade
  if (currentVelocity.length() > 0.001) {
    // Atualizar posição do jogador
    playerMesh.position.x += currentVelocity.x;
    playerMesh.position.z += currentVelocity.z;

    // Aplicar efeito de salto (bob)
    bobTimer +=
      currentVelocity.length() *
      SETTINGS.BOB_FREQUENCY *
      SETTINGS.BOB_SPEED_SCALING;
    const bobOffset =
      Math.sin(bobTimer) *
      SETTINGS.BOB_AMPLITUDE *
      (currentVelocity.length() / maxSpeed);
    playerMesh.position.y =
      players[localPlayerId].baseHeight + SETTINGS.PLAYER_HEIGHT + bobOffset;

    // Aplicar inclinação na direção do movimento
    const movementAngle = Math.atan2(currentVelocity.x, currentVelocity.z);
    const tiltIntensity =
      (currentVelocity.length() / maxSpeed) * SETTINGS.TILT_INTENSITY;

    // Rotação suave para a direção do movimento
    const targetRotationY = movementAngle;
    playerMesh.rotation.y = targetRotationY;

    // Inclinar para frente na direção do movimento
    playerMesh.rotation.x = tiltIntensity;

    // Manter jogador dentro dos limites do mundo
    playerMesh.position.x = Math.max(
      -worldSize,
      Math.min(worldSize, playerMesh.position.x),
    );
    playerMesh.position.z = Math.max(
      -worldSize,
      Math.min(worldSize, playerMesh.position.z),
    );

    // Atualizar posição da câmera relativa ao jogador
    updateCameraPosition();

    // Enviar atualização de posição para o servidor
    socket.emit("playerMovement", {
      position: {
        x: playerMesh.position.x,
        y: playerMesh.position.y - SETTINGS.PLAYER_HEIGHT, // Ajustar pelo offset
        z: playerMesh.position.z,
      },
    });
  } else {
    // Recuperar altura normal quando parado
    playerMesh.position.y =
      players[localPlayerId].baseHeight + SETTINGS.PLAYER_HEIGHT;

    // Recuperar inclinação e rotação quando parado
    playerMesh.rotation.x *= 1 - SETTINGS.TILT_RECOVERY_SPEED;
  }
}

// Update player interpolation for smooth movement
function updatePlayerInterpolation() {
  Object.keys(interpolationData).forEach((playerId) => {
    if (playerId !== localPlayerId && players[playerId]) {
      const data = interpolationData[playerId];
      const playerMesh = players[playerId].mesh;

      // Calculate dynamic interpolation speed based on ping
      const ping = data.ping || 100; // Default to 100ms if no ping data
      const speedFactor = Math.max(0, Math.min(1, SETTINGS.PING_WEIGHT * (1000 / ping)));
      const interpolationSpeed = SETTINGS.MIN_INTERPOLATION_SPEED + 
        (SETTINGS.MAX_INTERPOLATION_SPEED - SETTINGS.MIN_INTERPOLATION_SPEED) * speedFactor;

      // Adjust position with dynamic interpolation
      playerMesh.position.lerp(data.targetPosition, interpolationSpeed);
    }
  });
}

// Animate all balls
function animateBalls() {
  Object.keys(balls).forEach((ballId) => {
    const ball = balls[ballId];
    if (ball && ball.mesh) {
      // Rotate ball
      ball.mesh.rotation.y += SETTINGS.BALL_ROTATION_SPEED;
      ball.mesh.rotation.x += SETTINGS.BALL_ROTATION_SPEED / 2;

      // Make ball hover up and down
      const hoverOffset = Math.sin(Date.now() * 0.002) * 0.1;
      ball.mesh.position.y = ball.baseHeight + hoverOffset;
    }
  });
}

// Check for ball collisions
function checkBallCollisions() {
  if (!players[localPlayerId]) return;

  const playerPosition = players[localPlayerId].mesh.position.clone();
  playerPosition.y = 0; // Ignore height difference when checking collision

  Object.keys(balls).forEach((ballId) => {
    const ball = balls[ballId];
    if (ball && ball.mesh && !ball.collected) {
      const ballPosition = ball.mesh.position.clone();
      ballPosition.y = 0; // Ignore height difference when checking collision
      const distance = playerPosition.distanceTo(ballPosition);

      // Verificar se a bola está dentro da distância de coleta e não está em processo de coleta
      if (
        distance < SETTINGS.COLLECTION_DISTANCE &&
        !pendingCollections.has(ballId)
      ) {
        // Marcar bola como coletada localmente para evitar tentativas repetidas
        ball.collected = true;

        // Implementação de coleta otimista: ocultar a bola imediatamente
        ball.mesh.visible = false;

        // Adicionar à lista de coletas pendentes para debounce
        pendingCollections.add(ballId);

        console.log(`Collecting ball ${ballId}, distance: ${distance}`);

        // Dizer ao servidor que esta bola foi coletada
        socket.emit("collectBall", { ballId: ballId });

        // Configurar um timeout de segurança para limpar o status pendente
        // após 5 segundos, caso o servidor não responda
        setTimeout(() => {
          pendingCollections.delete(ballId);
        }, 5000);
      }
    }
  });
}

// Create a nametag for a player
function createNametag(name) {
  // Create a canvas for the nametag
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 512; // Aumentar a largura do canvas para nomes maiores
  canvas.height = 128; // Aumentar a altura do canvas

  // Fill with transparent background
  context.fillStyle = "rgba(0, 0, 0, 0)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text
  context.font = "bold 42px Arial"; // Fonte maior
  context.textAlign = "center";
  context.textBaseline = "middle";

  // Draw text outline
  context.strokeStyle = "black";
  context.lineWidth = 5; // Contorno mais grosso
  context.strokeText(name, canvas.width / 2, canvas.height / 2);

  // Draw text fill
  context.fillStyle = "white";
  context.fillText(name, canvas.width / 2, canvas.height / 2);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Create a sprite material with the texture
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });

  // Create sprite with the material
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3, 0.75, 1); // Aumentar escala proporcionalmente

  // Create a group to hold the sprite (for easier positioning)
  const group = new THREE.Group();
  group.add(sprite);

  return group;
}

// Update nametag orientations to face the camera
function updateNametagOrientations() {
  Object.values(players).forEach((player) => {
    if (player.nametagGroup) {
      // Make nametag face the camera
      player.nametagGroup.quaternion.copy(camera.quaternion);
    }
  });
}

// Helper function to get a random color
function getRandomColor() {
  // Exclude very dark or light colors
  const hue = Math.random() * 360;
  const saturation = 70 + Math.random() * 30; // 70-100%
  const lightness = 40 + Math.random() * 20; // 40-60%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Initialize everything immediately since we're now loaded after menu handling
function initGame() {
  console.log("Initializing game with nickname:", playerNickname);
  try {
    // Create UI
    createUI();

    // Initialize scene
    initializeScene();

    // Create ground if not created already
    if (!scene.getObjectByName("ground")) {
      createGround(scene);
    }

    // Initialize controls
    initControls();

    // Connect to server
    connectToServer();

    // Start animation loop
    animate();

    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Error initializing game:", error);
    alert("Error starting game: " + error.message);
  }
}

initGame();

// Setup window resize handler
window.addEventListener("resize", () => {
  if (renderer && camera) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    console.log("Window resized to", width, "x", height);
  }
});

// Update leaderboard
function updateLeaderboard() {
  // Sort players by score
  leaderboardPlayers = Object.values(players).sort((a, b) => b.score - a.score);

  // Update leaderboard display
  const leaderboardEntries = document.getElementById("leaderboard-entries");
  if (!leaderboardEntries) return;

  leaderboardEntries.innerHTML = "";

  // Mostrar apenas os top 3 jogadores
  const topPlayers = leaderboardPlayers.slice(0, 3);

  // Medalhas para os top 3
  const medals = ["🥇", "🥈", "🥉"];

  topPlayers.forEach((player, index) => {
    const entry = document.createElement("div");
    entry.className = "leaderboard-entry";
    entry.style.margin = "3px 0";
    entry.style.display = "flex";
    entry.style.justifyContent = "space-between";

    // Destaque para o jogador local
    if (player.id === localPlayerId) {
      entry.style.fontWeight = "bold";
      entry.style.color = "#ffff00";
    }

    // Medalha + nome
    const nameSpan = document.createElement("span");
    nameSpan.innerHTML = `${medals[index] || "•"} ${player.nickname}`;
    nameSpan.style.textOverflow = "ellipsis";
    nameSpan.style.overflow = "hidden";
    nameSpan.style.whiteSpace = "nowrap";
    nameSpan.style.maxWidth = "170px";

    // Pontuação
    const scoreSpan = document.createElement("span");
    scoreSpan.innerHTML = `${player.score}`;
    scoreSpan.style.marginLeft = "10px";

    entry.appendChild(nameSpan);
    entry.appendChild(scoreSpan);

    leaderboardEntries.appendChild(entry);
  });

  // Se não há jogadores suficientes, mostrar espaços vazios
  for (let i = topPlayers.length; i < 3; i++) {
    const emptyEntry = document.createElement("div");
    emptyEntry.className = "leaderboard-entry";
    emptyEntry.style.margin = "3px 0";
    emptyEntry.style.color = "#888";
    emptyEntry.innerHTML = `${medals[i] || "•"} ---`;
    leaderboardEntries.appendChild(emptyEntry);
  }
}

function setRandomNicknamePlaceholder() {
  const nicknames = [
    "SpeedyGonzales",
    "FlashGordon",
    "SonicBoom",
    "Rocketman",
    "Turbo",
    "Zippy",
    "Whizzbang",
    "ZoomZoom",
    "Rapid",
    "Velocity",
  ];
  nicknameInput.placeholder = nicknames[Math.floor(Math.random() * nicknames.length)];
}