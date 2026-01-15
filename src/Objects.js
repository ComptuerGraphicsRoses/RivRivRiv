import { GAME_SCALE, BOUNDARY_HALF_X, BOUNDARY_HALF_Z, BOUNDARY_MIN_Y, BOUNDARY_MAX_Y } from "./FlockingSystem.js";
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { InventoryManager } from './Inventory.js';
import { createObjectType } from './ObjectTypes.js';

export class ObjectManager {
    constructor(scene, camera, canvas, sceneManager = null, shaderManager = null) {
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;
        this.sceneManager = sceneManager;
        this.shaderManager = shaderManager;
        this.gameState = null;

        this.placedObjects = [];
        this.previewObject = null;
        this.previewSpotlight = null;
        this.previewSpotlightTarget = null;
        this.buildMode = false;

        this.selectedShape = 'rock1';

        this.collidables = [];
        this.minDistance = 1.5 * GAME_SCALE;
        this._lastPreviewPos = new THREE.Vector3();
        this._previewMoveThreshold = 0.05;

        // Preview distance settings
        this.previewDistance = 10 * GAME_SCALE;
        this.minPreviewDistance = 3 * 1.5 * GAME_SCALE;
        this.maxPreviewDistance = 30 * GAME_SCALE;
        this.distanceStep = 0.5 * GAME_SCALE;

        // Rotation settings
        this.rotationMode = false;
        this.rotationSensitivity = 0.01;
        this.previewRotation = new THREE.Euler(0, 0, 0);
        this.zRotationStep = 0.1;

        // Spotlight settings
        this.spotlightIntensity = 6.0;
        this.minSpotlightIntensity = 1.0;
        this.maxSpotlightIntensity = 20.0;
        this.intensityStep = 0.5;

        this.inventoryManager = new InventoryManager();
        this.inventoryManager.setLevel('level1');

        this.justSelectedObject = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Bindings
        this.onCanvasClick = this.onCanvasClick.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseClick = this.onMouseClick.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);

