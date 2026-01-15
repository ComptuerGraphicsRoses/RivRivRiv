/**
 * Main Application Entry Point
 * Flocking Frenzy - BBM 412 Computer Graphics Project
 */

import * as THREE from 'three';
import { CameraController } from './Camera.js';
import { SceneManager } from './Scene.js';
import { ShaderManager } from './ShaderManager.js';
import { UIManager } from './UI.js';
import { GameState } from './GameState.js';
import { ObjectManager } from './Objects.js';
import { getLevelConfig, getAllLevelIds } from './LevelConfig.js';

class FlockingFrenzy {
    constructor() {
        // Get canvas element
        this.canvas = document.getElementById('canvas');

        // Initialize Three.js renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Initialize subsystems
        this.camera = new CameraController(this.canvas);
        this.sceneManager = new SceneManager();
        this.shaderManager = new ShaderManager();
        this.ui = new UIManager();
        this.gameState = new GameState();

        // Timing
        this.clock = new THREE.Clock();
        this.deltaTime = 0;

        // Level management
        this.currentLevelId = 'level1';
        this.currentLevelConfig = null;




        // Setup event listeners
        this.setupEventListeners();

        // Initialize game
        this.init();
    }

    async init() {
        console.log('Initializing Flocking Frenzy...');
        console.log('Three.js Revision:', THREE.REVISION);

        try {
            // Load level configuration
            this.currentLevelConfig = getLevelConfig(this.currentLevelId);
            if (!this.currentLevelConfig) {
                throw new Error(`Level config not found: ${this.currentLevelId}`);
            }
            console.log(`✓ Loaded level config: ${this.currentLevelConfig.name}`);

            // Load shaders
            await this.shaderManager.loadShaders();
            console.log('✓ Shaders loaded');

            // Initialize scene with default shader
            await this.sceneManager.init(this.shaderManager);
            console.log('✓ Scene initialized');

            // DON'T spawn fish yet - wait for game start
            // Fish will be spawned when player clicks "Start Simulation"

            // Setup UI
            this.ui.init(this.gameState);
            console.log('✓ UI initialized');

            // Initialize object manager (build mode system) with SceneManager reference
            this.objectManager = new ObjectManager(
                this.sceneManager.scene,
                this.camera.camera,
                this.canvas,
                this.sceneManager,  // Pass SceneManager for bait registration
                this.shaderManager  // Pass ShaderManager for shader material creation
            );
            // Pass ObjectManager reference to camera so it can check rotation mode
            this.camera.objectManager = this.objectManager;
            console.log('✓ Object manager initialized');

            // Set inventory from level config
            this.objectManager.inventoryManager.setLevel(this.currentLevelId);

            // Initialize inventory UI with inventory manager from ObjectManager
            this.ui.initInventory(this.objectManager.inventoryManager);

            // Set up callback to update UI when inventory changes
            this.objectManager.onInventoryChange = () => {
                this.ui.updateInventory();
            };
            console.log('✓ Inventory UI initialized');

            // Setup GameState with references to managers
            this.gameState.setInventoryManager(this.objectManager.inventoryManager);
            this.gameState.setObjectManager(this.objectManager);
            this.gameState.setSceneManager(this.sceneManager);
            this.gameState.loadLevel(this.currentLevelConfig, this.currentLevelId);

            // Give ObjectManager reference to GameState for phase checking
            this.objectManager.gameState = this.gameState;

            // Setup callback for when simulation starts
            this.gameState.onSimulationStart = this.onSimulationStart.bind(this);

            // Setup callback for when level ends (show popup)
            this.gameState.onLevelEnd = this.onLevelEnd.bind(this);

            // Setup popup button listeners
            this.setupPopupListeners();

            // Setup callback for fish reaching goal
            this.sceneManager.onFishReachGoal = () => {
                this.gameState.onFishReachedGoal();
            };

            // Setup callback for fish death
            this.sceneManager.onFishDeath = () => {
                this.gameState.onFishDeath();
            };

            // Set up bait consumption callback
            this.sceneManager.flockingSystem.onBaitConsumed = (baitObject) => {
                // Check if this bait was created by ObjectManager or SceneManager
                if (baitObject.userData.createdBy === 'SceneManager') {
                    // SceneManager bait - handle removal in SceneManager
                    this.sceneManager.consumeBait(baitObject);
                } else {
                    // ObjectManager bait - handle removal in ObjectManager
                    this.objectManager.consumeBait(baitObject);
                }
            };
            console.log('✓ Bait consumption system initialized');

            // Create goal zone from level config
            const goalConfig = this.currentLevelConfig.goalConfig;
            this.sceneManager.createGoalZone(
                goalConfig.position,
                goalConfig.radius,
                goalConfig.color
            );
            console.log('✓ Goal zone created');

            // Create spawn zone visualization
            const fishConfig = this.currentLevelConfig.fishConfig;
            this.sceneManager.createSpawnZone(
                fishConfig.spawnPosition,
                fishConfig.spawnSpread,
                0xff9900 // Orange
            );
            console.log('✓ Spawn zone created');

            // Create predator spawn zone visualizations
            const predatorConfig = this.currentLevelConfig.predatorConfig;
            if (predatorConfig && predatorConfig.spawns) {
                for (const spawn of predatorConfig.spawns) {
                    this.sceneManager.createPredatorSpawnZone(spawn.position);
                }
                console.log(`✓ ${predatorConfig.spawns.length} predator spawn zone(s) created`);
            }

            // Start render loop
            this.animate();
            console.log('✓ Render loop started');

            console.log('Flocking Frenzy initialized successfully!');
            console.log('Place all items and press "Start Simulation" to begin!');
            console.log('Press H for help');
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    /**
     * Called when simulation starts - spawn fish and predators
     */
    async onSimulationStart() {
        console.log('Spawning fish and predators...');

        const fishConfig = this.currentLevelConfig.fishConfig;
        const predatorConfig = this.currentLevelConfig.predatorConfig;

        // Spawn fish school from level config
        await this.sceneManager.spawnFishSchool(
            fishConfig.count,
            fishConfig.spawnPosition,
            fishConfig.spawnSpread
        );

        // Spawn predators from level config
        if (predatorConfig && predatorConfig.spawns) {
            for (const spawn of predatorConfig.spawns) {
                await this.sceneManager.spawnPredator(spawn.position);
            }
        }

        // Create goal bait to guide fish
        const goalConfig = this.currentLevelConfig.goalConfig;
        this.sceneManager.bait = this.sceneManager.createGoalBait(goalConfig.position);

        // Clear spawn zone when simulation starts
        this.sceneManager.clearSpawnZones();
        this.sceneManager.clearPredatorSpawnZones();

        console.log('✓ Fish and predators spawned - simulation active!');
    }

    /**
     * Called when level ends (win or lose)
     * @param {boolean} isWin - Whether the player won
     */
    onLevelEnd(isWin) {
        const nextLevelId = this.getNextLevelId();
        const hasNextLevel = nextLevelId !== null;

        this.ui.showGameEndPopup(this.gameState, isWin, hasNextLevel);
    }

    /**
     * Setup popup button event listeners
     */
    setupPopupListeners() {
        // Restart button in popup
        this.ui.popupRestartBtn.addEventListener('click', () => {
            this.ui.hideGameEndPopup();
            this.gameState.restartLevel();
            // Reset inventory for current level
            this.objectManager.inventoryManager.setLevel(this.currentLevelId);
            this.ui.renderInventoryHotbar();
            console.log('✓ Level restarted from popup');
        });

        // Next level button in popup
        this.ui.popupNextBtn.addEventListener('click', () => {
            const nextLevelId = this.getNextLevelId();
            if (nextLevelId) {
                this.ui.hideGameEndPopup();
                this.loadNewLevel(nextLevelId);
                console.log(`✓ Loading next level: ${nextLevelId}`);
            }
        });
    }

    /**
     * Get the next level ID based on current level
     * @returns {string|null} Next level ID or null if no more levels
     */
    getNextLevelId() {
        const allLevels = getAllLevelIds();
        const currentIndex = allLevels.indexOf(this.currentLevelId);

        if (currentIndex === -1 || currentIndex >= allLevels.length - 1) {
            return null; // No next level
        }

        return allLevels[currentIndex + 1];
    }

    /**
     * Load a new level by ID
     * @param {string} levelId - Level identifier
     */
    loadNewLevel(levelId) {
        const levelConfig = getLevelConfig(levelId);
        if (!levelConfig) {
            console.error(`Level config not found: ${levelId}`);
            return;
        }

        // Update current level references
        this.currentLevelId = levelId;
        this.currentLevelConfig = levelConfig;

        // Reset game state
        this.gameState.phase = 'PREPARATION';
        this.gameState.score = this.gameState.startingScore;
        this.gameState.timeRemaining = levelConfig.maxTime;
        this.gameState.timeElapsed = 0;

        // Clear all objects and scene elements
        if (this.objectManager) {
            this.objectManager.clearAll();
        }

        if (this.sceneManager) {
            this.sceneManager.clearFish();
            this.sceneManager.clearPredators();
            this.sceneManager.clearGoalZones();
            this.sceneManager.clearSpawnZones();
            this.sceneManager.clearPredatorSpawnZones();
            this.sceneManager.removeGoalBait();
            this.sceneManager.flockingSystem.clearBaits();
        }

        // Load new level config into game state
        this.gameState.loadLevel(levelConfig, levelId);

        // Set new inventory
        this.objectManager.inventoryManager.setLevel(levelId);
        this.ui.renderInventoryHotbar();

        // Create new goal zone
        const goalConfig = levelConfig.goalConfig;
        this.sceneManager.createGoalZone(
            goalConfig.position,
            goalConfig.radius,
            goalConfig.color
        );

        // Create new spawn zone
        const fishConfig = levelConfig.fishConfig;
        this.sceneManager.createSpawnZone(
            fishConfig.spawnPosition,
            fishConfig.spawnSpread,
            0xff9900
        );

        // Create predator spawn zones
        const predatorConfig = levelConfig.predatorConfig;
        if (predatorConfig && predatorConfig.spawns) {
            for (const spawn of predatorConfig.spawns) {
                this.sceneManager.createPredatorSpawnZone(spawn.position);
            }
        }

        console.log(`✓ Loaded level: ${levelConfig.name}`);
        console.log('Place all items and press "Start Simulation" to begin!');
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', this.onWindowResize);

        // Keyboard input
        window.addEventListener('keydown', this.onKeyDown);

        // UI events will be handled by UIManager
    }

    onWindowResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.updateAspect(width / height);
        this.renderer.setSize(width, height);
    }

    onKeyDown = (event) => {
        switch (event.key.toLowerCase()) {
            case 'enter':
                // Start simulation (only if in PREPARATION phase and all items placed)
                if (this.gameState.phase === 'PREPARATION' && this.gameState.canStartGame()) {
                    this.gameState.startSimulation();
                    console.log('✓ Simulation started via Enter key');
                } else if (this.gameState.phase === 'PREPARATION') {
                    console.log('Cannot start: Place all inventory items first');
                } else {
                    console.log('Simulation already running');
                }
                break;

            case 'r':
                // Restart level (works in any phase)
                this.ui.hideGameEndPopup(); // Hide popup if visible
                this.gameState.restartLevel();
                // Reset inventory for current level
                this.objectManager.inventoryManager.setLevel(this.currentLevelId);
                this.ui.renderInventoryHotbar();
                console.log('✓ Level restarted via R key');
                break;

            case 'h':
                // Toggle help menu
                this.ui.toggleHelp();
                break;
            case 'p':
                this.gameState.togglePause();
                break;
            case '1':
                // Switch to Phong shader
                this.shaderManager.setActiveShader('phong');
                this.sceneManager.updateShader(this.shaderManager);
                console.log('Switched to Phong shader (realistic lighting)');
                break;

            case '2':
                // Switch to Underwater shader
                this.shaderManager.setActiveShader('underwater');
                this.sceneManager.updateShader(this.shaderManager);
                console.log('Switched to Underwater shader (depth fog + color grading)');
                break;

            case '3':
                // Place Small Rock
                if (this.objectManager) {
                    this.objectManager.toggleBuildModeWithShape('rock1');
                }
                break;

            case '4':
                // Place Medium Rock
                if (this.objectManager) {
                    this.objectManager.toggleBuildModeWithShape('rock2');
                }
                break;

            case '5':
                // Place Large Rock
                if (this.objectManager) {
                    this.objectManager.toggleBuildModeWithShape('rock3');
                }
                break;

            case '6':
                // Place Bait
                if (this.objectManager) {
                    this.objectManager.toggleBuildModeWithShape('bait');
                }
                break;

            case '7':
                // Place Spotlight
                if (this.objectManager) {
                    this.objectManager.toggleBuildModeWithShape('spotlight');
                }
                break;

            case '8':
                // Switch to Toon shader
                this.shaderManager.setActiveShader('toon');
                this.sceneManager.updateShader(this.shaderManager);
                console.log('Switched to Toon shader (cel-shading)');
                break;

            case '+':
                // Increase spotlight intensity
                if (this.objectManager && this.objectManager.buildMode && this.objectManager.selectedShape === 'spotlight') {
                    this.objectManager.spotlightIntensity = Math.min(
                        this.objectManager.maxSpotlightIntensity,
                        this.objectManager.spotlightIntensity + this.objectManager.intensityStep
                    );
                    // Update preview spotlight intensity in real-time
                    if (this.objectManager.previewSpotlight) {
                        this.objectManager.previewSpotlight.intensity = this.objectManager.spotlightIntensity;
                    }
                    console.log(`Spotlight intensity: ${this.objectManager.spotlightIntensity.toFixed(1)}`);
                    event.preventDefault();
                }
                break;

            case '-':
                // Decrease spotlight intensity
                if (this.objectManager && this.objectManager.buildMode && this.objectManager.selectedShape === 'spotlight') {
                    this.objectManager.spotlightIntensity = Math.max(
                        this.objectManager.minSpotlightIntensity,
                        this.objectManager.spotlightIntensity - this.objectManager.intensityStep
                    );
                    // Update preview spotlight intensity in real-time
                    if (this.objectManager.previewSpotlight) {
                        this.objectManager.previewSpotlight.intensity = this.objectManager.spotlightIntensity;
                    }
                    console.log(`Spotlight intensity: ${this.objectManager.spotlightIntensity.toFixed(1)}`);
                    event.preventDefault();
                }
                break;

            case 't':
                // Toggle all spotlights on/off
                if (this.objectManager && !this.objectManager.buildMode) {
                    this.objectManager.toggleAllSpotlights();
                }
                break;

            case 'v':
                // Toggle debug view (boundaries/obstacles)
                this.sceneManager.toggleDebugView();
                break;

            case 'n':
                // Next level (only in EVALUATION phase after winning) or view team names
                if (this.gameState.phase === 'EVALUATION') {
                    const survivalRate = this.gameState.fishSaved / this.gameState.fishTotal;
                    const isWin = survivalRate >= this.gameState.requiredSurvivalPercentage;
                    const nextLevelId = this.getNextLevelId();

                    if (isWin && nextLevelId) {
                        this.ui.hideGameEndPopup();
                        this.loadNewLevel(nextLevelId);
                        console.log(`✓ Loading next level via N key: ${nextLevelId}`);
                    }
                } else {
                    // Animate camera to team names scene
                    this.camera.animateToNamesScene();
                }
                break;
        }

        // Pass keyboard events to camera controller
        this.camera.onKeyDown(event);
    }

    update(deltaTime) {

        // Update camera
        this.camera.update(deltaTime);

        // Update scene (fish, predators, etc.) - only during simulation
        if (!this.gameState.paused && this.gameState.phase === 'SIMULATION') {
            this.sceneManager.update(deltaTime);
        }

        // Update game state
        this.gameState.update(deltaTime);

        // Update UI
        this.ui.update(this.gameState);

        // Update object manager (build mode)
        if (this.objectManager) {
            this.objectManager.update();
        }

        // Update shader uniforms
        this.shaderManager.updateUniforms(
            this.camera.camera,
            this.sceneManager.lights,
            deltaTime
        );
    }

    render() {
        this.renderer.render(this.sceneManager.scene, this.camera.camera);
    }

    animate = () => {
        requestAnimationFrame(this.animate);

        this.deltaTime = this.clock.getDelta();

        this.update(this.deltaTime);
        this.render();
    }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new FlockingFrenzy();
});
