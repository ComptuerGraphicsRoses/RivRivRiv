// javascript
// src/Objects.js - add scroll-controlled preview distance
import * as THREE from 'three';
import { InventoryManager } from './Inventory.js';
import { createObjectType, getObjectAttributes } from './ObjectTypes.js';

export class ObjectManager {
    constructor(scene, camera, canvas, sceneManager = null) {
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;
        this.sceneManager = sceneManager; // Reference to SceneManager for bait registration

        this.placedObjects = [];
        this.previewObject = null;
        this.previewSpotlight = null; // Preview spotlight light in build mode
        this.previewSpotlightTarget = null; // Target for preview spotlight
        this.buildMode = false;

        this.selectedShape = 'rock1'; // 'rock1', 'rock2', 'rock3', 'bait', 'spotlight'

        this.collidables = [];
        this.minDistance = 1.5; // Minimum distance between placed objects
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

        // Spotlight intensity control
        this.spotlightIntensity = 6.0; // Default intensity
        this.minSpotlightIntensity = 1.0;
        this.maxSpotlightIntensity = 20.0;
        this.intensityStep = 0.5;

        // Initialize inventory manager
        this.inventoryManager = new InventoryManager();
        this.inventoryManager.setLevel('level1'); // Assume level1 for now

        // Initialize inventory manager
        this.inventoryManager = new InventoryManager();
        this.inventoryManager.setLevel('level1'); // Assume level1 for now

        // Flag to prevent immediate placement after selecting an object
        this.justSelectedObject = false;

        // Raycaster for object selection when not in build mode
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.onCanvasClick = this.onCanvasClick.bind(this);

        // Add global click listener for object selection
        this.canvas.addEventListener('click', this.onCanvasClick);

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

        // Add preview spotlight light if placing a spotlight
        if (this.selectedShape === 'spotlight') {
            this.previewSpotlight = new THREE.SpotLight(0xffffff, this.spotlightIntensity);
            this.previewSpotlight.angle = Math.PI / 9;
            this.previewSpotlight.penumbra = 0.2;
            this.previewSpotlight.decay = 1;
            this.previewSpotlight.distance = 0;
            this.previewSpotlight.castShadow = false; // Disable shadows for preview performance

            // Create target for spotlight
            this.previewSpotlightTarget = new THREE.Object3D();
            this.previewSpotlight.target = this.previewSpotlightTarget;

            this.scene.add(this.previewSpotlight);
            this.scene.add(this.previewSpotlightTarget);
        }

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

        // Remove preview spotlight if it exists
        if (this.previewSpotlight) {
            this.scene.remove(this.previewSpotlight);
            this.previewSpotlight = null;
        }
        if (this.previewSpotlightTarget) {
            this.scene.remove(this.previewSpotlightTarget);
            this.previewSpotlightTarget = null;
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
        const objectType = createObjectType(shape);
        return objectType.createGeometry();
    }

    getPreviewColor(shape) {
        const objectType = createObjectType(shape);
        return objectType.previewColor;
    }

    getPlacedColor(shape) {
        const objectType = createObjectType(shape);
        return objectType.color;
    }

    getShapeSize(shape) {
        const objectType = createObjectType(shape);
        return objectType.size;
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

        // Update preview spotlight position and target if it exists
        if (this.previewSpotlight && this.previewSpotlightTarget) {
            this.previewSpotlight.position.copy(position);
            this.previewSpotlight.rotation.copy(this.previewRotation);

            // Update spotlight target based on rotation
            const direction = new THREE.Vector3(0, -1, 0);
            direction.applyEuler(this.previewRotation);
            const targetDistance = 10;
            this.previewSpotlightTarget.position.copy(position).add(direction.multiplyScalar(targetDistance));
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
        // Ignore clicks that just selected an object
        if (this.justSelectedObject) return;

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

    /**
     * Handle canvas clicks for selecting placed objects (when not in build mode)
     */
    onCanvasClick(event) {
        // Only handle selection when NOT in build mode
        if (this.buildMode) return;

        // Raycast from center of screen (0, 0 in normalized device coordinates)
        // This selects whatever object is at the center crosshair, not where mouse clicks
        this.mouse.x = 0;
        this.mouse.y = 0;

        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Check for intersections with placed objects
        const selectableObjects = this.placedObjects.filter(obj => {
            // For spotlights, check their visual cone instead
            if (obj.userData.type === 'spotlight') {
                return obj.userData.visual;
            }
            return obj.isMesh;
        }).map(obj => {
            // Return visual cone for spotlights, regular object for others
            return obj.userData.type === 'spotlight' ? obj.userData.visual : obj;
        });

        const intersects = this.raycaster.intersectObjects(selectableObjects, false);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;

            // Find the original placed object
            let selectedObject = null;
            let selectedIndex = -1;  // ADD THIS LINE
            for (let i = 0; i < this.placedObjects.length; i++) {  // CHANGE: use for loop with index
                const obj = this.placedObjects[i];
                if (obj.isMesh && obj === clickedObject) {
                    selectedObject = obj;
                    selectedIndex = i;  // ADD THIS LINE
                    break;
                } else if (obj.userData.visual === clickedObject) {
                    selectedObject = obj;
                    selectedIndex = i;  // ADD THIS LINE
                    break;
                }
            }

            if (selectedObject && selectedObject.userData.type) {
                const objectType = selectedObject.userData.type;
                console.log(`Removing ${objectType} to re-place it...`);

                // Prevent this click from triggering build mode placement
                event.stopPropagation();
                this.justSelectedObject = true;

                // Remove the object from the scene first
                this.removeObject(selectedIndex);

                // Now enter build mode with this object type
                this.toggleBuildModeWithShape(objectType);

                // Reset flag after a short delay
                setTimeout(() => {
                    this.justSelectedObject = false;
                }, 100);
            }
        }
    }

    /**
     * Remove a placed object by index
     * @param {number} index - Index in placedObjects array
     */
    removeObject(index) {
        if (index < 0 || index >= this.placedObjects.length) return;

        const obj = this.placedObjects[index];
        const objectType = obj.userData.type;

        // Unregister bait from flocking system if it's a bait
        if (objectType === 'bait' && this.sceneManager) {
            this.sceneManager.unregisterBait(obj);
        }

        // Remove from scene
        this.scene.remove(obj);

        // Handle spotlight cleanup
        if (objectType === 'spotlight') {
            if (obj.userData.visual) {
                this.scene.remove(obj.userData.visual);
                if (obj.userData.visual.geometry) obj.userData.visual.geometry.dispose();
                if (obj.userData.visual.material) obj.userData.visual.material.dispose();
            }
            if (obj.userData.target) {
                this.scene.remove(obj.userData.target);
            }
        }

        // Handle regular object cleanup
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();

        // Remove from collidables
        this.collidables = this.collidables.filter(entry => entry.mesh !== obj);

        // Remove from placedObjects array
        this.placedObjects.splice(index, 1);

        // Return to inventory
        this.inventoryManager.recordRemoval(objectType);

        // Notify inventory change
        if (this.onInventoryChange) {
            this.onInventoryChange();
        }

        console.log(`Removed ${objectType}`);
    }

    /**
     * Handle bait consumption by fish
     * Called when a fish reaches and consumes a bait
     * @param {THREE.Mesh} baitObject - The bait object to remove
     */
    consumeBait(baitObject) {
        const index = this.placedObjects.indexOf(baitObject);
        if (index === -1) return;

        const objectType = baitObject.userData.type;

        // Remove from scene
        this.scene.remove(baitObject);

        // Handle cleanup
        if (baitObject.geometry) baitObject.geometry.dispose();
        if (baitObject.material) baitObject.material.dispose();

        // Remove from collidables
        this.collidables = this.collidables.filter(entry => entry.mesh !== baitObject);

        // Remove from placedObjects array
        this.placedObjects.splice(index, 1);

        // Return to inventory
        this.inventoryManager.recordRemoval(objectType);

        // Notify inventory change
        if (this.onInventoryChange) {
            this.onInventoryChange();
        }

        console.log(`✓ Bait consumed by fish and returned to inventory`);
    }

    placeObject() {
        if (!this.previewObject) return;

        // Handle spotlight differently from regular objects
        if (this.selectedShape === 'spotlight') {
            // Create actual THREE.SpotLight
            const spotlight = new THREE.SpotLight(0xffffff, 2.0);
            spotlight.position.copy(this.previewObject.position);
            spotlight.rotation.copy(this.previewObject.rotation);
            spotlight.intensity = this.spotlightIntensity;
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

            // Store spotlight with metadata and attributes
            const objectTypeData = createObjectType(this.selectedShape);
            spotlight.userData.type = 'spotlight';
            spotlight.userData.placedAt = Date.now();
            spotlight.userData.visual = visualCone;
            spotlight.userData.target = target;
            spotlight.userData.attributes = objectTypeData; // Store all attributes
            spotlight.userData.attributes.lightIntensity = this.spotlightIntensity; // Store actual used intensity

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

            // Store object type and attributes for easy querying
            const objectTypeData = createObjectType(this.selectedShape);
            placedObject.userData.type = this.selectedShape;
            placedObject.userData.placedAt = Date.now();
            placedObject.userData.attributes = objectTypeData; // Store all attributes

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

            // Register bait with flocking system if it's a bait
            if (this.selectedShape === 'bait' && this.sceneManager) {
                this.sceneManager.registerBait(placedObject);
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

    /**
     * Get object attributes for collision detection (for Fish.js)
     * @param {THREE.Object3D} object - The collided object
     * @returns {PlaceableObject|null} Object attributes or null
     */
    getObjectAttributes(object) {
        return getObjectAttributes(object);
    }

    update() {
        if (this.buildMode && this.previewObject) {
            this.updatePreviewPosition();
        }
    }

    /**
     * Toggle all spotlights on/off
     * @returns {boolean} True if spotlights were toggled, false if no spotlights exist
     */
    toggleAllSpotlights() {
        const spotlights = this.placedObjects.filter(obj => obj.userData.type === 'spotlight');

        if (spotlights.length === 0) {
            console.log('No spotlights placed');
            return false;
        }

        // Toggle all spotlights
        spotlights.forEach(spotlight => {
            spotlight.visible = !spotlight.visible;
            if (spotlight.userData.visual) {
                spotlight.userData.visual.visible = spotlight.visible;
            }
        });

        const status = spotlights[0].visible ? 'ON' : 'OFF';
        console.log(`💡 ${spotlights.length} spotlight(s) toggled ${status}`);
        return true;
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

        // Remove canvas click listener
        this.canvas.removeEventListener('click', this.onCanvasClick);

        this.placedObjects.forEach(obj => {
            // Unregister bait from flocking system if it's a bait
            if (obj.userData.type === 'bait' && this.sceneManager) {
                this.sceneManager.unregisterBait(obj);
            }

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