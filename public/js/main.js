// Window onload handler
document.addEventListener('DOMContentLoaded', onload);

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
  INTERPOLATION_SPEED: 0.1,
  BALL_RADIUS: 0.3,
  BALL_SEGMENTS: 16,
  BALL_ROTATION_SPEED: 0.02,
  BALL_VALUE: 10,
  BALL_HOVER_HEIGHT: 0.2,
  BALL_HOVER_SPEED: 1.0,
  CAMERA_FOV: 75,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  DELTA_TIME: 1/60,
  SKY_COLOR: 0x87CEFA,
  SIZE_INCREASE_PER_BALL: 0.05, // Size increase multiplier per ball collected
  MAX_SIZE_MULTIPLIER: 2.5, // Maximum size multiplier for players
  NAMETAG_OFFSET_Y: 2.2, // Height above player for nametag
  NAMETAG_SCALE: 0.01, // Scale of the nametag text
  NICKNAME_MAX_LENGTH: 20,
  NICKNAME_MIN_LENGTH: 2,
  NICKNAME_PATTERN: /^[a-zA-Z0-9\s\-_]+$/, // Apenas letras, números, espaços, hífens e underscores
  UI_TRANSITION_DURATION: '0.3s',
  ACCELERATION: 0.015, // Velocidade de aceleração
  DECELERATION: 0.03,   // Velocidade de desaceleração (mais rápida que aceleração)
  TILT_INTENSITY: 0.15, // Intensidade da inclinação do jogador durante o movimento
  TILT_RECOVERY_SPEED: 0.1, // Velocidade de recuperação da inclinação
  BOB_FREQUENCY: 0.1, // Frequência do efeito de salto
  BOB_AMPLITUDE: 0.05, // Amplitude do efeito de salto
  BOB_SPEED_SCALING: 1.5, // Escala da velocidade de bob baseada na velocidade de movimento
  SPEED_BOOST_MULTIPLIER: 2.0 // Multiplicador de velocidade para power-up
};

// Movement keys tracking
let keys = { forward: false, backward: false, left: false, right: false, sprint: false };

// UI elements
let scoreDisplay, topScoreDisplay, playerCountDisplay, messageDisplay;
let menuScreen, nicknameInput, playButton;
let playerNickname = sessionStorage.getItem('playerNickname') || 'Player';
console.log('Retrieved nickname from session storage:', playerNickname);

// Power-up state
const powerUps = {
  SPEED: { active: false, duration: 5000 } // Example speed boost power-up
};

const tempVec3_1 = new THREE.Vector3();
const tempVec3_2 = new THREE.Vector3();
const tempVec3_3 = new THREE.Vector3();

// Wait for the DOM to load completely
function onload() {
  console.log('DOM loaded, initializing game menu');

  // Get menu elements and set up UI
  menuScreen = document.getElementById('menu-screen');
  nicknameInput = document.getElementById('nickname-input');
  playButton = document.getElementById('play-button');

  console.log('Menu elements:', { 
    menuScreen: !!menuScreen, 
    nicknameInput: !!nicknameInput, 
    playButton: !!playButton 
  });

  // Set up menu event listeners
  if (playButton) {
    playButton.onclick = function() {
      console.log('Play button clicked!');
      startGame();
    };
    console.log('Play button click handler attached');
  } else {
    console.error('Play button not found in the DOM');
  }

  // Focus the nickname input automatically
  if (nicknameInput) {
    nicknameInput.focus();

    nicknameInput.addEventListener('keypress', function(e) {
      console.log('Key pressed in input:', e.key);
      if (e.key === 'Enter') {
        console.log('Enter key pressed, starting game...');
        startGame();
      }
    });
    console.log('Nickname input keypress handler attached');
  }
}

// Start the game when the play button is clicked
function startGame() {
  try {
    console.log('startGame function called');

    // Get nickname from input or use placeholder if empty
    playerNickname = nicknameInput.value.trim();
    if (playerNickname.length === 0) {
      playerNickname = nicknameInput.placeholder;
    }

    // Sanitização do nickname
    playerNickname = playerNickname
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove caracteres não permitidos
      .slice(0, SETTINGS.NICKNAME_MAX_LENGTH); // Limita o tamanho máximo

    // Validação final
    if (playerNickname.length < SETTINGS.NICKNAME_MIN_LENGTH) {
      playerNickname = "Player" + Math.floor(Math.random() * 1000);
    }

    console.log(`Starting game with nickname: ${playerNickname}`);

    // Hide the menu screen with transition
    if (menuScreen) {
      menuScreen.style.transition = `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-out`;
      menuScreen.style.opacity = '0';
      setTimeout(() => {
        menuScreen.style.display = 'none';
      }, parseFloat(SETTINGS.UI_TRANSITION_DURATION) * 1000);
      console.log('Menu screen hidden with transition');
    } else {
      console.error('Menu screen element not found');
    }

    // Create UI elements for the game
    createUI();
    console.log('Game UI created');

    // Connect to the server
    connectToServer();
    console.log('Connected to server');

    // Start the animation loop
    animate();
    console.log('Animation loop started');

    gameActive = true;
  } catch (error) {
    console.error('Error starting game:', error);
    alert('Error starting game: ' + error.message);
  }
}

