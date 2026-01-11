// javascript
// src/Objects.js - add scroll-controlled preview distance
import * as THREE from 'three';
import { InventoryManager } from './Inventory.js';

export class ObjectManager {
    constructor(scene, camera, canvas) {
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;

        this.placedObjects = [];
        this.previewObject = null;
        this.buildMode = false;

        this.selectedShape = 'rock1'; // 'rock1', 'rock2', 'rock3', 'bait', 'spotlight'

        this.collidables = [];
        this._lastPreviewPos = new THREE.Vector3();
        this._previewMoveThreshold = 0.05;

        // Preview distance control
        this.previewDistance = 10;
        this.minPreviewDistance = 3;
        this.maxPreviewDistance = 30;
        this.distanceStep = 0.5;

        // Rotation control
        this.rotationMode = false;
        this.rotationSensitivity = 0.01;
        this.previewRotation = new THREE.Euler(0, 0, 0);

        // Initialize inventory manager
        this.inventoryManager = new InventoryManager();
        this.inventoryManager.setLevel('level1'); // Assume level1 for now

        // Callback for inventory changes
        this.onInventoryChange = null;

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseClick = this.onMouseClick.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
    }

    toggleBuildModeWithShape(shape) {
        // Check inventory before allowing build mode
        if (!this.inventoryManager.canPlace(shape)) {
            const remaining = this.inventoryManager.getRemaining(shape);
            const limit = this.inventoryManager.getLimit(shape);
            console.log(`Cannot place ${shape}: limit reached (${limit}/${limit} used)`);
            return false;
        }

        if (this.buildMode && this.selectedShape === shape) {
            this.exitBuildMode();
        } else {
            if (this.buildMode) this.exitBuildMode();
            this.selectedShape = shape;
            this.enterBuildMode();
        }
        return this.buildMode;
    }

    enterBuildMode() {
        const geometry = this.createGeometry(this.selectedShape);
        const material = new THREE.MeshStandardMaterial({
            color: this.getPreviewColor(this.selectedShape),
            transparent: true,
            opacity: 0.5
        });
        this.previewObject = new THREE.Mesh(geometry, material);
        this.scene.add(this.previewObject);

        this.indexCollidables();
        this.updatePreviewPosition(true);

        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('click', this.onMouseClick);
        window.addEventListener('wheel', this.onWheel, {passive: false});
        window.addEventListener('contextmenu', this.onContextMenu);
        this.buildMode = true;
    }

    exitBuildMode() {
        if (this.previewObject) {
            this.scene.remove(this.previewObject);
            this.previewObject.geometry.dispose();
            this.previewObject.material.dispose();
            this.previewObject = null;
        }
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('click', this.onMouseClick);
        window.removeEventListener('wheel', this.onWheel);
        window.removeEventListener('contextmenu', this.onContextMenu);
        this.rotationMode = false;
        this.buildMode = false;
    }

    onWheel(event) {
        event.preventDefault();

        // deltaY > 0 -> scroll down -> decrease distance
        // deltaY < 0 -> scroll up -> increase distance
        if (event.deltaY < 0) {
            this.previewDistance += this.distanceStep;
        } else {
            this.previewDistance -= this.distanceStep;
        }

        // clamp distance
        this.previewDistance = Math.max(
            this.minPreviewDistance,
            Math.min(this.maxPreviewDistance, this.previewDistance)
        );

        this.updatePreviewPosition(true);
    }

    onContextMenu(event) {
        // Prevent default right-click context menu in build mode
        event.preventDefault();
    }

    createGeometry(shape) {
        // Placeholder geometries - replace with actual rock models later
        switch (shape) {
            case 'rock1':
                return new THREE.BoxGeometry(2, 2, 2); // Small rock
            case 'rock2':
                return new THREE.BoxGeometry(3, 2.5, 2.5); // Medium rock
            case 'rock3':
                return new THREE.BoxGeometry(4, 3, 3); // Large rock
            case 'bait':
                return new THREE.SphereGeometry(0.4, 16, 16); // Simple sphere for bait
            case 'spotlight':
                // Visual representation of spotlight - small cone pointing down
                return new THREE.ConeGeometry(0.5, 1, 8);
            default:
                return new THREE.BoxGeometry(2, 2, 2);
        }
    }

    getPreviewColor(shape) {
        switch (shape) {
            case 'spotlight':
                return 0xffff00; // Yellow for spotlight preview
            default:
                return 0x00ff00;
        }
    }

    getPlacedColor(shape) {
        switch (shape) {
            case 'rock1':
                return 0x8b7355; // Light brown
            case 'rock2':
                return 0x696969; // Gray
            case 'rock3':
                return 0x556b2f; // Olive green
            case 'bait':
                return 0xff69b4; // Pink for bait
            case 'spotlight':
                return 0xffaa00; // Orange for spotlight body
            default:
                return 0x8b7355;
        }
    }

