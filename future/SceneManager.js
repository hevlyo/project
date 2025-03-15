export class SceneManager {
    constructor(settingsManager) {
      this.settingsManager = settingsManager;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.worldSize = 50;
      this.initialize();
      this.setupResizeHandler();
    }
  
    initialize() {
      const settings = this.settingsManager.SETTINGS;
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(settings.SKY_COLOR, 0.01);
      this.camera = new THREE.PerspectiveCamera(
        settings.CAMERA_FOV,
        window.innerWidth / window.innerHeight,
        settings.CAMERA_NEAR,
        settings.CAMERA_FAR
      );
      this.camera.position.set(0, settings.CAMERA_HEIGHT, settings.CAMERA_DISTANCE);
      this.camera.lookAt(0, 0, 0);
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor(settings.SKY_COLOR);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      document.body.appendChild(this.renderer.domElement);
      this.setupLighting();
      this.createGround();
    }
  
    setupLighting() {
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(ambientLight);
  
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(50, 200, 100);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 500;
      directionalLight.shadow.camera.left = -100;
      directionalLight.shadow.camera.right = 100;
      directionalLight.shadow.camera.top = 100;
      directionalLight.shadow.camera.bottom = -100;
      this.scene.add(directionalLight);
    }
  
    createGround() {
      const textureLoader = new THREE.TextureLoader();
      const groundTexture = textureLoader.load("/assets/textures/grass.jpg");
      groundTexture.wrapS = THREE.RepeatWrapping;
      groundTexture.wrapT = THREE.RepeatWrapping;
      groundTexture.repeat.set(16, 16);
      groundTexture.anisotropy = 16;
  
      const groundMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: true,
      });
  
      const groundGeometry = new THREE.PlaneGeometry(this.worldSize * 2, this.worldSize * 2, 32, 32);
      const vertices = groundGeometry.attributes.position.array;
      for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 1] = Math.random() * 0.2;
      }
      groundGeometry.computeVertexNormals();
  
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.receiveShadow = true;
      groundMesh.name = "ground";
      this.scene.add(groundMesh);
  
      const gridHelper = new THREE.GridHelper(this.worldSize * 2, 20, 0x000000, 0x000000);
      gridHelper.position.y = 0.01;
      gridHelper.material.opacity = 0.1;
      gridHelper.material.transparent = true;
      this.scene.add(gridHelper);
    }
  
    updateWorldSize(size) {
      this.worldSize = size;
      const groundMesh = this.scene.getObjectByName("ground");
      if (groundMesh) {
        this.scene.remove(groundMesh);
        this.createGround();
      }
    }
  
    setupResizeHandler() {
      window.addEventListener("resize", () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        console.log("Window resized to", width, "x", height);
      });
    }
  
    updateCameraForPlayer(playerMesh, sizeMultiplier, baseHeight) {
      if (!playerMesh) return;
      
      const settings = this.settingsManager.SETTINGS;
      const adjustedCameraDistance = settings.CAMERA_DISTANCE * Math.max(1, sizeMultiplier * 0.8) * 1.5;
      const adjustedCameraHeight = settings.CAMERA_HEIGHT * Math.max(1, sizeMultiplier * 0.5) * 1.2;
      
      const cameraDirection = this.camera.getWorldDirection(new THREE.Vector3());
      this.camera.position.copy(playerMesh.position).sub(
        cameraDirection.multiplyScalar(adjustedCameraDistance)
      );
      
      this.camera.position.y = playerMesh.position.y + adjustedCameraHeight;
      this.camera.lookAt(playerMesh.position);
    }
  
    render() {
      if (this.scene && this.camera && this.renderer) {
        this.renderer.render(this.scene, this.camera);
      } else {
        console.error("Cannot render: scene, camera, or renderer is not defined", {
          scene: !!this.scene,
          camera: !!this.camera,
          renderer: !!this.renderer,
        });
      }
    }
  
    addToScene(object) {
      if (this.scene) {
        this.scene.add(object);
      }
    }
  
    removeFromScene(object) {
      if (this.scene) {
        this.scene.remove(object);
      }
    }
  
    createNametag(name) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = 512;
      canvas.height = 128;
      
      context.fillStyle = "rgba(0, 0, 0, 0)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      context.font = "bold 42px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      
      context.strokeStyle = "black";
      context.lineWidth = 5;
      context.strokeText(name, canvas.width / 2, canvas.height / 2);
      
      context.fillStyle = "white";
      context.fillText(name, canvas.width / 2, canvas.height / 2);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });
      
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(3, 0.75, 1);
      
      const group = new THREE.Group();
      group.add(sprite);
      
      return group;
    }
  
    updateNametagOrientations(players) {
      Object.values(players).forEach((player) => {
        if (player.nametagGroup) {
          player.nametagGroup.quaternion.copy(this.camera.quaternion);
        }
      });
    }
  
    getRandomColor() {
      const hue = Math.random() * 360;
      const saturation = 70 + Math.random() * 30;
      const lightness = 40 + Math.random() * 20;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
  }