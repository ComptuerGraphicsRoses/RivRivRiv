import * as THREE from 'three';

// Global configuration
export const GAME_SCALE = 2;
export const BOUNDARY_HALF_X = 10 * GAME_SCALE;
export const BOUNDARY_MIN_Y = -0.5 * GAME_SCALE;
export const BOUNDARY_MAX_Y = 5 * GAME_SCALE;
export const BOUNDARY_HALF_Z = 10 * GAME_SCALE;

export class FlockingSystem {
    constructor() {
        this.fish = [];
        this.obstacles = [];
        this.baits = [];
        this.predator = null;

        this.boundaryRadius = 1;

        // Behavior weights (tuned for normalized forces)
        this.separationWeight = 30.0;
        this.alignmentWeight = 2.0;
        this.cohesionWeight = 4.0;
        this.seekWeight = 3.0;
        this.obstacleAvoidanceWeight = 100.0;
        this.boundaryWeight = 500.0;

        // Obstacle avoidance parameters
        this.detectionBoxMinLength = 5.0;
        this.brakingWeight = 0.5;
        this.panicDistance = 0.5;
    }

    addFish(fish) {
        this.fish.push(fish);
    }

    setPredator(predator) {
        this.predator = predator;
    }

    addObstacle(obstacle) {
        this.obstacles.push(obstacle);
    }

    removeObstacle(obstacle) {
        const index = this.obstacles.indexOf(obstacle);
        if (index > -1) {
            this.obstacles.splice(index, 1);
            return true;
        }
        return false;
    }

    addBait(baitObject) {
        this.baits.push(baitObject);
        console.log(`✓ Bait registered at (${baitObject.position.x.toFixed(2)}, ${baitObject.position.y.toFixed(2)}, ${baitObject.position.z.toFixed(2)})`);
    }

    removeBait(baitObject) {
        const index = this.baits.indexOf(baitObject);
        if (index > -1) {
            this.baits.splice(index, 1);
            console.log(`✓ Bait removed`);
        }
    }

    clearBaits() {
        this.baits = [];
    }

    setBaitPosition(position) {
        this.baits = [{ position: position.clone() }];
    }

    update(delta) {
        this.updateNeighborhoods();

        for (const fish of this.fish) {
            if (!fish.alive) continue;

            const totalForce = new THREE.Vector3();

            //Separation
            const separationForce = this.calculateSeparation(fish);
            separationForce.multiplyScalar(this.separationWeight);
            totalForce.add(separationForce);

            // Alignment
            const alignmentForce = this.calculateAlignment(fish);
            alignmentForce.multiplyScalar(this.alignmentWeight);
            totalForce.add(alignmentForce);

            //Cohesion
            const cohesionForce = this.calculateCohesion(fish);
            cohesionForce.multiplyScalar(this.cohesionWeight);
            totalForce.add(cohesionForce);

            // Seek
            if (this.baits.length > 0) {
                const nearestBait = this.findNearestBait(fish);
                if (nearestBait) {
                    const seekForce = this.calculateSeek(fish, nearestBait.position);
                    seekForce.multiplyScalar(this.seekWeight);
                    totalForce.add(seekForce);
                }
            }

            // Obstacle Avoidance
            const avoidanceForce = this.calculateObstacleAvoidance(fish);
            avoidanceForce.multiplyScalar(this.obstacleAvoidanceWeight);
            totalForce.add(avoidanceForce);

            // Boundary Avoidance
            const boundaryForce = this.calculateBoundaryAvoidance(fish);
            boundaryForce.multiplyScalar(this.boundaryWeight);
            totalForce.add(boundaryForce);

            fish.applyForce(totalForce);
        }

        for (const fish of this.fish) {
            fish.update(delta);
            this._correctObstacleCollisions(fish);
        }

        this._checkBaitConsumption();
    }