    getShapeSize(shape) {
        switch (shape) {
            case 'rock1':
                return 2;
            case 'rock2':
                return 2.5;
            case 'rock3':
                return 3;
            case 'bait':
                return 0.8;
            case 'spotlight':
                return 1; // Small size for spotlight
            default:
                return 2;
        }
    }

    indexCollidables() {
        this.collidables.length = 0;
        this.scene.traverse(child => {
            if (!child.isMesh) return;
            if (child === this.previewObject) return;
            if (!child.geometry) return;
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();

            this.collidables.push({
                mesh: child,
                localBBox: child.geometry.boundingBox.clone(),
                localSphere: child.geometry.boundingSphere.clone(),
                worldBBox: null,
                needsWorldBBoxUpdate: true
            });
        });
    }

    updatePreviewPosition(forceCheck = false) {
        if (!this.previewObject || !this.camera) return;

        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        // Create raycaster from camera
        const raycaster = new THREE.Raycaster(
            this.camera.position,
            direction,
            0,
            this.previewDistance
        );

        // Get all intersections except preview object
        const intersects = raycaster.intersectObjects(this.scene.children, true)
            .filter(hit => hit.object !== this.previewObject);

        let actualDistance = this.previewDistance;

        // If raycast hits something, clamp distance to just before hit
        if (intersects.length > 0) {
            const hitDistance = intersects[0].distance;
            const objectSize = this.getShapeSize(this.selectedShape);
            // Reduced buffer: just half object size + small gap
            const buffer = objectSize * 0.5 + 0.2; // reduced from objectSize * 0.5

            actualDistance = Math.max(
                this.minPreviewDistance,
                hitDistance - buffer
            );
        }

        const position = this.camera.position.clone().add(
            direction.multiplyScalar(actualDistance)
        );
        this.previewObject.position.copy(position);

        const moved = position.distanceTo(this._lastPreviewPos) > this._previewMoveThreshold;
        if (forceCheck || moved) {
            this._lastPreviewPos.copy(position);
            const hasCollision = this.checkCollision(position);
            this.updatePreviewColor(hasCollision);
        }
    }

    checkCollision(position) {
        const objectSize = this.getShapeSize(this.selectedShape);
        const halfSize = objectSize * 0.6;
        const previewSphereRadius = Math.sqrt(3 * halfSize * halfSize);

        for (const p of this.placedObjects) {
            if (position.distanceTo(p.position) < this.minDistance) {
                return true;
            }
        }

        const previewBox = new THREE.Box3().setFromCenterAndSize(
            position,
            new THREE.Vector3(objectSize, objectSize, objectSize)
        );

        for (const entry of this.collidables) {
            const mesh = entry.mesh;
            const localSphere = entry.localSphere;
            const worldCenter = localSphere.center.clone().applyMatrix4(mesh.matrixWorld);
            const maxScale = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
            const worldRadius = localSphere.radius * maxScale;
            const dist = position.distanceTo(worldCenter);
            if (dist > worldRadius + previewSphereRadius) continue;

            if (!entry.worldBBox || entry.needsWorldBBoxUpdate) {
                entry.worldBBox = entry.localBBox.clone().applyMatrix4(mesh.matrixWorld);
                entry.needsWorldBBoxUpdate = false;
            }
            if (previewBox.intersectsBox(entry.worldBBox)) return true;
        }

        return position.y < 1;

    }

    updatePreviewColor(hasCollision) {
        if (!this.previewObject) return;
        if (hasCollision) this.previewObject.material.color.setHex(0xff0000);
        else this.previewObject.material.color.setHex(this.getPreviewColor(this.selectedShape));
    }

        onMouseMove(event) {
            if (this.rotationMode && this.previewObject) {
                // Use movementX/Y from pointer lock for rotation
                // For spotlight/cone: use Z and X axes instead of Y and X
                if (this.selectedShape === 'spotlight') {
                    // Mouse X controls Z-axis (sideways tilt)
                    // Mouse Y controls X-axis (forward/backward tilt)
                    this.previewRotation.z += event.movementX * this.rotationSensitivity;
                    this.previewRotation.x += event.movementY * this.rotationSensitivity;
                } else {
                    // For regular objects: use Y and X axes
                    this.previewRotation.y += event.movementX * this.rotationSensitivity;
                    this.previewRotation.x += event.movementY * this.rotationSensitivity;
                }

                this.previewObject.rotation.copy(this.previewRotation);
            } else {
                this.updatePreviewPosition();
            }
        }

    onMouseClick(event) {
        if (event.button === 0) { // Left click - place object
            if (!this.buildMode || !this.previewObject) return;

            const hasCollision = this.checkCollision(this.previewObject.position);
            if (hasCollision) {
                console.log('Cannot place object here - collision detected!');
                return;
            }
            this.placeObject();
        } else if (event.button === 2) { // Right click - toggle rotation mode
            event.preventDefault();
            this.rotationMode = !this.rotationMode;
            console.log(`Rotation mode: ${this.rotationMode ? 'ON' : 'OFF'}`);
        }
    }

