// Predator.js
import {
    BOUNDARY_HALF_X, 
    BOUNDARY_MIN_Y,
    BOUNDARY_MAX_Y,
    BOUNDARY_HALF_Z,
} from "./FlockingSystem.js";

import * as THREE from 'three';

export default class Predator {
    constructor(position) {
        this.position = position.clone();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.rotation = new THREE.Quaternion(); // Track rotation for obstacle avoidance

        // === AI PARAMETRELERİ ===
        this.maxSpeed = 2;          // balıktan hızlı
        this.maxForce = 0.15;

        this.detectionRadius = 10.0;  // metre
        this.captureRadius = 0.6;     // yakalama mesafesi

        this.wanderAngle = 0;
        
        // Obstacle Avoidance Params
        this.boundingRadius = 0.5;         // Larger than fish
        this.obstacleAvoidanceWeight = 100.0; // Strong avoidance
        this.detectionBoxMinLength = 5.0;
        this.brakingWeight = 0.5;
        this.panicDistance = 0.5;
    }


    /* ---------------- UPDATE ---------------- */

    update(deltaTime, fishes, obstacles = []) {
        // 1. Update Rotation based on velocity (needed for local space avoidance)
        if (this.velocity.lengthSq() > 0.0001) {
            const target = this.position.clone().add(this.velocity);
            this.lookAt(target);
        }

        let targetFish = this.findClosestFish(fishes);
        const totalForce = new THREE.Vector3();

        if (targetFish) {
            // 🎯 Avlanma
            const seekForce = this.seek(targetFish.position);
            totalForce.add(seekForce);
            
            this.tryToEat(targetFish);
        } else {
            // 🐾 Gezinme
            const wanderForce = this.wander();
            totalForce.add(wanderForce);
        }

        // 🛑 Obstacle Avoidance (Highest Priority)
        if (obstacles.length > 0) {
            const avoidanceForce = this.calculateObstacleAvoidance(obstacles);
            avoidanceForce.multiplyScalar(this.obstacleAvoidanceWeight);
            totalForce.add(avoidanceForce);
        }

        this.applyForce(totalForce);

        // Fizik entegrasyonu
        this.velocity.add(this.acceleration);

        // speed limit
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity.setLength(this.maxSpeed);
        }

        this.position.addScaledVector(this.velocity, deltaTime);
        
        // Clamp predator position to boundaries (same as fish boundaries)
        this.position.x = Math.max(-BOUNDARY_HALF_X, Math.min(BOUNDARY_HALF_X, this.position.x));
        this.position.y = Math.max(BOUNDARY_MIN_Y, Math.min(BOUNDARY_MAX_Y, this.position.y));
        this.position.z = Math.max(-BOUNDARY_HALF_Z, Math.min(BOUNDARY_HALF_Z, this.position.z));

        // Update collision correction
        this._correctObstacleCollisions(obstacles);

