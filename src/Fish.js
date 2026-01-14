/**
 * Fish Entity - Based on Yuka Vehicle but adapted for Three.js
 * Represents a single fish with steering behaviors
 */

import * as THREE from 'three';

export class Fish {
    constructor() {
        // Transform
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        
        // Movement parameters
        this.maxSpeed = 2.0;
        this.maxForce = 1.5;
        this.mass = 1.0;
        
        // Boids parameters
        this.perceptionRadius = 3.0;  // How far this fish can "see" neighbors
        this.separationRadius = 1.0;  // Minimum distance from neighbors
        
        // Neighbors cache
        this.neighbors = [];
        
        // State
        this.alive = true;
        this.reachedGoal = false; // Marked true when fish reaches goal (before death)
        this.wasDead = false; // Track if death callback was already called

        // Bait consumption
        this.baitConsumptionRadius = 0.6;  // How close to bait to consume it

        // Callbacks
        this.onDeath = null; // Callback when fish dies

        // Rendering
        this.mesh = null;
        
        // Bounding radius for collision detection
        this.boundingRadius = 0.2;
        
        // Forward direction (local space)
        this.forward = new THREE.Vector3(0, 0, 1);
        this.up = new THREE.Vector3(0, 1, 0);
    }
    
    /**
     * Update fish position and rotation based on steering forces
     */
    update(delta) {
        // Skip physics if fish reached goal (performance optimization)
        if (!this.alive || this.reachedGoal) return;

        // Limit acceleration
        if (this.acceleration.lengthSq() > this.maxForce * this.maxForce) {
            this.acceleration.normalize().multiplyScalar(this.maxForce);
        }
        
        // Update velocity: v = v + a * dt
        this.velocity.add(this.acceleration.clone().multiplyScalar(delta));
        
        // Limit speed
        const speedSq = this.velocity.lengthSq();
        if (speedSq > this.maxSpeed * this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }
        
        // Update position: p = p + v * dt
        this.position.add(this.velocity.clone().multiplyScalar(delta));
        
        // Update orientation to face movement direction
        if (speedSq > 0.00001) {
            const target = this.position.clone().add(this.velocity);
            this.lookAt(target);
        }
        
        // Reset acceleration for next frame
        this.acceleration.set(0, 0, 0);
        
        // Sync with Three.js mesh
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            this.mesh.quaternion.copy(this.rotation);
        }
    }
    
    /**
     * Apply a steering force to this fish
     */
    applyForce(force) {
        // F = ma, so a = F/m
        const acc = force.clone().divideScalar(this.mass);
        this.acceleration.add(acc);
    }
    
    /**
     * Make the fish look at a target position
     * Uses smooth interpolation for natural turning
     */
    lookAt(target) {
        const direction = new THREE.Vector3().subVectors(target, this.position).normalize();
        
        if (direction.lengthSq() > 0.00001) {
            // Calculate target rotation
            const matrix = new THREE.Matrix4();
            matrix.lookAt(this.position, target, this.up);
            const targetRotation = new THREE.Quaternion();
            targetRotation.setFromRotationMatrix(matrix);
            
            // Smoothly interpolate between current and target rotation
            // 0.5 = 50% blend, creates smooth turning
            this.rotation.slerp(targetRotation, 0.1);
        }
    }
    
    /**
     * Get the current forward direction in world space
     */
    getDirection(result = new THREE.Vector3()) {
        return result.copy(this.forward).applyQuaternion(this.rotation).normalize();
    }
    
    /**
     * Get current speed
     */
    getSpeed() {
        return this.velocity.length();
    }
    
    /**
     * Set the Three.js mesh for this fish
     */
    setMesh(mesh) {
        this.mesh = mesh;
        mesh.position.copy(this.position);
        mesh.quaternion.copy(this.rotation);
    }
    
    /**
     * Kill this fish
     */
    die() {
        const wasAlive = this.alive;
        this.alive = false;
        if (this.mesh) {
            this.mesh.visible = false;
        }

        // Notify callback if fish was alive (prevent duplicate death calls)
        if (wasAlive && this.onDeath && !this.wasDead) {
            this.onDeath();
            this.wasDead = true;
        }
    }
}
