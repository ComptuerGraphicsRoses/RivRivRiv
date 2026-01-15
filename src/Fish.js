import {
    BOUNDARY_HALF_X,
    BOUNDARY_MIN_Y,
    BOUNDARY_MAX_Y,
    BOUNDARY_HALF_Z,
} from "./FlockingSystem.js";

import * as THREE from 'three';

// Based on Yuka Vehicle
export class Fish {
    constructor() {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();

        this.maxSpeed = 2.0;
        this.maxForce = 1.5;
        this.mass = 1.0;

        this.perceptionRadius = 3.0;
        this.separationRadius = 1.0;

        this.neighbors = [];

        this.alive = true;
        this.reachedGoal = false;
        this.wasDead = false;

        this.baitConsumptionRadius = 0.6;

        this.onDeath = null;

        this.mesh = null;
        this.boundingRadius = 0.2;

        this.forward = new THREE.Vector3(0, 0, 1);
        this.up = new THREE.Vector3(0, 1, 0);
    }

    update(delta) {
        if (!this.alive || this.reachedGoal) return;

        if (this.acceleration.lengthSq() > this.maxForce * this.maxForce) {
            this.acceleration.normalize().multiplyScalar(this.maxForce);
        }

        this.velocity.add(this.acceleration.clone().multiplyScalar(delta));

        const speedSq = this.velocity.lengthSq();
        if (speedSq > this.maxSpeed * this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }

        this.position.add(this.velocity.clone().multiplyScalar(delta));

        this.position.x = Math.max(-BOUNDARY_HALF_X, Math.min(BOUNDARY_HALF_X, this.position.x));
        this.position.y = Math.max(BOUNDARY_MIN_Y, Math.min(BOUNDARY_MAX_Y, this.position.y));
        this.position.z = Math.max(-BOUNDARY_HALF_Z, Math.min(BOUNDARY_HALF_Z, this.position.z));

        if (speedSq > 0.00001) {
            const target = this.position.clone().add(this.velocity);
            this.lookAt(target);
        }

        this.acceleration.set(0, 0, 0);

        if (this.mesh) {
            this.mesh.position.copy(this.position);
            this.mesh.quaternion.copy(this.rotation);
        }
    }

    applyForce(force) {
        // F = ma, so a = F/m
        const acc = force.clone().divideScalar(this.mass);
        this.acceleration.add(acc);
    }

    lookAt(target) {
        const direction = new THREE.Vector3().subVectors(target, this.position).normalize();

        if (direction.lengthSq() > 0.00001) {
            const matrix = new THREE.Matrix4();
            matrix.lookAt(this.position, target, this.up);

            // Adjust for model orientation
            const rotationY = new THREE.Matrix4();
            rotationY.makeRotationY(Math.PI / 2);
            matrix.multiply(rotationY);

            const targetRotation = new THREE.Quaternion();
            targetRotation.setFromRotationMatrix(matrix);

            this.rotation.slerp(targetRotation, 0.1);
        }
    }

    getDirection(result = new THREE.Vector3()) {
        return result.copy(this.forward).applyQuaternion(this.rotation).normalize();
    }

    getSpeed() {
        return this.velocity.length();
    }

    setMesh(mesh) {
        this.mesh = mesh;
        mesh.position.copy(this.position);
        mesh.quaternion.copy(this.rotation);
    }

    die() {
        const wasAlive = this.alive;
        this.alive = false;
        if (this.mesh) {
            this.mesh.visible = false;
        }

        if (wasAlive && this.onDeath && !this.wasDead) {
            this.onDeath();
            this.wasDead = true;
        }
    }
}