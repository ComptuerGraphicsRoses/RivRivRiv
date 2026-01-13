/**
 * Inventory System
 * Manages level-based object placement limits
 */

// Level inventory configurations (JSON-style data)
// This can be easily moved to a separate JSON file later
export const LEVEL_INVENTORIES = {
    level1: {
        rock1: 2,      // Small rocks
        rock2: 1,      // Medium rocks
        rock3: 1,      // Large rocks
        bait: 10,       // Bait items
        spotlight: 1   // Spotlights
    },
    level2: {
        rock1: 3,
        rock2: 2,
        rock3: 1,
        bait: 4,
        spotlight: 2
    },
    level3: {
        rock1: 4,
        rock2: 3,
        rock3: 2,
        bait: 5,
        spotlight: 2
    }
};

/**
 * InventoryManager - Tracks and validates object placement against level limits
 */
export class InventoryManager {
    constructor() {
        // Track how many of each object type have been placed per level
        this.placedCounts = {};
        this.currentLevel = 'level1'; // Default level

        this.resetCounts();
    }

    /**
     * Reset all placement counts to zero
     */
    resetCounts() {
        this.placedCounts = {
            rock1: 0,
            rock2: 0,
            rock3: 0,
            bait: 0,
            spotlight: 0
        };
    }

    /**
     * Set the current level
     * @param {string} levelId - Level identifier (e.g., 'level1')
     */
    setLevel(levelId) {
        if (!LEVEL_INVENTORIES[levelId]) {
            console.warn(`Unknown level: ${levelId}, defaulting to level1`);
            this.currentLevel = 'level1';
        } else {
            this.currentLevel = levelId;
        }
        this.resetCounts();
    }

    /**
     * Check if a specific object type can still be placed
     * @param {string} objectType - Type of object (rock1, rock2, rock3, bait, spotlight)
     * @returns {boolean} - True if can place, false if limit reached
     */
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

    /**
     * Get remaining count for an object type
     * @param {string} objectType - Type of object
     * @returns {number} - Remaining count
     */
    getRemaining(objectType) {
        const levelConfig = LEVEL_INVENTORIES[this.currentLevel];
        if (!levelConfig) return 0;

        const limit = levelConfig[objectType] || 0;
        const placed = this.placedCounts[objectType] || 0;
        return Math.max(0, limit - placed);
    }

    /**
     * Get total limit for an object type
     * @param {string} objectType - Type of object
     * @returns {number} - Total limit
     */
    getLimit(objectType) {
        const levelConfig = LEVEL_INVENTORIES[this.currentLevel];
        if (!levelConfig) return 0;
        return levelConfig[objectType] || 0;
    }

    /**
     * Record that an object has been placed
     * @param {string} objectType - Type of object placed
     */
    recordPlacement(objectType) {
        if (!this.placedCounts[objectType]) {
            this.placedCounts[objectType] = 0;
        }
        this.placedCounts[objectType]++;

        console.log(`Placed ${objectType}: ${this.placedCounts[objectType]}/${this.getLimit(objectType)}`);
    }

    /**
     * Get current placement counts
     * @returns {object} - Current counts
     */
    getCounts() {
        return { ...this.placedCounts };
    }

    /**
     * Get full inventory status for current level
     * @returns {object} - Inventory status with limits and remaining
     */
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