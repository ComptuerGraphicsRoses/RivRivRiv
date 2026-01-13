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
        this.detectionBoxMinLength = 4.0;
        this.brakingWeight = 0.2;
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
        
        // Detection box length is proportional to speed
        const detectionBoxLength = this.detectionBoxMinLength + 
            (fish.getSpeed() / fish.maxSpeed) * this.detectionBoxMinLength;
        
        let closestObstacle = null;
        let closestDistance = Infinity;
        let closestLocalPos = new THREE.Vector3();
        
        // Create fish's world matrix and inverse
        const fishWorldMatrix = new THREE.Matrix4();
        fishWorldMatrix.compose(fish.position, fish.rotation, new THREE.Vector3(1, 1, 1));
        const inverseMatrix = new THREE.Matrix4().copy(fishWorldMatrix).invert();
        
        // Check all obstacles in fish's local space
        for (const obstacle of this.obstacles) {
            // Transform obstacle position to fish's local space
            const obstacleLocalPos = obstacle.position.clone().applyMatrix4(inverseMatrix);
            
            // In fish's local space:
            // Check if obstacle is ahead (negative Z) and within detection range
            if (obstacleLocalPos.z < 0 && Math.abs(obstacleLocalPos.z) < detectionBoxLength) {
                const expandedRadius = obstacle.boundingRadius + fish.boundingRadius;
                
                // Check if obstacle is within the width of detection box
                // Using horizontal distance (x and y in local space)
                const lateralDistance = Math.sqrt(obstacleLocalPos.x * obstacleLocalPos.x + obstacleLocalPos.y * obstacleLocalPos.y);
                
                if (lateralDistance < expandedRadius) {
                    // This obstacle is in our path!
                    const distToObstacle = Math.abs(obstacleLocalPos.z);
                    
                    if (distToObstacle < closestDistance) {
                        closestDistance = distToObstacle;
                        closestObstacle = obstacle;
                        closestLocalPos.copy(obstacleLocalPos);
                    }
                }
            }
        }
        
        // If we found a close obstacle, calculate avoidance force
        if (closestObstacle !== null) {
            // The closer the obstacle, the stronger the steering force
            const multiplier = 1.0 + ((detectionBoxLength - closestDistance) / detectionBoxLength);
            
            // Calculate lateral force (steer to the side)
            // Push away from obstacle in X and Y (lateral directions)
            const lateralDistance = Math.sqrt(
                closestLocalPos.x * closestLocalPos.x + 
                closestLocalPos.y * closestLocalPos.y
            );
            
            if (lateralDistance > 0.001) {
                // Steer perpendicular to current lateral offset
                force.x = (closestObstacle.boundingRadius - closestLocalPos.x) * multiplier;
                force.y = (closestObstacle.boundingRadius - closestLocalPos.y) * multiplier * 0.5; // Less vertical force
            } else {
                // If directly ahead, pick a side to steer towards
                force.x = closestObstacle.boundingRadius * multiplier * (Math.random() > 0.5 ? 1 : -1);
            }
            
            // Apply braking force (negative Z in local space = slow down)
            force.z = (closestObstacle.boundingRadius - Math.abs(closestLocalPos.z)) * this.brakingWeight;
            
            // Transform force from local space back to world space
            force.applyQuaternion(fish.rotation);
        }
        
        return force;
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
}
