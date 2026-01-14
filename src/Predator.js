// Predator.js
import * as THREE from 'three';

export default class Predator {
    constructor(position) {
        this.position = position.clone();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();

        // === AI PARAMETRELERİ ===
        this.maxSpeed = 2;          // balıktan hızlı
        this.maxForce = 0.15;

        this.detectionRadius = 10.0;  // metre
        this.captureRadius = 0.6;     // yakalama mesafesi

        this.wanderAngle = 0;
    }


    /* ---------------- UPDATE ---------------- */

    update(deltaTime, fishes) {
        let targetFish = this.findClosestFish(fishes);

        if (targetFish) {
            // 🎯 Avlanma
            const seekForce = this.seek(targetFish.position);
            this.applyForce(seekForce);

            this.tryToEat(targetFish);
        } else {
            // 🐾 Gezinme
            const wanderForce = this.wander();
            this.applyForce(wanderForce);
        }

        // Fizik entegrasyonu
        this.velocity.add(this.acceleration);

        // speed limit
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity.setLength(this.maxSpeed);
        }

        this.position.addScaledVector(this.velocity, deltaTime);

        this.acceleration.set(0, 0, 0);
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
