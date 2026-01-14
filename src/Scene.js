/**
 * Scene Manager
 * Manages Three.js scene, lighting, and objects
 */

import {
    GAME_SCALE,
    BOUNDARY_HALF_X, 
    BOUNDARY_MIN_Y,
    BOUNDARY_MAX_Y,
    BOUNDARY_HALF_Z,
} from "./FlockingSystem.js";

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
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
        this.goalZones = []; // Goal zones for fish to reach
        this.spawnZones = []; // Fish spawn zones for visualization
        this.predatorSpawnZones = []; // Predator spawn zones for visualization

        // Flocking system
        this.flockingSystem = new FlockingSystem();

        // Bait (goal) object
        this.bait = null;
        this.skybox = null;

        // Callbacks
        this.onFishDeath = null; // Callback when fish dies
        this.onFishReachGoal = null; // Callback when fish reaches goal
        // Store FBX models for shader switching
        this.fbxModels = [];

        // Store reference to shader manager
        this.shaderManager = null;
    }

    init = async (shaderManager) => {
        // Store shader manager reference
        this.shaderManager = shaderManager;

        // Setup lighting
        this.setupLights();

        // Setup skybox
        await this.setupSkybox();

        // Load Scene.fbx model
        await this.loadSceneModel();

        // Load rock mesh and boundaries
        await this.loadRockMesh();
        await this.loadRockBoundaries();

        // Load obstacles from ObstacleSpheres.fbx
        await this.loadObstaclesFromFBX();
        // Create placeholder geometry for testing
        //this.createTestScene();

        this.createGroundPlane();
        this.createBoundaryVisualization();  // Show fish boundary area
        // Create team names scene (in separate area)
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
                    console.log(`✓ Scene.fbx loaded with textures (scale: ${GAME_SCALE}x)`);

                    // Extract textures from the model before applying shaders
                    const textures = this.extractTexturesFromModel(fbx);

                    // Apply shader materials if shader manager is available
                    if (this.shaderManager) {
                        this.createShaderMaterialsForModel(fbx, textures);
                        this.applyShaderToModel(fbx, this.shaderManager.activeShader);
                    }

                    // Store model reference for shader switching
                    this.fbxModels.push(fbx);

                    this.scene.add(fbx);
                    console.log('✓ Scene.fbx loaded with shader materials');
                    resolve(fbx);
                },
                (progress) => {
                    //console.log('Loading Scene.fbx:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading Scene.fbx:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Extract textures from FBX model's original materials
     * @param {THREE.Group} fbx - The FBX model
     * @returns {Map<string, THREE.Texture>} Map of mesh UUID to texture
     */
    extractTexturesFromModel = (fbx) => {
        const textures = new Map();

        fbx.traverse((child) => {
            if (child.isMesh && child.material) {
                // Handle both single material and material array
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach((material) => {
                    // Check if material has a valid map (texture)
                    if (material.map && material.map.isTexture) {
                        textures.set(child.uuid, material.map);
                    }
                });
            }
        });

        if (textures.size > 0) {
            console.log(`✓ Extracted ${textures.size} textures from FBX model`);
        } else {
            console.log('ℹ No textures found in FBX model, using material colors');
        }
        return textures;
    }

    /**
     * Create shader materials (phong and toon) for an FBX model
     * @param {THREE.Group} fbx - The FBX model
     * @param {Map<string, THREE.Texture>} textures - Map of mesh UUID to texture
     */
    createShaderMaterialsForModel = (fbx, textures) => {
        if (!this.shaderManager) return;

        // Store materials on the model's userData
        fbx.userData.shaderMaterials = {
            phong: new Map(),
            toon: new Map()
        };

        fbx.traverse((child) => {
            if (child.isMesh) {
                const texture = textures.get(child.uuid) || null;

                // Create phong material
                const phongMaterial = this.shaderManager.createShaderMaterial('phong', texture);
                fbx.userData.shaderMaterials.phong.set(child.uuid, phongMaterial);

                // Create toon material
                const toonMaterial = this.shaderManager.createShaderMaterial('toon', texture);
                fbx.userData.shaderMaterials.toon.set(child.uuid, toonMaterial);
            }
        });

        console.log('✓ Created shader materials for FBX model');
    }

    /**
     * Apply a specific shader to an FBX model
     * @param {THREE.Group} fbx - The FBX model
     * @param {string} shaderName - 'phong' or 'toon'
     */
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

    /**
     * Generic function to load an FBX mesh
     * @param {string} filePath - Path to the FBX file
     * @param {THREE.Vector3} position - Position in world space
     * @param {THREE.Vector3} scale - Scale factors (default 0.01 for all axes)
     * @param {THREE.Euler} rotation - Rotation in radians (default no rotation)
     * @returns {Promise<THREE.Group>} The loaded FBX object
     */
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
                    console.log(`✓ FBX mesh loaded: ${filePath} at (${scaledPosition.x.toFixed(2)}, ${scaledPosition.y.toFixed(2)}, ${scaledPosition.z.toFixed(2)}) scale ${GAME_SCALE}x`);
                    resolve(fbx);
                },
                (progress) => {
                    //console.log(`Loading ${filePath}:`, (progress.loaded / progress.total * 100) + '%');
                },
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
                    // Create GroundedSkybox with the loaded texture
                    this.skybox = new GroundedSkybox(texture, 15, 15);
                    this.skybox.position.y = 10; // Adjust height as needed
                    this.skybox.scale.multiplyScalar(GAME_SCALE);
                    this.scene.add(this.skybox);

                    console.log('✓ Skybox loaded successfully');
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

    /**
     * Generic function to load FBX boundary spheres as obstacles
     * @param {string} filePath - Path to the FBX boundary file
     * @param {THREE.Vector3} position - Position offset in world space
     * @param {THREE.Vector3} scale - Scale factors (default 0.01 for all axes)
     * @param {THREE.Euler} rotation - Rotation in radians (default no rotation)
     * @returns {Promise<Array>} Array of boundary data objects {obstacle, wireframeMesh}
     */
    loadFBXBoundaries = async (filePath, position, scale = new THREE.Vector3(0.01, 0.01, 0.01), rotation = new THREE.Euler(0, 0, 0)) => {
        const loader = new FBXLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                filePath,
                (fbx) => {
                    let sphereCount = 0;
                    const boundaryData = []; // Store boundary data for later removal

                    // Configuration for boundaries
                    const BOUNDARY_CONFIG = {
                        positionScale: scale.x, // Use X component as uniform scale
                        positionOffset: position,
                        scaleMultiplier: scale.x
                    };

                    // Apply rotation to the entire FBX group if needed
                    if (rotation.x !== 0 || rotation.y !== 0 || rotation.z !== 0) {
                        fbx.rotation.copy(rotation);
                    }

                    // Traverse all objects in the FBX
                    fbx.traverse((child) => {
                        if (child.isMesh && child.geometry) {
                            const geometry = child.geometry;

                            // Get world position and scale
                            child.updateWorldMatrix(true, false);
                            const worldPosition = new THREE.Vector3();
                            const worldScale = new THREE.Vector3();
                            const worldQuaternion = new THREE.Quaternion();
                            child.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

                            // Apply scale and position offset
                            worldPosition.multiplyScalar(BOUNDARY_CONFIG.positionScale * GAME_SCALE);
                            worldPosition.add(BOUNDARY_CONFIG.positionOffset);
                            worldScale.multiplyScalar(BOUNDARY_CONFIG.scaleMultiplier);

                            // Calculate bounding sphere
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
                                boundaryData.push(data); // Store for later removal

                                sphereCount++;
                                console.log(`✓ Added boundary: ${child.name} at (${worldPosition.x.toFixed(2)}, ${worldPosition.y.toFixed(2)}, ${worldPosition.z.toFixed(2)})`);
                            }
                        }
                    });

                    console.log(`✓ FBX boundaries loaded: ${filePath} - Found ${sphereCount} sphere obstacles`);
                    resolve(boundaryData); // Return boundary data instead of fbx
                },
                (progress) => {
                    //console.log(`Loading ${filePath}:`, (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error(`Error loading ${filePath}:`, error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Load kaya1 rock mesh for visual display
     * (Wrapper function using generic loadFBXMesh)
     */
    loadRockMesh = async () => {
        const ROCK_POSITION = new THREE.Vector3(10, 0, 10);
        const ROCK_SCALE = new THREE.Vector3(0.01, 0.01, 0.01);

        return this.loadFBXMesh(
            '../assets/models/kaya1.fbx',
            ROCK_POSITION,
            ROCK_SCALE
        );
    }

    /**
     * Load kaya1 boundary spheres as obstacles
     * (Wrapper function using generic loadFBXBoundaries)
     */
    loadRockBoundaries = async () => {
        const ROCK_POSITION = new THREE.Vector3(10, 0, 10);
        const ROCK_SCALE = new THREE.Vector3(0.01, 0.01, 0.01);

        return this.loadFBXBoundaries(
            '../assets/models/kaya1Boundaries.fbx',
            ROCK_POSITION,
            ROCK_SCALE
        );
    }

    /**
     * Load obstacles from ObstacleSpheres.fbx
     * Detects all sphere objects and adds them as obstacles
     */
    loadObstaclesFromFBX = async () => {
        const loader = new FBXLoader();

        // Configuration for importing obstacles from Blender FBX (apply GAME_SCALE)
        const OBSTACLE_IMPORT_CONFIG = {
            // Position scale factor (scaled by GAME_SCALE)
            positionScale: 0.05 * GAME_SCALE,

            // Position offset to align with Scene.fbx coordinate system (scaled)
            positionOffset: new THREE.Vector3(0, 0, 0).multiplyScalar(GAME_SCALE),

            // Scale multiplier to match Blender units (scaled by GAME_SCALE)
            scaleMultiplier: 0.05
        };

        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/models/AllSceneColliders.fbx',
                (fbx) => {
                    let sphereCount = 0;

                    // Traverse all objects in the FBX
                    fbx.traverse((child) => {
                        if (child.isMesh && child.geometry) {
                            // Check if this is a sphere by analyzing the geometry
                            const geometry = child.geometry;

                            // Get world position and scale
                            child.updateWorldMatrix(true, false);
                            const worldPosition = new THREE.Vector3();
                            const worldScale = new THREE.Vector3();
                            const worldQuaternion = new THREE.Quaternion();
                            child.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

                            // Apply scale factor to bring coordinates to scene scale
                            worldPosition.multiplyScalar(OBSTACLE_IMPORT_CONFIG.positionScale);
                            worldPosition.add(OBSTACLE_IMPORT_CONFIG.positionOffset);
                            worldScale.multiplyScalar(OBSTACLE_IMPORT_CONFIG.scaleMultiplier);

                            // Calculate bounding sphere
                            if (!geometry.boundingSphere) {
                                geometry.computeBoundingSphere();
                            }

                            const boundingSphere = geometry.boundingSphere;

                            // Heuristic: If the object name contains "Sphere" or has relatively uniform scale
                            const isSphere = child.name.toLowerCase().includes('sphere') ||
                                child.name.toLowerCase().includes('ball') ||
                                this.isSphereGeometry(geometry);

                            if (isSphere) {
                                // Scale radius to match world scale
                                const radius = boundingSphere.radius * GAME_SCALE;

                                // Add as obstacle with ellipsoid scale and rotation
                                // The obstacle will be: sphere with base radius, scaled by worldScale
                                this.addObstacle(worldPosition, radius, worldScale, worldQuaternion);

                                sphereCount++;
                                console.log(`✓ Added obstacle: ${child.name} at (${worldPosition.x.toFixed(2)}, ${worldPosition.y.toFixed(2)}, ${worldPosition.z.toFixed(2)}) radius ${radius.toFixed(2)} scale (${worldScale.x.toFixed(2)}, ${worldScale.y.toFixed(2)}, ${worldScale.z.toFixed(2)})`);
                            }
                        }
                    });

                    console.log(`✓ ObstacleSpheres.fbx loaded - Found ${sphereCount} sphere obstacles`);
                    resolve(fbx);
                },
                (progress) => {
                    //console.log('Loading ObstacleSpheres.fbx:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading ObstacleSpheres.fbx:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Helper function to detect if a geometry is spherical
     * Checks vertex distribution to determine if it's a sphere
     */
    isSphereGeometry(geometry) {
        // Simple heuristic: check if vertices are roughly equidistant from center
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
        // Ambient light
        this.lights.ambient = new THREE.AmbientLight(0x7296DD, 1.0);
        this.scene.add(this.lights.ambient);

        // Directional light (sun)
        this.lights.directional = new THREE.DirectionalLight(0xffffff, 1.0);
        this.lights.directional.position.set(5, 10, 5);
        this.lights.directional.target.position.set(0, 0, 0);
        this.lights.directional.castShadow = true;
        this.scene.add(this.lights.directional);
        
        // const helper = new THREE.DirectionalLightHelper(this.lights.directional, 5);
        // this.scene.add(helper);
        
        // Spotlight (BBM 412 requirement)
        // this.lights.spotlight = new THREE.SpotLight(0xffffff, 2.0);
        // this.lights.spotlight.position.set(0, 10, 0);
        // this.lights.spotlight.angle = Math.PI / 6;
        // this.lights.spotlight.penumbra = 0.2;
        // this.lights.spotlight.decay = 2;
        // this.lights.spotlight.distance = 50;
        // this.lights.spotlight.castShadow = true;

        // // Spotlight target
        // this.lights.spotlight.target.position.set(0, 0, 0);
        // this.scene.add(this.lights.spotlight);
        // this.scene.add(this.lights.spotlight.target);

        // // Helper for spotlight (for debugging)
        // const spotLightHelper = new THREE.SpotLightHelper(this.lights.spotlight);
        // this.scene.add(spotLightHelper);
    }

    createTestScene = () => {
        // Ground plane with sandy texture
        this.createGroundPlane();

        // Test cube (Morphology #1 for BBM 412)
        const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6b6b,
            roughness: 0.5,
            metalness: 0.3
        });
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cube.position.set(0, 1, 0);
        cube.castShadow = true;
        cube.receiveShadow = true;
        this.scene.add(cube);
        this.objects.push(cube);

        // Test sphere (Morphology #2 for BBM 412)
        const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
        const sphereMaterial = new THREE.MeshStandardMaterial({
            color: 0x4ecdc4,
            roughness: 0.3,
            metalness: 0.7
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.set(4, 1, 0);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        this.scene.add(sphere);
        this.objects.push(sphere);

        // Test cone (Morphology #3 for BBM 412)
        const coneGeometry = new THREE.ConeGeometry(1, 2, 32);
        const coneMaterial = new THREE.MeshStandardMaterial({
            color: 0xf9ca24,
            roughness: 0.4,
            metalness: 0.5
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(-4, 1, 0);
        cone.castShadow = true;
        cone.receiveShadow = true;
        this.scene.add(cone);
        this.objects.push(cone);
    }

    createGroundPlane() {
        const groundGeometry = new THREE.PlaneGeometry(100 * GAME_SCALE, 100 * GAME_SCALE);

        // Load sandy texture
        const textureLoader = new THREE.TextureLoader();
        const sandyTexture = textureLoader.load('../assets/models/SandyDry_S.jpg');

        // Configure texture wrapping and repeat for better appearance
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

    /**
     * Create wireframe visualization for fish boundary area
     * Shows the play area where fish are confined
     */
    createBoundaryVisualization = () => {
        // Calculate box dimensions and center position
        const width = BOUNDARY_HALF_X * 2;   // 20
        const height = BOUNDARY_MAX_Y - BOUNDARY_MIN_Y; // 6.5
        const depth = BOUNDARY_HALF_Z * 2;   // 20
        
        const centerY = (BOUNDARY_MIN_Y + BOUNDARY_MAX_Y) / 2; // 1.75
        
        // Create wireframe box
        const boundaryGeometry = new THREE.BoxGeometry(width, height, depth);
        const boundaryMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,  // Green color for boundary
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        const boundaryBox = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
        boundaryBox.position.set(0, centerY, 0);
        this.scene.add(boundaryBox);
        
        console.log(`✓ Boundary visualization created: ${width}x${height}x${depth} at (0, ${centerY.toFixed(2)}, 0)`);
    }

    createTeamNamesScene = () => {
        // This will be located at a separate area (e.g., y = -50)
        // For now, create placeholder text using 3D objects
        const nameGeometry = new THREE.BoxGeometry(1, 1, 1);
        const nameMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

        // TODO: Replace with actual team member names using 3D text or assembled cubes
        const namePlaceholder = new THREE.Mesh(nameGeometry, nameMaterial);
        namePlaceholder.position.set(0, -50, 0);
        this.scene.add(namePlaceholder);
    }

    /**
     * Spawn a school of fish
     * @param {number} count - Number of fish to spawn
     * @param {THREE.Vector3} spawnPosition - Center position for spawning
     * @param {THREE.Vector3} spawnSpread - Random spread area (x, y, z)
     */
    spawnFishSchool = (count = 50, spawnPosition = new THREE.Vector3(0, 2, 0), spawnSpread = new THREE.Vector3(5, 2, 5)) => {
        const fishGeometry = new THREE.ConeGeometry(0.15, 0.5, 8);
        fishGeometry.rotateX(Math.PI * -0.5); // Point forward

        const fishMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a90e2,
            roughness: 0.6,
            metalness: 0.4,
            emissive: 0x1a3a5a,
            emissiveIntensity: 0.2
        });

        for (let i = 0; i < count; i++) {
            // Create fish entity
            const fish = new Fish();

            // Random spawn position within spread area
            fish.position.set(
                spawnPosition.x + (Math.random() - 0.5) * spawnSpread.x,
                spawnPosition.y + (Math.random() - 0.5) * spawnSpread.y,
                spawnPosition.z + (Math.random() - 0.5) * spawnSpread.z
            );

            // Random initial velocity
            fish.velocity.set(
                -0.5 + Math.random(),
                -0.2 + Math.random() * 0.4,
                -0.5 + Math.random()
            );

            // Create mesh
            const mesh = new THREE.Mesh(fishGeometry, fishMaterial.clone());
            mesh.castShadow = true;
            fish.setMesh(mesh);
            this.scene.add(mesh);

            // Set death callback
            fish.onDeath = () => {
                if (this.onFishDeath) {
                    this.onFishDeath();
                }
            };

            // Add to flocking system
            this.flockingSystem.addFish(fish);
            this.fish.push(fish);
        }

        console.log(`✓ Spawned ${count} fish at (${spawnPosition.x.toFixed(2)}, ${spawnPosition.y.toFixed(2)}, ${spawnPosition.z.toFixed(2)})`);
    }

    /**
     * Create bait (goal) object
     */
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

        // Register with flocking system
        this.flockingSystem.addBait(this.bait);

        console.log('✓ Created bait at', position);
    }

    /**
     * Create a goal bait that doesn't get consumed (for guiding fish to goal)
     */
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

        // Register with flocking system
        this.flockingSystem.addBait(goalBait);

        console.log('✓ Created goal bait at', position);
        return goalBait;
    }

    /**
     * Remove goal bait
     */
    removeGoalBait = () => {
        if (this.bait && this.bait.userData.isGoalBait) {
            this.flockingSystem.removeBait(this.bait);
            this.scene.remove(this.bait);
            if (this.bait.geometry) this.bait.geometry.dispose();
            if (this.bait.material) this.bait.material.dispose();
            this.bait = null;
            console.log('✓ Goal bait removed');
        }
    }

    /**
     * Register a bait object placed by ObjectManager
     * This allows fish to chase baits placed in build mode
     */
    registerBait = (baitObject) => {
        this.flockingSystem.addBait(baitObject);
    }

    /**
     * Unregister a bait object (e.g., when removed)
     */
    unregisterBait = (baitObject) => {
        this.flockingSystem.removeBait(baitObject);
    }

    /**
     * Handle bait consumption - remove bait from scene
     * Called by FlockingSystem when fish consume bait
     */
    consumeBait = (baitObject) => {
        // Remove from scene
        this.scene.remove(baitObject);

        // Clean up geometry and material
        if (baitObject.geometry) baitObject.geometry.dispose();
        if (baitObject.material) baitObject.material.dispose();

        // If this was the default bait, clear reference
        if (baitObject === this.bait) {
            this.bait = null;
        }

        console.log('✓ Bait consumed by fish!');
    }

    /**
     * Add obstacle for fish to avoid
     * @returns {Object} Object containing obstacle and wireframe mesh references
     */
    addObstacle = (position, radius = 1.0, scale = new THREE.Vector3(1, 1, 1), rotation = new THREE.Quaternion()) => {
        const obstacle = {
            position: position.clone(),
            boundingRadius: radius,
            scale: scale.clone(),
            rotation: rotation.clone()
        };

        // Add to flocking system
        this.flockingSystem.addObstacle(obstacle);

        // Add wireframe helper for extra visibility
        // const wireframeMesh = this.showWireFrameObstacleSpheres(radius, position, scale, rotation);
        const wireframeMesh = null;
        
        // Return both obstacle and wireframe for later removal
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
        for (const data of boundaryData) {
            if (data.obstacle) {
                this.flockingSystem.removeObstacle(data.obstacle);
                removedCount++;
            }
            if (data.wireframeMesh) {
                this.scene.remove(data.wireframeMesh);
                if (data.wireframeMesh.geometry) data.wireframeMesh.geometry.dispose();
                if (data.wireframeMesh.material) data.wireframeMesh.material.dispose();
            }
        }

        console.log(`✓ Removed ${removedCount} obstacle(s) from flocking system`);
    }

    spawnPredator = (position = new THREE.Vector3(0, 2, 0)) => {
    const predator = new Predator(position);

    // 🦈 Mesh
    const geometry = new THREE.ConeGeometry(0.4, 1.5, 12);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.4,
        metalness: 0.6
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(position);

    predator.mesh = mesh;

    this.scene.add(mesh);
    this.predators.push(predator);

    console.log('✓ Predator spawned');
    }

    /**
     * Create a goal zone where fish need to reach
     * @param {THREE.Vector3} position - Goal zone center position
     * @param {number} radius - Goal zone radius
     * @param {number} color - Goal zone color (hex)
     * @returns {Object} Goal zone object with mesh and parameters
     */
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

        console.log(`✓ Created goal zone at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) with radius ${radius}`);

        return goalZone;
    }

    /**
     * Check if fish have reached goal zones and mark them
     * @param {Function} onFishReachGoal - Callback when fish reaches goal
     */
    checkFishReachGoal = (onFishReachGoal) => {
        if (this.goalZones.length === 0) return;

        for (const fish of this.fish) {
            // Skip fish that are already dead
            if (!fish.alive) continue;

            // Check against all goal zones
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

                    console.log(`🐟 Fish reached goal and saved!`);

                    break; // Fish reached a goal, no need to check other zones
                }
            }
        }
    }

    /**
     * Clear all goal zones
     */
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
        console.log('✓ Goal zones cleared');
    }

    /**
     * Create a spawn zone visualization where fish will spawn
     */
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
        console.log(`✓ Created spawn zone at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);

        return spawnZone;
    }

    /**
     * Clear all spawn zones
     */
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
        console.log('✓ Spawn zones cleared');
    }

    /**
     * Create a predator spawn zone visualization where predators will spawn
     * Uses a red/dark color scheme to indicate danger
     */
    createPredatorSpawnZone = (position, color = 0xff0000) => {
        const radius = 1.5; // Size of the spawn marker

        // Create sphere geometry for predator spawn point
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

        // Create wireframe sphere
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

        // Create a warning icon (exclamation mark style - cone pointing up)
        const iconGeometry = new THREE.ConeGeometry(0.3, 0.8, 8);
        const iconMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00, // Yellow warning color
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
        console.log(`✓ Created predator spawn zone at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);

        return predatorSpawnZone;
    }

    /**
     * Clear all predator spawn zones
     */
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
        console.log('✓ Predator spawn zones cleared');
    }

    /**
     * Clear all fish from the scene
     */
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
        console.log('✓ Fish cleared');
    }

    /**
     * Clear all predators from the scene
     */
    clearPredators = () => {
        for (const predator of this.predators) {
            if (predator.mesh) {
                this.scene.remove(predator.mesh);
                if (predator.mesh.geometry) predator.mesh.geometry.dispose();
                if (predator.mesh.material) predator.mesh.material.dispose();
            }
        }
        this.predators = [];
        console.log('✓ Predators cleared');
    }


    updateShader = (shaderManager) => {
        // Store shader manager reference
        this.shaderManager = shaderManager;

        // Apply shader to all stored FBX models
        this.fbxModels.forEach(fbx => {
            this.applyShaderToModel(fbx, shaderManager.activeShader);
        });

        console.log('Scene shader updated to:', shaderManager.activeShader);
    }

    update = (deltaTime) => {
        // Animate test objects (simple rotation for demonstration)
        this.objects.forEach((obj, index) => {
            obj.rotation.y += deltaTime * (0.5 + index * 0.2);
        });

        // Update flocking system
        this.flockingSystem.update(deltaTime);

        // Check if fish reached goal zones (callback will be set by main.js)
        if (this.onFishReachGoal) {
            this.checkFishReachGoal(this.onFishReachGoal);
        }

        // Animate bait (pulsing effect)
        if (this.bait) {
            const time = Date.now() * 0.001;
            const scale = 1.0 + Math.sin(time * 3) * 0.2;
            this.bait.scale.setScalar(scale);
        }

        // 🦈 Update predators
        this.predators.forEach(predator => {
            predator.update(deltaTime, this.fish, this.flockingSystem.obstacles);

            if (predator.mesh) {
                predator.mesh.position.copy(predator.position);

                // Yöne bakma (çok iyi görünür)
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
        wireframeMesh.quaternion.copy(rotation); // Apply rotation
        this.scene.add(wireframeMesh);

        console.log(`✓ Added obstacle at (${position.x}, ${position.y}, ${position.z}) with radius ${radius}`);
        return wireframeMesh;
    }
}