        this.canvas.addEventListener('click', this.onCanvasClick);
        this.onInventoryChange = null;
    }

    toggleBuildModeWithShape(shape) {
        if (!shape) {
            console.error('toggleBuildModeWithShape called with invalid shape:', shape);
            return false;
        }

        if (this.gameState && this.gameState.phase !== 'PREPARATION') {
            console.log('Cannot place objects during simulation - press R to restart');
            return false;
        }

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

    loadFBXPreview(objectType) {
        const loader = new FBXLoader();

        // Placeholder while loading
        const placeholderGeometry = this.createGeometry(this.selectedShape);
        const placeholderMaterial = new THREE.MeshStandardMaterial({
            color: this.getPreviewColor(this.selectedShape),
            transparent: true,
            opacity: 0.3
        });
        this.previewObject = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
        this.scene.add(this.previewObject);

        console.log(`Loading FBX preview: ${objectType.fbxMeshPath}`);

        loader.load(
            objectType.fbxMeshPath,
            (fbx) => {
                if (this.previewObject && this.previewObject.geometry) {
                    this.scene.remove(this.previewObject);
                    this.previewObject.geometry.dispose();
                    this.previewObject.material.dispose();
                }

                const scaledScale = objectType.fbxScale.clone().multiplyScalar(GAME_SCALE);
                fbx.scale.copy(scaledScale);

                // Apply preview transparency
                fbx.traverse((child) => {
                    if (child.isMesh) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];

                        materials.forEach((mat, index) => {
                            if (mat) {
                                const clonedMat = mat.clone();
                                clonedMat.transparent = true;
                                clonedMat.opacity = 0.5;

                                if (!clonedMat.map) {
                                    clonedMat.color.setHex(this.getPreviewColor(this.selectedShape));
                                }

                                if (Array.isArray(child.material)) {
                                    child.material[index] = clonedMat;
                                } else {
                                    child.material = clonedMat;
                                }
                            }
                        });
                    }
                });

                this.previewObject = fbx;
                this.previewObject.userData.isFBXModel = true;
                this.scene.add(this.previewObject);

                console.log(`FBX preview loaded: ${objectType.fbxMeshPath}`);
            },
            undefined,
            (error) => {
                console.error(`Error loading FBX preview:`, error);
            }
        );
    }

    enterBuildMode() {
        const objectType = createObjectType(this.selectedShape);
        this.previewRotation.set(0, 0, 0);

        if (objectType.usesFBXModel) {
            this.loadFBXPreview(objectType);
        } else {
            const geometry = this.createGeometry(this.selectedShape);
            const material = new THREE.MeshStandardMaterial({
                color: this.getPreviewColor(this.selectedShape),
                transparent: true,
                opacity: 0.5
            });
            this.previewObject = new THREE.Mesh(geometry, material);
            this.scene.add(this.previewObject);
        }

        if (this.selectedShape === 'spotlight') {
            this.previewSpotlight = new THREE.SpotLight(0xffffff, this.spotlightIntensity);
            this.previewSpotlight.angle = Math.PI / 9;
            this.previewSpotlight.penumbra = 0.2;
            this.previewSpotlight.decay = 1;
            this.previewSpotlight.distance = 0;
            this.previewSpotlight.castShadow = false;

            this.previewSpotlightTarget = new THREE.Object3D();
            this.previewSpotlight.target = this.previewSpotlightTarget;

            this.scene.add(this.previewSpotlight);
            this.scene.add(this.previewSpotlightTarget);
        }

        this.indexCollidables();
        this.updatePreviewPosition(true);

        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('click', this.onMouseClick);
        window.addEventListener('wheel', this.onWheel, { passive: false });
        window.addEventListener('contextmenu', this.onContextMenu);
        window.addEventListener('keydown', this.onKeyDown);
        this.buildMode = true;
    }

    exitBuildMode() {
        if (this.previewObject) {
            this.scene.remove(this.previewObject);

            if (this.previewObject.userData.isFBXModel) {
                this.previewObject.traverse((child) => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat && mat.dispose && mat.dispose());
                            } else if (child.material.dispose) {
                                child.material.dispose();
                            }
                        }
                    }
                });
            } else {
                if (this.previewObject.geometry) this.previewObject.geometry.dispose();
                if (this.previewObject.material) this.previewObject.material.dispose();
            }
            this.previewObject = null;
        }

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
        window.removeEventListener('keydown', this.onKeyDown);
        this.rotationMode = false;
        this.buildMode = false;
    }

    onWheel(event) {
        event.preventDefault();

        if (event.deltaY < 0) {
            this.previewDistance += this.distanceStep;
        } else {
            this.previewDistance -= this.distanceStep;
        }

        this.previewDistance = Math.max(
            this.minPreviewDistance,
            Math.min(this.maxPreviewDistance, this.previewDistance)
        );

        this.updatePreviewPosition(true);
    }

    onContextMenu(event) {
        event.preventDefault();
    }

    onKeyDown = (event) => {
        if (!this.buildMode || !this.previewObject) return;

        const objectTypeData = createObjectType(this.selectedShape);

        // Z-axis rotation for objects that aren't ground-bound
        if (event.key.toLowerCase() === 'q') {
            if (!objectTypeData.requiresGroundPlacement) {
                this.previewRotation.z -= this.zRotationStep;
                this.previewObject.rotation.copy(this.previewRotation);
                event.preventDefault();
            }
        } else if (event.key.toLowerCase() === 'e') {
            if (!objectTypeData.requiresGroundPlacement) {
                this.previewRotation.z += this.zRotationStep;
                this.previewObject.rotation.copy(this.previewRotation);
                event.preventDefault();
            }
        }
    }

    createGeometry(shape) {
        const objectType = createObjectType(shape);
        if (!objectType || !objectType.createGeometry) {
            console.warn(`Invalid shape "${shape}" in createGeometry, using default box`);
            return new THREE.BoxGeometry(2, 2, 2);
        }
        return objectType.createGeometry();
    }

    getPreviewColor(shape) {
        const objectType = createObjectType(shape);
        return (objectType && objectType.previewColor !== undefined) ? objectType.previewColor : 0x00ff00;
    }

    getPlacedColor(shape) {
        const objectType = createObjectType(shape);
        return (objectType && objectType.color !== undefined) ? objectType.color : 0x8b7355;
    }

    getShapeSize(shape) {
        const objectType = createObjectType(shape);
        return (objectType && objectType.size !== undefined) ? objectType.size : 2;
    }

    indexCollidables() {
        this.collidables.length = 0;
        this.scene.traverse(child => {
            if (!child.isMesh || child === this.previewObject || !child.geometry) return;

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

        const raycaster = new THREE.Raycaster(
            this.camera.position,
            direction,
            0,
            this.previewDistance
        );

        const intersects = raycaster.intersectObjects(this.scene.children, true)
            .filter(hit => {
                if (hit.object === this.previewObject) return false;

                // Handle FBX children
                if (this.previewObject.userData.isFBXModel) {
                    let parent = hit.object.parent;
                    while (parent) {
                        if (parent === this.previewObject) return false;
                        parent = parent.parent;
                    }
                }

                if (hit.object.userData.ignoreRaycast) return false;
                return true;
            });

        let actualDistance = this.previewDistance;

        if (intersects.length > 0) {
            const hitDistance = intersects[0].distance;
            const objectSize = this.getShapeSize(this.selectedShape);
            const buffer = objectSize * 0.5 + 0.2;

            actualDistance = Math.max(
                this.minPreviewDistance,
                hitDistance - buffer
            );
        }

        const position = this.camera.position.clone().add(
            direction.multiplyScalar(actualDistance)
        );

        // Boundary Clamping
        const objectTypeData = createObjectType(this.selectedShape);
        const objectRadius = (this.getShapeSize(this.selectedShape) / 2) || 1;
        const safetyMargin = 1.0;
        const totalBuffer = objectRadius + safetyMargin;

        position.x = Math.max(-BOUNDARY_HALF_X + totalBuffer, Math.min(BOUNDARY_HALF_X - totalBuffer, position.x));
        position.z = Math.max(-BOUNDARY_HALF_Z + totalBuffer, Math.min(BOUNDARY_HALF_Z - totalBuffer, position.z));

        if (objectTypeData.requiresGroundPlacement) {
            position.y = 0.2;
        } else {
            position.y = Math.max(BOUNDARY_MIN_Y + totalBuffer, Math.min(BOUNDARY_MAX_Y - totalBuffer, position.y));
        }

        this.previewObject.position.copy(position);

        if (this.previewSpotlight && this.previewSpotlightTarget) {
            this.previewSpotlight.position.copy(position);
            this.previewSpotlight.rotation.copy(this.previewRotation);

            const direction = new THREE.Vector3(0, -1, 0);
            direction.applyEuler(this.previewRotation);
            const targetDistance = 10 * GAME_SCALE;
            this.previewSpotlightTarget.position.copy(position).add(direction.multiplyScalar(targetDistance));
        }
    }

    onMouseMove(event) {
        if (this.rotationMode && this.previewObject) {
            const objectTypeData = createObjectType(this.selectedShape);

            if (objectTypeData.requiresGroundPlacement) {
                this.previewRotation.y += event.movementX * this.rotationSensitivity;
            } else {
                this.previewRotation.y += event.movementX * this.rotationSensitivity;
                this.previewRotation.x += event.movementY * this.rotationSensitivity;
            }

            this.previewObject.rotation.copy(this.previewRotation);
        } else {
            this.updatePreviewPosition();
        }
    }

    onMouseClick(event) {
        if (this.justSelectedObject) return;

        if (event.button === 0) {
            if (!this.buildMode || !this.previewObject) return;
            this.placeObject();
        } else if (event.button === 2) {
            event.preventDefault();
            this.rotationMode = !this.rotationMode;
            console.log(`Rotation mode: ${this.rotationMode ? 'ON' : 'OFF'}`);
        }
    }

    onCanvasClick(event) {
        if (this.buildMode) return;
        if (this.gameState && this.gameState.phase !== 'PREPARATION') return;

        this.mouse.x = 0;
        this.mouse.y = 0;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const raycastTargets = [];
        for (const obj of this.placedObjects) {
            if (obj.userData.type === 'spotlight') {
                if (obj.userData.visual) {
                    raycastTargets.push(obj.userData.visual);
                }
            } else {
                raycastTargets.push(obj);
            }
        }

        const intersects = this.raycaster.intersectObjects(raycastTargets, true);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            let selectedObject = null;
            let selectedIndex = -1;

            // Identify which placed object was clicked
            for (let i = 0; i < this.placedObjects.length; i++) {
                const obj = this.placedObjects[i];

                // Check spotlight
                if (obj.userData.type === 'spotlight' && obj.userData.visual) {
                    if (obj.userData.visual === clickedObject) {
                        selectedObject = obj;
                        selectedIndex = i;
                        break;
                    }
                    // Check children of visual cone
                    let parent = clickedObject.parent;
                    while (parent) {
                        if (parent === obj.userData.visual) {
                            selectedObject = obj;
                            selectedIndex = i;
                            break;
                        }
                        parent = parent.parent;
                    }
                    if (selectedObject) break;
                }

                // Check direct match
                if (obj === clickedObject) {
                    selectedObject = obj;
                    selectedIndex = i;
                    break;
                }

                // Check FBX descendants
                if (obj.userData.isFBXModel) {
                    let parent = clickedObject.parent;
                    while (parent) {
                        if (parent === obj) {
                            selectedObject = obj;
                            selectedIndex = i;
                            break;
                        }
                        parent = parent.parent;
                    }
                    if (selectedObject) break;
                }
            }

            if (selectedObject && selectedObject.userData.type) {
                const objectType = selectedObject.userData.type;
                console.log(`Removing ${objectType} to re-place it...`);

                event.stopPropagation();
                this.justSelectedObject = true;

                this.removeObject(selectedIndex);
                this.toggleBuildModeWithShape(objectType);

                setTimeout(() => {
                    this.justSelectedObject = false;
                }, 100);
            }
        }
    }

    removeObject(index) {
        if (index < 0 || index >= this.placedObjects.length) return;

        const obj = this.placedObjects[index];
        const objectType = obj.userData.type;

        if (objectType === 'bait' && this.sceneManager) {
            this.sceneManager.unregisterBait(obj);
        }

        if (obj.userData.boundaries && this.sceneManager) {
            console.log(`Removing ${obj.userData.boundaries.length} boundary collider(s)...`);
            this.sceneManager.removeObstacles(obj.userData.boundaries);
        }

        this.scene.remove(obj);

        // Cleanup spotlights
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

        // Cleanup FBX or Geometry
        if (obj.userData.isFBXModel) {
            obj.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat && mat.dispose && mat.dispose());
                        } else if (child.material.dispose) {
                            child.material.dispose();
                        }
                    }
                }
            });
        } else {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        this.collidables = this.collidables.filter(entry => entry.mesh !== obj);
        this.placedObjects.splice(index, 1);
        this.inventoryManager.recordRemoval(objectType);

        if (this.onInventoryChange) {
            this.onInventoryChange();
        }

        console.log(`Removed ${objectType}`);
    }

    consumeBait(baitObject) {
        const index = this.placedObjects.indexOf(baitObject);
        if (index === -1) return;

        const objectType = baitObject.userData.type;
        this.scene.remove(baitObject);

        if (baitObject.geometry) baitObject.geometry.dispose();
        if (baitObject.material) baitObject.material.dispose();

        this.collidables = this.collidables.filter(entry => entry.mesh !== baitObject);
        this.placedObjects.splice(index, 1);
        this.inventoryManager.recordRemoval(objectType);

        if (this.onInventoryChange) {
            this.onInventoryChange();
        }

        console.log(`Bait consumed by fish and returned to inventory`);
    }

    placeFBXObject(objectTypeData) {
        const loader = new FBXLoader();
        const position = this.previewObject.position.clone();
        const rotation = this.previewObject.rotation.clone();
        const scale = objectTypeData.fbxScale;

        if (objectTypeData.requiresGroundPlacement) {
            position.y = 0;
        }

        console.log(`Placing FBX object at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);

        loader.load(
            objectTypeData.fbxMeshPath,
            async (fbx) => {
                const scaledScale = scale.clone().multiplyScalar(GAME_SCALE);
                fbx.scale.copy(scaledScale);
                fbx.position.copy(position);
                fbx.rotation.copy(rotation);

                const textures = this.extractTexturesFromFBX(fbx);

                if (this.shaderManager) {
                    this.createShaderMaterialsForFBX(fbx, textures);
                    this.applyShaderToFBX(fbx, this.shaderManager.activeShader);
                } else {
                    // Fallback materials
                    fbx.traverse((child) => {
                        if (child.isMesh) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];

                            materials.forEach(mat => {
                                if (mat) {
                                    mat.metalness = 0.3;
                                    mat.roughness = 0.7;
                                    mat.transparent = false;
                                    mat.opacity = 1.0;

                                    if (!mat.map) {
                                        mat.color.setHex(this.getPlacedColor(this.selectedShape));
                                    }
                                }
                            });

                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                }

                fbx.userData.type = this.selectedShape;
                fbx.userData.placedAt = Date.now();
                fbx.userData.attributes = objectTypeData;
                fbx.userData.isFBXModel = true;

                this.scene.add(fbx);
                this.placedObjects.push(fbx);

                if (this.sceneManager && this.shaderManager) {
                    this.sceneManager.addFBXModel(fbx);
                    console.log('FBX object registered with shader system');
                }

                this.inventoryManager.recordPlacement(this.selectedShape);

                if (this.onInventoryChange) {
                    this.onInventoryChange();
                }

                console.log(`Placed FBX object ${this.selectedShape} #${this.placedObjects.length}`);

                if (objectTypeData.fbxBoundariesPath && this.sceneManager) {
                    console.log(`Loading boundaries for ${this.selectedShape}...`);
                    try {
                        const boundaryData = await this.sceneManager.loadFBXBoundaries(
                            objectTypeData.fbxBoundariesPath,
                            position,
                            scale,
                            rotation
                        );
                        fbx.userData.boundaries = boundaryData;
                        console.log(`Boundaries loaded for ${this.selectedShape} (${boundaryData.length} colliders)`);
                    } catch (error) {
                        console.error(`Error loading boundaries:`, error);
                    }
                }
            },
            undefined,
            (error) => {
                console.error(`Error placing FBX object:`, error);
            }
        );
    }

    extractTexturesFromFBX(fbx) {
        const textures = new Map();
        fbx.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material) => {
                    if (material.map && material.map.isTexture) {
                        textures.set(child.uuid, material.map);
                    }
                });
            }
        });
        return textures;
    }

    createShaderMaterialsForFBX(fbx, textures) {
        if (!this.shaderManager) return;

        fbx.userData.shaderMaterials = {
            phong: new Map(),
            toon: new Map(),
            underwater: new Map()
        };

        fbx.traverse((child) => {
            if (child.isMesh) {
                const texture = textures.get(child.uuid) || null;

                const phongMaterial = this.shaderManager.createShaderMaterial('phong', texture);
                fbx.userData.shaderMaterials.phong.set(child.uuid, phongMaterial);

                const toonMaterial = this.shaderManager.createShaderMaterial('toon', texture);
                fbx.userData.shaderMaterials.toon.set(child.uuid, toonMaterial);

                const underwaterMaterial = this.shaderManager.createShaderMaterial('underwater', texture);
                fbx.userData.shaderMaterials.underwater.set(child.uuid, underwaterMaterial);

                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }

    applyShaderToFBX(fbx, shaderName) {
        if (!fbx.userData.shaderMaterials || !fbx.userData.shaderMaterials[shaderName]) {
            console.warn('Shader materials not found for FBX model');
            return;
        }

        fbx.traverse((child) => {
            if (child.isMesh) {
                const material = fbx.userData.shaderMaterials[shaderName].get(child.uuid);
                if (material) {
                    child.material = material;
                }
            }
        });
    }

    placeObject() {
        if (!this.previewObject) return;

        if (this.selectedShape === 'spotlight') {
            const spotlight = new THREE.SpotLight(0xffffff, 2.0);
            spotlight.position.copy(this.previewObject.position);
            spotlight.rotation.copy(this.previewObject.rotation);
            spotlight.intensity = this.spotlightIntensity;
            spotlight.angle = Math.PI / 9;
            spotlight.penumbra = 0.2;
            spotlight.decay = 1;
            spotlight.distance = 0;
            spotlight.castShadow = true;

            const direction = new THREE.Vector3(0, -1, 0);
            direction.applyEuler(this.previewObject.rotation);
            const targetDistance = 10;
            const target = new THREE.Object3D();
            target.position.copy(spotlight.position).add(direction.multiplyScalar(targetDistance));

            this.scene.add(target);
            spotlight.target = target;
            this.scene.add(spotlight);
            this.scene.add(spotlight.target);

            this.sceneManager.lights.spotlight = spotlight;

            // Visual indicator
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

            const objectTypeData = createObjectType(this.selectedShape);
            spotlight.userData.type = 'spotlight';
            spotlight.userData.placedAt = Date.now();
            spotlight.userData.visual = visualCone;
            spotlight.userData.target = target;
            spotlight.userData.attributes = objectTypeData;
            spotlight.userData.attributes.lightIntensity = this.spotlightIntensity;

            this.placedObjects.push(spotlight);
            this.inventoryManager.recordPlacement(this.selectedShape);

            if (this.onInventoryChange) {
                this.onInventoryChange();
            }

            console.log(`Placed spotlight #${this.placedObjects.length}`);

        } else {
            const objectTypeData = createObjectType(this.selectedShape);

            if (objectTypeData.usesFBXModel) {
                this.placeFBXObject(objectTypeData);
            } else {
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
                placedObject.userData.attributes = objectTypeData;

                placedObject.castShadow = true;
                placedObject.receiveShadow = true;

                placedObject.geometry.computeBoundingBox();
                placedObject.geometry.computeBoundingSphere();

                const worldBBox = placedObject.geometry.boundingBox.clone().applyMatrix4(placedObject.matrixWorld);

                this.scene.add(placedObject);
                this.placedObjects.push(placedObject);

                this.inventoryManager.recordPlacement(this.selectedShape);

                if (this.onInventoryChange) {
                    this.onInventoryChange();
                }

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
        }

        this.exitBuildMode();
    }

    update() {
        if (this.buildMode && this.previewObject) {
            this.updatePreviewPosition();
        }
    }

    toggleAllSpotlights() {
        const spotlights = this.placedObjects.filter(obj => obj.userData.type === 'spotlight');

        if (spotlights.length === 0) {
            console.log('No spotlights placed');
            return false;
        }

        spotlights.forEach(spotlight => {
            spotlight.visible = !spotlight.visible;
            if (spotlight.userData.visual) {
                spotlight.userData.visual.visible = spotlight.visible;
            }
        });

        if (spotlights[0].visible) {
            this.sceneManager.lights.spotlight = spotlights[0];
        } else {
            this.sceneManager.lights.spotlight = null;
        }

        const status = spotlights[0].visible ? 'ON' : 'OFF';
        console.log(`${spotlights.length} spotlight(s) toggled ${status}`);
        return true;
    }

    clearAll() {
        this.exitBuildMode();

        this.placedObjects.forEach(obj => {
            if (obj.userData.type === 'bait' && this.sceneManager) {
                this.sceneManager.unregisterBait(obj);
            }

            if (obj.userData.boundaries && this.sceneManager) {
                console.log(`Removing ${obj.userData.boundaries.length} boundary collider(s)...`);
                this.sceneManager.removeObstacles(obj.userData.boundaries);
            }

            this.scene.remove(obj);

            if (obj.userData.type === 'spotlight') {
                if (obj.userData.visual) {
                    this.scene.remove(obj.userData.visual);
                    if (obj.userData.visual.geometry) obj.userData.visual.geometry.dispose();
                    if (obj.userData.visual.material) obj.userData.visual.material.dispose();
                }
                if (obj.userData.target) this.scene.remove(obj.userData.target);
                this.sceneManager.lights.spotlight = null;
            }

            if (obj.userData.isFBXModel) {
                obj.traverse((child) => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat && mat.dispose && mat.dispose());
                            } else if (child.material.dispose) {
                                child.material.dispose();
                            }
                        }
                    }
                });
            } else {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            }
        });

        this.placedObjects = [];
        this.collidables = [];
        this.inventoryManager.resetCounts();
        console.log('All objects cleared, inventory reset');
    }

    dispose() {
        this.exitBuildMode();
        this.canvas.removeEventListener('click', this.onCanvasClick);
        this.clearAll();
    }
}