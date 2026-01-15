/**
 * Level Configuration System
 * Defines fish spawn positions, quantities, goal zones, and inventory per level
 */

import * as THREE from 'three';

/**
 * Level configurations
 * Each level defines:
 * - fishConfig: spawn position, count, and spread area
 * - goalConfig: goal zone position and radius
 * - inventory: available items for placement (same structure as LEVEL_INVENTORIES)
 * - predatorConfig: predator spawn positions
 */
export const LEVEL_CONFIGS = {
    level1: {
        name: "Level 1 - Introduction",
        fishConfig: {
            count: 50,
            spawnPosition: new THREE.Vector3(16, 6, 16),
            spawnSpread: new THREE.Vector3(2, 2, 2) // Random spread in x, y, z
        },
        goalConfig: {
            position: new THREE.Vector3(-16, 6, -16),
            radius: 2.5,
            color: 0x00ff00 // Green
        },
        predatorConfig: {
            spawns: [
                { position: new THREE.Vector3(16, 6, -16) }
            ]
        },
        inventory: {
            rock1: 2,      // Small rocks
            rock2: 1,      // Medium rocks
            rock3: 1,      // Large rocks
            bait: 3,       // Bait items
            spotlight: 1   // Spotlights
        },
        requiredSurvivalPercentage: 0.6, // 60%
        maxTime: 45
    },

    level2: {
        name: "Level 2 - Advanced",
        fishConfig: {
            count: 80,
            spawnPosition: new THREE.Vector3(-16, 7, -16),
            spawnSpread: new THREE.Vector3(2, 2, 2)
        },
        goalConfig: {
            position: new THREE.Vector3(16, 3, 10),
            radius: 2.0,
            color: 0x00ff00
        },
        predatorConfig: {
            spawns: [
                { position: new THREE.Vector3(-12, 6, 15) },
                { position: new THREE.Vector3(14, 4, -14) }
            ]
        },
        inventory: {
            rock1: 3,
            rock2: 2,
            rock3: 2,
            bait: 4,
            spotlight: 1
        },
        requiredSurvivalPercentage: 0.65, // 65%
        maxTime: 50
    },

    level3: {
        name: "Level 3 - Expert",
        fishConfig: {
            count: 100,
            spawnPosition: new THREE.Vector3(-16, 6, -16),
            spawnSpread: new THREE.Vector3(2, 2, 2)
        },
        goalConfig: {
            position: new THREE.Vector3(4, 4, 0),
            radius: 2,
            color: 0x00ff00
        },
        predatorConfig: {
            spawns: [
                { position: new THREE.Vector3(16, 3, 16) },
                { position: new THREE.Vector3(0, 3, 10) },
                { position: new THREE.Vector3(16, 3, 0) }
            ]
        },
        inventory: {
            rock1: 4,
            rock2: 3,
            rock3: 2,
            bait: 5,
            spotlight: 1
        },
        requiredSurvivalPercentage: 0.7, // 70%
        maxTime: 55
    }
};

/**
 * Get level configuration by ID
 * @param {string} levelId - Level identifier (e.g., 'level1')
 * @returns {Object|null} Level configuration or null if not found
 */
export function getLevelConfig(levelId) {
    return LEVEL_CONFIGS[levelId] || null;
}

/**
 * Get all available level IDs
 * @returns {string[]} Array of level IDs
 */
export function getAllLevelIds() {
    return Object.keys(LEVEL_CONFIGS);
}