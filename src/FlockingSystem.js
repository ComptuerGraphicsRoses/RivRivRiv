/**
 * FlockingSystem - Manages all fish and applies boids behaviors
 * Based on Yuka's steering behaviors but adapted for Three.js
 */

// Hard boundary clamping - ENSURE fish never escape the play area
// This is the safety net in case the boundary avoidance force isn't enough
// Boundaries: X[-10,+10], Y[-1.5,5], Z[-10,+10]
export const BOUNDARY_HALF_X = 10;
export const BOUNDARY_MIN_Y = -0.5;
export const BOUNDARY_MAX_Y = 5;
export const BOUNDARY_HALF_Z = 10;

import * as THREE from 'three';

export class FlockingSystem {
    constructor() {
        this.fish = [];
        this.obstacles = [];
        this.baits = []; // Track multiple baits instead of single position

        // World boundaries - fish will be kept within these bounds
        this.boundaryRadius = 1;   // Distance from boundary where avoidance kicks in

        // Behavior weights - based on boids-js-master working values
        // These are tuned to work with normalized forces
        this.separationWeight = 30.0;      // Strong separation to avoid crowding
        this.alignmentWeight = 2.0;        // Match neighbors' direction
        this.cohesionWeight = 4.0;         // Stay together as a group
        this.seekWeight = 3.0;             // Move towards bait
        this.obstacleAvoidanceWeight = 100.0;  // Very strong to avoid obstacles
        this.boundaryWeight = 500.0;       // VERY strong to stay within world bounds (increased from 100)

        // Obstacle avoidance parameters
        this.detectionBoxMinLength = 5.0;  // Increased for earlier detection
        this.brakingWeight = 0.5;          // Increased for stronger braking
        this.panicDistance = 0.5;          // Distance at which to apply emergency measures
    }

    /**
     * Add a fish to the flock
     */
    addFish(fish) {
        this.fish.push(fish);
    }

    /**
     * Add an obstacle
     */
    addObstacle(obstacle) {
        this.obstacles.push(obstacle);
    }

