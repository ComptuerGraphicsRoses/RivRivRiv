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
            if (this.isPointerLocked && !this.isAnimating) {
                // Prevent camera look if interacting with objects
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
            this.isAnimating = false;
            this.animationProgress = 0;
        } else {
            this.savedPosition = this.camera.position.clone();
            this.savedRotation = new THREE.Euler().copy(this.camera.rotation);
            this.isAnimating = true;
            this.animationProgress = 0;
            console.log('Animating to team names scene...');
        }
    }

    updateCameraAnimation = (deltaTime) => {
        if (!this.isAnimating) return;

        // 2 second duration
        const animationSpeed = 0.5;
        this.animationProgress += deltaTime * animationSpeed;

        if (this.animationProgress >= 1.0) {
            this.animationProgress = 1.0;
        }

        const t = this.smoothstep(this.animationProgress);

        this.camera.position.lerpVectors(this.savedPosition, this.targetPosition, t);

        const currentQuat = new THREE.Quaternion().setFromEuler(this.savedRotation);
        const targetQuat = new THREE.Quaternion().setFromEuler(this.targetRotation);
        this.camera.quaternion.slerpQuaternions(currentQuat, targetQuat, t);
    }

    smoothstep = (t) => {
        return t * t * (3.0 - 2.0 * t);
    }

    update = (deltaTime) => {
        if (this.isAnimating) {
            this.updateCameraAnimation(deltaTime);
            return;
        }

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
        const EXTRA_BUFFER_FOR_CAMERA_TO_NOT_GO_INSIDE_FLOOR = 1 * GAME_SCALE;
        this.camera.position.x = Math.max(-BOUNDARY_HALF_X, Math.min(BOUNDARY_HALF_X, this.camera.position.x));
        this.camera.position.y = Math.max(BOUNDARY_MIN_Y + EXTRA_BUFFER_FOR_CAMERA_TO_NOT_GO_INSIDE_FLOOR, Math.min(BOUNDARY_MAX_Y, this.camera.position.y));
        this.camera.position.z = Math.max(-BOUNDARY_HALF_Z, Math.min(BOUNDARY_HALF_Z, this.camera.position.z));
    }

    updateAspect = (aspect) => {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
}