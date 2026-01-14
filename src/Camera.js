/**
 * Camera Controller
 * First-person camera with 6 DOF movement and smooth transitions
 */

import {
    BOUNDARY_HALF_X, 
    BOUNDARY_MIN_Y,
    BOUNDARY_MAX_Y,
    BOUNDARY_HALF_Z,
} from "./FlockingSystem.js";

import * as THREE from 'three';

export class CameraController {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Reference to ObjectManager (set later by main.js)
        this.objectManager = null;

        // Create perspective camera
        this.camera = new THREE.PerspectiveCamera(
            75, // FOV
            window.innerWidth / window.innerHeight, // Aspect
            0.1, // Near
            1000 // Far
        );
        
        // Initial camera position
        this.camera.position.set(0, 5, 10);
        
        // Camera orientation (Euler angles)
        this.pitch = 0; // X rotation
        this.yaw = 0;   // Y rotation
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;
        
        // Movement settings
        this.moveSpeed = 10.0;
        this.lookSpeed = 0.002;
        
        // Pointer lock state
        this.isPointerLocked = false;
        
        // Animation state for team names transition
        this.isAnimating = false;
        this.animationProgress = 0;
        this.savedPosition = null;
        this.savedRotation = null;
        this.targetPosition = new THREE.Vector3(0, 20, 0); // Top-down view
        this.targetRotation = new THREE.Euler(-Math.PI / 2, 0, 0); // Looking down
        
        // Setup controls
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
                // Skip camera rotation if ObjectManager is in rotation mode
                if (this.objectManager && this.objectManager.rotationMode) {
                    return;
                }

                this.yaw -= event.movementX * this.lookSpeed;
                this.pitch -= event.movementY * this.lookSpeed;
                
                // Clamp pitch to avoid gimbal lock
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
            // Return to original position
            this.isAnimating = false;
            this.animationProgress = 0;
        } else {
            // Save current state and start animation
            this.savedPosition = this.camera.position.clone();
            this.savedRotation = new THREE.Euler().copy(this.camera.rotation);
            this.isAnimating = true;
            this.animationProgress = 0;
            console.log('Animating to team names scene...');
        }
    }
    
    updateCameraAnimation = (deltaTime) => {
        if (!this.isAnimating) return;
        
        // Animation duration: 2 seconds
        const animationSpeed = 0.5; // 1/duration
        this.animationProgress += deltaTime * animationSpeed;
        
        if (this.animationProgress >= 1.0) {
            this.animationProgress = 1.0;
            // Animation complete - will stay at names scene until N pressed again
        }
        
        // Smooth interpolation (ease-in-out)
        const t = this.smoothstep(this.animationProgress);
        
        // Interpolate position
        this.camera.position.lerpVectors(this.savedPosition, this.targetPosition, t);
        
        // Interpolate rotation
        const currentQuat = new THREE.Quaternion().setFromEuler(this.savedRotation);
        const targetQuat = new THREE.Quaternion().setFromEuler(this.targetRotation);
        this.camera.quaternion.slerpQuaternions(currentQuat, targetQuat, t);
    }
    
    smoothstep = (t) => {
        // Smooth ease-in-out function
        return t * t * (3.0 - 2.0 * t);
    }
    
    update = (deltaTime) => {
        // Handle animation if active
        if (this.isAnimating) {
            this.updateCameraAnimation(deltaTime);
            return; // Don't allow manual control during animation
        }
        
        // Apply rotation
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        
        // Calculate movement direction
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
        
        // Clamp camera position to boundaries (same as fish boundaries)
        // Boundaries: X[-10,+10], Y[-0.5,5], Z[-10,+10]
        const EXTRA_BUFFER_FOR_CAMERA_TO_NOT_GO_INSIDE_FLOOR = 1;
        this.camera.position.x = Math.max(-BOUNDARY_HALF_X, Math.min(BOUNDARY_HALF_X, this.camera.position.x));
        this.camera.position.y = Math.max(BOUNDARY_MIN_Y + EXTRA_BUFFER_FOR_CAMERA_TO_NOT_GO_INSIDE_FLOOR, Math.min(BOUNDARY_MAX_Y, this.camera.position.y));
        this.camera.position.z = Math.max(-BOUNDARY_HALF_Z, Math.min(BOUNDARY_HALF_Z, this.camera.position.z));
    }
    
    updateAspect = (aspect) => {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
}
