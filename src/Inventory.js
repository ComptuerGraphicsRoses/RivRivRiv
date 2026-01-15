import { LEVEL_CONFIGS } from './LevelConfig.js';

// Convert level configs to inventory format
export const LEVEL_INVENTORIES = {};
for (const [levelId, config] of Object.entries(LEVEL_CONFIGS)) {
    LEVEL_INVENTORIES[levelId] = config.inventory;
}

export class InventoryManager {
    constructor() {
        this.placedCounts = {};
        this.currentLevel = 'level1';
        this.resetCounts();
    }

    resetCounts() {
        this.placedCounts = {
            rock1: 0,
            rock2: 0,
            rock3: 0,
            bait: 0,
            spotlight: 0
        };
    }

    setLevel(levelId) {
        if (!LEVEL_INVENTORIES[levelId]) {
            console.warn(`Unknown level: ${levelId}, defaulting to level1`);
            this.currentLevel = 'level1';
        } else {
            this.currentLevel = levelId;
        }
        this.resetCounts();
    }

    canPlace(objectType) {
        const levelConfig = LEVEL_INVENTORIES[this.currentLevel];

        if (!levelConfig) {
            console.error(`No inventory config for level: ${this.currentLevel}`);
            return false;
        }

        const limit = levelConfig[objectType];
        if (limit === undefined) {
            console.warn(`No limit defined for object type: ${objectType}`);
            return false;
        }

        const placed = this.placedCounts[objectType] || 0;
        return placed < limit;
    }

    getRemaining(objectType) {
        const levelConfig = LEVEL_INVENTORIES[this.currentLevel];
        if (!levelConfig) return 0;

        const limit = levelConfig[objectType] || 0;
        const placed = this.placedCounts[objectType] || 0;
        return Math.max(0, limit - placed);
    }

    getLimit(objectType) {
        const levelConfig = LEVEL_INVENTORIES[this.currentLevel];
        if (!levelConfig) return 0;
        return levelConfig[objectType] || 0;
    }

    recordPlacement(objectType) {
        if (!this.placedCounts[objectType]) {
            this.placedCounts[objectType] = 0;
        }
        this.placedCounts[objectType]++;

        console.log(`Placed ${objectType}: ${this.placedCounts[objectType]}/${this.getLimit(objectType)}`);
    }

    recordRemoval(objectType) {
        if (!this.placedCounts[objectType]) {
            this.placedCounts[objectType] = 0;
        }

        if (this.placedCounts[objectType] > 0) {
            this.placedCounts[objectType]--;
            console.log(`Removed ${objectType}: ${this.placedCounts[objectType]}/${this.getLimit(objectType)}`);
        } else {
            console.warn(`Attempted to remove ${objectType} but count was already 0`);
        }
    }

    getCounts() {
        return { ...this.placedCounts };
    }

    getInventoryStatus() {
        const levelConfig = LEVEL_INVENTORIES[this.currentLevel];
        const status = {};

        for (const objectType in levelConfig) {
            const limit = levelConfig[objectType];
            const placed = this.placedCounts[objectType] || 0;
            status[objectType] = {
                limit,
                placed,
                remaining: Math.max(0, limit - placed)
            };
        }

        return status;
    }
}