    /**
     * Remove an obstacle
     */
    removeObstacle(obstacle) {
        const index = this.obstacles.indexOf(obstacle);
        if (index > -1) {
            this.obstacles.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Add a bait that fish will be attracted to
     */
    addBait(baitObject) {
        this.baits.push(baitObject);
        console.log(`✓ Bait registered with flocking system at (${baitObject.position.x.toFixed(2)}, ${baitObject.position.y.toFixed(2)}, ${baitObject.position.z.toFixed(2)})`);
    }

    /**
     * Remove a bait from tracking
     */
    removeBait(baitObject) {
        const index = this.baits.indexOf(baitObject);
        if (index > -1) {
            this.baits.splice(index, 1);
            console.log(`✓ Bait removed from flocking system`);
        }
    }

    /**
     * Clear all baits
     */
    clearBaits() {
        this.baits = [];
    }

    /**
     * Set the bait/goal position (legacy method for backward compatibility)
     */
    setBaitPosition(position) {
        // For backward compatibility, create a simple bait object
        const baitObject = {
            position: position.clone()
        };
        this.baits = [baitObject];
    }

    /**
     * Update all fish
     */
    update(delta) {
        // First pass: update neighbors for all fish
        this.updateNeighborhoods();

        // Second pass: calculate and apply forces
        for (const fish of this.fish) {
            if (!fish.alive) continue;

            // Reset forces
            const totalForce = new THREE.Vector3();

            // 1. Separation - avoid crowding neighbors
            const separationForce = this.calculateSeparation(fish);
            separationForce.multiplyScalar(this.separationWeight);
            totalForce.add(separationForce);

            // 2. Alignment - steer towards average heading
            const alignmentForce = this.calculateAlignment(fish);
            alignmentForce.multiplyScalar(this.alignmentWeight);
            totalForce.add(alignmentForce);

            // 3. Cohesion - steer towards average position
            const cohesionForce = this.calculateCohesion(fish);
            cohesionForce.multiplyScalar(this.cohesionWeight);
            totalForce.add(cohesionForce);

            // 4. Seek - move towards nearest bait/goal
            if (this.baits.length > 0) {
                const nearestBait = this.findNearestBait(fish);
                if (nearestBait) {
                    const seekForce = this.calculateSeek(fish, nearestBait.position);
                    seekForce.multiplyScalar(this.seekWeight);
                    totalForce.add(seekForce);
                }
            }

            // 5. Obstacle avoidance
            const avoidanceForce = this.calculateObstacleAvoidance(fish);
            avoidanceForce.multiplyScalar(this.obstacleAvoidanceWeight);
            totalForce.add(avoidanceForce);

            // 6. Boundary avoidance - keep fish within world bounds
            const boundaryForce = this.calculateBoundaryAvoidance(fish);
            boundaryForce.multiplyScalar(this.boundaryWeight);
            totalForce.add(boundaryForce);

            // Apply the combined force
            fish.applyForce(totalForce);
        }

        // Third pass: update positions
        for (const fish of this.fish) {
            fish.update(delta);

            // Fourth pass: hard collision correction (safety net)
            this._correctObstacleCollisions(fish);
        }

        // Fifth pass: check for bait consumption
        this._checkBaitConsumption();
    }

    /**
     * Check if any fish have reached baits and consume them
     * First fish to reach a bait consumes it
     */
    _checkBaitConsumption() {
        if (this.baits.length === 0) return;

        const baitsToRemove = [];

        // Check each bait against all fish
        for (const bait of this.baits) {
            for (const fish of this.fish) {
                if (!fish.alive) continue;

                const distance = fish.position.distanceTo(bait.position);

                // If fish is within consumption radius
                if (distance <= fish.baitConsumptionRadius) {
                    // Mark this bait for removal (first fish wins)
                    if (!baitsToRemove.includes(bait)) {
                        baitsToRemove.push(bait);
                        console.log(`🐟 Fish consumed bait at (${bait.position.x.toFixed(2)}, ${bait.position.y.toFixed(2)}, ${bait.position.z.toFixed(2)})`);
                    }
                    break; // Only first fish consumes this bait
                }
            }
        }

        // Remove consumed baits
        for (const bait of baitsToRemove) {
            // Remove from tracking array
            this.removeBait(bait);

            // Notify callback (SceneManager/ObjectManager will handle scene removal)
            if (this.onBaitConsumed) {
                this.onBaitConsumed(bait);
            }
        }
    }

    /**
     * Find the nearest bait to a fish
     */
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

    /**
     * Update neighbor lists for all fish
     */
    updateNeighborhoods() {
        for (const fish of this.fish) {
            if (!fish.alive) continue;

            fish.neighbors = [];

            for (const other of this.fish) {
                if (other === fish || !other.alive) continue;

                const distSq = fish.position.distanceToSquared(other.position);
                const radiusSq = fish.perceptionRadius * fish.perceptionRadius;

                if (distSq < radiusSq) {
                    fish.neighbors.push(other);
                }
            }
        }
    }

    /**
     * SEPARATION: Steer to avoid crowding neighbors
     * Based on boids-js-master implementation with quadratic distance falloff
     */
    calculateSeparation(fish) {
        const force = new THREE.Vector3();

        if (fish.neighbors.length === 0) return force;

        for (const neighbor of fish.neighbors) {
            const toAgent = new THREE.Vector3().subVectors(fish.position, neighbor.position);
            let distance = toAgent.length();

            // Avoid division by zero
            if (distance <= 0.01) distance = 0.01;

            // Only separate if too close
            if (distance < fish.separationRadius) {
                // Quadratic falloff: (direction/distance)/distance
                // This makes closer neighbors have MUCH stronger repulsion
                const normalizedDir = toAgent.clone().normalize();
                const weightedForce = normalizedDir.multiplyScalar(1.0 / (distance * distance));
                force.add(weightedForce);
            }
        }

        return force;
    }

    /**
     * ALIGNMENT: Steer towards average heading of neighbors
     * Based on boids-js-master - use normalized average velocity
     */
    calculateAlignment(fish) {
        const force = new THREE.Vector3();

        if (fish.neighbors.length === 0) return force;

        const averageVelocity = new THREE.Vector3();

        // Sum up all neighbor velocities
        for (const neighbor of fish.neighbors) {
            averageVelocity.add(neighbor.velocity);
        }

        // Get the average
        averageVelocity.divideScalar(fish.neighbors.length);

        // Normalize to get direction
        const avgLength = averageVelocity.length();
        if (avgLength > 0) {
            averageVelocity.normalize();
        }

        return averageVelocity;
    }

    /**
     * COHESION: Steer towards average position of neighbors  
     * Based on boids-js-master implementation
     */
    calculateCohesion(fish) {
        const force = new THREE.Vector3();

        if (fish.neighbors.length === 0) return force;

        const centerOfMass = new THREE.Vector3();

        // Calculate average position of neighbors
        for (const neighbor of fish.neighbors) {
            centerOfMass.add(neighbor.position);
        }

        centerOfMass.divideScalar(fish.neighbors.length);

        // Direction towards center of mass
        force.subVectors(centerOfMass, fish.position);

        // Normalize the direction
        const length = force.length();
        if (length > 0) {
            force.normalize();
        }

        return force;
    }

    /**
     * SEEK: Steer towards a target position
     * Based on Yuka's SeekBehavior
     */
    calculateSeek(fish, target) {
        const force = new THREE.Vector3();

        // Desired velocity points towards target
        const desiredVelocity = new THREE.Vector3()
            .subVectors(target, fish.position)
            .normalize()
            .multiplyScalar(fish.maxSpeed);

        // Steering force = desired velocity - current velocity
        force.subVectors(desiredVelocity, fish.velocity);

        return force;
    }

    /**
     * BOUNDARY AVOIDANCE: Keep fish within world boundaries
     * Based on boids-js-master computeObstacles boundary logic
     * Uses inverse distance force to push fish away from boundaries
     */
    calculateBoundaryAvoidance(fish) {
        const force = new THREE.Vector3();

        // Distance from each boundary (centered at origin)
        // Left wall: -BOUNDARY_HALF_X, Right wall: +BOUNDARY_HALF_X
        const distFromLeftX = fish.position.x - (-BOUNDARY_HALF_X);   // distance from left wall
        const distFromRightX = BOUNDARY_HALF_X - fish.position.x;     // distance from right wall

        // Y is ground-based: [0, 15]
        const distFromGround = fish.position.y - BOUNDARY_MIN_Y;      // distance from ground (Y=0)
        const distFromCeiling = BOUNDARY_MAX_Y - fish.position.y;     // distance from ceiling (Y=15)

        const distFromBackZ = fish.position.z - (-BOUNDARY_HALF_Z);
        const distFromFrontZ = BOUNDARY_HALF_Z - fish.position.z;

        // X boundaries (left/right walls)
        if (distFromLeftX < this.boundaryRadius && distFromLeftX > 0) {
            // Too close to left boundary, push right
            force.x += 1.0 / distFromLeftX;
        }
        if (distFromRightX < this.boundaryRadius && distFromRightX > 0) {
            // Too close to right boundary, push left
            force.x -= 1.0 / distFromRightX;
        }

        // Y boundaries (ground/ceiling)
        if (distFromGround < this.boundaryRadius && distFromGround > 0) {
            // Too close to ground, push up
            force.y += 1.0 / distFromGround;
        }
        if (distFromCeiling < this.boundaryRadius && distFromCeiling > 0) {
            // Too close to ceiling, push down
            force.y -= 1.0 / distFromCeiling;
        }

        // Z boundaries (back/front walls)
        if (distFromBackZ < this.boundaryRadius && distFromBackZ > 0) {
            // Too close to back boundary, push forward
            force.z += 1.0 / distFromBackZ;
        }
        if (distFromFrontZ < this.boundaryRadius && distFromFrontZ > 0) {
            // Too close to front boundary, push back
            force.z -= 1.0 / distFromFrontZ;
        }

        return force;
    }

    /**
     * OBSTACLE AVOIDANCE: Avoid collisions with static obstacles
     * Based on Yuka's ObstacleAvoidanceBehavior - adapted for 3D Three.js
     */
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

    /**
     * Calculate detection box length based on fish speed
     * Faster fish need longer detection range
     */
    _calculateDetectionBoxLength(fish) {
        const speedRatio = fish.getSpeed() / fish.maxSpeed;
        return this.detectionBoxMinLength * (1 + speedRatio);
    }

    /**
     * Create inverse matrix to transform world coordinates to fish's local space
     * In local space: fish looks down negative Z axis
     */
    _createFishLocalSpaceMatrix(fish) {
        const fishWorldMatrix = new THREE.Matrix4();
        fishWorldMatrix.compose(
            fish.position,
            fish.rotation,
            new THREE.Vector3(1, 1, 1)
        );
        return new THREE.Matrix4().copy(fishWorldMatrix).invert();
    }

    /**
     * Find the closest obstacle that's in the fish's path
     * Returns obstacle data with local position and distance, or null if none found
     */
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
                // Transform to ellipsoid space for accurate collision detection
                // In ellipsoid space, the obstacle becomes a unit sphere
                const invScale = new THREE.Vector3(
                    1.0 / obstacle.scale.x,
                    1.0 / obstacle.scale.y,
                    1.0 / obstacle.scale.z
                );

                // Transform obstacle position to ellipsoid space
                const obstacleInEllipsoidSpace = obstacleLocalPos.clone().multiply(invScale);

                // Fish bounding radius in ellipsoid space (use max inverse scale for conservative detection)
                const maxInvScale = Math.max(invScale.x, invScale.y, invScale.z);
                const fishRadiusInEllipsoidSpace = fish.boundingRadius * maxInvScale;

                // Expanded radius in ellipsoid space
                const expandedRadius = obstacle.boundingRadius + fishRadiusInEllipsoidSpace;

                // Lateral distance in ellipsoid space (XY plane in fish's local coordinates)
                const lateralDistanceInEllipsoidSpace = this._calculateLateralDistance(obstacleInEllipsoidSpace);

                // Check if obstacle intersects with our detection box width (in ellipsoid space)
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

    /**
     * Calculate lateral (sideways) distance in XY plane
     * This represents how far left/right/up/down the obstacle is from fish's forward path
     */
    _calculateLateralDistance(localPosition) {
        return Math.sqrt(
            localPosition.x * localPosition.x +
            localPosition.y * localPosition.y
        );
    }

    /**
     * Calculate the actual avoidance force in fish's local space
     * Force has three components:
     * - X/Y: lateral steering to avoid obstacle
     * - Z: braking force to slow down
     */
    _calculateAvoidanceForce(fish, obstacleData, detectionBoxLength) {
        const force = new THREE.Vector3();
        const { obstacle, localPosition, distance } = obstacleData;

        // Smooth proximity multiplier using quadratic easing
        // Instead of linear or exponential, use a smooth curve that gradually increases
        const normalizedDist = distance / detectionBoxLength; // 0 to 1 (1 = far, 0 = very close)

        // Quadratic ease-in: gentle far away, strong up close
        // (1 - x)^2 scaled up, gives smooth acceleration as distance decreases
        const easingFactor = 1.0 - normalizedDist; // Invert: 0 = far, 1 = close
        const proximityMultiplier = 1.0 + (easingFactor * easingFactor * 8.0); // 1.0 to 9.0 smoothly

        // Extra boost when very close, but still smooth
        const veryCloseBoost = distance < this.panicDistance
            ? (1.0 - (distance / this.panicDistance)) * 3.0  // Smooth 0-3x bonus
            : 0;

        const finalMultiplier = proximityMultiplier + veryCloseBoost;

        // Calculate lateral steering force
        const lateralDistance = this._calculateLateralDistance(localPosition);

        if (lateralDistance > 0.001) {
            // Steer away from obstacle's lateral position
            force.x = (obstacle.boundingRadius - localPosition.x) * finalMultiplier;
            force.y = (obstacle.boundingRadius - localPosition.y) * finalMultiplier * 0.5;
        } else {
            // Obstacle is directly ahead - randomly pick a side to avoid
            const randomDirection = Math.random() > 0.5 ? 1 : -1;
            force.x = obstacle.boundingRadius * finalMultiplier * randomDirection;
        }

        // Smooth braking curve - stronger when closer
        const brakingMultiplier = 1.0 + (easingFactor * easingFactor * 2.0); // Gradual increase
        const brakingForce = (obstacle.boundingRadius - distance) * this.brakingWeight * brakingMultiplier;
        force.z = brakingForce;

        return force;
    }

    /**
     * Transform force from fish's local space to world space
     * Modifies the force vector in place
     */
    _transformForceToWorldSpace(force, fishRotation) {
        force.applyQuaternion(fishRotation);
    }

    /**
     * Get alive fish count
     */
    getAliveFishCount() {
        return this.fish.filter(f => f.alive).length;
    }

    /**
     * Get fish that reached goal
     */
    getFishAtGoalCount() {
        return this.fish.filter(f => f.reachedGoal).length;
    }

    /**
     * Smooth collision correction - Final safety net
     * If a fish somehow ended up inside an obstacle, smoothly push it out
     * Uses velocity-based push instead of position teleport for natural movement
     */
    _correctObstacleCollisions(fish) {
        if (!fish.alive) return;

        for (const obstacle of this.obstacles) {
            // Transform fish position into ellipsoid's local space
            // In this space, the ellipsoid becomes a unit sphere
            const fishPosRelative = new THREE.Vector3().subVectors(fish.position, obstacle.position);

            // Scale by inverse of ellipsoid scale to convert to unit sphere space
            const invScale = new THREE.Vector3(
                1.0 / obstacle.scale.x,
                1.0 / obstacle.scale.y,
                1.0 / obstacle.scale.z
            );
            const fishInEllipsoidSpace = fishPosRelative.clone().multiply(invScale);

            // Distance in transformed space (as if obstacle is a unit sphere)
            const distanceInEllipsoidSpace = fishInEllipsoidSpace.length();

            // Fish bounding radius also needs to be scaled to ellipsoid space
            // Use the maximum inverse scale component for conservative collision detection
            const maxInvScale = Math.max(invScale.x, invScale.y, invScale.z);
            const fishRadiusInEllipsoidSpace = fish.boundingRadius * maxInvScale;

            // Minimum distance in ellipsoid space (obstacle is now radius=boundingRadius sphere)
            const minDistance = obstacle.boundingRadius + fishRadiusInEllipsoidSpace;

            // Check if fish is inside obstacle's boundary
            if (distanceInEllipsoidSpace < minDistance) {
                // Calculate penetration depth in ellipsoid space
                const penetrationDepth = minDistance - distanceInEllipsoidSpace;

                // Calculate push direction in ellipsoid space
                let pushDirectionEllipsoidSpace;
                if (distanceInEllipsoidSpace > 0.001) {
                    // Normal case: push away from center in ellipsoid space
                    pushDirectionEllipsoidSpace = fishInEllipsoidSpace.clone().normalize();
                } else {
                    // Edge case: fish exactly at obstacle center, push in random direction
                    pushDirectionEllipsoidSpace = new THREE.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                }

                // Transform push direction back to world space
                // The gradient of the ellipsoid surface points in the direction of (x/a², y/b², z/c²)
                // This is equivalent to multiplying by inverse scale squared, then normalizing
                const pushDirectionWorldSpace = pushDirectionEllipsoidSpace.clone().multiply(invScale).normalize();

                // Apply smooth repulsion via velocity instead of position jump
                // Strength based on penetration depth - deeper = stronger push
                const repulsionStrength = (penetrationDepth + 0.2) * 8.0; // Strong but smooth
                const repulsionVelocity = pushDirectionWorldSpace.multiplyScalar(repulsionStrength);
                fish.velocity.add(repulsionVelocity);

                // Dampen any velocity toward the obstacle (in world space)
                const toObstacle = new THREE.Vector3().subVectors(obstacle.position, fish.position);
                const toObstacleNorm = toObstacle.normalize();
                const velocityTowardObstacle = fish.velocity.dot(toObstacleNorm);
                if (velocityTowardObstacle > 0) {
                    // Remove the component moving toward obstacle
                    const velocityCorrection = toObstacleNorm.multiplyScalar(velocityTowardObstacle);
                    fish.velocity.sub(velocityCorrection);
                }
            }
        }
    }
}
