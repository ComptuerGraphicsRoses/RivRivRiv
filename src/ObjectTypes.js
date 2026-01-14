/**
 * ObjectTypes.js
 * Class-based object type definitions with attributes
 * Makes it easy for Fish.js and other systems to identify object properties
 */

import * as THREE from 'three';

/**
 * Base class for all placeable objects
 */
export class PlaceableObject {
    constructor() {
        this.type = 'generic';
        this.size = 2;
        this.color = 0x8b7355;
        this.previewColor = 0x00ff00;
    }

    /**
     * Create Three.js geometry for this object type
     * @returns {THREE.BufferGeometry}
     */
    createGeometry() {
        return new THREE.BoxGeometry(this.size, this.size, this.size);
    }
}

/**
 * Rock1 - Small rock
 */
export class Rock1 extends PlaceableObject {
    constructor() {
        super();
        this.type = 'rock1';
        this.size = 2;
        this.color = 0x8b7355; // Light brown
        this.previewColor = 0x00ff00;

        // FBX model configuration
        this.usesFBXModel = true;
        this.fbxMeshPath = '../assets/models/kaya2.fbx';
        this.fbxBoundariesPath = '../assets/models/kaya2Boundaries.fbx';
        this.fbxScale = new THREE.Vector3(0.01, 0.01, 0.01);
    }

    createGeometry() {
        // Fallback geometry for preview placeholder
        return new THREE.BoxGeometry(2, 2, 2);
    }
}

/**
 * Rock2 - Big Rock
 */
export class Rock2 extends PlaceableObject {
    constructor() {
        super();
        this.type = 'rock2';
        this.size = 2.5;
        this.color = 0x696969; // Gray
        this.previewColor = 0x00ff00;

        this.usesFBXModel = true;
        this.fbxMeshPath = '../assets/models/SM_Rocks_09B.fbx';
        this.fbxBoundariesPath = '../assets/models/RockColliderB.fbx';
        this.fbxScale = new THREE.Vector3(0.04, 0.04, 0.04);
    }

    createGeometry() {
        return new THREE.BoxGeometry(3, 2.5, 2.5);
    }
}

/**
 * Rock3 - Large Coral
 */
export class Rock3 extends PlaceableObject {
    constructor() {
        super();
        this.type = 'rock3';
        this.size = 3;
        this.color = 0x556b2f; // Olive green
        this.previewColor = 0x00ff00;

        this.usesFBXModel = true;
        this.fbxMeshPath = '../assets/models/BigCoral.fbx';
        this.fbxBoundariesPath = '../assets/models/BigCoralColliders.fbx';
        this.fbxScale = new THREE.Vector3(0.05, 0.05, 0.05);

        // Rock3 must be placed at ground level (y=0)
        this.requiresGroundPlacement = true;
    }

    createGeometry() {
        return new THREE.BoxGeometry(4, 3, 3);
    }
}

/**
 * Bait - Attracts fish
 */
export class Bait extends PlaceableObject {
    constructor() {
        super();
        this.type = 'bait';
        this.size = 0.8;
        this.color = 0xff69b4; // Pink
        this.previewColor = 0x00ff00;
    }

    createGeometry() {
        return new THREE.SphereGeometry(0.4, 16, 16);
    }
}

/**
 * Spotlight - Illuminates area
 */
export class Spotlight extends PlaceableObject {
    constructor() {
        super();
        this.type = 'spotlight';
        this.size = 1;
        this.color = 0xffaa00; // Orange
        this.previewColor = 0xffff00; // Yellow
    }

    createGeometry() {
        return new THREE.ConeGeometry(0.5, 1, 8);
    }
}

/**
 * Factory function to create object type instances
 * @param {string} shape - Object type identifier
 * @returns {PlaceableObject} Instance of the appropriate object type class
 */
export function createObjectType(shape) {
    switch (shape) {
        case 'rock1': return new Rock1();
        case 'rock2': return new Rock2();
        case 'rock3': return new Rock3();
        case 'bait': return new Bait();
        case 'spotlight': return new Spotlight();
        default:
            console.warn(`Unknown object type "${shape}", using default PlaceableObject`);
            return new PlaceableObject();
    }
}

/**
 * Get object attributes from a Three.js object's userData
 * @param {THREE.Object3D} threeObject - The Three.js object to query
 * @returns {PlaceableObject|null} Object attributes or null
 */
export function getObjectAttributes(threeObject) {
    if (!threeObject || !threeObject.userData) return null;
    return threeObject.userData.attributes || null;
}

