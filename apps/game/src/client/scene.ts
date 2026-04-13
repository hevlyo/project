import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SETTINGS } from "./config.js";
import {
	createArenaPatchTexture,
	createBrassBandTexture,
	createDetailBumpTexture,
	createPillarColorTexture,
	createSkyTexture,
	createStoneTexture,
	createTextTexture,
	disposeMaterial,
} from "./sceneTextures.js";

export class SceneController {
	// Scene state is intentionally dynamic; these declarations keep TypeScript
	// aware of the fields without over-modeling the Three.js object graphs.
	container: HTMLElement;
	worldSize: number;
	scene: THREE.Scene | null;
	camera: THREE.PerspectiveCamera | null;
	renderer: THREE.WebGLRenderer | null;
	floor: THREE.Mesh | null;
	innerDisk: THREE.Mesh | null;
	brassRing: THREE.Mesh | null;
	boundaryRing: THREE.Mesh | null;
	posts: THREE.Mesh[];
	skyDome: THREE.Mesh | null;
	arenaDecorGroup: THREE.Group | null;
	arenaAssetGroup: THREE.Group | null;
	arenaAssetRoots: any[];
	arenaDecorations: any[];
	playerMeshes: Map<string, any>;
	ballMeshes: Map<string, any>;
	projectileMeshes: Map<string, any>;
	projectileTrails: any[];
	pickupBursts: any[];
	valuePopups: any[];
	valuePopupLayer: HTMLDivElement | null;
	valuePopupProjectPoint: THREE.Vector3;
	cameraLookTarget: THREE.Vector3;
	cameraTrackedPlayerId: string | null;
	cameraCurrentFov: number;
	cameraCurrentDistance: number;
	cameraCurrentHeight: number;
	cameraCurrentLookHeight: number;
	cameraPickupDistanceBoost: number;
	cameraPickupHeightBoost: number;
	cameraPickupFovBoost: number;
	cameraPickupDistanceBoostTarget: number;
	cameraPickupHeightBoostTarget: number;
	cameraPickupFovBoostTarget: number;
	cameraDesiredPosition: THREE.Vector3;
	cameraDesiredLookAt: THREE.Vector3;
	cameraForward: THREE.Vector3;
	idleCameraPosition: THREE.Vector3;
	idleCameraLookAt: THREE.Vector3;
	freeCameraMode: boolean;
	freeCameraYaw: number;
	freeCameraPitch: number;
	freeCameraTarget: THREE.Vector3;
	freeCameraForward: THREE.Vector3;
	freeCameraRight: THREE.Vector3;
	freeCameraMovement: THREE.Vector3;
	ambientLight: THREE.AmbientLight | null;
	hemiLight: THREE.HemisphereLight | null;
	directionalLight: THREE.DirectionalLight | null;
	isNightMode: boolean;
	fireballTexture: THREE.Texture | null;

	constructor({ container, worldSize }) {
		this.container = container;
		this.worldSize = worldSize;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.floor = null;
		this.innerDisk = null;
		this.brassRing = null;
		this.boundaryRing = null;
		this.posts = [];
		this.skyDome = null;
		this.arenaDecorGroup = null;
		this.arenaAssetGroup = null;
		this.arenaAssetRoots = [];
		this.playerMeshes = new Map();
		this.ballMeshes = new Map();
		this.projectileMeshes = new Map();
		this.projectileTrails = [];
		this.pickupBursts = [];
		this.valuePopups = [];
		this.valuePopupLayer = null;
		this.valuePopupProjectPoint = new THREE.Vector3();
		this.cameraLookTarget = new THREE.Vector3(0, 1.2, 0);
		this.cameraTrackedPlayerId = null;
		this.cameraCurrentFov = SETTINGS.cameraBaseFov;
		this.cameraCurrentDistance = SETTINGS.cameraDistance;
		this.cameraCurrentHeight = SETTINGS.cameraHeight;
		this.cameraCurrentLookHeight = SETTINGS.cameraLookHeight;
		this.cameraPickupDistanceBoost = 0;
		this.cameraPickupHeightBoost = 0;
		this.cameraPickupFovBoost = 0;
		this.cameraPickupDistanceBoostTarget = 0;
		this.cameraPickupHeightBoostTarget = 0;
		this.cameraPickupFovBoostTarget = 0;
		this.cameraDesiredPosition = new THREE.Vector3();
		this.cameraDesiredLookAt = new THREE.Vector3();
		this.cameraForward = new THREE.Vector3();
		this.idleCameraPosition = new THREE.Vector3();
		this.idleCameraLookAt = new THREE.Vector3(0, 1.8, 0);
		this.freeCameraMode = false;
		this.freeCameraYaw = 0;
		this.freeCameraPitch = -0.22;
		this.freeCameraTarget = new THREE.Vector3();
		this.freeCameraForward = new THREE.Vector3();
		this.freeCameraRight = new THREE.Vector3();
		this.freeCameraMovement = new THREE.Vector3();
		this.fireballTexture = null;
	}

