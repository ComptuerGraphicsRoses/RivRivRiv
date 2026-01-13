/**
 * FlockingSystem - Manages all fish and applies boids behaviors
 * Based on Yuka's steering behaviors but adapted for Three.js
 */

import * as THREE from 'three';

export class FlockingSystem {
    constructor() {
        this.fish = [];
        this.obstacles = [];
        this.baitPosition = new THREE.Vector3();
        
        // Behavior weights (tunable)
        this.separationWeight = 1.5;
        this.alignmentWeight = 1.0;
        this.cohesionWeight = 1.0;
        this.seekWeight = 0.8;
        this.obstacleAvoidanceWeight = 5.0;  // Balanced weight
        
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
     * Set the bait/goal position
     */
    setBaitPosition(position) {
        this.baitPosition.copy(position);
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
            
            // 4. Seek - move towards bait/goal
            const seekForce = this.calculateSeek(fish, this.baitPosition);
            seekForce.multiplyScalar(this.seekWeight);
            totalForce.add(seekForce);
            
            // 5. Obstacle avoidance
            const avoidanceForce = this.calculateObstacleAvoidance(fish);
            avoidanceForce.multiplyScalar(this.obstacleAvoidanceWeight);
            totalForce.add(avoidanceForce);
            
            // Apply the combined force
            fish.applyForce(totalForce);
        }
        
        // Third pass: update positions
        for (const fish of this.fish) {
            fish.update(delta);
            
            // Fourth pass: hard collision correction (safety net)
            this._correctObstacleCollisions(fish);
        }
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
     * Based on Yuka's SeparationBehavior
     */
    calculateSeparation(fish) {
        const force = new THREE.Vector3();
        
        for (const neighbor of fish.neighbors) {
            const toAgent = new THREE.Vector3().subVectors(fish.position, neighbor.position);
            let distance = toAgent.length();
            
            // Avoid division by zero
            if (distance === 0) distance = 0.0001;
            
            // Only separate if too close
            if (distance < fish.separationRadius) {
                // Force is inversely proportional to distance
                toAgent.normalize().divideScalar(distance);
                force.add(toAgent);
            }
        }
        
        return force;
    }
    
    /**
     * ALIGNMENT: Steer towards average heading of neighbors
     * Based on Yuka's AlignmentBehavior
     */
    calculateAlignment(fish) {
        const force = new THREE.Vector3();
        
        if (fish.neighbors.length === 0) return force;
        
        const averageDirection = new THREE.Vector3();
        
        for (const neighbor of fish.neighbors) {
            const neighborDir = neighbor.getDirection();
            averageDirection.add(neighborDir);
        }
        
        averageDirection.divideScalar(fish.neighbors.length);
        
        // Calculate force to align with average direction
        const currentDir = fish.getDirection();
        force.subVectors(averageDirection, currentDir);
        
        return force;
    }
    
    /**
     * COHESION: Steer towards average position of neighbors  
     * Based on Yuka's CohesionBehavior
     */
    calculateCohesion(fish) {
        const force = new THREE.Vector3();
        
        if (fish.neighbors.length === 0) return force;
        
        const centerOfMass = new THREE.Vector3();
        
        for (const neighbor of fish.neighbors) {
            centerOfMass.add(neighbor.position);
        }
        
        centerOfMass.divideScalar(fish.neighbors.length);
        
        // Seek towards center of mass
        const cohesionForce = this.calculateSeek(fish, centerOfMass);
        
        // Normalize (cohesion is usually stronger than other forces)
        if (cohesionForce.lengthSq() > 0) {
            cohesionForce.normalize();
        }
        
        return cohesionForce;
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
