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
        this.canvas = document.getElementById('canvas');

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.camera = new CameraController(this.canvas);
        this.sceneManager = new SceneManager();
        this.shaderManager = new ShaderManager();
        this.ui = new UIManager();
        this.gameState = new GameState();

        this.clock = new THREE.Clock();
        this.deltaTime = 0;

        this.currentLevelId = 'level1';
        this.currentLevelConfig = null;

        this.setupEventListeners();
        this.init();
    }

    async init() {
        console.log('Initializing Flocking Frenzy...');
        console.log('Three.js Revision:', THREE.REVISION);

        try {
            this.currentLevelConfig = getLevelConfig(this.currentLevelId);
            if (!this.currentLevelConfig) {
                throw new Error(`Level config not found: ${this.currentLevelId}`);
            }
            console.log(`Loaded level config: ${this.currentLevelConfig.name}`);

            await this.shaderManager.loadShaders();
            console.log('Shaders loaded');

            await this.sceneManager.init(this.shaderManager);
            console.log('Scene initialized');

            this.ui.init(this.gameState);
            console.log('UI initialized');

            this.objectManager = new ObjectManager(
                this.sceneManager.scene,
                this.camera.camera,
                this.canvas,
                this.sceneManager,
                this.shaderManager
            );

            this.camera.objectManager = this.objectManager;
            console.log('Object manager initialized');

            this.objectManager.inventoryManager.setLevel(this.currentLevelId);
            this.ui.initInventory(this.objectManager.inventoryManager);

            this.objectManager.onInventoryChange = () => {
                this.ui.updateInventory();
            };
            console.log('Inventory UI initialized');

            this.gameState.setInventoryManager(this.objectManager.inventoryManager);
            this.gameState.setObjectManager(this.objectManager);
            this.gameState.setSceneManager(this.sceneManager);
            this.gameState.loadLevel(this.currentLevelConfig, this.currentLevelId);

            this.objectManager.gameState = this.gameState;

            this.gameState.onSimulationStart = this.onSimulationStart.bind(this);
            this.gameState.onLevelEnd = this.onLevelEnd.bind(this);

            this.setupPopupListeners();

            this.sceneManager.onFishReachGoal = () => {
                this.gameState.onFishReachedGoal();
            };

            this.sceneManager.onFishDeath = () => {
                this.gameState.onFishDeath();
            };

            // Handle bait consumption
            this.sceneManager.flockingSystem.onBaitConsumed = (baitObject) => {
                if (baitObject.userData.createdBy === 'SceneManager') {
                    this.sceneManager.consumeBait(baitObject);
                } else {
                    this.objectManager.consumeBait(baitObject);
                }
            };
            console.log('Bait consumption system initialized');

            const goalConfig = this.currentLevelConfig.goalConfig;
            this.sceneManager.createGoalZone(
                goalConfig.position,
                goalConfig.radius,
                goalConfig.color
            );

            const fishConfig = this.currentLevelConfig.fishConfig;
            this.sceneManager.createSpawnZone(
                fishConfig.spawnPosition,
                fishConfig.spawnSpread,
                0xff9900
            );

            const predatorConfig = this.currentLevelConfig.predatorConfig;
            if (predatorConfig && predatorConfig.spawns) {
                for (const spawn of predatorConfig.spawns) {
                    this.sceneManager.createPredatorSpawnZone(spawn.position);
                }
                console.log(`${predatorConfig.spawns.length} predator spawn zone(s) created`);
            }

            this.animate();
            console.log('Render loop started');
            console.log('Flocking Frenzy initialized successfully');

        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    async onSimulationStart() {
        console.log('Spawning fish and predators...');

        const fishConfig = this.currentLevelConfig.fishConfig;
        const predatorConfig = this.currentLevelConfig.predatorConfig;

        await this.sceneManager.spawnFishSchool(
            fishConfig.count,
            fishConfig.spawnPosition,
            fishConfig.spawnSpread
        );

        if (predatorConfig && predatorConfig.spawns) {
            for (const spawn of predatorConfig.spawns) {
                await this.sceneManager.spawnPredator(spawn.position);
            }
        }

        const goalConfig = this.currentLevelConfig.goalConfig;
        this.sceneManager.bait = this.sceneManager.createGoalBait(goalConfig.position);

        this.sceneManager.clearSpawnZones();
        this.sceneManager.clearPredatorSpawnZones();

        console.log('Fish and predators spawned - simulation active');
    }

    onLevelEnd(isWin) {
        const nextLevelId = this.getNextLevelId();
        const hasNextLevel = nextLevelId !== null;

        this.ui.showGameEndPopup(this.gameState, isWin, hasNextLevel);
    }

    setupPopupListeners() {
        this.ui.popupRestartBtn.addEventListener('click', () => {
            this.ui.hideGameEndPopup();
            this.gameState.restartLevel();
            this.objectManager.inventoryManager.setLevel(this.currentLevelId);
            this.ui.renderInventoryHotbar();
            console.log('Level restarted from popup');
        });

        this.ui.popupNextBtn.addEventListener('click', () => {
            const nextLevelId = this.getNextLevelId();
            if (nextLevelId) {
                this.ui.hideGameEndPopup();
                this.loadNewLevel(nextLevelId);
                console.log(`Loading next level: ${nextLevelId}`);
            }
        });
    }

    getNextLevelId() {
        const allLevels = getAllLevelIds();
        const currentIndex = allLevels.indexOf(this.currentLevelId);

        if (currentIndex === -1 || currentIndex >= allLevels.length - 1) {
            return null;
        }

        return allLevels[currentIndex + 1];
    }

    loadNewLevel(levelId) {
        const levelConfig = getLevelConfig(levelId);
        if (!levelConfig) {
            console.error(`Level config not found: ${levelId}`);
            return;
        }

        this.currentLevelId = levelId;
        this.currentLevelConfig = levelConfig;

        this.gameState.phase = 'PREPARATION';
        this.gameState.score = this.gameState.startingScore;
        this.gameState.timeRemaining = levelConfig.maxTime;
        this.gameState.timeElapsed = 0;

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

        this.gameState.loadLevel(levelConfig, levelId);

        this.objectManager.inventoryManager.setLevel(levelId);
        this.ui.renderInventoryHotbar();

        const goalConfig = levelConfig.goalConfig;
        this.sceneManager.createGoalZone(
            goalConfig.position,
            goalConfig.radius,
            goalConfig.color
        );

        const fishConfig = levelConfig.fishConfig;
        this.sceneManager.createSpawnZone(
            fishConfig.spawnPosition,
            fishConfig.spawnSpread,
            0xff9900
        );

        const predatorConfig = levelConfig.predatorConfig;
        if (predatorConfig && predatorConfig.spawns) {
            for (const spawn of predatorConfig.spawns) {
                this.sceneManager.createPredatorSpawnZone(spawn.position);
            }
        }

        console.log(`Loaded level: ${levelConfig.name}`);
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize);
        window.addEventListener('keydown', this.onKeyDown);
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
                if (this.gameState.phase === 'PREPARATION' && this.gameState.canStartGame()) {
                    this.gameState.startSimulation();
                    console.log('Simulation started');
                } else if (this.gameState.phase === 'PREPARATION') {
                    console.log('Cannot start: Place all inventory items first');
                } else {
                    console.log('Simulation already running');
                }
                break;

            case 'r':
                this.ui.hideGameEndPopup();
                this.gameState.restartLevel();
                this.objectManager.inventoryManager.setLevel(this.currentLevelId);
                this.ui.renderInventoryHotbar();
                console.log('Level restarted');
                break;

            case 'h':
                this.ui.toggleHelp();
                break;
            case 'p':
                this.gameState.togglePause();
                break;
            case '1':
                this.shaderManager.setActiveShader('phong');
                this.sceneManager.updateShader(this.shaderManager);
                console.log('Switched to Phong shader');
                break;

            case '2':
                this.shaderManager.setActiveShader('underwater');
                this.sceneManager.updateShader(this.shaderManager);
                console.log('Switched to Underwater shader');
                break;

            case '3':
                if (this.objectManager) this.objectManager.toggleBuildModeWithShape('rock1');
                break;

            case '4':
                if (this.objectManager) this.objectManager.toggleBuildModeWithShape('rock2');
                break;

            case '5':
                if (this.objectManager) this.objectManager.toggleBuildModeWithShape('rock3');
                break;

            case '6':
                if (this.objectManager) this.objectManager.toggleBuildModeWithShape('bait');
                break;

            case '7':
                if (this.objectManager) this.objectManager.toggleBuildModeWithShape('spotlight');
                break;

            case '8':
                this.shaderManager.setActiveShader('toon');
                this.sceneManager.updateShader(this.shaderManager);
                console.log('Switched to Toon shader');
                break;

            case '+':
                if (this.objectManager && this.objectManager.buildMode && this.objectManager.selectedShape === 'spotlight') {
                    this.objectManager.spotlightIntensity = Math.min(
                        this.objectManager.maxSpotlightIntensity,
                        this.objectManager.spotlightIntensity + this.objectManager.intensityStep
                    );
                    if (this.objectManager.previewSpotlight) {
                        this.objectManager.previewSpotlight.intensity = this.objectManager.spotlightIntensity;
                    }
                    console.log(`Spotlight intensity: ${this.objectManager.spotlightIntensity.toFixed(1)}`);
                    event.preventDefault();
                }
                break;

            case '-':
                if (this.objectManager && this.objectManager.buildMode && this.objectManager.selectedShape === 'spotlight') {
                    this.objectManager.spotlightIntensity = Math.max(
                        this.objectManager.minSpotlightIntensity,
                        this.objectManager.spotlightIntensity - this.objectManager.intensityStep
                    );
                    if (this.objectManager.previewSpotlight) {
                        this.objectManager.previewSpotlight.intensity = this.objectManager.spotlightIntensity;
                    }
                    console.log(`Spotlight intensity: ${this.objectManager.spotlightIntensity.toFixed(1)}`);
                    event.preventDefault();
                }
                break;

            case 't':
                if (this.objectManager && !this.objectManager.buildMode) {
                    this.objectManager.toggleAllSpotlights();
                }
                break;

            case 'v':
                this.sceneManager.toggleDebugView();
                break;

            case 'n':
                if (this.gameState.phase === 'EVALUATION') {
                    const survivalRate = this.gameState.fishSaved / this.gameState.fishTotal;
                    const isWin = survivalRate >= this.gameState.requiredSurvivalPercentage;
                    const nextLevelId = this.getNextLevelId();

                    if (isWin && nextLevelId) {
                        this.ui.hideGameEndPopup();
                        this.loadNewLevel(nextLevelId);
                        console.log(`Loading next level: ${nextLevelId}`);
                    }
                } else {
                    this.camera.animateToNamesScene();
                }
                break;
        }

        this.camera.onKeyDown(event);
    }

    update(deltaTime) {
        this.camera.update(deltaTime);

        if (!this.gameState.paused && this.gameState.phase === 'SIMULATION') {
            this.sceneManager.update(deltaTime);
        }

        this.gameState.update(deltaTime);
        this.ui.update(this.gameState);

        if (this.objectManager) {
            this.objectManager.update();
        }

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

document.addEventListener('DOMContentLoaded', () => {
    window.game = new FlockingFrenzy();
});