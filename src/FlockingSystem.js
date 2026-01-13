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
                const expandedRadius = obstacle.boundingRadius + fish.boundingRadius;
                const lateralDistance = this._calculateLateralDistance(obstacleLocalPos);
                
                // Check if obstacle intersects with our detection box width
                if (lateralDistance < expandedRadius && distanceAlongPath < closestDistance) {
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
        
        // Check if we're in panic zone (very close to obstacle)
        const inPanicZone = distance < this.panicDistance;
        
        // Exponential proximity multiplier - gets MUCH stronger when very close
        let proximityMultiplier;
        if (inPanicZone) {
            // Exponential increase when dangerously close
            const normalizedDist = distance / this.panicDistance;
            proximityMultiplier = 10.0 / (normalizedDist + 0.01); // Approaches infinity as distance → 0
        } else {
            // Linear increase in normal range
            proximityMultiplier = 1.0 + (detectionBoxLength - distance) / detectionBoxLength;
        }
        
        // Calculate lateral steering force
        const lateralDistance = this._calculateLateralDistance(localPosition);
        
        if (lateralDistance > 0.001) {
            // Steer away from obstacle's lateral position
            force.x = (obstacle.boundingRadius - localPosition.x) * proximityMultiplier;
            force.y = (obstacle.boundingRadius - localPosition.y) * proximityMultiplier * 0.5;
        } else {
            // Obstacle is directly ahead - randomly pick a side to avoid
            const randomDirection = Math.random() > 0.5 ? 1 : -1;
            force.x = obstacle.boundingRadius * proximityMultiplier * randomDirection;
        }
        
        // Emergency braking when in panic zone
        if (inPanicZone) {
            // Much stronger braking to prevent penetration
            force.z = (obstacle.boundingRadius - distance) * this.brakingWeight * 5.0;
        } else {
            // Normal braking force
            const brakingForce = (obstacle.boundingRadius - distance) * this.brakingWeight;
            force.z = brakingForce;
        }
        
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
     * Hard collision correction - Final safety net
     * If a fish somehow ended up inside an obstacle, forcefully push it out
     * This should rarely trigger if avoidance is working well, but prevents exploits
     */
    _correctObstacleCollisions(fish) {
        if (!fish.alive) return;
        
        for (const obstacle of this.obstacles) {
            const toObstacle = new THREE.Vector3().subVectors(obstacle.position, fish.position);
            const distance = toObstacle.length();
            const minDistance = obstacle.boundingRadius + fish.boundingRadius;
            
            // Check if fish is inside obstacle's boundary
            if (distance < minDistance) {
                // Calculate penetration depth
                const penetrationDepth = minDistance - distance;
                
                // Push fish out along the direction away from obstacle center
                if (distance > 0.001) {
                    // Normal case: push away from center
                    const pushDirection = toObstacle.clone().normalize().negate();
                    const correction = pushDirection.multiplyScalar(penetrationDepth + 0.1); // +0.1 for safety margin
                    fish.position.add(correction);
                } else {
                    // Edge case: fish exactly at obstacle center, push in random direction
                    const randomDir = new THREE.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                    fish.position.add(randomDir.multiplyScalar(minDistance + 0.1));
                }
                
                // Zero out velocity component toward obstacle to prevent re-entry
                const velocityTowardObstacle = fish.velocity.dot(toObstacle) / distance;
                if (velocityTowardObstacle > 0) {
                    const toObstacleNorm = toObstacle.clone().normalize();
                    const velocityCorrection = toObstacleNorm.multiplyScalar(velocityTowardObstacle);
                    fish.velocity.sub(velocityCorrection);
                }
                
                // Sync mesh position after correction
                if (fish.mesh) {
                    fish.mesh.position.copy(fish.position);
                }
            }
        }
    }
}
