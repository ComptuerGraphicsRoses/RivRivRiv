/**
 * Game State Manager
 * Manages game phases, scoring, and win/lose conditions
 */

export class GameState {
    constructor() {
        // Game phases
        this.phase = 'PREPARATION'; // PREPARATION, SIMULATION, EVALUATION
        this.paused = false;
        
        // Scoring
        this.score = 100;
        this.startingScore = 100;
        
        // Timer
        this.maxTime = 30.0;
        this.timeRemaining = this.maxTime;
        this.timeElapsed = 0;
        
        // Fish tracking
        this.fishTotal = 50;
        this.fishAlive = 50;
        this.fishSaved = 0;
        
        // Level configuration
        this.currentLevel = 'level1';
        this.currentLevelId = 'level1';
        this.requiredSurvivalPercentage = 0.6; // 60%

        // References to other managers
        this.inventoryManager = null;
        this.objectManager = null;
        this.sceneManager = null;

        // Callbacks
        this.onSimulationStart = null; // Called when simulation starts
        this.onLevelEnd = null; // Called when level ends (win or lose)
    }

    /**
     * Set reference to inventory manager for validation
     */
    setInventoryManager(inventoryManager) {
        this.inventoryManager = inventoryManager;
    }

    /**
     * Set reference to object manager for clearing objects
     */
    setObjectManager(objectManager) {
        this.objectManager = objectManager;
    }

    /**
     * Set reference to scene manager for spawning
     */
    setSceneManager(sceneManager) {
        this.sceneManager = sceneManager;
    }

    /**
     * Load level configuration
     * @param {Object} levelConfig - Level configuration from LevelConfig.js
     * @param {string} levelId - Level identifier (e.g., 'level1')
     */
    loadLevel = (levelConfig, levelId = null) => {
        this.currentLevel = levelConfig.name || 'Unknown Level';
        this.currentLevelId = levelId || this.currentLevelId;
        this.currentLevelConfig = levelConfig; // Store full config for restart
        this.maxTime = levelConfig.maxTime || 30.0;
        this.requiredSurvivalPercentage = levelConfig.requiredSurvivalPercentage || 0.6;
        this.fishTotal = levelConfig.fishConfig.count;
        this.fishAlive = levelConfig.fishConfig.count;
        this.fishSaved = 0;

        console.log(`✓ Loaded level: ${this.currentLevel}`);
        console.log(`  - Fish: ${this.fishTotal}`);
        console.log(`  - Required survival: ${(this.requiredSurvivalPercentage * 100)}%`);
        console.log(`  - Max time: ${this.maxTime}s`);
    }

    /**
     * Check if all inventory items have been placed
     * @returns {boolean} True if can start game, false otherwise
     */
    canStartGame = () => {
        if (this.phase !== 'PREPARATION') return false;
        if (!this.inventoryManager) return false;

        const status = this.inventoryManager.getInventoryStatus();

        // Check if all items are placed (remaining === 0)
        for (const [itemType, itemStatus] of Object.entries(status)) {
            if (itemStatus.remaining > 0) {
                return false; // Still have items to place
            }
        }

        return true; // All items placed
    }

    togglePause = () => {
        this.paused = !this.paused;
    }
    
    startSimulation = () => {
        if (this.phase !== 'PREPARATION') return;
        
        // Validate that all items are placed
        if (!this.canStartGame()) {
            console.warn('Cannot start: not all items are placed');
            return;
        }

        this.phase = 'SIMULATION';
        this.timeRemaining = this.maxTime;
        this.timeElapsed = 0;
        
        console.log('Simulation started!');

        // Trigger callback for spawning fish and predators
        if (this.onSimulationStart) {
            this.onSimulationStart();
        }
    }
    
    restartLevel = () => {
        this.phase = 'PREPARATION';
        this.score = this.startingScore;
        this.timeRemaining = this.maxTime;
        this.timeElapsed = 0;
        this.fishAlive = this.fishTotal;
        this.fishSaved = 0;
        
        // Clear all user-placed objects
        if (this.objectManager) {
            this.objectManager.clearAll();
        }

        // Clear fish, predators, and goal zones from scene
        if (this.sceneManager) {
            this.sceneManager.clearFish();
            this.sceneManager.clearPredators();
            this.sceneManager.clearGoalZones();
            this.sceneManager.clearSpawnZones();
            this.sceneManager.clearPredatorSpawnZones();
            this.sceneManager.removeGoalBait(); // Remove goal bait
            this.sceneManager.flockingSystem.clearBaits(); // Clear bait tracking

            // Recreate goal zone from level config
            if (this.currentLevelConfig) {
                const goalConfig = this.currentLevelConfig.goalConfig;
                this.sceneManager.createGoalZone(
                    goalConfig.position,
                    goalConfig.radius,
                    goalConfig.color
                );
            }

            // Recreate spawn zone
            const fishConfig = this.currentLevelConfig.fishConfig;
            this.sceneManager.createSpawnZone(
                fishConfig.spawnPosition,
                fishConfig.spawnSpread,
                0xff9900
            );

            // Recreate predator spawn zones
            const predatorConfig = this.currentLevelConfig.predatorConfig;
            if (predatorConfig && predatorConfig.spawns) {
                for (const spawn of predatorConfig.spawns) {
                    this.sceneManager.createPredatorSpawnZone(spawn.position);
                }
            }
        }

        console.log('Level restarted - place all items to begin');
    }
    
    onFishDeath = () => {
        this.fishAlive = Math.max(0, this.fishAlive - 1);
        this.score -= 2;
        this.score = Math.max(0, this.score);
    }
    
    onFishReachedGoal = () => {
        this.fishSaved++;
        // Fish dies when reaching goal (calls onDeath which decreases fishAlive)
        // But we compensate by adding 1 back, so fishAlive only decreases for real deaths
        this.fishAlive++;
    }
    
    update = (deltaTime) => {
        // Only update during SIMULATION phase
        if (this.phase !== 'SIMULATION') return;
        
        // Update timer
        this.timeElapsed += deltaTime;
        this.timeRemaining = Math.max(0, this.maxTime - this.timeElapsed);
        
        // Time penalty
        this.score -= 0.5 * deltaTime;
        this.score = Math.max(0, this.score);
        
        // Check if all fish are accounted for (none left alive in scene)
        if (this.fishAlive === this.fishSaved) {
            console.log('All fish accounted for (saved or dead) - ending simulation');
            this.evaluateLevel();
            return;
        }

        // Check if time ran out
        if (this.timeRemaining <= 0) {
            this.evaluateLevel();
        }
    }
    
    evaluateLevel = () => {
        this.phase = 'EVALUATION';
        
        const survivalRate = this.fishSaved / this.fishTotal;
        const isWin = survivalRate >= this.requiredSurvivalPercentage;

        if (isWin) {
            // Win
            this.score += 50; // Completion bonus
            console.log('LEVEL COMPLETE!');
            console.log(`Survival Rate: ${(survivalRate * 100).toFixed(1)}%`);
            console.log(`Final Score: ${Math.floor(this.score)}`);
        } else {
            // Lose
            console.log('LEVEL FAILED');
            console.log(`Survival Rate: ${(survivalRate * 100).toFixed(1)}% (Required: ${(this.requiredSurvivalPercentage * 100)}%)`);
            console.log(`Final Score: ${Math.floor(this.score)}`);
        }

        // Trigger callback for UI popup
        if (this.onLevelEnd) {
            this.onLevelEnd(isWin);
        }
    }
}
