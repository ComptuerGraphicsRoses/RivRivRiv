import {
    BOUNDARY_HALF_X,
    BOUNDARY_MIN_Y,
    BOUNDARY_MAX_Y,
    BOUNDARY_HALF_Z,
    GAME_SCALE,
} from "./FlockingSystem.js";

import * as THREE from 'three';

export class CameraController {
    constructor(canvas) {
        this.canvas = canvas;
        this.objectManager = null;

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        this.camera.position.set(0, 5, 10);

        this.pitch = 0;
        this.yaw = 0;

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;

        this.moveSpeed = 10.0;
        this.lookSpeed = 0.002;

        this.isPointerLocked = false;

        this.isAnimating = false;
        this.isReturning = false; // Track if we're returning from names scene
        this.atNamesScene = false; // Track if we're currently stationed at names scene
        this.animationProgress = 0;
        this.savedPosition = null;
        this.savedRotation = null;
        this.targetPosition = new THREE.Vector3(60, 15, 0);
        this.targetRotation = new THREE.Euler(-Math.PI / 2, 0, 0);

        this.setupPointerLock();
        this.setupKeyboardControls();
    }

    setupPointerLock = () => {
        this.canvas.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                this.canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
        });

        document.addEventListener('mousemove', (event) => {
            if (this.isPointerLocked && !this.isAnimating && !this.isReturning && !this.atNamesScene) {
                // Skip camera rotation if ObjectManager is in rotation mode
                if (this.objectManager && this.objectManager.rotationMode) {
                    return;
                }

                this.yaw -= event.movementX * this.lookSpeed;
                this.pitch -= event.movementY * this.lookSpeed;

                // Clamp pitch to avoid flipping
                this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
            }
        });
    }

    setupKeyboardControls = () => {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    onKeyDown = (event) => {
        switch (event.key.toLowerCase()) {
            case 'w': this.moveForward = true; break;
            case 's': this.moveBackward = true; break;
            case 'a': this.moveLeft = true; break;
            case 'd': this.moveRight = true; break;
            case ' ': this.moveUp = true; event.preventDefault(); break;
            case 'shift': this.moveDown = true; break;
            case 'escape':
                if (this.isPointerLocked) {
                    document.exitPointerLock();
                }
                break;
        }
    }

    onKeyUp = (event) => {
        switch (event.key.toLowerCase()) {
            case 'w': this.moveForward = false; break;
            case 's': this.moveBackward = false; break;
            case 'a': this.moveLeft = false; break;
            case 'd': this.moveRight = false; break;
            case ' ': this.moveUp = false; break;
            case 'shift': this.moveDown = false; break;
        }
    }

    animateToNamesScene = () => {
        if (this.isAnimating) {
            // Animation is in progress, do nothing (wait for it to complete)
            return;
        }

        if (this.isReturning) {
            // Return animation is in progress, do nothing
            return;
        }

        // Check if we're already at the names scene
        if (this.atNamesScene) {
            // Start return animation
            console.log('Returning to original position...');
            this.isReturning = true;
            this.animationProgress = 0;
            this.atNamesScene = false;
            // savedPosition and savedRotation are already stored
        } else {
            this.savedPosition = this.camera.position.clone();
            this.savedRotation = new THREE.Euler().copy(this.camera.rotation);
            this.isAnimating = true;
            this.animationProgress = 0;
            console.log('Animating to team names scene...');
        }
    }

    updateCameraAnimation = (deltaTime) => {
        if (!this.isAnimating && !this.isReturning) return;

        // 2 second duration
        const animationSpeed = 0.5;
        this.animationProgress += deltaTime * animationSpeed;

        // Clamp to 1.0
        if (this.animationProgress > 1.0) {
            this.animationProgress = 1.0;
        }

        const t = this.smoothstep(this.animationProgress);

        if (this.isReturning) {
            // Interpolate from target back to saved position (reverse)
            this.camera.position.lerpVectors(this.targetPosition, this.savedPosition, t);
            
            // Interpolate rotation (reverse)
            const targetQuat = new THREE.Quaternion().setFromEuler(this.targetRotation);
            const savedQuat = new THREE.Quaternion().setFromEuler(this.savedRotation);
            this.camera.quaternion.slerpQuaternions(targetQuat, savedQuat, t);

            // Check if animation is complete
            if (this.animationProgress >= 1.0) {
                // Restore pitch and yaw from saved rotation
                this.pitch = this.savedRotation.x;
                this.yaw = this.savedRotation.y;
                
                // Return animation complete - reset state
                console.log('Return animation complete');
                this.isReturning = false;
                this.savedPosition = null;
                this.savedRotation = null;
            }
        } else {
            // Interpolate from saved to target position (forward)
            this.camera.position.lerpVectors(this.savedPosition, this.targetPosition, t);

            // Interpolate rotation (forward)
            const currentQuat = new THREE.Quaternion().setFromEuler(this.savedRotation);
            const targetQuat = new THREE.Quaternion().setFromEuler(this.targetRotation);
            this.camera.quaternion.slerpQuaternions(currentQuat, targetQuat, t);

            // Check if animation is complete
            if (this.animationProgress >= 1.0) {
                // Forward animation complete - stay at names scene
                console.log('Names scene animation complete');
                this.isAnimating = false;
                this.atNamesScene = true; // Mark that we're now stationed at names scene
                // Don't update pitch/yaw here - we want to stay looking down
            }
        }
    }

    smoothstep = (t) => {
        return t * t * (3.0 - 2.0 * t);
    }

    update = (deltaTime) => {
        // Handle animation if active
        if (this.isAnimating || this.isReturning) {
            this.updateCameraAnimation(deltaTime);
            return;
        }

        // Don't allow manual control when stationed at names scene
        if (this.atNamesScene) {
            return;
        }

        // Apply rotation
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

        const direction = new THREE.Vector3();
        const right = new THREE.Vector3();

        this.camera.getWorldDirection(direction);
        right.crossVectors(this.camera.up, direction).normalize();

        const moveVector = new THREE.Vector3();

        if (this.moveForward) moveVector.add(direction);
        if (this.moveBackward) moveVector.sub(direction);
        if (this.moveLeft) moveVector.add(right);
        if (this.moveRight) moveVector.sub(right);
        if (this.moveUp) moveVector.y += 1;
        if (this.moveDown) moveVector.y -= 1;

        if (moveVector.length() > 0) {
            moveVector.normalize();
            moveVector.multiplyScalar(this.moveSpeed * deltaTime);
            this.camera.position.add(moveVector);
        }

        // Clamp within game boundaries with floor offset
        const EXTRA_BUFFER_FOR_CAMERA_TO_NOT_GO_INSIDE_FLOOR = 0.5 * GAME_SCALE;
        this.camera.position.x = Math.max(-BOUNDARY_HALF_X, Math.min(BOUNDARY_HALF_X, this.camera.position.x));
        this.camera.position.y = Math.max(BOUNDARY_MIN_Y + EXTRA_BUFFER_FOR_CAMERA_TO_NOT_GO_INSIDE_FLOOR, Math.min(BOUNDARY_MAX_Y, this.camera.position.y));
        this.camera.position.z = Math.max(-BOUNDARY_HALF_Z, Math.min(BOUNDARY_HALF_Z, this.camera.position.z));
    }

    updateAspect = (aspect) => {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
}