	init() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x8f_b8_bf);
		this.scene.fog = new THREE.Fog(
			0x8f_b8_bf,
			this.worldSize * 0.9,
			this.worldSize * 3.1,
		);

		this.camera = new THREE.PerspectiveCamera(
			SETTINGS.cameraBaseFov,
			1,
			0.1,
			500,
		);
		this.camera.position.set(0, SETTINGS.cameraHeight, SETTINGS.cameraDistance);

		this.renderer = new THREE.WebGLRenderer({
			antialias: SETTINGS.renderAntialias,
			powerPreference: SETTINGS.renderPowerPreference,
		});
		this.renderer.setPixelRatio(
			Math.min(window.devicePixelRatio || 1, SETTINGS.renderPixelRatioCap),
		);
		this.renderer.shadowMap.enabled = SETTINGS.renderShadows;
		if (SETTINGS.renderShadows) {
			this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		}

		this.container.append(this.renderer.domElement);
		this.ensureValuePopupLayer();

		// Chamar resize ANTES de criar luzes e arena para garantir que o renderer tem tamanho válido
		this.resize();

		this.createLights();
		this.createArena();
		void this.loadArenaAssets();

		this.fireballTexture = new THREE.TextureLoader().load(
			"/assets/textures/fireball.png",
		);
		this.fireballTexture.colorSpace = THREE.SRGBColorSpace;
	}

	ensureValuePopupLayer() {
		if (this.valuePopupLayer) {
			return;
		}

		const layer = document.createElement("div");
		layer.className = "floating-value-layer";
		this.container.append(layer);
		this.valuePopupLayer = layer;
	}

	createLights() {
		this.ambientLight = new THREE.AmbientLight(0xff_f4_d7, 0.34);
		this.scene.add(this.ambientLight);

		this.hemiLight = new THREE.HemisphereLight(0xf7_e8_c5, 0x0f_2a_32, 1.15);
		this.scene.add(this.hemiLight);

		this.directionalLight = new THREE.DirectionalLight(0xff_f0_be, 1.55);
		this.directionalLight.position.set(18, 28, 12);
		this.directionalLight.castShadow = SETTINGS.renderShadows;
		if (SETTINGS.renderShadows) {
			this.directionalLight.shadow.mapSize.width = SETTINGS.renderShadowMapSize;
			this.directionalLight.shadow.mapSize.height =
				SETTINGS.renderShadowMapSize;
			this.directionalLight.shadow.camera.left = -80;
			this.directionalLight.shadow.camera.right = 80;
			this.directionalLight.shadow.camera.top = 80;
			this.directionalLight.shadow.camera.bottom = -80;
			this.directionalLight.shadow.camera.far = 120;
		}

		this.scene.add(this.directionalLight);

		const rim = new THREE.PointLight(0x7b_df_f2, 12, 100, 2);
		rim.position.set(-24, 12, -18);
		this.scene.add(rim);
	}

	setNightMode(isNight) {
		this.isNightMode = isNight;
		if (isNight) {
			this.scene.background.setHex(0x1a_1a_2e);
			this.scene.fog.color.setHex(0x1a_1a_2e);
			if (this.skyDome) {
				this.skyDome.material.color.setHex(0x22_22_33);
			}

			if (this.ambientLight) {
				this.ambientLight.intensity = 0.1;
			}

			if (this.hemiLight) {
				this.hemiLight.intensity = 0.3;
				this.hemiLight.color.setHex(0x40_55_80);
				this.hemiLight.groundColor.setHex(0x08_10_16);
			}

			if (this.directionalLight) {
				this.directionalLight.intensity = 0.25;
				this.directionalLight.color.setHex(0x8a_a8_d4);
			}
		} else {
			this.scene.background.setHex(0x8f_b8_bf);
			this.scene.fog.color.setHex(0x8f_b8_bf);
			if (this.skyDome) {
				this.skyDome.material.color.setHex(0xff_ff_ff);
			}

			if (this.ambientLight) {
				this.ambientLight.intensity = 0.34;
			}

			if (this.hemiLight) {
				this.hemiLight.intensity = 1.15;
				this.hemiLight.color.setHex(0xf7_e8_c5);
				this.hemiLight.groundColor.setHex(0x0f_2a_32);
			}

			if (this.directionalLight) {
				this.directionalLight.intensity = 1.55;
				this.directionalLight.color.setHex(0xff_f0_be);
			}
		}
	}

	createArena() {
		const maxAnisotropy = Math.min(
			8,
			this.renderer?.capabilities?.getMaxAnisotropy?.() || 1,
		);
		const grassMap = new THREE.TextureLoader().load(
			"/assets/textures/grass.jpg",
		);
		grassMap.colorSpace = THREE.SRGBColorSpace;
		grassMap.wrapS = THREE.RepeatWrapping;
		grassMap.wrapT = THREE.RepeatWrapping;
		grassMap.repeat.set(14, 14);
		grassMap.anisotropy = maxAnisotropy;

		const innerGrassMap = grassMap.clone();
		innerGrassMap.repeat.set(9, 9);
		innerGrassMap.offset.set(0.18, 0.23);
		innerGrassMap.needsUpdate = true;
		innerGrassMap.anisotropy = maxAnisotropy;

		const floorDetailMap = createDetailBumpTexture();
		floorDetailMap.wrapS = THREE.RepeatWrapping;
		floorDetailMap.wrapT = THREE.RepeatWrapping;
		floorDetailMap.repeat.set(32, 32);
		floorDetailMap.anisotropy = maxAnisotropy;

		const innerDetailMap = createDetailBumpTexture();
		innerDetailMap.wrapS = THREE.RepeatWrapping;
		innerDetailMap.wrapT = THREE.RepeatWrapping;
		innerDetailMap.repeat.set(22, 22);
		innerDetailMap.anisotropy = maxAnisotropy;

		const brassBandMap = createBrassBandTexture();
		brassBandMap.wrapS = THREE.RepeatWrapping;
		brassBandMap.wrapT = THREE.RepeatWrapping;
		brassBandMap.repeat.set(9, 1);
		brassBandMap.anisotropy = maxAnisotropy;

		const brassDetailMap = createDetailBumpTexture();
		brassDetailMap.wrapS = THREE.RepeatWrapping;
		brassDetailMap.wrapT = THREE.RepeatWrapping;
		brassDetailMap.repeat.set(30, 4);
		brassDetailMap.anisotropy = maxAnisotropy;

		const pillarMap = createPillarColorTexture();
		pillarMap.wrapS = THREE.RepeatWrapping;
		pillarMap.wrapT = THREE.RepeatWrapping;
		pillarMap.repeat.set(2.2, 1);
		pillarMap.anisotropy = maxAnisotropy;

		const pillarDetailMap = createDetailBumpTexture();
		pillarDetailMap.wrapS = THREE.RepeatWrapping;
		pillarDetailMap.wrapT = THREE.RepeatWrapping;
		pillarDetailMap.repeat.set(8, 4);
		pillarDetailMap.anisotropy = maxAnisotropy;

		const skyTexture = createSkyTexture();
		skyTexture.colorSpace = THREE.SRGBColorSpace;
		skyTexture.wrapS = THREE.RepeatWrapping;
		skyTexture.wrapT = THREE.ClampToEdgeWrapping;
		skyTexture.repeat.set(1, 1);

		const patchTexture = createArenaPatchTexture();
		patchTexture.colorSpace = THREE.SRGBColorSpace;
		patchTexture.wrapS = THREE.RepeatWrapping;
		patchTexture.wrapT = THREE.RepeatWrapping;
		patchTexture.anisotropy = maxAnisotropy;

		const stoneTexture = createStoneTexture();
		stoneTexture.wrapS = THREE.RepeatWrapping;
		stoneTexture.wrapT = THREE.RepeatWrapping;
		stoneTexture.repeat.set(1.1, 1);
		stoneTexture.anisotropy = maxAnisotropy;

		this.skyDome = new THREE.Mesh(
			new THREE.SphereGeometry(250, 40, 24),
			new THREE.MeshBasicMaterial({
				map: skyTexture,
				side: THREE.BackSide,
			}),
		);
		this.scene.add(this.skyDome);

		this.arenaDecorGroup = new THREE.Group();
		this.scene.add(this.arenaDecorGroup);

		this.arenaAssetGroup = new THREE.Group();
		this.scene.add(this.arenaAssetGroup);

		this.floor = new THREE.Mesh(
			new THREE.CircleGeometry(50, 72),
			new THREE.MeshStandardMaterial({
				color: 0xcf_e8_cf,
				map: grassMap,
				bumpMap: floorDetailMap,
				bumpScale: 0.3,
				roughness: 0.92,
				metalness: 0.03,
			}),
		);
		this.floor.rotation.x = -Math.PI / 2;
		this.floor.receiveShadow = true;
		this.scene.add(this.floor);

		this.innerDisk = new THREE.Mesh(
			new THREE.CircleGeometry(41, 72),
			new THREE.MeshStandardMaterial({
				color: 0xb8_dd_b8,
				map: innerGrassMap,
				bumpMap: innerDetailMap,
				bumpScale: 0.2,
				roughness: 0.86,
				metalness: 0.04,
			}),
		);
		this.innerDisk.rotation.x = -Math.PI / 2;
		this.innerDisk.position.y = 0.01;
		this.innerDisk.receiveShadow = true;
		this.scene.add(this.innerDisk);

		this.brassRing = new THREE.Mesh(
			new THREE.RingGeometry(32, 38, 64),
			new THREE.MeshBasicMaterial({
				color: 0xe7_b5_44,
				opacity: 0.3,
				transparent: true,
				side: THREE.DoubleSide,
			}),
		);
		this.brassRing.rotation.x = -Math.PI / 2;
		this.brassRing.position.y = 0.02;
		this.scene.add(this.brassRing);

		this.boundaryRing = new THREE.Mesh(
			new THREE.TorusGeometry(50, 0.45, 14, 120),
			new THREE.MeshStandardMaterial({
				color: 0xf5_d2_77,
				map: brassBandMap,
				bumpMap: brassDetailMap,
				bumpScale: 0.1,
				roughness: 0.26,
				metalness: 0.76,
				emissive: 0x8d_5d_00,
				emissiveIntensity: 0.26,
			}),
		);
		this.boundaryRing.rotation.x = Math.PI / 2;
		this.boundaryRing.position.y = 0.36;
		this.boundaryRing.receiveShadow = true;
		this.boundaryRing.castShadow = true;
		this.scene.add(this.boundaryRing);

		for (let index = 0; index < SETTINGS.arenaPostCount; index += 1) {
			const pillar = new THREE.Mesh(
				new THREE.CylinderGeometry(0.45, 0.65, 4.8, 14),
				new THREE.MeshStandardMaterial({
					color: 0xb0_8f_72,
					map: pillarMap,
					bumpMap: pillarDetailMap,
					bumpScale: 0.22,
					roughness: 0.72,
					metalness: 0.14,
				}),
			);
			pillar.castShadow = true;
			pillar.receiveShadow = true;
			this.scene.add(pillar);
			this.posts.push(pillar);
		}

		this.arenaDecorations = [];
		for (let index = 0; index < 8; index += 1) {
			const angle = (Math.PI * 2 * index) / 8;
			const monolith = new THREE.Group();

			const pedestal = new THREE.Mesh(
				new THREE.CylinderGeometry(0.85, 1.1, 1.15, 10),
				new THREE.MeshStandardMaterial({
					color: 0x4c_57_59,
					map: stoneTexture,
					roughness: 0.84,
					metalness: 0.06,
				}),
			);
			pedestal.castShadow = true;
			pedestal.receiveShadow = true;
			monolith.add(pedestal);

			const spire = new THREE.Mesh(
				new THREE.CylinderGeometry(0.48, 0.74, 3.9, 10),
				new THREE.MeshStandardMaterial({
					color: 0x66_73_76,
					map: stoneTexture.clone(),
					roughness: 0.8,
					metalness: 0.08,
				}),
			);
			spire.position.y = 2.52;
			spire.castShadow = true;
			spire.receiveShadow = true;
			monolith.add(spire);

			const cap = new THREE.Mesh(
				new THREE.SphereGeometry(0.36, 14, 14),
				new THREE.MeshBasicMaterial({
					color: index % 2 === 0 ? 0x7b_df_f2 : 0xff_d1_66,
					transparent: true,
					opacity: 0.82,
				}),
			);
			cap.position.y = 4.75;
			monolith.add(cap);

			const band = new THREE.Mesh(
				new THREE.TorusGeometry(0.86, 0.06, 8, 24),
				new THREE.MeshBasicMaterial({
					color: index % 2 === 0 ? 0x7b_df_f2 : 0xff_d1_66,
					transparent: true,
					opacity: 0.24,
					side: THREE.DoubleSide,
				}),
			);
			band.rotation.x = Math.PI / 2;
			band.position.y = 2.12;
			monolith.add(band);

			monolith.userData = {
				angle,
				radius: 50 * SETTINGS.arenaMonolithRingScale,
				baseY: 0.15,
				bobPhase: Math.random() * Math.PI * 2,
			};
			this.arenaDecorGroup.add(monolith);
			this.arenaDecorations.push(monolith);
		}

		for (let index = 0; index < 12; index += 1) {
			const patch = new THREE.Mesh(
				new THREE.PlaneGeometry(
					8 + Math.random() * 4,
					4.8 + Math.random() * 2.6,
					1,
					1,
				),
				new THREE.MeshBasicMaterial({
					map: patchTexture.clone(),
					transparent: true,
					opacity: 0.82,
					depthWrite: false,
					side: THREE.DoubleSide,
				}),
			);
			patch.rotation.x = -Math.PI / 2;
			patch.rotation.z = Math.random() * Math.PI;
			patch.position.set(
				Math.cos((Math.PI * 2 * index) / 12) * (13 + Math.random() * 18),
				0.03,
				Math.sin((Math.PI * 2 * index) / 12) * (13 + Math.random() * 18),
			);
			patch.userData = {
				pulsePhase: Math.random() * Math.PI * 2,
			};
			this.arenaDecorGroup.add(patch);
			this.arenaDecorations.push(patch);
		}

		this.layoutArenaDecor();
	}

	async loadArenaAssets() {
		const loader = new GLTFLoader();
		const assetDefinitions = [
			{
				url: "/assets/models/lantern.glb",
				count: SETTINGS.arenaLanternCount,
				ringScale: SETTINGS.arenaLanternRingScale,
				scale: 0.68,
				y: 0.03,
				yOffset: 0.02,
				yRotationOffset: Math.PI,
				phaseOffset: 0,
			},
			{
				url: "/assets/models/diffuse-transmission-plant.glb",
				count: SETTINGS.arenaPlantCount,
				ringScale: SETTINGS.arenaPlantRingScale,
				scale: 0.52,
				y: 0.02,
				yOffset: 0.05,
				yRotationOffset: Math.PI / 2,
				phaseOffset: Math.PI / 7,
			},
		];

		const loadedAssets = await Promise.all(
			assetDefinitions.map(async (definition) => {
				try {
					const gltf = await loader.loadAsync(definition.url);
					return { definition, root: gltf.scene || gltf.scenes?.[0] || null };
				} catch (error) {
					console.warn("Failed to load arena asset", definition.url, error);
					return { definition, root: null };
				}
			}),
		);

		if (!this.arenaAssetGroup || !this.scene) {
			return;
		}

		for (const { definition, root } of loadedAssets) {
			if (!root) {
				continue;
			}

			root.traverse((node) => {
				if (node.isMesh) {
					node.castShadow = true;
					node.receiveShadow = true;
					const materials = Array.isArray(node.material)
						? node.material
						: [node.material];
					for (const material of materials) {
						if (!material) {
							continue;
						}

						material.roughness = Math.min(0.95, material.roughness ?? 0.8);
						material.metalness = Math.max(
							0,
							Math.min(0.2, material.metalness ?? 0),
						);
					}
				}
			});

			for (let index = 0; index < definition.count; index += 1) {
				const angle = (Math.PI * 2 * index) / definition.count;
				const instance = root.clone(true);
				instance.userData = {
					angle,
					radiusScale: definition.ringScale,
					baseY: definition.y,
					bobPhase: definition.phaseOffset + Math.random() * Math.PI * 2,
					rotationOffset: definition.yRotationOffset,
					yOffset: definition.yOffset,
				};
				instance.scale.setScalar(definition.scale);
				this.arenaAssetGroup.add(instance);
				this.arenaAssetRoots.push(instance);
			}
		}

		this.layoutArenaDecor();
	}

	layoutArenaDecor(simulationTimeMs = 0) {
		const scale = this.worldSize / 50;
		const postRadius = this.worldSize * SETTINGS.arenaPostRingScale;

		this.floor.scale.setScalar(scale);
		this.innerDisk.scale.setScalar(scale);
		this.brassRing.scale.setScalar(scale);
		this.boundaryRing.scale.setScalar(scale);
		if (this.skyDome) {
			this.skyDome.scale.setScalar(scale);
		}

		if (this.arenaDecorGroup) {
			this.arenaDecorGroup.scale.setScalar(scale);
		}

		for (const [index, post] of this.posts.entries()) {
			const angle = (Math.PI * 2 * index) / this.posts.length;
			post.position.set(
				Math.cos(angle) * postRadius,
				2.35,
				Math.sin(angle) * postRadius,
			);
			post.rotation.y = -angle;
		}

		if (this.arenaDecorations?.length) {
			for (const decor of this.arenaDecorations) {
				if (!decor.userData) {
					continue;
				}

				if (decor.geometry?.type === "PlaneGeometry") {
					continue;
				}

				const { angle, radius, baseY } = decor.userData;
				decor.position.set(
					Math.cos(angle) * radius,
					baseY,
					Math.sin(angle) * radius,
				);
				decor.rotation.y = -angle + Math.PI / 2;
			}
		}

		if (this.arenaAssetRoots?.length) {
			for (const asset of this.arenaAssetRoots) {
				const {
					angle,
					radiusScale,
					baseY,
					rotationOffset = 0,
					yOffset = 0,
					bobPhase = 0,
				} = asset.userData || {};
				if (!Number.isFinite(angle) || !Number.isFinite(radiusScale)) {
					continue;
				}

				const radius = this.worldSize * radiusScale;
				const bob = Math.sin(simulationTimeMs * 0.001 + bobPhase) * 0.08;
				asset.position.set(
					Math.cos(angle) * radius,
					baseY + yOffset + bob,
					Math.sin(angle) * radius,
				);
				asset.rotation.y = -angle + rotationOffset;
			}
		}
	}

	setWorldSize(worldSize) {
		this.worldSize = worldSize;
		this.scene.fog.far = this.worldSize * 2.8;
		this.layoutArenaDecor();
	}

	resize() {
		const width = this.container.clientWidth || window.innerWidth;
		const height = this.container.clientHeight || window.innerHeight;
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}

	createPlayerMesh(player, isLocal) {
		const group = new THREE.Group();

		const avatar = new THREE.Group();
		group.add(avatar);

		const baseColor = new THREE.Color(player.color);
		const bodyColor = baseColor.clone().offsetHSL(0, -0.05, -0.05);
		const capColor = baseColor.clone().offsetHSL(0, 0.02, 0.06);
		const accentColor = baseColor.clone().offsetHSL(0.02, -0.12, -0.18);
		const bellyColor = baseColor
			.clone()
			.lerp(new THREE.Color(0xf9_f1_da), 0.52);

		const bodyMaterial = new THREE.MeshStandardMaterial({
			color: bodyColor,
			roughness: 0.36,
			metalness: 0.08,
			emissive: bodyColor.clone().multiplyScalar(0.06),
		});

		const capMaterial = new THREE.MeshStandardMaterial({
			color: capColor,
			roughness: 0.26,
			metalness: 0.1,
			emissive: capColor.clone().multiplyScalar(0.05),
		});

		const body = new THREE.Mesh(
			new THREE.CylinderGeometry(0.62, 0.72, 1.8, 24),
			bodyMaterial,
		);
		body.castShadow = true;
		body.receiveShadow = true;
		avatar.add(body);

		const cap = new THREE.Mesh(
			new THREE.SphereGeometry(0.58, 20, 20),
			capMaterial,
		);
		cap.position.y = 0.95;
		cap.castShadow = true;
		cap.receiveShadow = true;
		avatar.add(cap);

		const belly = new THREE.Mesh(
			new THREE.SphereGeometry(0.42, 16, 16),
			new THREE.MeshStandardMaterial({
				color: bellyColor,
				roughness: 0.48,
				metalness: 0.03,
			}),
		);
		belly.position.set(0, 0.12, 0.38);
		belly.scale.set(1.1, 0.9, 0.62);
		belly.castShadow = true;
		belly.receiveShadow = true;
		avatar.add(belly);

		const facePanel = new THREE.Mesh(
			new THREE.SphereGeometry(0.36, 14, 14),
			new THREE.MeshStandardMaterial({
				color: bellyColor,
				roughness: 0.42,
				metalness: 0.03,
			}),
		);
		facePanel.position.set(0, 0.98, 0.43);
		facePanel.scale.set(0.94, 0.84, 0.54);
		facePanel.castShadow = true;
		facePanel.receiveShadow = true;
		avatar.add(facePanel);

		const snout = new THREE.Mesh(
			new THREE.CylinderGeometry(0.14, 0.17, 0.22, 14),
			new THREE.MeshStandardMaterial({
				color: bellyColor.clone().offsetHSL(0, 0, -0.06),
				roughness: 0.46,
				metalness: 0.02,
			}),
		);
		snout.rotation.x = Math.PI / 2;
		snout.position.set(0, 0.87, 0.61);
		snout.castShadow = true;
		snout.receiveShadow = true;
		avatar.add(snout);

		const eyeMaterial = new THREE.MeshStandardMaterial({
			color: 0x12_1f_25,
			roughness: 0.2,
			metalness: 0.36,
			emissive: 0x3d_59_63,
			emissiveIntensity: 0.35,
		});

		const eyeLeft = new THREE.Mesh(
			new THREE.SphereGeometry(0.07, 12, 12),
			eyeMaterial.clone(),
		);
		eyeLeft.position.set(-0.16, 1.05, 0.58);
		avatar.add(eyeLeft);

		const eyeRight = new THREE.Mesh(
			new THREE.SphereGeometry(0.07, 12, 12),
			eyeMaterial.clone(),
		);
		eyeRight.position.set(0.16, 1.05, 0.58);
		avatar.add(eyeRight);

		const nostrilMaterial = new THREE.MeshBasicMaterial({ color: 0x2f_38_3d });
		const nostrilLeft = new THREE.Mesh(
			new THREE.SphereGeometry(0.026, 8, 8),
			nostrilMaterial,
		);
		nostrilLeft.position.set(-0.056, 0.87, 0.72);
		avatar.add(nostrilLeft);

		const nostrilRight = new THREE.Mesh(
			new THREE.SphereGeometry(0.026, 8, 8),
			nostrilMaterial,
		);
		nostrilRight.position.set(0.056, 0.87, 0.72);
		avatar.add(nostrilRight);

		const earMaterial = new THREE.MeshStandardMaterial({
			color: accentColor,
			roughness: 0.34,
			metalness: 0.08,
		});

		const leftEar = new THREE.Mesh(
			new THREE.ConeGeometry(0.14, 0.32, 10),
			earMaterial,
		);
		leftEar.position.set(-0.33, 1.42, 0.03);
		leftEar.rotation.z = 0.24;
		leftEar.castShadow = true;
		avatar.add(leftEar);

		const rightEar = new THREE.Mesh(
			new THREE.ConeGeometry(0.14, 0.32, 10),
			earMaterial.clone(),
		);
		rightEar.position.set(0.33, 1.42, 0.03);
		rightEar.rotation.z = -0.24;
		rightEar.castShadow = true;
		avatar.add(rightEar);

		const belt = new THREE.Mesh(
			new THREE.TorusGeometry(0.56, 0.055, 10, 40),
			new THREE.MeshStandardMaterial({
				color: accentColor.clone().offsetHSL(0, 0, 0.03),
				roughness: 0.24,
				metalness: 0.58,
				emissive: accentColor.clone().multiplyScalar(0.12),
				emissiveIntensity: 0.3,
			}),
		);
		belt.rotation.x = Math.PI / 2;
		belt.position.y = 0.28;
		belt.castShadow = true;
		belt.receiveShadow = true;
		avatar.add(belt);

		const leftArm = new THREE.Mesh(
			new THREE.CapsuleGeometry(0.11, 0.46, 6, 10),
			bodyMaterial.clone(),
		);
		leftArm.position.set(-0.56, 0.32, 0.04);
		leftArm.rotation.z = -0.24;
		leftArm.castShadow = true;
		avatar.add(leftArm);

		const rightArm = new THREE.Mesh(
			new THREE.CapsuleGeometry(0.11, 0.46, 6, 10),
			bodyMaterial.clone(),
		);
		rightArm.position.set(0.56, 0.32, 0.04);
		rightArm.rotation.z = 0.24;
		rightArm.castShadow = true;
		avatar.add(rightArm);

		const leftLeg = new THREE.Mesh(
			new THREE.CapsuleGeometry(0.12, 0.26, 5, 8),
			bodyMaterial.clone(),
		);
		leftLeg.position.set(-0.22, -0.8, 0.03);
		leftLeg.castShadow = true;
		avatar.add(leftLeg);

		const rightLeg = new THREE.Mesh(
			new THREE.CapsuleGeometry(0.12, 0.26, 5, 8),
			bodyMaterial.clone(),
		);
		rightLeg.position.set(0.22, -0.8, 0.03);
		rightLeg.castShadow = true;
		avatar.add(rightLeg);

		const localRing = new THREE.Mesh(
			new THREE.TorusGeometry(0.92, 0.06, 10, 48),
			new THREE.MeshBasicMaterial({
				color: 0xff_e0_8a,
				transparent: true,
				opacity: isLocal ? 0.95 : 0,
			}),
		);
		localRing.rotation.x = Math.PI / 2;
		localRing.position.y = 0.08;
		group.add(localRing);

		const statusRing = new THREE.Mesh(
			new THREE.TorusGeometry(1.08, 0.05, 10, 48),
			new THREE.MeshBasicMaterial({
				color: 0x7b_df_f2,
				transparent: true,
				opacity: 0,
			}),
		);
		statusRing.rotation.x = Math.PI / 2;
		statusRing.position.y = 0.12;
		group.add(statusRing);

		const shadow = new THREE.Mesh(
			new THREE.CircleGeometry(0.82, 24),
			new THREE.MeshBasicMaterial({
				color: 0x07_10_14,
				transparent: true,
				opacity: 0.25,
			}),
		);
		shadow.rotation.x = -Math.PI / 2;
		shadow.position.y = 0.02;
		group.add(shadow);

		const labelTexture = createTextTexture(
			player.nickname,
			isLocal ? "#ffd166" : "#7bdff2",
		);
		const labelMaterial = new THREE.SpriteMaterial({
			map: labelTexture,
			transparent: true,
		});
		const label = new THREE.Sprite(labelMaterial);
		label.scale.set(3.4, 0.86, 1);
		label.position.y = 3.5;
		group.add(label);

		const healthBarWidth = 1.8;
		const healthBarHeight = 0.14;
		const healthBgGeometry = new THREE.PlaneGeometry(
			healthBarWidth,
			healthBarHeight,
		);
		const healthBgMaterial = new THREE.MeshBasicMaterial({
			color: 0x22_22_22,
			transparent: true,
			opacity: 0.6,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const healthBg = new THREE.Mesh(healthBgGeometry, healthBgMaterial);

		const healthFillGeometry = new THREE.PlaneGeometry(
			healthBarWidth,
			healthBarHeight,
		);
		const healthFillMaterial = new THREE.MeshBasicMaterial({
			color: 0x44_dd_44,
			transparent: true,
			opacity: 0.85,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const healthFill = new THREE.Mesh(healthFillGeometry, healthFillMaterial);
		healthFill.position.z = 0.001;

		const healthBarGroup = new THREE.Group();
		healthBarGroup.add(healthBg);
		healthBarGroup.add(healthFill);
		healthBarGroup.position.y = 3.0;
		group.add(healthBarGroup);

		this.scene.add(group);

		return {
			group,
			avatar,
			body,
			cap,
			belly,
			facePanel,
			leftEar,
			rightEar,
			leftArm,
			rightArm,
			localRing,
			statusRing,
			shadow,
			label,
			labelTexture,
			labelText: player.nickname,
			localState: isLocal,
			displayScale: player.sizeMultiplier || 1,
			healthBarGroup,
			healthFill,
			healthBarWidth,
		};
	}

	upsertPlayer(player, { isLocal }) {
		let entry = this.playerMeshes.get(player.id);
		if (!entry) {
			entry = this.createPlayerMesh(player, isLocal);
			this.playerMeshes.set(player.id, entry);
		}

		if (entry.labelText !== player.nickname || entry.localState !== isLocal) {
			entry.labelTexture.dispose();
			entry.labelTexture = createTextTexture(
				player.nickname,
				isLocal ? "#ffd166" : "#7bdff2",
			);
			entry.label.material.map = entry.labelTexture;
			entry.label.material.needsUpdate = true;
			entry.labelText = player.nickname;
			entry.localState = isLocal;
		}

		const targetScale = player.sizeMultiplier || 1;
		if (!Number.isFinite(entry.displayScale)) {
			entry.displayScale = targetScale;
		}

		const scaleSmoothing =
			targetScale > entry.displayScale
				? SETTINGS.playerScaleGrowSmoothing
				: SETTINGS.playerScaleShrinkSmoothing;
		entry.displayScale = THREE.MathUtils.lerp(
			entry.displayScale,
			targetScale,
			scaleSmoothing,
		);
		if (Math.abs(entry.displayScale - targetScale) < 0.002) {
			entry.displayScale = targetScale;
		}

		const scale = entry.displayScale;
		const bobOffset = player.bobOffset || 0;
		const now = Date.now();
		const invulnerable = (player.invulnerableUntil || 0) > now;
		const boosted = !invulnerable && (player.speedBoostUntil || 0) > now;

		entry.group.position.set(player.position.x, 0, player.position.z);
		entry.group.rotation.y = player.rotationY || 0;

		entry.avatar.position.y = SETTINGS.playerHeight * scale + bobOffset;
		entry.avatar.rotation.x = player.tilt || 0;
		entry.avatar.scale.set(scale, scale, scale);

		const movementEnergy = Math.min(
			1,
			Math.abs(player.tilt || 0) * 4.5 + Math.abs(bobOffset) * 5,
		);
		const gaitWave = Math.sin(now * 0.018 + player.position.x * 0.4);
		entry.leftArm.rotation.x =
			-0.24 * movementEnergy + gaitWave * 0.34 * movementEnergy;
		entry.rightArm.rotation.x =
			-0.24 * movementEnergy - gaitWave * 0.34 * movementEnergy;
		entry.leftEar.rotation.x = 0.06 + gaitWave * 0.04;
		entry.rightEar.rotation.x = 0.06 - gaitWave * 0.04;

		entry.localRing.material.opacity = isLocal ? 0.95 : 0.08;
		entry.localRing.scale.setScalar(1 + (scale - 1) * 0.25);
		if (invulnerable || boosted) {
			const pulse = 0.58 + Math.sin(now * 0.012) * 0.2;
			entry.statusRing.visible = true;
			entry.statusRing.material.opacity = pulse;
			entry.statusRing.material.color.setHex(
				invulnerable ? 0x7b_df_f2 : 0xc7_f4_64,
			);
			entry.statusRing.scale.setScalar(
				1.12 + (scale - 1) * 0.34 + Math.sin(now * 0.008) * 0.04,
			);
		} else {
			entry.statusRing.visible = false;
			entry.statusRing.material.opacity = 0;
			entry.statusRing.scale.setScalar(1 + (scale - 1) * 0.28);
		}

		entry.shadow.scale.setScalar(scale * 1.1);
		entry.label.position.y = 3.4 * scale + bobOffset;
		entry.label.quaternion.copy(this.camera.quaternion);

		const healthRatio = Math.max(
			0,
			Math.min(1, (player.health || 0) / Math.max(1, player.maxHealth || 1)),
		);
		entry.healthBarGroup.position.y = 3.0 * scale + bobOffset;
		entry.healthBarGroup.quaternion.copy(this.camera.quaternion);
		entry.healthFill.scale.x = healthRatio;
		entry.healthFill.position.x =
			-(entry.healthBarWidth * (1 - healthRatio)) / 2;
		if (healthRatio > 0.5) {
			entry.healthFill.material.color.setHex(0x44_dd_44);
		} else if (healthRatio > 0.25) {
			entry.healthFill.material.color.setHex(0xff_bf_69);
		} else {
			entry.healthFill.material.color.setHex(0xff_7f_7f);
		}

		entry.healthBarGroup.visible = healthRatio < 1 || entry.localState;
	}

	removePlayer(playerId) {
		const entry = this.playerMeshes.get(playerId);
		if (!entry) {
			return;
		}

		this.scene.remove(entry.group);
		entry.labelTexture.dispose();
		entry.group.traverse((node) => {
			if (node.geometry) {
				node.geometry.dispose();
			}

			if (node.material) {
				disposeMaterial(node.material);
			}
		});

		this.playerMeshes.delete(playerId);
	}

	createBallMesh(ball) {
		const group = new THREE.Group();
		group.position.set(ball.position.x, 0.88, ball.position.z);

		const core = new THREE.Mesh(
			new THREE.SphereGeometry(0.36, 24, 24),
			new THREE.MeshStandardMaterial({
				color: ball.color,
				roughness: 0.2,
				metalness: 0.7,
				emissive: ball.color,
				emissiveIntensity: ball.type === "GOLDEN" ? 0.28 : 0.14,
			}),
		);
		core.castShadow = true;
		core.receiveShadow = true;
		group.add(core);

		const glow = new THREE.Mesh(
			new THREE.SphereGeometry(0.48, 18, 18),
			new THREE.MeshBasicMaterial({
				color: ball.color,
				transparent: true,
				opacity: 0.14,
			}),
		);
		group.add(glow);

		const halo = new THREE.Mesh(
			new THREE.RingGeometry(0.48, 0.7, 28),
			new THREE.MeshBasicMaterial({
				color: ball.color,
				transparent: true,
				opacity: 0.2,
				side: THREE.DoubleSide,
			}),
		);
		halo.rotation.x = -Math.PI / 2;
		halo.position.y = -0.74;
		group.add(halo);

		this.scene.add(group);

		return {
			group,
			core,
			glow,
			halo,
			phase: Math.random() * Math.PI * 2,
			baseY: 0.88,
		};
	}

	getBallValueAccent(ball) {
		if (ball.type === "GOLDEN") {
			return "#ffd166";
		}

		if (ball.type === "SPEED") {
			return "#7bdff2";
		}

		return "#fff5d8";
	}

	upsertBall(ball) {
		let entry = this.ballMeshes.get(ball.id);
		if (!entry) {
			entry = this.createBallMesh(ball);
			this.ballMeshes.set(ball.id, entry);
		}

		entry.group.visible = !ball.hidden;
		entry.group.position.x = ball.position.x;
		entry.group.position.z = ball.position.z;
		entry.core.material.color.setHex(ball.color);
		entry.core.material.emissive.setHex(ball.color);
		entry.glow.material.color.setHex(ball.color);
		entry.halo.material.color.setHex(ball.color);
	}

	createProjectileMesh(projectile) {
		const material = new THREE.SpriteMaterial({
			map: this.fireballTexture,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			color: projectile.color,
		});
		const sprite = new THREE.Sprite(material);
		const visualSize = Math.max(2.5, projectile.radius * 4.5);
		sprite.scale.set(visualSize, visualSize, 1);
		sprite.position.set(
			projectile.position.x,
			projectile.position.y || 0.85,
			projectile.position.z,
		);

		this.scene.add(sprite);

		return {
			sprite,
			origin: new THREE.Vector3(
				projectile.position.x,
				projectile.position.y || 0,
				projectile.position.z,
			),
			direction: new THREE.Vector3(
				projectile.direction.x,
				projectile.direction.y || 0,
				projectile.direction.z,
			),
			speed: projectile.speed,
			bornAt: projectile.createdAt,
			expiresAt: projectile.expiresAt,
			radius: projectile.radius,
			baseVisualSize: visualSize,
		};
	}

	upsertProjectile(projectile, simulationTimeMs) {
		let entry = this.projectileMeshes.get(projectile.id);
		if (!entry) {
			entry = this.createProjectileMesh(projectile);
			this.projectileMeshes.set(projectile.id, entry);
		}

		entry.origin.set(
			projectile.position.x,
			projectile.position.y || 0,
			projectile.position.z,
		);
		entry.direction.set(
			projectile.direction.x,
			projectile.direction.y || 0,
			projectile.direction.z,
		);
		entry.speed = projectile.speed;
		entry.radius = projectile.radius;
		entry.bornAt = projectile.createdAt;
		entry.expiresAt = projectile.expiresAt;
		entry.sprite.material.color.setHex(projectile.color);

		const ageSeconds = Math.max(0, (simulationTimeMs - entry.bornAt) / 1000);
		const travel = entry.direction
			.clone()
			.multiplyScalar(entry.speed * ageSeconds);
		entry.sprite.position.copy(entry.origin).add(travel);
	}

	removeProjectile(projectileId) {
		const entry = this.projectileMeshes.get(projectileId);
		if (!entry) {
			return;
		}

		this.scene.remove(entry.sprite);
		entry.sprite.material.dispose();

		this.projectileMeshes.delete(projectileId);
	}

	removeBall(ballId) {
		const entry = this.ballMeshes.get(ballId);
		if (!entry) {
			return;
		}

		this.scene.remove(entry.group);
		entry.group.traverse((node) => {
			if (node.geometry) {
				node.geometry.dispose();
			}

			if (node.material) {
				disposeMaterial(node.material);
			}
		});
		this.ballMeshes.delete(ballId);
	}

	spawnPickupBurst(position, color, simulationTimeMs) {
		this.spawnBurst({
			position,
			color,
			simulationTimeMs,
			innerRadius: 0.4,
			outerRadius: 0.62,
			duration: 520,
			opacity: 0.75,
			grow: 3.2,
		});
	}

	spawnFloatingValue(
		position,
		text,
		color,
		simulationTimeMs,
		scaleMultiplier = 1,
	) {
		const safeScale = THREE.MathUtils.clamp(
			scaleMultiplier || 1,
			1,
			SETTINGS.maxSizeMultiplier,
		);
		const popupScale = 1 + (safeScale - 1) * 0.7;
		this.ensureValuePopupLayer();

		const element = document.createElement("div");
		element.className = "floating-value-popup";
		element.textContent = String(text);
		element.style.setProperty(
			"--popup-accent",
			new THREE.Color(color).getStyle(),
		);
		this.valuePopupLayer?.append(element);

		this.valuePopups.push({
			element,
			bornAt: simulationTimeMs,
			duration: 1150,
			startX: position.x,
			startY: position.y + 1.12 * popupScale,
			startZ: position.z,
			riseHeight: 1.75 + (popupScale - 1) * 0.5,
			driftX: (Math.random() - 0.5) * 0.34,
			driftZ: (Math.random() - 0.5) * 0.3,
			baseScale: popupScale,
		});
	}

	spawnRespawnBurst(position, color, simulationTimeMs) {
		this.spawnBurst({
			position,
			color,
			simulationTimeMs,
			innerRadius: 0.58,
			outerRadius: 0.9,
			duration: 980,
			opacity: 0.68,
			grow: 3.4,
			y: 0.18,
		});
	}

	spawnFireballImpact(position, color, simulationTimeMs, wasFatal = false) {
		this.spawnBurst({
			position,
			color: wasFatal ? 0xff7f7f : color,
			simulationTimeMs,
			innerRadius: wasFatal ? 0.56 : 0.34,
			outerRadius: wasFatal ? 1.02 : 0.72,
			duration: wasFatal ? 700 : 420,
			opacity: wasFatal ? 0.82 : 0.68,
			grow: wasFatal ? 3.8 : 2.8,
			y: 0.18,
		});
	}

	spawnDashTrail(position, color, simulationTimeMs, scale = 1) {
		const safeScale = Math.max(0.8, Math.min(2.8, scale || 1));
		this.spawnBurst({
			position,
			color,
			simulationTimeMs,
			innerRadius: 0.24 * safeScale,
			outerRadius: 0.42 * safeScale,
			duration: 260,
			opacity: 0.42,
			grow: 1.35,
			y: 0.22,
		});
	}

	spawnBurst({
		position,
		color,
		simulationTimeMs,
		innerRadius,
		outerRadius,
		duration,
		opacity,
		grow,
		y = 0.18,
	}) {
		const mesh = new THREE.Mesh(
			new THREE.RingGeometry(innerRadius, outerRadius, 26),
			new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity,
				side: THREE.DoubleSide,
			}),
		);
		mesh.rotation.x = -Math.PI / 2;
		mesh.position.set(position.x, y, position.z);
		this.scene.add(mesh);

		this.pickupBursts.push({
			mesh,
			bornAt: simulationTimeMs,
			duration,
			opacity,
			grow,
		});
	}

	step(simulationTimeMs, serverNowMs = simulationTimeMs) {
		if (this.skyDome) {
			this.skyDome.rotation.y = simulationTimeMs * 0.000_015;
		}

		for (const entry of this.ballMeshes.values()) {
			const hover = Math.sin(simulationTimeMs * 0.004 + entry.phase) * 0.18;
			entry.group.position.y = entry.baseY + hover;
			entry.core.rotation.y += 0.02;
			entry.glow.scale.setScalar(
				1 + Math.sin(simulationTimeMs * 0.006 + entry.phase) * 0.08,
			);
		}

		for (const entry of this.projectileMeshes.values()) {
			const ageSeconds = Math.max(0, (serverNowMs - entry.bornAt) / 1000);
			const progress = Math.max(
				0,
				Math.min(
					1,
					(serverNowMs - entry.bornAt) /
						Math.max(1, entry.expiresAt - entry.bornAt),
				),
			);
			const travel = entry.direction
				.clone()
				.multiplyScalar(entry.speed * ageSeconds);
			entry.sprite.position.copy(entry.origin).add(travel);
			entry.sprite.position.y =
				0.85 + Math.sin(simulationTimeMs * 0.01 + entry.radius * 2) * 0.08;
			const pulse = 1 + Math.sin(simulationTimeMs * 0.012 + progress) * 0.12;
			const size = entry.baseVisualSize * pulse;
			entry.sprite.scale.set(size, size, 1);
			entry.sprite.material.opacity = 1 - progress * 0.3;

			const trailParticle = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: this.fireballTexture,
					transparent: true,
					depthWrite: false,
					blending: THREE.AdditiveBlending,
					color: 0xff_99_33,
					opacity: 0.7,
				}),
			);
			const trailSize = entry.baseVisualSize * 0.75;
			trailParticle.scale.set(trailSize, trailSize, 1);
			trailParticle.position.copy(entry.sprite.position);
			this.scene.add(trailParticle);
			this.projectileTrails.push({
				sprite: trailParticle,
				bornAt: simulationTimeMs,
				duration: 500,
				initialSize: trailSize,
			});
		}

		this.projectileTrails = this.projectileTrails.filter((trail) => {
			const age = simulationTimeMs - trail.bornAt;
			const progress = age / trail.duration;

			if (progress >= 1) {
				this.scene.remove(trail.sprite);
				trail.sprite.material.dispose();
				return false;
			}

			const fade = 1 - progress;
			trail.sprite.material.opacity = 0.7 * fade;
			const shrink = trail.initialSize * (0.7 + 0.3 * fade);
			trail.sprite.scale.set(shrink, shrink, 1);
			return true;
		});

		this.pickupBursts = this.pickupBursts.filter((burst) => {
			const age = simulationTimeMs - burst.bornAt;
			const progress = age / burst.duration;

			if (progress >= 1) {
				this.scene.remove(burst.mesh);
				burst.mesh.geometry.dispose();
				disposeMaterial(burst.mesh.material);
				return false;
			}

			burst.mesh.scale.setScalar(1 + progress * burst.grow);
			burst.mesh.material.opacity = burst.opacity * (1 - progress);
			return true;
		});

		this.valuePopups = this.valuePopups.filter((popup) => {
			const age = simulationTimeMs - popup.bornAt;
			const progress = age / popup.duration;

			if (progress >= 1) {
				popup.element?.remove();
				return false;
			}

			const eased = 1 - (1 - progress) ** 2;
			this.valuePopupProjectPoint.set(
				popup.startX + popup.driftX * eased,
				popup.startY + popup.riseHeight * eased,
				popup.startZ + popup.driftZ * eased,
			);
			this.valuePopupProjectPoint.project(this.camera);

			const isBehindCamera = this.valuePopupProjectPoint.z > 1;
			if (isBehindCamera) {
				popup.element.style.opacity = "0";
				return true;
			}

			const width = this.container.clientWidth || window.innerWidth;
			const height = this.container.clientHeight || window.innerHeight;
			const screenX = (this.valuePopupProjectPoint.x * 0.5 + 0.5) * width;
			const screenY = (-this.valuePopupProjectPoint.y * 0.5 + 0.5) * height;
			const visualScale = popup.baseScale * (1 + progress * 0.1);
			const opacity = Math.max(0, 1 - progress ** 1.35);

			popup.element.style.opacity = opacity.toFixed(3);
			popup.element.style.transform = `translate3d(${screenX.toFixed(1)}px, ${screenY.toFixed(1)}px, 0) translate(-50%, -50%) scale(${visualScale.toFixed(3)})`;
			return true;
		});

		if (this.arenaDecorations?.length) {
			for (const decor of this.arenaDecorations) {
				if (!decor.userData?.pulsePhase) {
					continue;
				}

				if (decor.geometry?.type === "PlaneGeometry") {
					decor.material.opacity =
						0.66 +
						Math.sin(simulationTimeMs * 0.0011 + decor.userData.pulsePhase) *
							0.08;
					decor.position.y =
						0.03 +
						Math.sin(simulationTimeMs * 0.0014 + decor.userData.pulsePhase) *
							0.02;
					continue;
				}

				decor.position.y =
					decor.userData.baseY +
					Math.sin(simulationTimeMs * 0.0017 + decor.userData.bobPhase) * 0.08;
			}
		}

		if (this.arenaAssetRoots?.length) {
			for (const asset of this.arenaAssetRoots) {
				const {
					angle,
					radius,
					baseY,
					rotationOffset = 0,
					yOffset = 0,
					bobPhase = 0,
				} = asset.userData || {};
				if (!Number.isFinite(angle) || !Number.isFinite(radius)) {
					continue;
				}

				const bob = Math.sin(simulationTimeMs * 0.001 + bobPhase) * 0.08;
				asset.position.set(
					Math.cos(angle) * radius,
					baseY + yOffset + bob,
					Math.sin(angle) * radius,
				);
				asset.rotation.y =
					-angle +
					rotationOffset +
					Math.sin(simulationTimeMs * 0.0004 + bobPhase) * 0.02;
			}
		}
	}

	updateCamera(player, heading) {
		if (this.freeCameraMode) {
			return;
		}

		const scale =
			this.playerMeshes.get(player.id)?.displayScale ||
			player.sizeMultiplier ||
			1;
		const growth = Math.max(0, scale - 1);
		const maxGrowth = Math.max(0.001, SETTINGS.maxSizeMultiplier - 1);
		const growthProgress = THREE.MathUtils.clamp(growth / maxGrowth, 0, 1);
		const targetDistance =
			SETTINGS.cameraDistance *
			(1 +
				growth * SETTINGS.cameraDistanceGrowthFactor +
				growthProgress * SETTINGS.cameraDistanceProgressFactor);
		const targetHeight =
			SETTINGS.cameraHeight *
			(1 +
				growth * SETTINGS.cameraHeightGrowthFactor +
				growthProgress * SETTINGS.cameraHeightProgressFactor);
		const targetLookHeight = SETTINGS.cameraLookHeight * scale;
		const targetFov = THREE.MathUtils.clamp(
			SETTINGS.cameraBaseFov +
				growth * SETTINGS.cameraFovGrowthFactor +
				growthProgress * SETTINGS.cameraFovProgressFactor,
			SETTINGS.cameraBaseFov,
			SETTINGS.cameraMaxFov,
		);

		if (this.cameraTrackedPlayerId === player.id) {
			this.cameraPickupFovBoost = THREE.MathUtils.lerp(
				this.cameraPickupFovBoost,
				this.cameraPickupFovBoostTarget,
				SETTINGS.cameraPickupBoostSmoothing,
			);
			this.cameraPickupDistanceBoost = THREE.MathUtils.lerp(
				this.cameraPickupDistanceBoost,
				this.cameraPickupDistanceBoostTarget,
				SETTINGS.cameraPickupBoostSmoothing,
			);
			this.cameraPickupHeightBoost = THREE.MathUtils.lerp(
				this.cameraPickupHeightBoost,
				this.cameraPickupHeightBoostTarget,
				SETTINGS.cameraPickupBoostSmoothing,
			);
			this.cameraPickupDistanceBoostTarget = THREE.MathUtils.lerp(
				this.cameraPickupDistanceBoostTarget,
				0,
				SETTINGS.cameraPickupBoostDecay,
			);
			this.cameraPickupHeightBoostTarget = THREE.MathUtils.lerp(
				this.cameraPickupHeightBoostTarget,
				0,
				SETTINGS.cameraPickupBoostDecay,
			);
			this.cameraPickupFovBoostTarget = THREE.MathUtils.lerp(
				this.cameraPickupFovBoostTarget,
				0,
				SETTINGS.cameraPickupBoostDecay,
			);

			const zoomingOut = targetDistance > this.cameraCurrentDistance;
			let smoothing = zoomingOut
				? SETTINGS.cameraZoomOutSmoothing
				: SETTINGS.cameraZoomInSmoothing;
			if (
				this.cameraPickupDistanceBoost > 0.02 ||
				this.cameraPickupDistanceBoostTarget > 0.02
			) {
				smoothing = Math.max(
					smoothing,
					SETTINGS.cameraPickupZoomResponseSmoothing,
				);
			}

			this.cameraCurrentDistance = THREE.MathUtils.lerp(
				this.cameraCurrentDistance,
				targetDistance + this.cameraPickupDistanceBoost,
				smoothing,
			);
			this.cameraCurrentHeight = THREE.MathUtils.lerp(
				this.cameraCurrentHeight,
				targetHeight + this.cameraPickupHeightBoost,
				smoothing,
			);
			this.cameraCurrentLookHeight = THREE.MathUtils.lerp(
				this.cameraCurrentLookHeight,
				targetLookHeight,
				SETTINGS.cameraLookHeightSmoothing,
			);
			const wideningFov =
				targetFov + this.cameraPickupFovBoost > this.cameraCurrentFov;
			let fovSmoothing = wideningFov
				? SETTINGS.cameraFovZoomOutSmoothing
				: SETTINGS.cameraFovZoomInSmoothing;
			if (
				this.cameraPickupFovBoost > 0.05 ||
				this.cameraPickupFovBoostTarget > 0.05
			) {
				fovSmoothing = Math.max(
					fovSmoothing,
					SETTINGS.cameraPickupZoomResponseSmoothing,
				);
			}

			this.cameraCurrentFov = THREE.MathUtils.lerp(
				this.cameraCurrentFov,
				targetFov + this.cameraPickupFovBoost,
				fovSmoothing,
			);
			if (Math.abs(this.cameraCurrentDistance - targetDistance) < 0.01) {
				this.cameraCurrentDistance = targetDistance;
			}

			if (Math.abs(this.cameraCurrentHeight - targetHeight) < 0.01) {
				this.cameraCurrentHeight = targetHeight;
			}

			if (Math.abs(this.cameraCurrentLookHeight - targetLookHeight) < 0.01) {
				this.cameraCurrentLookHeight = targetLookHeight;
			}

			if (Math.abs(this.cameraCurrentFov - targetFov) < 0.05) {
				this.cameraCurrentFov = targetFov;
			}
		} else {
			this.cameraTrackedPlayerId = player.id;
			this.cameraCurrentFov = targetFov;
			this.cameraCurrentDistance = targetDistance;
			this.cameraCurrentHeight = targetHeight;
			this.cameraCurrentLookHeight = targetLookHeight;
			this.cameraPickupFovBoost = 0;
			this.cameraPickupDistanceBoost = 0;
			this.cameraPickupHeightBoost = 0;
			this.cameraPickupFovBoostTarget = 0;
			this.cameraPickupDistanceBoostTarget = 0;
			this.cameraPickupHeightBoostTarget = 0;
		}

		const cameraLimit = this.worldSize * 0.84;

		const desiredPosition = this.cameraDesiredPosition.set(
			player.position.x - Math.sin(heading) * this.cameraCurrentDistance,
			this.cameraCurrentHeight,
			player.position.z - Math.cos(heading) * this.cameraCurrentDistance,
		);
		const desiredLookAt = this.cameraDesiredLookAt.set(
			player.position.x,
			this.cameraCurrentLookHeight,
			player.position.z,
		);

		desiredPosition.x = THREE.MathUtils.clamp(
			desiredPosition.x,
			-cameraLimit,
			cameraLimit,
		);
		desiredPosition.z = THREE.MathUtils.clamp(
			desiredPosition.z,
			-cameraLimit,
			cameraLimit,
		);

		this.camera.position.lerp(desiredPosition, SETTINGS.cameraSmoothing);
		this.cameraLookTarget.lerp(desiredLookAt, SETTINGS.cameraSmoothing + 0.04);
		if (Math.abs(this.camera.fov - this.cameraCurrentFov) > 0.01) {
			this.camera.fov = this.cameraCurrentFov;
			this.camera.updateProjectionMatrix();
		}

		this.camera.lookAt(this.cameraLookTarget);
	}

	setFreeCameraMode(enabled, player = null) {
		this.freeCameraMode = Boolean(enabled);

		if (!this.camera) {
			return;
		}

		if (player && this.freeCameraMode) {
			const distance = SETTINGS.cameraDistance;
			const lookHeight =
				SETTINGS.cameraLookHeight * (player.sizeMultiplier || 1);
			const target = new THREE.Vector3(
				player.position.x,
				lookHeight,
				player.position.z,
			);
			this.camera.position.set(
				player.position.x,
				player.position.y + SETTINGS.cameraHeight,
				player.position.z - distance,
			);
			const direction = target.clone().sub(this.camera.position).normalize();
			this.freeCameraYaw = Math.atan2(direction.x, direction.z);
			this.freeCameraPitch = Math.asin(
				THREE.MathUtils.clamp(direction.y, -0.97, 0.97),
			);
			this.camera.position.set(
				player.position.x - Math.sin(this.freeCameraYaw) * distance,
				player.position.y + SETTINGS.cameraHeight,
				player.position.z - Math.cos(this.freeCameraYaw) * distance,
			);
			this.cameraLookTarget.copy(target);
			this.freeCameraTarget.copy(target);
		} else {
			this.camera.getWorldDirection(this.freeCameraForward);
			const planar = Math.hypot(
				this.freeCameraForward.x,
				this.freeCameraForward.z,
			);
			if (planar > 0.000_01) {
				this.freeCameraYaw = Math.atan2(
					this.freeCameraForward.x,
					this.freeCameraForward.z,
				);
			}

			this.freeCameraPitch = Math.asin(
				THREE.MathUtils.clamp(this.freeCameraForward.y, -0.97, 0.97),
			);
		}

		this.cameraTrackedPlayerId = null;
		this.cameraPickupFovBoost = 0;
		this.cameraPickupDistanceBoost = 0;
		this.cameraPickupHeightBoost = 0;
		this.cameraPickupFovBoostTarget = 0;
		this.cameraPickupDistanceBoostTarget = 0;
		this.cameraPickupHeightBoostTarget = 0;
	}

	updateFreeCamera(inputState = null, deltaMs = 16) {
		if (!this.camera) {
			return;
		}

		if (!this.freeCameraMode) {
			return;
		}

		const inputX = (inputState?.right ? 1 : 0) - (inputState?.left ? 1 : 0);
		const inputZ =
			(inputState?.forward ? 1 : 0) - (inputState?.backward ? 1 : 0);
		const inputY = (inputState?.up ? 1 : 0) - (inputState?.down ? 1 : 0);
		const accelerate = Boolean(inputState?.sprint);
		const speed = accelerate ? 30 : 17;
		const deltaSeconds = Math.max(0.001, deltaMs / 1000);

		this.freeCameraForward
			.set(
				Math.sin(this.freeCameraYaw) * Math.cos(this.freeCameraPitch),
				Math.sin(this.freeCameraPitch),
				Math.cos(this.freeCameraYaw) * Math.cos(this.freeCameraPitch),
			)
			.normalize();

		this.freeCameraRight
			.set(-this.freeCameraForward.z, 0, this.freeCameraForward.x)
			.normalize();

		this.freeCameraMovement
			.set(0, 0, 0)
			.addScaledVector(this.freeCameraRight, inputX)
			.addScaledVector(this.freeCameraForward, inputZ)
			.addScaledVector(THREE.Object3D.DEFAULT_UP, inputY);

		if (this.freeCameraMovement.lengthSq() > 0.000_01) {
			this.freeCameraMovement.normalize().multiplyScalar(speed * deltaSeconds);
			this.camera.position.add(this.freeCameraMovement);
		}

		const horizontalLimit = this.worldSize * 1.35;
		const verticalMin = 1.2;
		const verticalMax = this.worldSize * 0.9;
		this.camera.position.x = THREE.MathUtils.clamp(
			this.camera.position.x,
			-horizontalLimit,
			horizontalLimit,
		);
		this.camera.position.z = THREE.MathUtils.clamp(
			this.camera.position.z,
			-horizontalLimit,
			horizontalLimit,
		);
		this.camera.position.y = THREE.MathUtils.clamp(
			this.camera.position.y,
			verticalMin,
			verticalMax,
		);

		this.freeCameraTarget
			.copy(this.camera.position)
			.addScaledVector(this.freeCameraForward, 10);
		this.cameraLookTarget.copy(this.freeCameraTarget);

		if (Math.abs(this.camera.fov - SETTINGS.cameraBaseFov) > 0.01) {
			this.camera.fov = SETTINGS.cameraBaseFov;
			this.camera.updateProjectionMatrix();
		}

		this.camera.lookAt(this.cameraLookTarget);
	}

	adjustFreeCameraLook(deltaX = 0, deltaY = 0) {
		if (!this.freeCameraMode) {
			return;
		}

		const sensitivity = 0.0022;
		this.freeCameraYaw -= deltaX * sensitivity;
		this.freeCameraPitch = THREE.MathUtils.clamp(
			this.freeCameraPitch - deltaY * sensitivity,
			-1.35,
			1.35,
		);
	}

	adjustFreeCameraZoom(deltaY = 0) {
		if (!this.freeCameraMode || !this.camera) {
			return;
		}

		this.camera.getWorldDirection(this.freeCameraForward);
		const zoomStep = THREE.MathUtils.clamp(deltaY * 0.01, -2.5, 2.5);
		this.camera.position.addScaledVector(this.freeCameraForward, zoomStep);
	}

	updateIdleCamera(simulationTimeMs) {
		this.cameraTrackedPlayerId = null;
		this.cameraCurrentFov = SETTINGS.cameraBaseFov;
		this.cameraCurrentDistance = SETTINGS.cameraDistance;
		this.cameraCurrentHeight = SETTINGS.cameraHeight;
		this.cameraCurrentLookHeight = SETTINGS.cameraLookHeight;
		this.cameraPickupFovBoost = 0;
		this.cameraPickupDistanceBoost = 0;
		this.cameraPickupHeightBoost = 0;
		this.cameraPickupFovBoostTarget = 0;
		this.cameraPickupDistanceBoostTarget = 0;
		this.cameraPickupHeightBoostTarget = 0;

		const angle = simulationTimeMs * 0.000_22;
		const radius = this.worldSize * 0.85;
		const desiredPosition = this.idleCameraPosition.set(
			Math.cos(angle) * radius,
			this.worldSize * 0.17,
			Math.sin(angle) * radius,
		);
		const desiredLookAt = this.idleCameraLookAt;

		this.camera.position.lerp(desiredPosition, 0.035);
		this.cameraLookTarget.lerp(desiredLookAt, 0.05);
		if (Math.abs(this.camera.fov - SETTINGS.cameraBaseFov) > 0.01) {
			this.camera.fov = SETTINGS.cameraBaseFov;
			this.camera.updateProjectionMatrix();
		}

		this.camera.lookAt(this.cameraLookTarget);
	}

	render() {
		this.renderer.render(this.scene, this.camera);
	}

	getMouseWorldDirection(playerPos, mouseX, mouseY, fallbackHeading) {
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.camera);

		const targetPoint = new THREE.Vector3();
		const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
		raycaster.ray.intersectPlane(floorPlane, targetPoint);

		const direction = new THREE.Vector3().subVectors(targetPoint, playerPos);
		direction.y = 0;
		if (direction.lengthSq() > 0.001) {
			return direction.normalize();
		}

		return new THREE.Vector3(
			Math.sin(fallbackHeading),
			0,
			Math.cos(fallbackHeading),
		);
	}

	getCameraHeading(fallback = 0) {
		if (!this.camera) {
			return fallback;
		}

		this.camera.getWorldDirection(this.cameraForward);
		const planarLengthSq =
			this.cameraForward.x * this.cameraForward.x +
			this.cameraForward.z * this.cameraForward.z;
		if (planarLengthSq < 0.000_001) {
			return fallback;
		}

		return Math.atan2(this.cameraForward.x, this.cameraForward.z);
	}

	getCanvasElement() {
		return this.renderer?.domElement || null;
	}

	triggerPickupCameraBoost(value = 10, playerScale = 1) {
		const growth = Math.max(0, playerScale - 1);
		const maxGrowth = Math.max(0.001, SETTINGS.maxSizeMultiplier - 1);
		const growthProgress = THREE.MathUtils.clamp(growth / maxGrowth, 0, 1);
		const proportionalFactor = 0.85 + growthProgress * 0.95;

		const distanceBoost = Math.min(
			SETTINGS.cameraPickupMaxZoomBoost,
			value * SETTINGS.cameraPickupZoomPerPoint * proportionalFactor,
		);
		const heightBoost = Math.min(
			SETTINGS.cameraPickupMaxHeightBoost,
			value * SETTINGS.cameraPickupHeightPerPoint * proportionalFactor,
		);
		const fovBoost = Math.min(
			SETTINGS.cameraPickupMaxFovBoost,
			value * SETTINGS.cameraPickupFovPerPoint * proportionalFactor,
		);

		this.cameraPickupDistanceBoostTarget = Math.min(
			SETTINGS.cameraPickupMaxZoomBoost,
			this.cameraPickupDistanceBoostTarget + distanceBoost,
		);
		this.cameraPickupHeightBoostTarget = Math.min(
			SETTINGS.cameraPickupMaxHeightBoost,
			this.cameraPickupHeightBoostTarget + heightBoost,
		);
		this.cameraPickupFovBoostTarget = Math.min(
			SETTINGS.cameraPickupMaxFovBoost,
			this.cameraPickupFovBoostTarget + fovBoost,
		);
	}

	disposeStaticNode(node) {
		if (!node) {
			return;
		}

		this.scene?.remove(node);
		node.traverse?.((child) => {
			if (child.geometry) {
				child.geometry.dispose();
			}

			if (child.material) {
				disposeMaterial(child.material);
			}
		});
	}

	dispose() {
		for (const [playerId, _] of this.playerMeshes.entries()) {
			this.removePlayer(playerId);
		}

		for (const [ballId, _] of this.ballMeshes.entries()) {
			this.removeBall(ballId);
		}

		for (const [projectileId, _] of this.projectileMeshes.entries()) {
			this.removeProjectile(projectileId);
		}

		if (this.fireballTexture) {
			this.fireballTexture.dispose();
			this.fireballTexture = null;
		}

		for (const trail of this.projectileTrails) {
			this.scene?.remove(trail.sprite);
			trail.sprite.material.dispose();
		}

		this.projectileTrails = [];

		for (const burst of this.pickupBursts) {
			this.scene?.remove(burst.mesh);
			burst.mesh.geometry.dispose();
			disposeMaterial(burst.mesh.material);
		}

		this.pickupBursts = [];

		for (const popup of this.valuePopups) {
			popup.element?.remove();
		}

		this.valuePopups = [];
		this.valuePopupLayer?.remove();
		this.valuePopupLayer = null;

		for (const post of this.posts) {
			this.disposeStaticNode(post);
		}

		this.posts = [];
		this.disposeStaticNode(this.skyDome);
		this.disposeStaticNode(this.arenaDecorGroup);
		this.disposeStaticNode(this.arenaAssetGroup);
		this.arenaDecorations = [];
		this.arenaAssetRoots = [];
		this.disposeStaticNode(this.floor);
		this.disposeStaticNode(this.innerDisk);
		this.disposeStaticNode(this.brassRing);
		this.disposeStaticNode(this.boundaryRing);

		if (this.renderer) {
			this.renderer.renderLists?.dispose?.();
			this.renderer.dispose();
			this.renderer.forceContextLoss?.();
			this.renderer.domElement?.remove();
		}

		this.scene?.clear();
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.floor = null;
		this.innerDisk = null;
		this.brassRing = null;
		this.boundaryRing = null;
		this.skyDome = null;
		this.arenaDecorGroup = null;
		this.arenaAssetGroup = null;
	}
}

export * as THREE from "three";
