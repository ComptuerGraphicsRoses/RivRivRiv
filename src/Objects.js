// javascript
// src/Objects.js - add scroll-controlled preview distance

import * as THREE from 'three';

export class ObjectManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.placedObjects = [];
        this.previewObject = null;
        this.buildMode = false;

        this.selectedShape = 'cube'; // 'cube' or 'cube2'

        this.collidables = [];
        this.minDistanceBetweenObjects = 1;
        this._lastPreviewPos = new THREE.Vector3();
        this._previewMoveThreshold = 0.05;

        // Preview distance control
        this.previewDistance = 10;
        this.minPreviewDistance = 3;
        this.maxPreviewDistance = 30;
        this.distanceStep = 0.5;

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseClick = this.onMouseClick.bind(this);
        this.onWheel = this.onWheel.bind(this);
    }

    toggleBuildModeWithShape(shape) {
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

    createGeometry(shape) {
        if (shape === 'cube2') return new THREE.BoxGeometry(2, 2, 2);
        return new THREE.BoxGeometry(2, 2, 2);
    }

    getPreviewColor(shape) {
        if (shape === 'cube2') return 0x00ff00;
        return 0x00ff00;
    }

    getPlacedColor(shape) {
        if (shape === 'cube2') return 0x0000ff;
        return 0xff6600;
    }

    getShapeSize(shape) {
        return 2;
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
        const halfSize = objectSize * 0.5;
        const previewSphereRadius = Math.sqrt(3 * halfSize * halfSize);

        const minDistance = objectSize + this.minDistanceBetweenObjects;


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

        if (position.y < 1) return true;
        return false;
    }

    updatePreviewColor(hasCollision) {
        if (!this.previewObject) return;
        if (hasCollision) this.previewObject.material.color.setHex(0xff0000);
        else this.previewObject.material.color.setHex(this.getPreviewColor(this.selectedShape));
    }

    onMouseMove() {
        this.updatePreviewPosition();
    }

    onMouseClick() {
        if (!this.buildMode || !this.previewObject) return;

        const hasCollision = this.checkCollision(this.previewObject.position);
        if (hasCollision) {
            console.log('Cannot place object here - collision detected!');
            return;
        }
        this.placeObject();
    }

    placeObject() {
        if (!this.previewObject) return;

        const geometry = this.createGeometry(this.selectedShape);
        const material = new THREE.MeshStandardMaterial({
            color: this.getPlacedColor(this.selectedShape),
            metalness: 0.3,
            roughness: 0.7
        });

        const placedObject = new THREE.Mesh(geometry, material);
        placedObject.position.copy(this.previewObject.position);
        placedObject.userData.type = this.selectedShape;
        placedObject.userData.placedAt = Date.now();

        placedObject.geometry.computeBoundingBox();
        placedObject.geometry.computeBoundingSphere();

        const worldBBox = placedObject.geometry.boundingBox.clone().applyMatrix4(placedObject.matrixWorld);

        this.scene.add(placedObject);
        this.placedObjects.push(placedObject);

        this.collidables.push({
            mesh: placedObject,
            localBBox: placedObject.geometry.boundingBox.clone(),
            localSphere: placedObject.geometry.boundingSphere.clone(),
            worldBBox,
            needsWorldBBoxUpdate: false
        });

        console.log(`Placed ${this.selectedShape} #${this.placedObjects.length}`);

        this.exitBuildMode(); // Exit build mode after placing
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

    dispose() {
        this.exitBuildMode();

        this.placedObjects.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        this.placedObjects = [];
        this.collidables = [];
    }
}