// Create UI elements
// Create UI elements
function createUI() {
  // Fonte elegante (adicione no HTML <head> se ainda não tiver)
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);

  // Score
  scoreDisplay = document.createElement('div');
  scoreDisplay.id = 'score-display';
  scoreDisplay.className = 'game-ui';
  Object.assign(scoreDisplay.style, {
    position: 'absolute',
    top: '12px',
    left: '12px',
    color: '#f0e6d2',
    fontFamily: '"Playfair Display", serif',
    fontSize: '18px',
    padding: '6px 14px',
    backgroundColor: 'rgba(25, 25, 25, 0.7)',
    border: '1px solid rgba(212, 175, 55, 0.5)',
    borderRadius: '10px',
    boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)',
    transition: `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-in`,
    opacity: '0'
  });
  scoreDisplay.innerHTML = 'Score: 0';
  document.body.appendChild(scoreDisplay);

  // Leaderboard
  topScoreDisplay = document.createElement('div');
  topScoreDisplay.id = 'leaderboard-display';
  topScoreDisplay.className = 'game-ui';
  Object.assign(topScoreDisplay.style, {
    position: 'absolute',
    top: '12px',
    right: '12px',
    color: '#f0e6d2',
    fontFamily: '"Playfair Display", serif',
    fontSize: '15px',
    padding: '12px 14px',
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    border: '1px solid rgba(212, 175, 55, 0.5)',
    borderRadius: '10px',
    minWidth: '230px',
    boxShadow: '0 0 15px rgba(212, 175, 55, 0.3)',
    transition: `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-in`,
    opacity: '0'
  });
  topScoreDisplay.innerHTML = `
    <div style="text-align:center; font-weight: bold; font-size: 1.1em; margin-bottom: 6px;">🏆 Leaderboard</div>
    <div id="leaderboard-entries" style="display: flex; flex-direction: column; gap: 3px;"></div>
  `;
  document.body.appendChild(topScoreDisplay);

  // Player Count
  playerCountDisplay = document.createElement('div');
  playerCountDisplay.id = 'player-count-display';
  playerCountDisplay.className = 'game-ui';
  Object.assign(playerCountDisplay.style, {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    color: '#cccccc',
    fontFamily: 'monospace',
    fontSize: '15px',
    padding: '6px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '6px',
    transition: `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-in`,
    opacity: '0'
  });
  playerCountDisplay.innerHTML = 'Players: 0';
  document.body.appendChild(playerCountDisplay);

  // Central Message
  messageDisplay = document.createElement('div');
  messageDisplay.id = 'message-display';
  messageDisplay.className = 'game-ui';
  Object.assign(messageDisplay.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
    fontFamily: '"Playfair Display", serif',
    fontSize: '26px',
    padding: '12px 24px',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    display: 'none',
    transition: `opacity ${SETTINGS.UI_TRANSITION_DURATION} ease-in-out`,
    opacity: '0',
    userSelect: 'none',
    pointerEvents: 'none',
    textAlign: 'center'
  });
  document.body.appendChild(messageDisplay);

  // Fade in
  setTimeout(() => {
    scoreDisplay.style.opacity = '1';
    topScoreDisplay.style.opacity = '1';
    playerCountDisplay.style.opacity = '1';
  }, 50);
}

// Function to show a message to the player
function showMessage(text, duration = 2000) {
  const toast = document.getElementById('message-toast');
  toast.textContent = text;
  toast.style.opacity = '1';

  clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => {
    toast.style.opacity = '0';
  }, duration);
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
    SETTINGS.CAMERA_FAR
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

  // Load background music
  loadBackgroundMusic();
  console.log('Background music loaded');

  // Start the animation loop
  animate();
}

function loadBackgroundMusic() {
  const audioLoader = new THREE.AudioLoader();
  const listener = new THREE.AudioListener();
  camera.add(listener);
  
  // Add loading and error handling
  audioLoader.load(
    './assets/background_sound.mp3',
    function(buffer) {
      const sound = new THREE.Audio(listener);
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.1);
      sound.play();
      console.log('Background music loaded and playing');
    },
    function(xhr) {
      console.log('Background music loading: ' + (xhr.loaded / xhr.total * 100) + '%');
    },
    function(error) {
      console.error('Error loading background music:', error);
      // Continue game without music
    }
  );
}

// Initialize keyboard state and event listeners
function initControls() {
  // Initialize movement keys state
  keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false
  };

  // Key down event listener
  window.addEventListener('keydown', (event) => {
    if (!gameActive) return;

    // Prevent default behavior for game control keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'Shift'].includes(event.key)) {
      event.preventDefault();
    }

    // Update key states
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        keys.forward = true;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        keys.backward = true;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        keys.left = true;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        keys.right = true;
        break;
      case 'Shift':
        keys.sprint = true;
        break;
    }
  });

  // Key up event listener
  window.addEventListener('keyup', (event) => {
    // Update key states
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        keys.forward = false;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        keys.backward = false;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        keys.left = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        keys.right = false;
        break;
      case 'Shift':
        keys.sprint = false;
        break;
    }
  });

  // Handle window blur (user tabs out)
  window.addEventListener('blur', () => {
    // Reset all keys when window loses focus
    Object.keys(keys).forEach(key => {
      keys[key] = false;
    });
  });
}

// Connect to the server
function connectToServer() {
  try {
    console.log('Connecting to server with nickname:', playerNickname);

    // Connect to the server via Socket.IO
    socket = io();
    console.log('Socket.IO connection created');

    // Set up socket event handlers
    setupSocketHandlers();

    // Join the game with the selected nickname
    socket.emit('joinGame', { nickname: playerNickname });
  } catch (error) {
    console.error('Error connecting to server:', error);
  }
}