    _checkBaitConsumption() {
        if (this.baits.length === 0) return;

        const baitsToRemove = [];

        for (const bait of this.baits) {
            if (bait.userData && bait.userData.isGoalBait) continue;

            for (const fish of this.fish) {
                if (!fish.alive) continue;

                if (fish.position.distanceTo(bait.position) <= fish.baitConsumptionRadius) {
                    if (!baitsToRemove.includes(bait)) {
                        baitsToRemove.push(bait);
                        console.log(`🐟 Fish consumed bait at (${bait.position.x.toFixed(2)}, ${bait.position.y.toFixed(2)})`);
                    }
                    break;
                }
            }
        }

        for (const bait of baitsToRemove) {
            this.removeBait(bait);
            if (this.onBaitConsumed) this.onBaitConsumed(bait);
        }
    }

    findNearestBait(fish) {
        if (this.baits.length === 0) return null;

        let nearestBait = null;
        let nearestDistSq = Infinity;

        for (const bait of this.baits) {
            const distSq = fish.position.distanceToSquared(bait.position);
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestBait = bait;
            }
        }
        return nearestBait;
    }

    updateNeighborhoods() {
        for (const fish of this.fish) {
            if (!fish.alive) continue;

            fish.neighbors = [];
            for (const other of this.fish) {
                if (other === fish || !other.alive) continue;

                if (fish.position.distanceToSquared(other.position) < fish.perceptionRadius * fish.perceptionRadius) {
                    fish.neighbors.push(other);
                }
            }
        }
    }

    calculateSeparation(fish) {
        const force = new THREE.Vector3();
        if (fish.neighbors.length === 0) return force;

        for (const neighbor of fish.neighbors) {
            const toAgent = new THREE.Vector3().subVectors(fish.position, neighbor.position);
            let distance = toAgent.length();

            if (distance <= 0.01) distance = 0.01;

            if (distance < fish.separationRadius) {
                // Quadratic falloff for stronger repuslion when close
                const normalizedDir = toAgent.clone().normalize();
                const weightedForce = normalizedDir.multiplyScalar(1.0 / (distance * distance));
                force.add(weightedForce);
            }
        }
        return force;
    }

    calculateAlignment(fish) {
        const force = new THREE.Vector3();
        if (fish.neighbors.length === 0) return force;

        const averageVelocity = new THREE.Vector3();
        for (const neighbor of fish.neighbors) {
            averageVelocity.add(neighbor.velocity);
        }

        averageVelocity.divideScalar(fish.neighbors.length);
        if (averageVelocity.length() > 0) averageVelocity.normalize();

        return averageVelocity;
    }

    calculateCohesion(fish) {
        const force = new THREE.Vector3();
        if (fish.neighbors.length === 0) return force;

        const centerOfMass = new THREE.Vector3();
        for (const neighbor of fish.neighbors) {
            centerOfMass.add(neighbor.position);
        }

        centerOfMass.divideScalar(fish.neighbors.length);
        force.subVectors(centerOfMass, fish.position);

        if (force.length() > 0) force.normalize();

        return force;
    }

    calculateSeek(fish, target) {
        const desiredVelocity = new THREE.Vector3()
            .subVectors(target, fish.position)
            .normalize()
            .multiplyScalar(fish.maxSpeed);

        return new THREE.Vector3().subVectors(desiredVelocity, fish.velocity);
    }

    calculateBoundaryAvoidance(fish) {
        const force = new THREE.Vector3();

        const distFromLeftX = fish.position.x - (-BOUNDARY_HALF_X);
        const distFromRightX = BOUNDARY_HALF_X - fish.position.x;
        const distFromGround = fish.position.y - BOUNDARY_MIN_Y;
        const distFromCeiling = BOUNDARY_MAX_Y - fish.position.y;
        const distFromBackZ = fish.position.z - (-BOUNDARY_HALF_Z);
        const distFromFrontZ = BOUNDARY_HALF_Z - fish.position.z;

        if (distFromLeftX < this.boundaryRadius && distFromLeftX > 0) force.x += 1.0 / distFromLeftX;
        if (distFromRightX < this.boundaryRadius && distFromRightX > 0) force.x -= 1.0 / distFromRightX;

        if (distFromGround < this.boundaryRadius && distFromGround > 0) force.y += 1.0 / distFromGround;
        if (distFromCeiling < this.boundaryRadius && distFromCeiling > 0) force.y -= 1.0 / distFromCeiling;

        if (distFromBackZ < this.boundaryRadius && distFromBackZ > 0) force.z += 1.0 / distFromBackZ;
        if (distFromFrontZ < this.boundaryRadius && distFromFrontZ > 0) force.z -= 1.0 / distFromFrontZ;

        return force;
    }

    //Adapted from Yuka for 3D
    calculateObstacleAvoidance(fish) {
        const force = new THREE.Vector3();
        if (this.obstacles.length === 0) return force;

        const detectionBoxLength = this._calculateDetectionBoxLength(fish);
        const fishLocalSpaceMatrix = this._createFishLocalSpaceMatrix(fish);

        const closestObstacleData = this._findClosestObstacleInPath(
            fish,
            fishLocalSpaceMatrix,
            detectionBoxLength
        );

        if (closestObstacleData) {
            const avoidanceForce = this._calculateAvoidanceForce(
                fish,
                closestObstacleData,
                detectionBoxLength
            );

            this._transformForceToWorldSpace(avoidanceForce, fish.rotation);
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

    _calculateDetectionBoxLength(fish) {
        const speedRatio = fish.getSpeed() / fish.maxSpeed;
        return this.detectionBoxMinLength * (1 + speedRatio);
    }

    _createFishLocalSpaceMatrix(fish) {
        const fishWorldMatrix = new THREE.Matrix4();
        fishWorldMatrix.compose(fish.position, fish.rotation, new THREE.Vector3(1, 1, 1));
        return new THREE.Matrix4().copy(fishWorldMatrix).invert();
    }

    _findClosestObstacleInPath(fish, fishLocalSpaceMatrix, detectionBoxLength) {
        let closestObstacle = null;
        let closestDistance = Infinity;
        let closestLocalPos = new THREE.Vector3();

        for (const obstacle of this.obstacles) {
            const obstacleLocalPos = obstacle.position.clone().applyMatrix4(fishLocalSpaceMatrix);

            // Check if obstacle is ahead (negative Z) and within detection range
            const isAhead = obstacleLocalPos.z < 0;
            const distanceAlongPath = Math.abs(obstacleLocalPos.z);
            const inDetectionRange = distanceAlongPath < detectionBoxLength;

            if (isAhead && inDetectionRange) {
                // Transform to ellipsoid space (obstacle becomes unit sphere)
                const invScale = new THREE.Vector3(
                    1.0 / obstacle.scale.x,
                    1.0 / obstacle.scale.y,
                    1.0 / obstacle.scale.z
                );

                const obstacleInEllipsoidSpace = obstacleLocalPos.clone().multiply(invScale);

                // Use max inverse scale for conservative detection
                const maxInvScale = Math.max(invScale.x, invScale.y, invScale.z);
                const fishRadiusInEllipsoidSpace = fish.boundingRadius * maxInvScale;
                const expandedRadius = obstacle.boundingRadius + fishRadiusInEllipsoidSpace;

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
        return Math.sqrt(localPosition.x * localPosition.x + localPosition.y * localPosition.y);
    }

    _calculateAvoidanceForce(fish, obstacleData, detectionBoxLength) {
        const force = new THREE.Vector3();
        const { obstacle, localPosition, distance } = obstacleData;

        // Quadratic ease-in: gentle far away, strong up close
        const normalizedDist = distance / detectionBoxLength;
        const easingFactor = 1.0 - normalizedDist;
        const proximityMultiplier = 1.0 + (easingFactor * easingFactor * 8.0);

        const veryCloseBoost = distance < this.panicDistance
            ? (1.0 - (distance / this.panicDistance)) * 3.0
            : 0;

        const finalMultiplier = proximityMultiplier + veryCloseBoost;
        const lateralDistance = this._calculateLateralDistance(localPosition);

        // Lateral steering (X only to prevent oscillation)
        if (lateralDistance > 0.001) {
            force.x = (obstacle.boundingRadius - localPosition.x) * finalMultiplier;
            force.y = 0;
        } else {
            // Direct hit: pick consistent side
            force.x = obstacle.boundingRadius * finalMultiplier;
            force.y = 0;
        }

        // Braking force
        const brakingMultiplier = 1.0 + (easingFactor * easingFactor * 2.0);
        force.z = (obstacle.boundingRadius - distance) * this.brakingWeight * brakingMultiplier;

        return force;
    }

    _transformForceToWorldSpace(force, fishRotation) {
        force.applyQuaternion(fishRotation);
    }

    getAliveFishCount() {
        return this.fish.filter(f => f.alive).length;
    }

    getFishAtGoalCount() {
        return this.fish.filter(f => f.reachedGoal).length;
    }

    /**
     * Safety net: Smoothly pushes fish out if they clip inside an obstacle
     */
    _correctObstacleCollisions(fish) {
        if (!fish.alive) return;

        for (const obstacle of this.obstacles) {
            // Transform fish position into ellipsoid's local space (unit sphere)
            const fishPosRelative = new THREE.Vector3().subVectors(fish.position, obstacle.position);

            const invScale = new THREE.Vector3(
                1.0 / obstacle.scale.x,
                1.0 / obstacle.scale.y,
                1.0 / obstacle.scale.z
            );
            const fishInEllipsoidSpace = fishPosRelative.clone().multiply(invScale);
            const distanceInEllipsoidSpace = fishInEllipsoidSpace.length();

            const maxInvScale = Math.max(invScale.x, invScale.y, invScale.z);
            const fishRadiusInEllipsoidSpace = fish.boundingRadius * maxInvScale;
            const minDistance = obstacle.boundingRadius + fishRadiusInEllipsoidSpace;

            if (distanceInEllipsoidSpace < minDistance) {
                const penetrationDepth = minDistance - distanceInEllipsoidSpace;

                // Push direction (NO Y to prevent oscillation)
                let pushDirectionEllipsoidSpace;
                if (distanceInEllipsoidSpace > 0.001) {
                    pushDirectionEllipsoidSpace = fishInEllipsoidSpace.clone();
                    pushDirectionEllipsoidSpace.y = 0;

                    if (pushDirectionEllipsoidSpace.lengthSq() > 0.0001) {
                        pushDirectionEllipsoidSpace.normalize();
                    } else {
                        pushDirectionEllipsoidSpace.set(1, 0, 1).normalize();
                    }
                } else {
                    pushDirectionEllipsoidSpace = new THREE.Vector3(1, 0, 1).normalize();
                }

                const pushDirectionWorldSpace = pushDirectionEllipsoidSpace.clone().multiply(invScale).normalize();

                // Smooth repulsion via velocity
                const repulsionStrength = (penetrationDepth + 0.3) * 12.0;
                fish.velocity.add(pushDirectionWorldSpace.multiplyScalar(repulsionStrength));

                // Dampen velocity toward obstacle
                const toObstacle = new THREE.Vector3().subVectors(obstacle.position, fish.position);
                const toObstacleNorm = toObstacle.normalize();
                const velocityTowardObstacle = fish.velocity.dot(toObstacleNorm);
                if (velocityTowardObstacle > 0) {
                    fish.velocity.sub(toObstacleNorm.multiplyScalar(velocityTowardObstacle));
                }
            }
        }
    }

    calculateObstacleAvoidanceForPredator(predator) {
        const force = new THREE.Vector3();
        if (this.obstacles.length === 0) return force;

        const predatorDetectionBoxMinLength = 2.0;
        const speedRatio = predator.velocity.length() / predator.maxSpeed;
        const detectionBoxLength = predatorDetectionBoxMinLength * (1 + speedRatio);

        // Proxy object to reuse fish logic
        const predatorProxy = {
            position: predator.position,
            velocity: predator.velocity,
            rotation: this._getPredatorRotation(predator),
            maxSpeed: predator.maxSpeed,
            boundingRadius: 0.5,
            getSpeed: () => predator.velocity.length()
        };

        const predatorLocalSpaceMatrix = this._createFishLocalSpaceMatrix(predatorProxy);
        const closestObstacleData = this._findClosestObstacleInPath(
            predatorProxy,
            predatorLocalSpaceMatrix,
            detectionBoxLength
        );

        if (closestObstacleData) {
            const avoidanceForce = this._calculateAvoidanceForce(
                predatorProxy,
                closestObstacleData,
                detectionBoxLength
            );

            this._transformForceToWorldSpace(avoidanceForce, predatorProxy.rotation);
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

    _getPredatorRotation(predator) {
        const rotation = new THREE.Quaternion();

        if (predator.velocity.lengthSq() > 0.0001) {
            const forward = predator.velocity.clone().normalize();
            const up = new THREE.Vector3(0, 1, 0);

            const right = new THREE.Vector3().crossVectors(up, forward).normalize();
            const correctedUp = new THREE.Vector3().crossVectors(forward, right);

            const rotMatrix = new THREE.Matrix4();
            rotMatrix.makeBasis(right, correctedUp, forward.negate());
            rotation.setFromRotationMatrix(rotMatrix);
        }
        return rotation;
    }

    correctPredatorObstacleCollisions(predator) {
        // Reuse logic manually as Predator isn't a Fish subclass
        for (const obstacle of this.obstacles) {
            const predatorPosRelative = new THREE.Vector3().subVectors(predator.position, obstacle.position);

            const invScale = new THREE.Vector3(
                1.0 / obstacle.scale.x,
                1.0 / obstacle.scale.y,
                1.0 / obstacle.scale.z
            );
            const predatorInEllipsoidSpace = predatorPosRelative.clone().multiply(invScale);
            const distanceInEllipsoidSpace = predatorInEllipsoidSpace.length();

            const predatorBoundingRadius = 0.5;
            const maxInvScale = Math.max(invScale.x, invScale.y, invScale.z);
            const predatorRadiusInEllipsoidSpace = predatorBoundingRadius * maxInvScale;
            const minDistance = obstacle.boundingRadius + predatorRadiusInEllipsoidSpace;

            if (distanceInEllipsoidSpace < minDistance) {
                const penetrationDepth = minDistance - distanceInEllipsoidSpace;

                let pushDirectionEllipsoidSpace;
                if (distanceInEllipsoidSpace > 0.001) {
                    pushDirectionEllipsoidSpace = predatorInEllipsoidSpace.clone();
                    pushDirectionEllipsoidSpace.y = 0;
                    if (pushDirectionEllipsoidSpace.lengthSq() > 0.0001) {
                        pushDirectionEllipsoidSpace.normalize();
                    } else {
                        pushDirectionEllipsoidSpace.set(1, 0, 1).normalize();
                    }
                } else {
                    pushDirectionEllipsoidSpace = new THREE.Vector3(1, 0, 1).normalize();
                }

                const pushDirectionWorldSpace = pushDirectionEllipsoidSpace.clone().multiply(invScale).normalize();

                const repulsionStrength = (penetrationDepth + 0.3) * 12.0;
                predator.velocity.add(pushDirectionWorldSpace.multiplyScalar(repulsionStrength));

                const toObstacle = new THREE.Vector3().subVectors(obstacle.position, predator.position);
                const toObstacleNorm = toObstacle.normalize();
                const velocityTowardObstacle = predator.velocity.dot(toObstacleNorm);
                if (velocityTowardObstacle > 0) {
                    predator.velocity.sub(toObstacleNorm.multiplyScalar(velocityTowardObstacle));
                }
            }
        }
    }
}