    placeObject() {
        if (!this.previewObject) return;

        // Handle spotlight differently from regular objects
        if (this.selectedShape === 'spotlight') {
            // Create actual THREE.SpotLight
            const spotlight = new THREE.SpotLight(0xffffff, 2.0);
            spotlight.position.copy(this.previewObject.position);
            spotlight.rotation.copy(this.previewObject.rotation);
            spotlight.intensity = 6.0;
            spotlight.angle = Math.PI / 9;
            spotlight.penumbra = 0.2;
            spotlight.decay = 1;
            spotlight.distance = 0;
            spotlight.castShadow = true;

            // Calculate target position based on rotation
            // Create a direction vector pointing down in local space
            const direction = new THREE.Vector3(0, -1, 0);
            // Apply the spotlight's rotation to the direction
            direction.applyEuler(this.previewObject.rotation);
            // Set target at a distance along that direction
            const targetDistance = 10;
            const target = new THREE.Object3D();
            target.position.copy(spotlight.position).add(direction.multiplyScalar(targetDistance));

            this.scene.add(target);
            spotlight.target = target;

            this.scene.add(spotlight);
            this.scene.add(spotlight.target);

            // Create a visual indicator (cone mesh) - non-collidable
            const visualCone = new THREE.Mesh(
                new THREE.ConeGeometry(0.5, 1.5, 8),
                new THREE.MeshBasicMaterial({
                    color: 0xffaa00,
                    transparent: true,
                    opacity: 0.7
                })
            );
            visualCone.position.copy(this.previewObject.position);
            visualCone.rotation.copy(this.previewObject.rotation);
            this.scene.add(visualCone);

            // Store spotlight with metadata
            spotlight.userData.type = 'spotlight';
            spotlight.userData.placedAt = Date.now();
            spotlight.userData.visual = visualCone;
            spotlight.userData.target = target;

            this.placedObjects.push(spotlight);

            // Record placement in inventory
            this.inventoryManager.recordPlacement(this.selectedShape);

            // Notify inventory change
            if (this.onInventoryChange) {
                this.onInventoryChange();
            }

            console.log(`Placed spotlight #${this.placedObjects.length}`);

        } else {
            // Regular object placement (rocks, etc.)
            const geometry = this.createGeometry(this.selectedShape);
            const material = new THREE.MeshStandardMaterial({
                color: this.getPlacedColor(this.selectedShape),
                metalness: 0.3,
                roughness: 0.7
            });

            const placedObject = new THREE.Mesh(geometry, material);
            placedObject.position.copy(this.previewObject.position);
            placedObject.rotation.copy(this.previewObject.rotation);
            placedObject.userData.type = this.selectedShape;
            placedObject.userData.placedAt = Date.now();

            // Enable shadows
            placedObject.castShadow = true;
            placedObject.receiveShadow = true;

            placedObject.geometry.computeBoundingBox();
            placedObject.geometry.computeBoundingSphere();

            const worldBBox = placedObject.geometry.boundingBox.clone().applyMatrix4(placedObject.matrixWorld);

            this.scene.add(placedObject);
            this.placedObjects.push(placedObject);

            // Record placement in inventory
            this.inventoryManager.recordPlacement(this.selectedShape);

            // Notify inventory change
            if (this.onInventoryChange) {
                this.onInventoryChange();
            }

            this.collidables.push({
                mesh: placedObject,
                localBBox: placedObject.geometry.boundingBox.clone(),
                localSphere: placedObject.geometry.boundingSphere.clone(),
                worldBBox,
                needsWorldBBoxUpdate: false
            });

            console.log(`Placed ${this.selectedShape} #${this.placedObjects.length}`);
        }

        this.exitBuildMode();
    }

    update(deltaTime) {
        if (this.buildMode && this.previewObject) {
            this.updatePreviewPosition();
        }
    }

    markMeshTransformChanged(mesh) {
        for (const entry of this.collidables) {
            if (entry.mesh === mesh) {
                entry.needsWorldBBoxUpdate = true;
                break;
            }
        }
    }

    /**
     * Clear all placed objects and reset inventory counts
     */
    clearAll() {
        this.dispose();
        this.inventoryManager.resetCounts();
        console.log('All objects cleared, inventory reset');
    }

    dispose() {
        this.exitBuildMode();

        this.placedObjects.forEach(obj => {
            this.scene.remove(obj);

            // Handle spotlight cleanup
            if (obj.userData.type === 'spotlight') {
                if (obj.userData.visual) {
                    this.scene.remove(obj.userData.visual);
                    if (obj.userData.visual.geometry) obj.userData.visual.geometry.dispose();
                    if (obj.userData.visual.material) obj.userData.visual.material.dispose();
                }
                if (obj.userData.target) this.scene.remove(obj.userData.target);
            }

            // Handle regular object cleanup
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        this.placedObjects = [];
        this.collidables = [];
    }
}