// Set up socket event handlers
function setupSocketHandlers() {
  // Remove any existing event listeners to prevent duplicates
  if (socket) {
    socket.removeAllListeners();
  }

  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    localPlayerId = socket.id;
    showMessage('Connected to game server!', 3000);
    gameActive = true;
  });

  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showMessage('Disconnected from server. Trying to reconnect...', 0);
    gameActive = false;
    
    // Clear pending collections
    pendingCollections.clear();
    
    // Try to reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      setTimeout(() => {
        reconnectAttempts++;
        showMessage(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, 0);
        socket.connect();
      }, RECONNECT_DELAY);
    } else {
      showMessage('Could not reconnect to server. Please refresh the page.', 0);
    }
  });

  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    localPlayerId = socket.id;
    showMessage('Connected to game server!', 3000);
    gameActive = true;
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // If we're reconnecting, re-join the game with the same nickname
    if (playerNickname) {
      socket.emit('joinGame', { nickname: playerNickname });
    }
  });

  // Handle world info
  socket.on('worldInfo', (data) => {
    console.log('Received world info:', data);
    worldSize = data.worldSize;
  });

  // Handle current players
  socket.on('currentPlayers', (serverPlayers) => {
    console.log('Current players received:', serverPlayers);

    // Clear existing players first
    Object.keys(players).forEach(id => {
      if (id !== localPlayerId) {
        removePlayer(id);
      }
    });

    // Add all players from server
    Object.values(serverPlayers).forEach(playerInfo => {
      // If this is us and we don't have our player yet, create it
      if (playerInfo.id === localPlayerId && !players[localPlayerId]) {
        console.log('Creating local player');
        addPlayer(playerInfo);
      }
      // If this is another player and we don't have them yet, create them
      else if (playerInfo.id !== localPlayerId && !players[playerInfo.id]) {
        console.log('Adding existing player:', playerInfo.id);
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
  socket.on('playerInfo', (playerData) => {
    console.log('Player info received:', playerData);
  
    if (playerData.id === localPlayerId && !players[localPlayerId]) {
      console.log('Creating local player mesh');
      addPlayer(playerData);
  
      const frases = [
        `Ah, se não é o ilustre ${playerData.nickname}, o flagelo das bolas errantes!`,
        `Senhor(a) ${playerData.nickname}, vossa tragédia começa agora.`,
        `Inclinem-se, plebe! ${playerData.nickname} adentrou o palco da vergonha.`,
        `${playerData.nickname}, que vossas mãos não sejam tão moles quanto vossas ideias.`
      ];
      const fraseAleatoria = frases[Math.floor(Math.random() * frases.length)];
      showMessage(fraseAleatoria, 3500);
    }
  });

  // Handle new balls
  socket.on('newBalls', (serverBalls) => {
    console.log('Received new balls:', serverBalls);

    // Limpar qualquer coleta pendente para bolas que não existem mais no servidor
    const serverBallIds = new Set(serverBalls.map(ball => ball.id));

    // Para cada coleta pendente, verificar se a bola ainda existe no servidor
    pendingCollections.forEach(pendingBallId => {
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
  socket.on('playerMoved', (moveData) => {
    // Skip if it's our own movement
    if (moveData.id === localPlayerId) return;

    // Update other player's target position
    if (players[moveData.id]) {
      // Create or update interpolation data
      if (!interpolationData[moveData.id]) {
        interpolationData[moveData.id] = {
          targetPosition: new THREE.Vector3()
        };
      }

      // Set target position for interpolation
      interpolationData[moveData.id].targetPosition.set(
        moveData.position.x,
        moveData.position.y + SETTINGS.PLAYER_HEIGHT,
        moveData.position.z
      );
    }
  });

  // Handle new player
  socket.on('newPlayer', (playerData) => {
    console.log('New player joined:', playerData);

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
  socket.on('playerDisconnected', (playerId) => {
    console.log('Player disconnected:', playerId);
    removePlayer(playerId);

    // Atualizar leaderboard quando um jogador desconecta
    updateLeaderboard();
  });

  // Handle score updates
  socket.on('updateScores', (scores) => {
    console.log('Score update received:', scores);

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
  socket.on('playerCount', (count) => {
    updatePlayerCount(count);
  });

  // Handle ball collection
  socket.on('ballCollected', (data) => {
      console.log('Ball collected:', data);
    
    // Clear any pending timeout for this ball
    if (pendingCollectionTimeouts[data.ballId]) {
      clearTimeout(pendingCollectionTimeouts[data.ballId]);
      delete pendingCollectionTimeouts[data.ballId];
    }
    
    // Remove the ball ID from pending collections list
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
      
        const frasesDePonto = [
          `+${data.value} pontos! O caldo está engrossando!`,
          `+${data.value}! Subindo como pão de ontem!`,
          `+${data.value} pontos... Um prodígio do caos!`,
          `+${data.value} pontos! Mais espesso que mingau requentado!`,
          `+${data.value}! Um espetáculo de desequilíbrio e ousadia!`
        ];
        const frase = frasesDePonto[Math.floor(Math.random() * frasesDePonto.length)];
        showMessage(frase, 1000);
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

// No frontend (client)
const ABILITIES = {
  DASH: {
    cost: 20,
    cooldown: 5000,
    active: false,
    lastUsed: 0
  },
  MAGNET: {
    cost: 50,
    cooldown: 15000,
    active: false,
    lastUsed: 0
  },
  SHOCKWAVE: {
    cost: 100,
    cooldown: 20000,
    active: false,
    lastUsed: 0
  }
};

// Ativar habilidade
function activateAbility(abilityName) {
  const ability = ABILITIES[abilityName];
  const now = Date.now();
  
  if (!ability || ability.active || now - ability.lastUsed < ability.cooldown || 
      players[localPlayerId].score < ability.cost) {
    return false;
  }
  
  socket.emit('useAbility', { ability: abilityName });
  ability.active = true;
  ability.lastUsed = now;
  
  // UI feedback
  showAbilityEffect(abilityName);
  
  setTimeout(() => {
    ability.active = false;
  }, ability.duration);
  
  return true;
}

function createZoneMesh(zoneData) {
  const geometry = new THREE.CylinderGeometry(zoneData.radius, zoneData.radius, 0.2, 32);
  
  let material;
  switch(zoneData.type) {
    case 'MULTIPLIER':
      material = new THREE.MeshBasicMaterial({ 
        color: 0xFFD700, 
        transparent: true, 
        opacity: 0.3 
      });
      break;
    case 'DANGER':
      material = new THREE.MeshBasicMaterial({ 
        color: 0xFF0000, 
        transparent: true, 
        opacity: 0.3 
      });
      break;
    // outros casos...
  }
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(zoneData.position.x, zoneData.position.y, zoneData.position.z);
  mesh.rotation.x = Math.PI / 2;
  
  scene.add(mesh);
  zones[zoneData.id] = { data: zoneData, mesh };
}

let currentWeatherEffect = null;
let weatherParticleSystem = null;

function handleWeatherEvent(weatherData) {
  currentWeatherEffect = weatherData;
  
  showMessage(`Clima mudou: ${getWeatherName(weatherData.type)}`, 3000);
  
  // Aplicar efeitos visuais
  switch(weatherData.type) {
    case 'RAIN':
      createRainEffect();
      scene.fog.density = 0.02;
      break;
    case 'FOG':
      scene.fog.density = 0.05;
      break;
    case 'STORM':
      createStormEffect();
      scene.fog.density = 0.03;
      break;
    case 'SUNSHINE':
      scene.fog.density = 0.007;
      createSunshineEffect();
      break;
  }
}

function getWeatherName(type) {
  switch(type) {
    case 'RAIN': return 'Chuva';
    case 'FOG': return 'Névoa';
    case 'STORM': return 'Tempestade';
    case 'SUNSHINE': return 'Dia Ensolarado';
    default: return type;
  }
}

function createRainEffect() {
  if (weatherParticleSystem) {
    scene.remove(weatherParticleSystem);
  }
  
  const rainGeometry = new THREE.BufferGeometry();
  const rainCount = 15000;
  const positions = new Float32Array(rainCount * 3);
  const velocities = new Float32Array(rainCount);
  
  for (let i = 0; i < rainCount; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * worldSize;
    positions[i * 3 + 1] = Math.random() * 30;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * worldSize;
    velocities[i] = 0.1 + Math.random() * 0.3;
  }
  
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  rainGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
  
  const rainMaterial = new THREE.PointsMaterial({
    color: 0x9999AA,
    size: 0.1,
    transparent: true,
    opacity: 0.6
  });
  
  weatherParticleSystem = new THREE.Points(rainGeometry, rainMaterial);
  scene.add(weatherParticleSystem);
}

// Função chamada no loop de animação
function updateWeatherEffects() {
  if (!currentWeatherEffect) return;
  
  switch(currentWeatherEffect.type) {
    case 'RAIN':
      updateRainAnimation();
      break;
    case 'STORM':
      updateStormAnimation();
      break;
    // outros casos...
  }
}

function updateRainAnimation() {
  if (!weatherParticleSystem) return;
  
  const positions = weatherParticleSystem.geometry.attributes.position.array;
  const velocities = weatherParticleSystem.geometry.attributes.velocity.array;
  const count = positions.length / 3;
  
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 1] -= velocities[i];
    
    if (positions[i * 3 + 1] < 0) {
      positions[i * 3 + 1] = 30;
      positions[i * 3] = (Math.random() * 2 - 1) * worldSize;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * worldSize;
    }
  }
  
  weatherParticleSystem.geometry.attributes.position.needsUpdate = true;
}

const ACHIEVEMENTS = [
  {
    id: 'FIRST_STEPS',
    name: 'Primeiros Passos',
    description: 'Colete sua primeira esfera',
    icon: '🥚',
    requirement: { type: 'COLLECT', count: 1 }
  },
  {
    id: 'COLLECTOR',
    name: 'Colecionador',
    description: 'Colete 100 esferas no total',
    icon: '🧩',
    requirement: { type: 'COLLECT_TOTAL', count: 100 }
  },
  {
    id: 'LEADERBOARD_MASTER',
    name: 'Mestre do Ranking',
    description: 'Fique em primeiro lugar por 5 minutos acumulados',
    icon: '👑',
    requirement: { type: 'TOP_POSITION', minutes: 5 }
  }
  // mais conquistas...
];

// Salvar/carregar progresso usando localStorage
function loadPlayerProgress() {
  const savedProgress = localStorage.getItem('playerProgress');
  
  if (savedProgress) {
    try {
      const progress = JSON.parse(savedProgress);
      return progress;
    } catch (e) {
      console.error('Erro ao carregar progresso:', e);
    }
  }
  
  return {
    totalBallsCollected: 0,
    achievementsUnlocked: {},
    timeInTopPosition: 0,
    highestScore: 0,
    gamesPlayed: 0
  };
}

let playerProgress = loadPlayerProgress();

function savePlayerProgress() {
  localStorage.setItem('playerProgress', JSON.stringify(playerProgress));
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(achievement => {
    if (playerProgress.achievementsUnlocked[achievement.id]) {
      return; // Já desbloqueado
    }
    
    let unlocked = false;
    
    switch(achievement.requirement.type) {
      case 'COLLECT':
        unlocked = pendingCollections.size >= achievement.requirement.count;
        break;
      case 'COLLECT_TOTAL':
        unlocked = playerProgress.totalBallsCollected >= achievement.requirement.count;
        break;
      case 'TOP_POSITION':
        unlocked = playerProgress.timeInTopPosition >= achievement.requirement.minutes * 60;
        break;
      // outros tipos...
    }
    
    if (unlocked) {
      unlockAchievement(achievement);
    }
  });
}

function unlockAchievement(achievement) {
  playerProgress.achievementsUnlocked[achievement.id] = Date.now();
  savePlayerProgress();
  
  // Mostrar notificação
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-icon">${achievement.icon}</div>
    <div class="achievement-text">
      <div class="achievement-title">Conquista desbloqueada!</div>
      <div class="achievement-name">${achievement.name}</div>
      <div class="achievement-description">${achievement.description}</div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Aplicar estilos
  Object.assign(notification.style, {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '15px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 0 10px gold',
    zIndex: '1000',
    opacity: '0',
    transition: 'opacity 0.5s ease-in-out'
  });
  
  // Animação de entrada
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 100);
  
  // Remover após alguns segundos
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 5000);
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
    1.0 + (ballsCollected * SETTINGS.SIZE_INCREASE_PER_BALL),
    SETTINGS.MAX_SIZE_MULTIPLIER
  );

  // Store the new size multiplier
  player.sizeMultiplier = sizeMultiplier;

  // Apply scaling to the mesh
  player.mesh.scale.set(sizeMultiplier, sizeMultiplier, sizeMultiplier);

  console.log(`Updated player ${playerId} size: ${sizeMultiplier.toFixed(2)}x (score: ${score})`);

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
      playerInfo.position.z
    );
    
    // Preservar a cor original do jogador
    if (playerInfo.color) {
      const playerColor = new THREE.Color(playerInfo.color);
      players[playerInfo.id].mesh.material.color = playerColor;
      players[playerInfo.id].color = playerColor.getHex();
    }
    return;
  }

  console.log('Adding player:', playerInfo.id);

  // Create player geometry and material
  const playerGeometry = new THREE.CylinderGeometry(
    SETTINGS.PLAYER_RADIUS, 
    SETTINGS.PLAYER_RADIUS, 
    SETTINGS.PLAYER_HEIGHT * 2, 
    SETTINGS.PLAYER_SEGMENTS
  );

  // Use player color from server
  const playerColor = new THREE.Color(playerInfo.color);
  const playerMaterial = new THREE.MeshStandardMaterial({
    color: playerColor,
    roughness: 0.5,
    metalness: 0.5
  });

  // Create player mesh
  const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
  playerMesh.castShadow = true;
  playerMesh.receiveShadow = true;

  // Set player position
  playerMesh.position.set(
    playerInfo.position.x,
    playerInfo.position.y + SETTINGS.PLAYER_HEIGHT,
    playerInfo.position.z
  );

  // Create player nametag
  const nickname = playerInfo.nickname || `Player ${playerInfo.id.substring(0, 4)}`;
  const nametagGroup = createNametag(nickname);

  // Position nametag above player
  nametagGroup.position.set(0, SETTINGS.PLAYER_HEIGHT * 1.6, 0);
  playerMesh.add(nametagGroup);

  // Store player mesh with ID
  players[playerInfo.id] = {
    mesh: playerMesh,
    id: playerInfo.id,
    nickname: nickname,
    score: playerInfo.score || 0,
    color: playerColor.getHex(),
    sizeMultiplier: playerInfo.sizeMultiplier || 1.0,
    nametagGroup: nametagGroup,
    baseHeight: playerInfo.position.y || 0
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
    if (players[playerId].mesh && scene) {
      // Remove from scene
      scene.remove(players[playerId].mesh);
      
      // Dispose of geometry and material
      if (players[playerId].mesh.geometry) {
        players[playerId].mesh.geometry.dispose();
      }
      if (players[playerId].mesh.material) {
        if (Array.isArray(players[playerId].mesh.material)) {
          players[playerId].mesh.material.forEach(material => material.dispose());
        } else {
          players[playerId].mesh.material.dispose();
        }
      }
      
      // Clear nametag texture from cache if exists
      if (players[playerId].nickname && nametagTextureCache[players[playerId].nickname]) {
        nametagTextureCache[players[playerId].nickname].dispose();
        delete nametagTextureCache[players[playerId].nickname];
      }
    }
    
    // Remove the player from the players object
    delete players[playerId];
    
    // Clean up interpolation data
    if (interpolationData[playerId]) {
      delete interpolationData[playerId];
    }
    
    // Update player count display
    updatePlayerCount();
    
    console.log(`Player ${playerId} removed and resources disposed`);
  }
}

// Create the ground
function createGround(scene) {
  // Create texture loader
  const textureLoader = new THREE.TextureLoader();
  
  // Add error handling for texture loading
  const groundTexture = textureLoader.load(
    '/assets/textures/grass.jpg',
    function(texture) {
      console.log('Ground texture loaded successfully');
    },
    function(xhr) {
      console.log('Ground texture loading progress: ' + (xhr.loaded / xhr.total * 100) + '%');
    },
    function(error) {
      console.error('Error loading ground texture:', error);
      // Fallback to a basic material if texture fails
      groundMesh.material = new THREE.MeshStandardMaterial({
        color: 0x7CFC00,  // Lawn green color as fallback
        roughness: 0.8,
        metalness: 0.2
      });
    }
  );
  
  // Configure texture properties
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(16, 16);
  groundTexture.anisotropy = 16;
  
  // Create material with the texture
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide  // Render both sides of the plane
  });
  
  // Create a simple flat ground first to test texturing
  const groundGeometry = new THREE.PlaneGeometry(worldSize * 2, worldSize * 2, 1, 1);
  
  // Create ground mesh
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  groundMesh.name = 'ground';
  scene.add(groundMesh);
  
  // Add a debug message
  console.log('Ground created with dimensions:', worldSize * 2, 'x', worldSize * 2);
  
  // Create grid helper with reduced opacity
  const gridHelper = new THREE.GridHelper(worldSize * 2, 20, 0x000000, 0x000000);
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
      ballInfo.position.z
    );
    return;
  }
  
  console.log('Adding ball:', ballInfo.id);
  
  // Create ball geometry and material
  const ballGeometry = new THREE.SphereGeometry(
    SETTINGS.BALL_RADIUS,
    SETTINGS.BALL_SEGMENTS,
    SETTINGS.BALL_SEGMENTS
  );
  
  const ballMaterial = new THREE.MeshStandardMaterial({ 
    color: ballInfo.color || 0xFFFFFF,
    roughness: 0.2,
    metalness: 0.9,
    emissive: ballInfo.type === 'GOLDEN' ? 0xFFD700 : 0,
    emissiveIntensity: 0.5
  });
  
  // Create ball mesh
  const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  // Enable frustum culling for better performance
  ballMesh.frustumCulled = true;
  
  // Set ball position
  ballMesh.position.set(
    ballInfo.position.x,
    ballInfo.position.y,
    ballInfo.position.z
  );
  
  // Store ball with ID and add to scene
  balls[ballInfo.id] = {
    mesh: ballMesh,
    baseHeight: ballInfo.position.y,
    collected: false,
    value: ballInfo.value || SETTINGS.BALL_VALUE,
    type: ballInfo.type || 'NORMAL'
  };
  
  // Add to scene
  scene.add(ballMesh);
}

// Remove a ball from the scene
function removeBall(ballId) {
  if (balls[ballId]) {
    if (balls[ballId].mesh && scene) {
      // Remove from scene
      scene.remove(balls[ballId].mesh);
      
      // Dispose of geometry and material
      if (balls[ballId].mesh.geometry) {
        balls[ballId].mesh.geometry.dispose();
      }
      if (balls[ballId].mesh.material) {
        if (Array.isArray(balls[ballId].mesh.material)) {
          balls[ballId].mesh.material.forEach(material => material.dispose());
        } else {
          balls[ballId].mesh.material.dispose();
        }
      }
    }
    
    // Clean up references
    delete balls[ballId];
    pendingCollections.delete(ballId);
    
    console.log(`Ball ${ballId} removed and resources disposed`);
  }
}

// Update camera position relative to player
function updateCameraPosition() {
  if (!players[localPlayerId]) return;

  const playerMesh = players[localPlayerId].mesh;
  const sizeMultiplier = players[localPlayerId].sizeMultiplier || 1.0;

  // Adjust camera distance based on player size
  const adjustedCameraDistance = SETTINGS.CAMERA_DISTANCE * Math.max(1, sizeMultiplier * 0.8) * 1.5; // Aumentado em 50%
  const adjustedCameraHeight = SETTINGS.CAMERA_HEIGHT * Math.max(1, sizeMultiplier * 0.5) * 1.2; // Aumentado em 20%

  // Get camera direction
  const cameraDirection = camera.getWorldDirection(new THREE.Vector3());

  // Position camera behind player
  camera.position.copy(playerMesh.position)
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
  
  // Only process game logic and rendering if the game is active and all required objects exist
  if (gameActive && scene && camera && renderer) {
    // Handle player movement
    updatePlayerMovement();
    updatePlayerInterpolation();
    
    checkPlayerCollisions();

    animateBalls();
    checkBallCollisions();
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Update nametag orientations to face camera
    updateNametagOrientations();
  } else if (gameActive) {
    console.warn('Cannot render: some required objects are not initialized', {
      scene: !!scene,
      camera: !!camera,
      renderer: !!renderer
    });
  }
}

// Update player movement based on keys
function updatePlayerMovement() {
  if (!players[localPlayerId]) return;
  
  const playerMesh = players[localPlayerId].mesh;
  const cameraDirection = camera.getWorldDirection(tempVec3_1);
  
  // Keep movement on the xz plane
  cameraDirection.y = 0;
  cameraDirection.normalize();
  
  // Calculate movement vectors
  const forwardVector = tempVec3_2.copy(cameraDirection);
  const rightVector = tempVec3_3.crossVectors(
    cameraDirection,
    new THREE.Vector3(0, 1, 0)
  ).normalize();
  
  // Determine max speed based on sprint/power-ups
  let maxSpeed = keys.sprint ? SETTINGS.MOVE_SPEED * SETTINGS.SPRINT_MULTIPLIER : SETTINGS.MOVE_SPEED;
  if (powerUps.SPEED.active) {
    maxSpeed *= SETTINGS.SPEED_BOOST_MULTIPLIER;
  }
  
  // Reset target velocity
  targetVelocity.set(0, 0, 0);
  
  // Add movement vectors based on keys
  if (keys.forward) targetVelocity.add(forwardVector);
  if (keys.backward) targetVelocity.sub(forwardVector);
  if (keys.left) targetVelocity.sub(rightVector);
  if (keys.right) targetVelocity.add(rightVector);
  
  // Always normalize the velocity for consistent speed in all directions
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
    bobTimer += currentVelocity.length() * SETTINGS.BOB_FREQUENCY * SETTINGS.BOB_SPEED_SCALING;
    const bobOffset = Math.sin(bobTimer) * SETTINGS.BOB_AMPLITUDE * (currentVelocity.length() / maxSpeed);
    playerMesh.position.y = players[localPlayerId].baseHeight + SETTINGS.PLAYER_HEIGHT + bobOffset;

    // Aplicar inclinação na direção do movimento
    const movementAngle = Math.atan2(currentVelocity.x, currentVelocity.z);
    const tiltIntensity = currentVelocity.length() / maxSpeed * SETTINGS.TILT_INTENSITY;

    // Rotação suave para a direção do movimento
    const targetRotationY = movementAngle;
    playerMesh.rotation.y = targetRotationY;

    // Inclinar para frente na direção do movimento
    playerMesh.rotation.x = tiltIntensity;

    // Manter jogador dentro dos limites do mundo
    playerMesh.position.x = Math.max(-worldSize, Math.min(worldSize, playerMesh.position.x));
    playerMesh.position.z = Math.max(-worldSize, Math.min(worldSize, playerMesh.position.z));

    // Atualizar posição da câmera relativa ao jogador
    updateCameraPosition();

    // Enviar atualização de posição para o servidor
    socket.emit('playerMovement', {
      position: {
        x: playerMesh.position.x,
        y: playerMesh.position.y - SETTINGS.PLAYER_HEIGHT, // Ajustar pelo offset
        z: playerMesh.position.z
      }
    });
  } else {
    // Recuperar altura normal quando parado
    playerMesh.position.y = players[localPlayerId].baseHeight + SETTINGS.PLAYER_HEIGHT;

    // Recuperar inclinação e rotação quando parado
    playerMesh.rotation.x *= (1 - SETTINGS.TILT_RECOVERY_SPEED);
  }
}

// Update player interpolation for smooth movement
function updatePlayerInterpolation() {
  Object.keys(interpolationData).forEach(playerId => {
    if (playerId !== localPlayerId && players[playerId]) {
      const data = interpolationData[playerId];
      const playerMesh = players[playerId].mesh;

      // Adjust position with interpolation
      playerMesh.position.lerp(data.targetPosition, SETTINGS.INTERPOLATION_SPEED);
    }
  });
}

// Animate all balls
function animateBalls() {
  Object.keys(balls).forEach(ballId => {
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
const pendingCollectionTimeouts = {};

function checkBallCollisions() {
  if (!players[localPlayerId]) return;
  
  const playerMesh = players[localPlayerId].mesh;
  const playerPosition = playerMesh.position.clone();
  const playerRadius = SETTINGS.PLAYER_RADIUS * (players[localPlayerId].sizeMultiplier || 1.0);
  
  Object.keys(balls).forEach(ballId => {
    const ball = balls[ballId];
    if (ball && ball.mesh && !ball.collected && !pendingCollections.has(ballId)) {
      const ballPosition = ball.mesh.position.clone();
      const distance = playerPosition.distanceTo(ballPosition);
      
      // Use 3D distance and check if within collection range
      // Adjust collection distance based on player size
      const adjustedCollectionDistance = SETTINGS.COLLECTION_DISTANCE + playerRadius - SETTINGS.PLAYER_RADIUS;
      
      if (distance < adjustedCollectionDistance) {
        // Mark ball as collected locally to prevent repeated attempts
        ball.collected = true;
        
        // Optimistic collection: hide the ball immediately
        ball.mesh.visible = false;
        
        // Add to pending collections set for debounce
        pendingCollections.add(ballId);
        
        console.log(`Collecting ball ${ballId}, distance: ${distance}`);
        
        // Tell server this ball was collected
        socket.emit('collectBall', { ballId: ballId });
        
        // Set up a safety timeout to clear pending status after 5 seconds
        pendingCollectionTimeouts[ballId] = setTimeout(() => {
          // If server didn't respond, make ball visible again
          if (balls[ballId]) {
            balls[ballId].collected = false;
            balls[ballId].mesh.visible = true;
            console.log(`Ball collection timeout for ${ballId}, making visible again`);
          }
          pendingCollections.delete(ballId);
          delete pendingCollectionTimeouts[ballId];
        }, 5000);
      }
    }
  });
}

const nametagTextureCache = {};

// Create a nametag for a player
function createNametag(name) {
  // Check if we already have a texture for this name
  if (nametagTextureCache[name]) {
    // Use the cached texture
    const texture = nametagTextureCache[name];
    
    // Create sprite material with the cached texture
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    
    // Create sprite with the material
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 0.75, 1);
    
    // Create a group to hold the sprite
    const group = new THREE.Group();
    group.add(sprite);
    
    return group;
  }
  
  // If no cached texture exists, create a new one
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  
  // Fill with transparent background
  context.fillStyle = 'rgba(0, 0, 0, 0)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw text with outline and fill
  context.font = 'bold 42px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  context.strokeStyle = 'black';
  context.lineWidth = 5;
  context.strokeText(name, canvas.width / 2, canvas.height / 2);
  
  context.fillStyle = 'white';
  context.fillText(name, canvas.width / 2, canvas.height / 2);
  
  // Create and cache the texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  nametagTextureCache[name] = texture;
  
  // Create sprite material and sprite as before
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3, 0.75, 1);
  
  const group = new THREE.Group();
  group.add(sprite);
  
  return group;
}

// Update nametag orientations to face the camera
function updateNametagOrientations() {
  Object.values(players).forEach(player => {
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
  const lightness = 40 + Math.random() * 20;  // 40-60%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Initialize everything immediately since we're now loaded after menu handling
function initGame() {
  console.log('Initializing game with nickname:', playerNickname);
  try {
    // Create UI
    createUI();
    
    // Initialize scene
    initializeScene();
    
    // Create ground if not created already
    if (!scene.getObjectByName('ground')) {
      createGround(scene);
    }
    
    // Initialize controls
    initControls();
    
    // Connect to server
    connectToServer();
    
    // Start animation loop (ONLY PLACE this should be called)
    animate();
    
    console.log('Game initialized successfully');
  } catch (error) {
    console.error('Error initializing game:', error);
    alert('Error starting game: ' + error.message);
  }
}

initGame();

// Setup window resize handler
window.addEventListener('resize', () => {
  if (renderer && camera) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    console.log('Window resized to', width, 'x', height);
  }
});

// Update leaderboard
function updateLeaderboard() {
  // Ordena jogadores por pontuação
  leaderboardPlayers = Object.values(players).sort((a, b) => b.score - a.score);

  const leaderboardEntries = document.getElementById('leaderboard-entries');
  if (!leaderboardEntries) return;

  leaderboardEntries.innerHTML = '';

  // Apenas os 3 melhores
  const topPlayers = leaderboardPlayers.slice(0, 3);
  const medals = ['👑', '🥈', '🥉'];

  topPlayers.forEach((player, index) => {
    const entry = document.createElement('div');
    entry.className = 'leaderboard-entry';
    entry.style.margin = '6px 0';
    entry.style.display = 'flex';
    entry.style.justifyContent = 'space-between';
    entry.style.alignItems = 'center';
    entry.style.padding = '6px 10px';
    entry.style.borderRadius = '6px';
    entry.style.background = 'rgba(30, 30, 30, 0.6)';
    entry.style.fontFamily = `'Playfair Display', serif`;
    entry.style.fontSize = '1em';

    // Destaque pro jogador local
    if (player.id === localPlayerId) {
      entry.style.fontWeight = 'bold';
      entry.style.color = '#f9c80e';
      entry.style.background = 'rgba(255, 255, 0, 0.1)';
      entry.style.boxShadow = '0 0 8px rgba(255, 255, 0, 0.3)';
    }

    const nameSpan = document.createElement('span');
    nameSpan.innerHTML = `${medals[index]}: ${player.nickname}`;
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    nameSpan.style.whiteSpace = 'nowrap';
    nameSpan.style.maxWidth = '200px';

    const scoreSpan = document.createElement('span');
    scoreSpan.innerHTML = `💰 ${player.score}`;
    scoreSpan.style.marginLeft = '10px';
    scoreSpan.style.fontWeight = 'bold';

    entry.appendChild(nameSpan);
    entry.appendChild(scoreSpan);

    leaderboardEntries.appendChild(entry);
  });

  // Preenche espaço se tiver menos que 3
  for (let i = topPlayers.length; i < 3; i++) {
    const emptyEntry = document.createElement('div');
    emptyEntry.className = 'leaderboard-entry';
    emptyEntry.style.margin = '6px 0';
    emptyEntry.style.color = '#555';
    emptyEntry.style.fontStyle = 'italic';
    emptyEntry.style.textAlign = 'center';
    emptyEntry.innerHTML = `${medals[i]}: --- um trono vazio ---`;
    leaderboardEntries.appendChild(emptyEntry);
  }
}

function checkPlayerCollisions() {
  if (!players[localPlayerId] || !players[localPlayerId].mesh) return;
  
  const localPlayer = players[localPlayerId];
  const localPosition = localPlayer.mesh.position.clone();
  localPosition.y = 0; // Project onto the XZ plane for collision checking
  
  const localRadius = SETTINGS.PLAYER_RADIUS * (localPlayer.sizeMultiplier || 1.0);
  
  // Check collisions with other players
  Object.values(players).forEach(otherPlayer => {
    if (otherPlayer.id === localPlayerId || !otherPlayer.mesh) return;
    
    const otherPosition = otherPlayer.mesh.position.clone();
    otherPosition.y = 0; // Project onto the XZ plane
    
    const otherRadius = SETTINGS.PLAYER_RADIUS * (otherPlayer.sizeMultiplier || 1.0);
    
    // Calculate distance between players
    const distance = localPosition.distanceTo(otherPosition);
    const minDistance = localRadius + otherRadius;
    
    // If players are colliding, push them apart
    if (distance < minDistance) {
      // Calculate direction to push
      const pushDirection = localPosition.clone().sub(otherPosition).normalize();
      
      // Calculate push amount (half the overlap)
      const overlap = minDistance - distance;
      const pushAmount = overlap * 0.5;
      
      // Apply push to local player position
      localPlayer.mesh.position.add(
        pushDirection.multiplyScalar(pushAmount)
      );
      
      // Keep player within world bounds
      localPlayer.mesh.position.x = Math.max(-worldSize, Math.min(worldSize, localPlayer.mesh.position.x));
      localPlayer.mesh.position.z = Math.max(-worldSize, Math.min(worldSize, localPlayer.mesh.position.z));
      
      // Update camera position
      updateCameraPosition();
    }
  });
}