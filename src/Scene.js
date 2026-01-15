import {
    GAME_SCALE,
    BOUNDARY_HALF_X,
    BOUNDARY_MIN_Y,
    BOUNDARY_MAX_Y,
    BOUNDARY_HALF_Z,
} from "./FlockingSystem.js";

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Fish } from './Fish.js';
import { FlockingSystem } from './FlockingSystem.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import Predator from './Predator.js';

export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x158DA0); // Deep water color
        this.scene.fog = new THREE.Fog(0x158DA0, 0, 20 * GAME_SCALE);

        this.lights = {
            directional: null,
            spotlight: null,
            ambient: null
        };

        this.objects = [];
        this.fish = [];
        this.predators = [];
        this.goalZones = [];
        this.spawnZones = [];
        this.predatorSpawnZones = [];

        // Flocking system
        this.flockingSystem = new FlockingSystem();

        this.bait = null;
        this.skybox = null;

        // Callbacks
        this.onFishDeath = null;
        this.onFishReachGoal = null;

        // Store FBX models for shader switching
        this.fbxModels = [];

        this.shaderManager = null;

        // Debug visualization
        this.debugMeshes = [];
        this.isDebugViewEnabled = false;
    }

    init = async (shaderManager) => {
        this.shaderManager = shaderManager;

        this.setupLights();
        await this.setupSkybox();
        await this.loadSceneModel();

        await this.loadObstaclesFromFBX();

        this.createGroundPlane();
        this.createBoundaryVisualization();
        this.createTeamNamesScene();
    }

    loadSceneModel = async () => {
        const loader = new FBXLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/models/Scene.fbx',
                (fbx) => {
                    const baseScale = 0.05 * GAME_SCALE;
                    fbx.scale.set(baseScale, baseScale, baseScale);
                    console.log(`Scene.fbx loaded with textures (scale: ${GAME_SCALE}x)`);

                    // Extract textures from the model before applying shaders
                    const textures = this.extractTexturesFromModel(fbx);

                    if (this.shaderManager) {
                        this.createShaderMaterialsForModel(fbx, textures);
                        this.applyShaderToModel(fbx, this.shaderManager.activeShader);
                    }

                    // Store model reference for shader switching
                    this.fbxModels.push(fbx);

                    this.scene.add(fbx);
                    resolve(fbx);
                },
                (progress) => { },
                (error) => {
                    console.error('Error loading Scene.fbx:', error);
                    reject(error);
                }
            );
        });
    }

    extractTexturesFromModel = (fbx) => {
        const textures = new Map();

        fbx.traverse((child) => {
            if (child.isMesh && child.material) {
                // Handle both single material and material array
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach((material) => {
                    if (material.map && material.map.isTexture) {
                        textures.set(child.uuid, material.map);
                    }
                });
            }
        });

        if (textures.size > 0) {
            console.log(`Extracted ${textures.size} textures from FBX model`);
        } else {
            console.log('No textures found in FBX model, using material colors');
        }
        return textures;
    }

    createShaderMaterialsForModel = (fbx, textures) => {
        if (!this.shaderManager) return;

        // Store materials on the model's userData
        fbx.userData.shaderMaterials = {
            phong: new Map(),
            toon: new Map(),
            underwater: new Map()
        };

        fbx.traverse((child) => {
            if (child.isMesh) {
                const texture = textures.get(child.uuid) || null;

                const phongMaterial = this.shaderManager.createShaderMaterial('phong', texture);
                fbx.userData.shaderMaterials.phong.set(child.uuid, phongMaterial);

                const toonMaterial = this.shaderManager.createShaderMaterial('toon', texture);
                fbx.userData.shaderMaterials.toon.set(child.uuid, toonMaterial);

                const underwaterMaterial = this.shaderManager.createShaderMaterial('underwater', texture);
                fbx.userData.shaderMaterials.underwater.set(child.uuid, underwaterMaterial);
            }
        });

        console.log('Created shader materials for FBX model');
    }


    applyShaderToModel = (fbx, shaderName) => {
        if (!fbx.userData.shaderMaterials || !fbx.userData.shaderMaterials[shaderName]) {
            console.warn('Shader materials not found for model');
            return;
        }

        fbx.traverse((child) => {
            if (child.isMesh) {
                const material = fbx.userData.shaderMaterials[shaderName].get(child.uuid);
                if (material) {
                    child.material = material;
                }
            }
        });
    }

    loadFBXMesh = async (filePath, position, scale = new THREE.Vector3(0.01, 0.01, 0.01), rotation = new THREE.Euler(0, 0, 0)) => {
        const loader = new FBXLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                filePath,
                (fbx) => {
                    // Apply GAME_SCALE to both scale and position
                    const scaledScale = scale.clone().multiplyScalar(GAME_SCALE);
                    const scaledPosition = position.clone().multiplyScalar(GAME_SCALE);

                    fbx.scale.copy(scaledScale);
                    fbx.position.copy(scaledPosition);
                    fbx.rotation.copy(rotation);
                    this.scene.add(fbx);
                    console.log(`FBX mesh loaded: ${filePath}`);
                    resolve(fbx);
                },
                (progress) => { },
                (error) => {
                    console.error(`Error loading ${filePath}:`, error);
                    reject(error);
                }
            );
        });
    }

    setupSkybox = async () => {
        const loader = new THREE.TextureLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/textures/skyrender.png',
                (texture) => {
                    this.skybox = new GroundedSkybox(texture, 15, 15);
                    this.skybox.position.y = 10; // Adjust height as needed
                    this.skybox.scale.multiplyScalar(GAME_SCALE);
                    this.scene.add(this.skybox);

                    console.log('Skybox loaded successfully');
                    resolve(this.skybox);
                },
                undefined,
                (error) => {
                    console.error('Error loading skybox texture:', error);
                    reject(error);
                }
            );
        });
    }

    loadFBXBoundaries = async (filePath, position, scale = new THREE.Vector3(0.01, 0.01, 0.01), rotation = new THREE.Euler(0, 0, 0)) => {
        const loader = new FBXLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                filePath,
                (fbx) => {
                    let sphereCount = 0;
                    const boundaryData = [];

                    // Configuration for boundaries
                    const BOUNDARY_CONFIG = {
                        positionScale: scale.x, // Use X component as uniform scale
                        positionOffset: position,
                        scaleMultiplier: scale.x
                    };

                    if (rotation.x !== 0 || rotation.y !== 0 || rotation.z !== 0) {
                        fbx.rotation.copy(rotation);
                    }

                    fbx.traverse((child) => {
                        if (child.isMesh && child.geometry) {
                            const geometry = child.geometry;

                            child.updateWorldMatrix(true, false);
                            const worldPosition = new THREE.Vector3();
                            const worldScale = new THREE.Vector3();
                            const worldQuaternion = new THREE.Quaternion();
                            child.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

                            // Apply scale and position offset
                            worldPosition.multiplyScalar(BOUNDARY_CONFIG.positionScale * GAME_SCALE);
                            worldPosition.add(BOUNDARY_CONFIG.positionOffset);
                            worldScale.multiplyScalar(BOUNDARY_CONFIG.scaleMultiplier);

                            if (!geometry.boundingSphere) {
                                geometry.computeBoundingSphere();
                            }

                            const boundingSphere = geometry.boundingSphere;

                            // Check if this is a sphere
                            const isSphere = child.name.toLowerCase().includes('sphere') ||
                                child.name.toLowerCase().includes('ball') ||
                                this.isSphereGeometry(geometry);

                            if (isSphere) {
                                const radius = boundingSphere.radius * GAME_SCALE;
                                const data = this.addObstacle(worldPosition, radius, worldScale, worldQuaternion);
                                boundaryData.push(data);
                                sphereCount++;
                            }
                        }
                    });

                    console.log(`FBX boundaries loaded: ${filePath} - Found ${sphereCount} sphere obstacles`);
                    resolve(boundaryData);
                },
                (progress) => { },
                (error) => {
                    console.error(`Error loading ${filePath}:`, error);
                    reject(error);
                }
            );
        });
    }

    loadObstaclesFromFBX = async () => {
        const loader = new FBXLoader();

        // Configuration for importing obstacles from Blender FBX (apply GAME_SCALE)
        const OBSTACLE_IMPORT_CONFIG = {
            positionScale: 0.05 * GAME_SCALE,
            positionOffset: new THREE.Vector3(0, 0, 0).multiplyScalar(GAME_SCALE),
            scaleMultiplier: 0.05
        };

        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/models/AllSceneColliders.fbx',
                (fbx) => {
                    let sphereCount = 0;

                    fbx.traverse((child) => {
                        if (child.isMesh && child.geometry) {
                            const geometry = child.geometry;

                            child.updateWorldMatrix(true, false);
                            const worldPosition = new THREE.Vector3();
                            const worldScale = new THREE.Vector3();
                            const worldQuaternion = new THREE.Quaternion();
                            child.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

                            // Apply scale factor to bring coordinates to scene scale
                            worldPosition.multiplyScalar(OBSTACLE_IMPORT_CONFIG.positionScale);
                            worldPosition.add(OBSTACLE_IMPORT_CONFIG.positionOffset);
                            worldScale.multiplyScalar(OBSTACLE_IMPORT_CONFIG.scaleMultiplier);

                            if (!geometry.boundingSphere) {
                                geometry.computeBoundingSphere();
                            }

                            const boundingSphere = geometry.boundingSphere;

                            // If the object name contains "Sphere" or has relatively uniform scale
                            const isSphere = child.name.toLowerCase().includes('sphere') ||
                                child.name.toLowerCase().includes('ball') ||
                                this.isSphereGeometry(geometry);

                            if (isSphere) {
                                const radius = boundingSphere.radius * GAME_SCALE;

                                // Add as obstacle with ellipsoid scale and rotation
                                this.addObstacle(worldPosition, radius, worldScale, worldQuaternion);
                                sphereCount++;
                            }
                        }
                    });

                    console.log(`ObstacleSpheres.fbx loaded - Found ${sphereCount} sphere obstacles`);
                    resolve(fbx);
                },
                (progress) => { },
                (error) => {
                    console.error('Error loading ObstacleSpheres.fbx:', error);
                    reject(error);
                }
            );
        });
    }


    isSphereGeometry(geometry) {
        // check if vertices are roughly equidistant from center
        const positions = geometry.attributes.position;
        if (!positions || positions.count < 10) return false;

        // Sample some vertices
        const sampleCount = Math.min(20, positions.count);
        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(i * positions.count / sampleCount);
            const x = positions.getX(idx);
            const y = positions.getY(idx);
            const z = positions.getZ(idx);
            const distance = Math.sqrt(x * x + y * y + z * z);
            samples.push(distance);
        }

        // Calculate variance
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
        const stdDev = Math.sqrt(variance);

        // If standard deviation is low relative to mean, it's likely a sphere
        const coefficientOfVariation = stdDev / mean;
        return coefficientOfVariation < 0.1; // Less than 10% variation
    }

    setupLights = () => {
        this.lights.ambient = new THREE.AmbientLight(0x7296DD, 1.0);
        this.scene.add(this.lights.ambient);

        // Directional light (sun)
        this.lights.directional = new THREE.DirectionalLight(0xffffff, 1.0);
        this.lights.directional.position.set(5, 10, 5);
        this.lights.directional.target.position.set(0, 0, 0);
        this.lights.directional.castShadow = true;
        this.scene.add(this.lights.directional);
    }

    createGroundPlane() {
        const groundGeometry = new THREE.PlaneGeometry(100 * GAME_SCALE, 100 * GAME_SCALE);
        const textureLoader = new THREE.TextureLoader();
        const sandyTexture = textureLoader.load('../assets/models/SandyDry_S.jpg');

        sandyTexture.wrapS = THREE.RepeatWrapping;
        sandyTexture.wrapT = THREE.RepeatWrapping;
        sandyTexture.repeat.set(20 * GAME_SCALE, 20 * GAME_SCALE); // Scaled with world

        const groundMaterial = new THREE.MeshStandardMaterial({
            map: sandyTexture,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = 0.01;
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    createBoundaryVisualization = () => {
        const width = BOUNDARY_HALF_X * 2;
        const height = BOUNDARY_MAX_Y - BOUNDARY_MIN_Y;
        const depth = BOUNDARY_HALF_Z * 2;
        const centerY = (BOUNDARY_MIN_Y + BOUNDARY_MAX_Y) / 2;

        const boundaryGeometry = new THREE.BoxGeometry(width, height, depth);
        const boundaryMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });

        const boundaryBox = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
        boundaryBox.position.set(0, centerY, 0);
        boundaryBox.visible = this.isDebugViewEnabled;

        this.scene.add(boundaryBox);
        this.debugMeshes.push(boundaryBox);
    }

    createTeamNamesScene = async () => {
        const textLines = [
            'Flocking Frenzy', '-a game by-', 'Ahmet Toktas 2230356015', 'Sinan Ermis 2220356143', 'Dursun Zahid Korkmaz 2210356020', 'Berkay Orene 2210356017'
        ];

        const fontLoader = new FontLoader();

        fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
            (font) => {
                const textMaterial = new THREE.MeshStandardMaterial({
                    color: 0xFF0000,
                    emissive: 0xFF0000,
                    emissiveIntensity: 0.3,
                    roughness: 0.4,
                    metalness: 0.2
                });

                const basePosition = new THREE.Vector3(60, 0, -5);
                const lineHeight = 2;

                textLines.forEach((text, index) => {
                    const textGeometry = new TextGeometry(text, {
                        font: font,
                        size: index === 0 ? 1.0 : 1.0, // Larger size for title
                        depth: 0.3,
                        curveSegments: 12,
                        bevelEnabled: true,
                        bevelThickness: 0.1,
                        bevelSize: 0.05,
                        bevelOffset: 0,
                        bevelSegments: 5
                    });

                    // Center the text
                    textGeometry.computeBoundingBox();
                    const centerOffset = -0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x);

                    const textMesh = new THREE.Mesh(textGeometry, textMaterial.clone());

                    textMesh.position.set(
                        basePosition.x + centerOffset,
                        basePosition.y,
                        basePosition.z + (index * lineHeight)
                    );

                    textMesh.rotation.x = -Math.PI / 2;
                    textMesh.castShadow = true;
                    this.scene.add(textMesh);
                });

                console.log('Team names scene created at (20, 0, 0)');
            },
            undefined,
            (error) => {
                console.error('Error loading font:', error);
            }
        );
    }

    spawnFishSchool = async (count = 50, spawnPosition = new THREE.Vector3(0, 2, 0), spawnSpread = new THREE.Vector3(5, 2, 5)) => {
        const loader = new FBXLoader();
        const fishScale = new THREE.Vector3(0.01, 0.01, 0.01);

        // Load the koi fish model once and clone it for each fish
        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/models/koifish.fbx',
                (fbx) => {
                    console.log('koifish.fbx model loaded for spawning');

                    for (let i = 0; i < count; i++) {
                        const fish = new Fish();

                        fish.position.set(
                            spawnPosition.x + (Math.random() - 0.5) * spawnSpread.x,
                            spawnPosition.y + (Math.random() - 0.5) * spawnSpread.y,
                            spawnPosition.z + (Math.random() - 0.5) * spawnSpread.z
                        );

                        fish.velocity.set(
                            -0.5 + Math.random(),
                            -0.2 + Math.random() * 0.4,
                            -0.5 + Math.random()
                        );

                        const fishMesh = fbx.clone();
                        const scaledScale = fishScale.clone().multiplyScalar(GAME_SCALE);
                        fishMesh.scale.copy(scaledScale);

                        // Rotate to point forward (like the cone did)
                        fishMesh.rotation.y = Math.PI / 2;

                        // Extract textures from THIS cloned mesh (important: clones have different UUIDs)
                        const textures = this.extractTexturesFromModel(fishMesh);

                        this.createShaderMaterialsForModel(fishMesh, textures);

                        if (this.shaderManager) {
                            this.applyShaderToModel(fishMesh, this.shaderManager.activeShader);
                        }

                        // Store model reference for shader switching
                        this.fbxModels.push(fishMesh);

                        fishMesh.castShadow = true;
                        fish.setMesh(fishMesh);
                        this.scene.add(fishMesh);

                        fish.onDeath = () => {
                            if (this.onFishDeath) {
                                this.onFishDeath();
                            }
                        };

                        this.flockingSystem.addFish(fish);
                        this.fish.push(fish);
                    }

                    console.log(`Spawned ${count} fish`);
                    resolve();
                },
                (progress) => { },
                (error) => {
                    console.error('Error loading koifish.fbx:', error);
                    reject(error);
                }
            );
        });
    }

    createBait = (position = new THREE.Vector3(30, 8, 30)) => {
        const baitGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const baitMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.7
        });

        this.bait = new THREE.Mesh(baitGeometry, baitMaterial);
        this.bait.position.copy(position);
        this.scene.add(this.bait);

        this.flockingSystem.addBait(this.bait);
    }

    createGoalBait = (position = new THREE.Vector3(10, 3, 10)) => {
        const baitGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const baitMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.8
        });

        const goalBait = new THREE.Mesh(baitGeometry, baitMaterial);
        goalBait.position.copy(position);
        goalBait.userData.isGoalBait = true; // Mark as special goal bait
        goalBait.userData.createdBy = 'SceneManager';
        this.scene.add(goalBait);

        this.flockingSystem.addBait(goalBait);
        return goalBait;
    }

    removeGoalBait = () => {
        if (this.bait && this.bait.userData.isGoalBait) {
            this.flockingSystem.removeBait(this.bait);
            this.scene.remove(this.bait);
            if (this.bait.geometry) this.bait.geometry.dispose();
            if (this.bait.material) this.bait.material.dispose();
            this.bait = null;
        }
    }


    registerBait = (baitObject) => {
        this.flockingSystem.addBait(baitObject);
    }

    unregisterBait = (baitObject) => {
        this.flockingSystem.removeBait(baitObject);
    }

    consumeBait = (baitObject) => {
        this.scene.remove(baitObject);

        if (baitObject.geometry) baitObject.geometry.dispose();
        if (baitObject.material) baitObject.material.dispose();

        // If this was the default bait, clear reference
        if (baitObject === this.bait) {
            this.bait = null;
        }
    }

    addObstacle = (position, radius = 1.0, scale = new THREE.Vector3(1, 1, 1), rotation = new THREE.Quaternion()) => {
        const obstacle = {
            position: position.clone(),
            boundingRadius: radius,
            scale: scale.clone(),
            rotation: rotation.clone()
        };

        this.flockingSystem.addObstacle(obstacle);

        // Add wireframe helper for extra visibility
        const wireframeMesh = this.showWireFrameObstacleSpheres(radius, position, scale, rotation);
        if (wireframeMesh) {
            wireframeMesh.visible = this.isDebugViewEnabled;
            this.debugMeshes.push(wireframeMesh);
        }

        return {
            obstacle: obstacle,
            wireframeMesh: wireframeMesh
        };
    }

    /**
     * Remove obstacles associated with a placed object
     * @param {Array} boundaryData - Array of boundary data objects {obstacle, wireframeMesh}
     */
    removeObstacles = (boundaryData) => {
        if (!boundaryData || !Array.isArray(boundaryData)) return;

        let removedCount = 0;
        const meshesToRemove = new Set();

        for (const data of boundaryData) {
            if (data.obstacle) {
                this.flockingSystem.removeObstacle(data.obstacle);
                removedCount++;
            }
            if (data.wireframeMesh) {
                this.scene.remove(data.wireframeMesh);
                if (data.wireframeMesh.geometry) data.wireframeMesh.geometry.dispose();
                if (data.wireframeMesh.material) data.wireframeMesh.material.dispose();
                meshesToRemove.add(data.wireframeMesh);
            }
        }

        if (meshesToRemove.size > 0) {
            this.debugMeshes = this.debugMeshes.filter(mesh => !meshesToRemove.has(mesh));
        }

        console.log(`Removed ${removedCount} obstacle(s) from flocking system`);
    }

    spawnPredator = async (position = new THREE.Vector3(0, 2, 0)) => {
        const loader = new FBXLoader();
        const sharkScale = new THREE.Vector3(0.003, 0.003, 0.0015);

        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/models/Shark.fbx',
                (fbx) => {
                    const predator = new Predator(position, this.flockingSystem);

                    const sharkMesh = fbx.clone();
                    const scaledScale = sharkScale.clone().multiplyScalar(GAME_SCALE);
                    sharkMesh.scale.copy(scaledScale);
                    sharkMesh.position.copy(position);

                    // Rotate to point forward
                    sharkMesh.rotation.y = Math.PI / 2;

                    // Extract textures from THIS cloned mesh
                    const textures = this.extractTexturesFromModel(sharkMesh);

                    this.createShaderMaterialsForModel(sharkMesh, textures);

                    if (this.shaderManager) {
                        this.applyShaderToModel(sharkMesh, this.shaderManager.activeShader);
                    }

                    // Store model reference for shader switching
                    this.fbxModels.push(sharkMesh);

                    sharkMesh.castShadow = true;
                    predator.mesh = sharkMesh;

                    this.scene.add(sharkMesh);
                    this.predators.push(predator);

                    console.log('Predator (Shark) spawned');
                    resolve(predator);
                },
                (progress) => { },
                (error) => {
                    console.error('Error loading Shark.fbx:', error);
                    reject(error);
                }
            );
        });
    }

    createGoalZone = (position, radius = 2.5, color = 0x00ff00) => {
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            wireframe: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);

        // Add wireframe overlay for better visibility
        const wireframeGeometry = new THREE.SphereGeometry(radius, 16, 16);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        wireframeMesh.position.copy(position);
        this.scene.add(wireframeMesh);

        const goalZone = {
            position: position.clone(),
            radius: radius,
            mesh: mesh,
            wireframeMesh: wireframeMesh
        };

        this.goalZones.push(goalZone);
        return goalZone;
    }

    checkFishReachGoal = (onFishReachGoal) => {
        if (this.goalZones.length === 0) return;

        for (const fish of this.fish) {
            // Skip fish that are already dead
            if (!fish.alive) continue;

            for (const goalZone of this.goalZones) {
                const distance = fish.position.distanceTo(goalZone.position);

                if (distance <= goalZone.radius) {
                    // Mark fish as having reached goal (before killing it)
                    fish.reachedGoal = true;

                    // Kill the fish (makes it truly dead, invisible, not targetable)
                    // This will trigger onDeath callback which decreases fishAlive
                    fish.die();

                    // Notify game state to increase fishSaved
                    // GameState will compensate fishAlive by adding 1 back
                    if (onFishReachGoal) {
                        onFishReachGoal();
                    }

                    console.log(`Fish reached goal and saved!`);
                    break;
                }
            }
        }
    }

    clearGoalZones = () => {
        for (const goalZone of this.goalZones) {
            if (goalZone.mesh) {
                this.scene.remove(goalZone.mesh);
                if (goalZone.mesh.geometry) goalZone.mesh.geometry.dispose();
                if (goalZone.mesh.material) goalZone.mesh.material.dispose();
            }
            if (goalZone.wireframeMesh) {
                this.scene.remove(goalZone.wireframeMesh);
                if (goalZone.wireframeMesh.geometry) goalZone.wireframeMesh.geometry.dispose();
                if (goalZone.wireframeMesh.material) goalZone.wireframeMesh.material.dispose();
            }
        }
        this.goalZones = [];
    }

    createSpawnZone = (position, spread, color = 0xff9900) => {
        const geometry = new THREE.BoxGeometry(spread.x * 2, spread.y * 2, spread.z * 2);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            wireframe: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);

        const wireframeGeometry = new THREE.BoxGeometry(spread.x * 2, spread.y * 2, spread.z * 2);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        wireframeMesh.position.copy(position);
        this.scene.add(wireframeMesh);

        const spawnZone = {
            position: position.clone(),
            spread: spread.clone(),
            mesh: mesh,
            wireframeMesh: wireframeMesh
        };

        this.spawnZones.push(spawnZone);
        return spawnZone;
    }

    clearSpawnZones = () => {
        for (const spawnZone of this.spawnZones) {
            if (spawnZone.mesh) {
                this.scene.remove(spawnZone.mesh);
                if (spawnZone.mesh.geometry) spawnZone.mesh.geometry.dispose();
                if (spawnZone.mesh.material) spawnZone.mesh.material.dispose();
            }
            if (spawnZone.wireframeMesh) {
                this.scene.remove(spawnZone.wireframeMesh);
                if (spawnZone.wireframeMesh.geometry) spawnZone.wireframeMesh.geometry.dispose();
                if (spawnZone.wireframeMesh.material) spawnZone.wireframeMesh.material.dispose();
            }
        }
        this.spawnZones = [];
    }

    //Create a predator spawn zone visualization where predators will spawn
    //Uses a red/dark color scheme to indicate danger

    createPredatorSpawnZone = (position, color = 0xff0000) => {
        const radius = 1.5;

        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.25,
            wireframe: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);

        const wireframeGeometry = new THREE.SphereGeometry(radius, 16, 16);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        wireframeMesh.position.copy(position);
        this.scene.add(wireframeMesh);

        // Create a warning icon
        const iconGeometry = new THREE.ConeGeometry(0.3, 0.8, 8);
        const iconMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const iconMesh = new THREE.Mesh(iconGeometry, iconMaterial);
        iconMesh.position.copy(position);
        iconMesh.position.y += radius + 0.5; // Position above the sphere
        this.scene.add(iconMesh);

        const predatorSpawnZone = {
            position: position.clone(),
            mesh: mesh,
            wireframeMesh: wireframeMesh,
            iconMesh: iconMesh
        };

        this.predatorSpawnZones.push(predatorSpawnZone);
        return predatorSpawnZone;
    }

    clearPredatorSpawnZones = () => {
        for (const spawnZone of this.predatorSpawnZones) {
            if (spawnZone.mesh) {
                this.scene.remove(spawnZone.mesh);
                if (spawnZone.mesh.geometry) spawnZone.mesh.geometry.dispose();
                if (spawnZone.mesh.material) spawnZone.mesh.material.dispose();
            }
            if (spawnZone.wireframeMesh) {
                this.scene.remove(spawnZone.wireframeMesh);
                if (spawnZone.wireframeMesh.geometry) spawnZone.wireframeMesh.geometry.dispose();
                if (spawnZone.wireframeMesh.material) spawnZone.wireframeMesh.material.dispose();
            }
            if (spawnZone.iconMesh) {
                this.scene.remove(spawnZone.iconMesh);
                if (spawnZone.iconMesh.geometry) spawnZone.iconMesh.geometry.dispose();
                if (spawnZone.iconMesh.material) spawnZone.iconMesh.material.dispose();
            }
        }
        this.predatorSpawnZones = [];
    }

    clearFish = () => {
        for (const fish of this.fish) {
            if (fish.mesh) {
                this.scene.remove(fish.mesh);
                if (fish.mesh.geometry) fish.mesh.geometry.dispose();
                if (fish.mesh.material) fish.mesh.material.dispose();
            }
        }
        this.fish = [];
        this.flockingSystem.fish = [];
    }

    clearPredators = () => {
        for (const predator of this.predators) {
            if (predator.mesh) {
                this.scene.remove(predator.mesh);
                if (predator.mesh.geometry) predator.mesh.geometry.dispose();
                if (predator.mesh.material) predator.mesh.material.dispose();
            }
        }
        this.predators = [];
    }

    updateShader = (shaderManager) => {
        this.shaderManager = shaderManager;

        // Apply shader to all stored FBX models
        this.fbxModels.forEach(fbx => {
            this.applyShaderToModel(fbx, shaderManager.activeShader);
        });

        console.log('Scene shader updated to:', shaderManager.activeShader);
    }

    addFBXModel = (fbx) => {
        this.fbxModels.push(fbx);
    }

    update = (deltaTime) => {

        this.flockingSystem.update(deltaTime);

        if (this.onFishReachGoal) {
            this.checkFishReachGoal(this.onFishReachGoal);
        }

        // Animate bait (pulsing effect)
        if (this.bait) {
            const time = Date.now() * 0.001;
            const scale = 1.0 + Math.sin(time * 3) * 0.2;
            this.bait.scale.setScalar(scale);
        }

        this.predators.forEach(predator => {
            predator.update(deltaTime, this.fish, this.flockingSystem.obstacles);

            if (predator.mesh) {
                predator.mesh.position.copy(predator.position);

                if (predator.velocity.lengthSq() > 0.0001) {
                    const lookTarget = predator.position.clone().add(predator.velocity);
                    predator.mesh.lookAt(lookTarget);
                }
            }
        });
    }

    showWireFrameObstacleSpheres(radius, position, scale, rotation) {
        const wireframeGeometry = new THREE.SphereGeometry(radius, 16, 16);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        wireframeMesh.position.copy(position);
        wireframeMesh.scale.copy(scale);
        wireframeMesh.quaternion.copy(rotation);
        this.scene.add(wireframeMesh);

        return wireframeMesh;
    }

    toggleDebugView = () => {
        this.isDebugViewEnabled = !this.isDebugViewEnabled;

        this.debugMeshes.forEach(mesh => {
            if (mesh) mesh.visible = this.isDebugViewEnabled;
        });

        console.log(`Debug view ${this.isDebugViewEnabled ? 'enabled' : 'disabled'}`);
        return this.isDebugViewEnabled;
    }
}