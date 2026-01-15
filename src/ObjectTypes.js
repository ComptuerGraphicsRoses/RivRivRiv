import { GAME_SCALE } from "./FlockingSystem.js";
import * as THREE from 'three';

// Base class for objects
export class PlaceableObject {
    constructor() {
        this.type = 'generic';
        this.size = 2;
        this.color = 0x8b7355;
        this.previewColor = 0x00ff00;
    }

    createGeometry() {
        return new THREE.BoxGeometry(this.size * GAME_SCALE, this.size * GAME_SCALE, this.size * GAME_SCALE);
    }
}

export class Rock1 extends PlaceableObject {
    constructor() {
        super();
        this.type = 'rock1';
        this.size = 2;
        this.color = 0x8b7355; // Light brown
        this.previewColor = 0x00ff00;

        // Model settings
        this.usesFBXModel = true;
        this.fbxMeshPath = '../assets/models/kaya2.fbx';
        this.fbxBoundariesPath = '../assets/models/kaya2Boundaries.fbx';
        this.fbxScale = new THREE.Vector3(0.01, 0.01, 0.01);
    }

    createGeometry() {
        // Placeholder geometry
        return new THREE.BoxGeometry(2 * GAME_SCALE, 2 * GAME_SCALE, 2 * GAME_SCALE);
    }
}

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
        return new THREE.BoxGeometry(3 * GAME_SCALE, 2.5 * GAME_SCALE, 2.5 * GAME_SCALE);
    }
}

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

        this.requiresGroundPlacement = true;
    }

    createGeometry() {
        return new THREE.BoxGeometry(4 * GAME_SCALE, 3 * GAME_SCALE, 3 * GAME_SCALE);
    }
}

export class Bait extends PlaceableObject {
    constructor() {
        super();
        this.type = 'bait';
        this.size = 0.8;
        this.color = 0xff69b4; // Pink
        this.previewColor = 0x00ff00;
    }

    createGeometry() {
        return new THREE.SphereGeometry(0.4 * GAME_SCALE, 16, 16);
    }
}

export class Spotlight extends PlaceableObject {
    constructor() {
        super();
        this.type = 'spotlight';
        this.size = 1;
        this.color = 0xffaa00; // Orange
        this.previewColor = 0xffff00; // Yellow
    }

    createGeometry() {
        return new THREE.ConeGeometry(0.5 * GAME_SCALE, 1 * GAME_SCALE, 8);
    }
}

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

export function getObjectAttributes(threeObject) {
    if (!threeObject || !threeObject.userData) return null;
    return threeObject.userData.attributes || null;
}