        this.acceleration.set(0, 0, 0);
    }

    lookAt(target) {
        const direction = new THREE.Vector3().subVectors(target, this.position).normalize();
        if (direction.lengthSq() > 0.00001) {
            const matrix = new THREE.Matrix4();
            matrix.lookAt(this.position, target, new THREE.Vector3(0, 1, 0));
            this.rotation.setFromRotationMatrix(matrix);
        }
    }

    getSpeed() {
        return this.velocity.length();
    }

    /* ---------------- OBSTACLE AVOIDANCE (Ported from FlockingSystem) ---------------- */

    calculateObstacleAvoidance(obstacles) {
        const force = new THREE.Vector3();

        if (!obstacles || obstacles.length === 0) return force;

        const detectionBoxLength = this._calculateDetectionBoxLength();
        const localSpaceMatrix = this._createLocalSpaceMatrix();
        const closestObstacleData = this._findClosestObstacleInPath(
            obstacles,
            localSpaceMatrix,
            detectionBoxLength
        );

        if (closestObstacleData) {
            const avoidanceForce = this._calculateAvoidanceForce(
                closestObstacleData,
                detectionBoxLength
            );

            this._transformForceToWorldSpace(avoidanceForce);
            const sphereToEllipsoidTransformation = new THREE.Matrix4().makeScale(
                closestObstacleData.obstacle.scale.x,
                closestObstacleData.obstacle.scale.y,
                closestObstacleData.obstacle.scale.z
            );

            avoidanceForce.applyMatrix4(sphereToEllipsoidTransformation);

            return avoidanceForce;
        }

        return force;
    }

    _calculateDetectionBoxLength() {
        const speedRatio = this.getSpeed() / this.maxSpeed;
        return this.detectionBoxMinLength * (1 + speedRatio);
    }

    _createLocalSpaceMatrix() {
        const worldMatrix = new THREE.Matrix4();
        worldMatrix.compose(
            this.position,
            this.rotation,
            new THREE.Vector3(1, 1, 1)
        );
        return new THREE.Matrix4().copy(worldMatrix).invert();
    }

    _findClosestObstacleInPath(obstacles, localSpaceMatrix, detectionBoxLength) {
        let closestObstacle = null;
        let closestDistance = Infinity;
        let closestLocalPos = new THREE.Vector3();

        for (const obstacle of obstacles) {
            const obstacleLocalPos = obstacle.position.clone().applyMatrix4(localSpaceMatrix);

            // Check if obstacle is ahead (negative Z) and within detection range
            const isAhead = obstacleLocalPos.z < 0;
            const distanceAlongPath = Math.abs(obstacleLocalPos.z);
            const inDetectionRange = distanceAlongPath < detectionBoxLength;

            if (isAhead && inDetectionRange) {
                const invScale = new THREE.Vector3(
                    1.0 / obstacle.scale.x,
                    1.0 / obstacle.scale.y,
                    1.0 / obstacle.scale.z
                );

                const obstacleInEllipsoidSpace = obstacleLocalPos.clone().multiply(invScale);
                const maxInvScale = Math.max(invScale.x, invScale.y, invScale.z);
                const radiusInEllipsoidSpace = this.boundingRadius * maxInvScale;
                const expandedRadius = obstacle.boundingRadius + radiusInEllipsoidSpace;
                const lateralDistanceInEllipsoidSpace = this._calculateLateralDistance(obstacleInEllipsoidSpace);

                if (lateralDistanceInEllipsoidSpace < expandedRadius && distanceAlongPath < closestDistance) {
                    closestDistance = distanceAlongPath;
                    closestObstacle = obstacle;
                    closestLocalPos.copy(obstacleLocalPos);
                }
            }
        }

        return closestObstacle ? {
            obstacle: closestObstacle,
            localPosition: closestLocalPos,
            distance: closestDistance
        } : null;
    }

    _calculateLateralDistance(localPosition) {
        return Math.sqrt(
            localPosition.x * localPosition.x +
            localPosition.y * localPosition.y
        );
    }

    _calculateAvoidanceForce(obstacleData, detectionBoxLength) {
        const force = new THREE.Vector3();
        const { obstacle, localPosition, distance } = obstacleData;

        const normalizedDist = distance / detectionBoxLength;
        const easingFactor = 1.0 - normalizedDist;
        const proximityMultiplier = 1.0 + (easingFactor * easingFactor * 8.0);

        const veryCloseBoost = distance < this.panicDistance
            ? (1.0 - (distance / this.panicDistance)) * 3.0
            : 0;

        const finalMultiplier = proximityMultiplier + veryCloseBoost;
        const lateralDistance = this._calculateLateralDistance(localPosition);

        if (lateralDistance > 0.001) {
            force.x = (obstacle.boundingRadius - localPosition.x) * finalMultiplier;
            force.y = (obstacle.boundingRadius - localPosition.y) * finalMultiplier * 0.5; // Less vertical avoidance
        } else {
            const randomDirection = Math.random() > 0.5 ? 1 : -1;
            force.x = obstacle.boundingRadius * finalMultiplier * randomDirection;
        }

        const brakingMultiplier = 1.0 + (easingFactor * easingFactor * 2.0);
        const brakingForce = (obstacle.boundingRadius - distance) * this.brakingWeight * brakingMultiplier;
        force.z = brakingForce;

        return force;
    }

    _transformForceToWorldSpace(force) {
        force.applyQuaternion(this.rotation);
    }

    _correctObstacleCollisions(obstacles) {
        if (!obstacles) return;
        
        for (const obstacle of obstacles) {
            const fishPosRelative = new THREE.Vector3().subVectors(this.position, obstacle.position);

            const invScale = new THREE.Vector3(
                1.0 / obstacle.scale.x,
                1.0 / obstacle.scale.y,
                1.0 / obstacle.scale.z
            );
            const fishInEllipsoidSpace = fishPosRelative.clone().multiply(invScale);
            const distanceInEllipsoidSpace = fishInEllipsoidSpace.length();

            const maxInvScale = Math.max(invScale.x, invScale.y, invScale.z);
            const fishRadiusInEllipsoidSpace = this.boundingRadius * maxInvScale;
            const minDistance = obstacle.boundingRadius + fishRadiusInEllipsoidSpace;

            if (distanceInEllipsoidSpace < minDistance) {
                const penetrationDepth = minDistance - distanceInEllipsoidSpace;

                let pushDirectionEllipsoidSpace;
                if (distanceInEllipsoidSpace > 0.001) {
                    pushDirectionEllipsoidSpace = fishInEllipsoidSpace.clone().normalize();
                } else {
                    pushDirectionEllipsoidSpace = new THREE.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                }

                const pushDirectionWorldSpace = pushDirectionEllipsoidSpace.clone().multiply(invScale).normalize();
                const repulsionStrength = (penetrationDepth + 0.2) * 8.0;
                const repulsionVelocity = pushDirectionWorldSpace.multiplyScalar(repulsionStrength);
                this.velocity.add(repulsionVelocity);

                const toObstacle = new THREE.Vector3().subVectors(obstacle.position, this.position);
                const toObstacleNorm = toObstacle.normalize();
                const velocityTowardObstacle = this.velocity.dot(toObstacleNorm);
                if (velocityTowardObstacle > 0) {
                    const velocityCorrection = toObstacleNorm.multiplyScalar(velocityTowardObstacle);
                    this.velocity.sub(velocityCorrection);
                }
            }
        }
    }

    /* ---------------- AI BEHAVIORS ---------------- */

    findClosestFish(fishes) {
        let closest = null;
        let minDist = Infinity;

        for (let fish of fishes) {
            if (!fish.alive) continue;

            const d = this.position.distanceTo(fish.position);
            if (d < this.detectionRadius && d < minDist) {
                minDist = d;
                closest = fish;
            }
        }
        return closest;
    }

    seek(targetPos) {
        const desired = targetPos.clone().sub(this.position);
        desired.normalize().multiplyScalar(this.maxSpeed);

        const steer = desired.sub(this.velocity);

        if (steer.length() > this.maxForce) {
            steer.setLength(this.maxForce);
        }

        return steer;
    }

    wander() {
        this.wanderAngle += (Math.random() - 0.5) * 0.5;

        const circleCenter = this.velocity.clone();
        if (circleCenter.length() < 0.01) {
            circleCenter.set(1, 0, 0);
        }
        circleCenter.normalize().multiplyScalar(2.0);

        const displacement = new THREE.Vector3(
            Math.cos(this.wanderAngle),
            0,
            Math.sin(this.wanderAngle)
        ).multiplyScalar(1.2);

        const wanderForce = circleCenter.add(displacement);

        if (wanderForce.length() > this.maxForce) {
            wanderForce.setLength(this.maxForce);
        }

        return wanderForce;
    }

    tryToEat(fish) {
        // Don't eat dead fish or fish that reached the goal
        if (!fish.alive || fish.reachedGoal) return;

        const d = this.position.distanceTo(fish.position);
        if (d < this.captureRadius) {
            fish.die();
        }
    }

    applyForce(force) {
        this.acceleration.add(force); 
    }
}
