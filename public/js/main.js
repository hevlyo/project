// Window onload handler
window.onload = function() {
  console.log('Window loaded - game initializing...');
  // onload(); // Call our onload function directly
};

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
  COLLECTION_DISTANCE: 2.5, // Increased from 1.5 to make balls easier to collect
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
  SKY_COLOR: 0x87CEEB,
  SIZE_INCREASE_PER_BALL: 0.05, // Size increase multiplier per ball collected
  MAX_SIZE_MULTIPLIER: 2.5, // Maximum size multiplier for players
  NAMETAG_OFFSET_Y: 2.2, // Height above player for nametag
  NAMETAG_SCALE: 0.01 // Scale of the nametag text
};

// Movement keys tracking
let keys = { forward: false, backward: false, left: false, right: false, sprint: false };

// UI elements
let scoreDisplay, topScoreDisplay, playerCountDisplay, messageDisplay;
let menuScreen, nicknameInput, playButton;
let playerNickname = sessionStorage.getItem('playerNickname') || 'Player';
console.log('Retrieved nickname from session storage:', playerNickname);

// Wait for the DOM to load completely
function onload() {
  console.log('DOM loaded, initializing game');
  
  // Get menu elements
  menuScreen = document.getElementById('menu-screen');
  nicknameInput = document.getElementById('nickname-input');
  playButton = document.getElementById('play-button');
  
  console.log('Menu elements:', { 
    menuScreen: !!menuScreen, 
    nicknameInput: !!nicknameInput, 
    playButton: !!playButton 
  });
  
  // Set a random fun placeholder
  setRandomNicknamePlaceholder();
  
  // Set up menu event listeners
  if (playButton) {
    // Add click event with direct function and logging
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
    
    // Start game when Enter key is pressed in the input field
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

// Set a random fun placeholder for the nickname input
function setRandomNicknamePlaceholder() {
  const funNames = [
    "Captain Awesome",
    "Ninja Collector",
    "Ball Hunter",
    "Sir Bouncy",
    "Speed Demon",
    "Orb Master",
    "Mighty Roller",
    "Galaxy Grabber",
    "Pixel Champion",
    "King Collector"
  ];
  
  // Choose a random name from the array
  const randomName = funNames[Math.floor(Math.random() * funNames.length)];
  nicknameInput.placeholder = randomName;
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
    
    // Ensure we have a valid nickname
    if (playerNickname.length < 2) {
      playerNickname = "Player" + Math.floor(Math.random() * 1000);
    }
    
    console.log(`Starting game with nickname: ${playerNickname}`);
    
    // Hide the menu screen
    if (menuScreen) {
      menuScreen.style.display = 'none';
      console.log('Menu screen hidden');
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
function createUI() {
  // Create score display
  scoreDisplay = document.createElement('div');
  scoreDisplay.id = 'score-display';
  scoreDisplay.className = 'game-ui';
  scoreDisplay.style.position = 'absolute';
  scoreDisplay.style.top = '10px';
  scoreDisplay.style.left = '10px';
  scoreDisplay.style.color = 'white';
  scoreDisplay.style.fontFamily = 'Arial, sans-serif';
  scoreDisplay.style.fontSize = '18px';
  scoreDisplay.style.padding = '5px 10px';
  scoreDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  scoreDisplay.style.borderRadius = '5px';
  scoreDisplay.innerHTML = 'Score: 0';
  document.body.appendChild(scoreDisplay);
  
  // Create top score display
  topScoreDisplay = document.createElement('div');
  topScoreDisplay.id = 'top-score-display';
  topScoreDisplay.className = 'game-ui';
  topScoreDisplay.style.position = 'absolute';
  topScoreDisplay.style.top = '10px';
  topScoreDisplay.style.right = '10px';
  topScoreDisplay.style.color = 'white';
  topScoreDisplay.style.fontFamily = 'Arial, sans-serif';
  topScoreDisplay.style.fontSize = '18px';
  topScoreDisplay.style.padding = '5px 10px';
  topScoreDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  topScoreDisplay.style.borderRadius = '5px';
  topScoreDisplay.innerHTML = 'Top Score: 0';
  document.body.appendChild(topScoreDisplay);
  
  // Create player count display
  playerCountDisplay = document.createElement('div');
  playerCountDisplay.id = 'player-count-display';
  playerCountDisplay.className = 'game-ui';
  playerCountDisplay.style.position = 'absolute';
  playerCountDisplay.style.bottom = '10px';
  playerCountDisplay.style.left = '10px';
  playerCountDisplay.style.color = 'white';
  playerCountDisplay.style.fontFamily = 'Arial, sans-serif';
  playerCountDisplay.style.fontSize = '16px';
  playerCountDisplay.style.padding = '5px 10px';
  playerCountDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  playerCountDisplay.style.borderRadius = '5px';
  playerCountDisplay.innerHTML = 'Players: 0';
  document.body.appendChild(playerCountDisplay);
  
  // Create message display
  messageDisplay = document.createElement('div');
  messageDisplay.id = 'message-display';
  messageDisplay.className = 'game-ui';
  messageDisplay.style.position = 'absolute';
  messageDisplay.style.top = '50%';
  messageDisplay.style.left = '50%';
  messageDisplay.style.transform = 'translate(-50%, -50%)';
  messageDisplay.style.color = 'white';
  messageDisplay.style.fontFamily = 'Arial, sans-serif';
  messageDisplay.style.fontSize = '24px';
  messageDisplay.style.padding = '10px 20px';
  messageDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  messageDisplay.style.borderRadius = '5px';
  messageDisplay.style.display = 'none';
  document.body.appendChild(messageDisplay);
}

// Function to show a message to the player
function showMessage(message, duration = 3000) {
  if (!messageDisplay) return;
  
  messageDisplay.innerHTML = message;
  messageDisplay.style.display = 'block';
  
  if (duration > 0) {
    setTimeout(() => {
      messageDisplay.style.display = 'none';
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
    SETTINGS.CAMERA_FAR
  );
  camera.position.set(0, SETTINGS.CAMERA_HEIGHT, SETTINGS.CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);
  
  // Create a renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(SETTINGS.SKY_COLOR);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  
  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 200, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
  
  // Create the ground
  createGround(scene);
  
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
    
    // Set up game event handlers
    setupGameEventHandlers();
    
    // Join the game with the selected nickname
    socket.emit('joinGame', { nickname: playerNickname });
  } catch (error) {
    console.error('Error connecting to server:', error);
  }
}

// Set up socket event handlers
function setupSocketHandlers() {
  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    localPlayerId = socket.id;
    showMessage('Connected to game server!', 3000);
    gameActive = true;
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showMessage('Disconnected from server. Trying to reconnect...', 0);
    gameActive = false;
  });
  
  socket.on('reconnect', () => {
    console.log('Reconnected to server');
    showMessage('Reconnected to server!', 3000);
    gameActive = true;
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
  });
  
  // Set up other event handlers
  setupGameEventHandlers();
}

// Set up game-related event handlers
function setupGameEventHandlers() {
  // Handle player info
  socket.on('playerInfo', (playerData) => {
    console.log('Player info received:', playerData);
    
    // If this is our player and we don't have it yet, create it
    if (playerData.id === localPlayerId && !players[localPlayerId]) {
      console.log('Creating local player mesh');
      addPlayer(playerData);
      showMessage(`Bem-vinde jogadore ${playerData.nickname}!`, 3000);
    }
  });
  
  // Handle new balls
  socket.on('newBalls', (serverBalls) => {
    console.log('Received new balls:', serverBalls);
    
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
      showMessage(`Player ${playerData.id.substring(0, 4)}... joined!`, 2000);
    }
    
    // Update player count
    updatePlayerCount();
  });
  
  // Handle player disconnection
  socket.on('playerDisconnected', (playerId) => {
    console.log('Player disconnected:', playerId);
    removePlayer(playerId);
    updatePlayerCount();
  });
  
  // Handle ball collection
  socket.on('ballCollected', (data) => {
    console.log('Ball collected:', data);
    
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
      topScoreDisplay.innerHTML = `Top Score: ${topScore}`;
    }
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
      topScoreDisplay.innerHTML = `Top Score: ${topScore}`;
    }
  });
  
  // Handle player count updates
  socket.on('playerCount', (count) => {
    updatePlayerCount(count);
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
  
  // Use player color from server or generate a random one
  const playerMaterial = new THREE.MeshPhongMaterial({
    color: playerInfo.color || getRandomColor(),
    shininess: 30
  });
  
  // Create player mesh
  const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
  
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
  nametagGroup.position.set(0, SETTINGS.NAMETAG_OFFSET_Y, 0);
  playerMesh.add(nametagGroup);
  
  // Store player mesh with ID
  players[playerInfo.id] = {
    mesh: playerMesh,
    id: playerInfo.id,
    nickname: nickname,
    score: playerInfo.score || 0,
    color: playerMaterial.color.getHex(),
    sizeMultiplier: playerInfo.sizeMultiplier || 1.0, // Store size multiplier
    nametagGroup: nametagGroup
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
    scene.remove(players[playerId].mesh);
    delete players[playerId];
    
    // Also clean up any interpolation data
    if (interpolationData[playerId]) {
      delete interpolationData[playerId];
    }
  }
}

// Create the ground
function createGround(scene) {
  // Create ground geometry and material
  const groundGeometry = new THREE.PlaneGeometry(worldSize * 2, worldSize * 2, 32, 32);
  const groundMaterial = new THREE.MeshPhongMaterial({
    color: 0x1E8449,
    shininess: 0,
    flatShading: true
  });
  
  // Create ground mesh
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  
  // Rotate ground to be horizontal
  groundMesh.rotation.x = -Math.PI / 2;
  
  // Add ground to scene
  scene.add(groundMesh);
  
  // Create grid helper
  const gridHelper = new THREE.GridHelper(worldSize * 2, 20, 0x000000, 0x000000);
  gridHelper.position.y = 0.01; // Slightly above ground to avoid z-fighting
  scene.add(gridHelper);
}

// Function to add a ball to the scene
function addBall(ballInfo) {
  // If ball already exists, just update it
  if (balls[ballInfo.id]) {
    // Update existing ball position
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
  
  const ballMaterial = new THREE.MeshPhongMaterial({
    color: 0xFFD700, // Gold color
    shininess: 100,
    emissive: 0x333300,
    emissiveIntensity: 0.2
  });
  
  // Create ball mesh
  const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
  
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
    value: ballInfo.value || SETTINGS.BALL_VALUE
  };
  
  // Add to scene
  scene.add(ballMesh);
}

// Remove a ball from the scene
function removeBall(ballId) {
  if (balls[ballId]) {
    scene.remove(balls[ballId].mesh);
    delete balls[ballId];
  }
}

// Update camera position relative to player
function updateCameraPosition() {
  if (!players[localPlayerId]) return;
  
  const playerMesh = players[localPlayerId].mesh;
  const sizeMultiplier = players[localPlayerId].sizeMultiplier || 1.0;
  
  // Adjust camera distance based on player size
  const adjustedCameraDistance = SETTINGS.CAMERA_DISTANCE * Math.max(1, sizeMultiplier * 0.8);
  const adjustedCameraHeight = SETTINGS.CAMERA_HEIGHT * Math.max(1, sizeMultiplier * 0.5);
  
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
  
  // Log the first few frames for debugging
  if (!window.frameCount) {
    window.frameCount = 0;
  }
  if (window.frameCount < 10) {
    console.log(`Animation frame ${window.frameCount}, gameActive: ${gameActive}`);
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
    console.log('Rendering scene');
    renderer.render(scene, camera);
  } else {
    console.error('Cannot render: scene, camera, or renderer is not defined', {
      scene: !!scene,
      camera: !!camera,
      renderer: !!renderer
    });
  }
  
  // Update nametag orientation to face camera
  updateNametagOrientations();
}

// Update player movement based on keys
function updatePlayerMovement() {
  if (!players[localPlayerId]) return;
  
  // Apply movement based on which keys are pressed
  const moveSpeed = keys.sprint ? SETTINGS.MOVE_SPEED * SETTINGS.SPRINT_MULTIPLIER : SETTINGS.MOVE_SPEED;
  const playerMesh = players[localPlayerId].mesh;
  const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
  
  // Normalize the direction for consistent movement speed
  cameraDirection.y = 0; // Keep movement on the xz plane
  cameraDirection.normalize();
  
  // Calculate forward/backward movement vector (based on camera direction)
  const forwardVector = cameraDirection.clone();
  
  // Calculate left/right movement vector (perpendicular to camera direction)
  const rightVector = new THREE.Vector3().crossVectors(
    cameraDirection,
    new THREE.Vector3(0, 1, 0)
  ).normalize();
  
  // Apply movement based on which keys are pressed
  let movementVector = new THREE.Vector3(0, 0, 0);
  
  if (keys.forward) movementVector.add(forwardVector);
  if (keys.backward) movementVector.sub(forwardVector);
  if (keys.left) movementVector.sub(rightVector); 
  if (keys.right) movementVector.add(rightVector); 
  
  // Only normalize and apply movement if we're actually moving
  if (movementVector.length() > 0) {
    movementVector.normalize();
    movementVector.multiplyScalar(moveSpeed);
    
    // Update player position
    playerMesh.position.x += movementVector.x;
    playerMesh.position.z += movementVector.z;
    
    // Keep player within world bounds
    playerMesh.position.x = Math.max(-worldSize, Math.min(worldSize, playerMesh.position.x));
    playerMesh.position.z = Math.max(-worldSize, Math.min(worldSize, playerMesh.position.z));
    
    // Update camera position relative to player
    updateCameraPosition();
    
    // Send position update to server
    socket.emit('playerMovement', {
      position: {
        x: playerMesh.position.x,
        y: playerMesh.position.y - SETTINGS.PLAYER_HEIGHT, // Adjust for the offset
        z: playerMesh.position.z
      }
    });
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
function checkBallCollisions() {
  if (!players[localPlayerId]) return;
  
  const playerPosition = players[localPlayerId].mesh.position.clone();
  playerPosition.y = 0; // Ignore height difference when checking collision
  
  Object.keys(balls).forEach(ballId => {
    const ball = balls[ballId];
    if (ball && ball.mesh && !ball.collected) {
      const ballPosition = ball.mesh.position.clone();
      ballPosition.y = 0; // Ignore height difference when checking collision
      const distance = playerPosition.distanceTo(ballPosition);
      
      if (distance < SETTINGS.COLLECTION_DISTANCE) {
        // Mark ball as collected to prevent duplicate collection
        ball.collected = true;
        
        console.log(`Collecting ball ${ballId}, distance: ${distance}`);
        
        // Tell the server this ball was collected
        socket.emit('collectBall', { ballId: ballId });
      }
    }
  });
}

// Create a nametag for a player
function createNametag(name) {
  // Create a canvas for the nametag
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  
  // Fill with transparent background
  context.fillStyle = 'rgba(0, 0, 0, 0)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw text
  context.font = 'bold 36px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  // Draw text outline
  context.strokeStyle = 'black';
  context.lineWidth = 4;
  context.strokeText(name, canvas.width / 2, canvas.height / 2);
  
  // Draw text fill
  context.fillStyle = 'white';
  context.fillText(name, canvas.width / 2, canvas.height / 2);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Create a sprite material with the texture
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true
  });
  
  // Create sprite with the material
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2, 0.5, 1);
  
  // Create a group to hold the sprite (for easier positioning)
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
    
    // Start animation loop
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
