/**
 * Scene Manager
 * Manages Three.js scene, lighting, and objects
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Fish } from './Fish.js';
import { FlockingSystem } from './FlockingSystem.js';

export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x001a2e); // Deep water color
        this.scene.fog = new THREE.Fog(0x001a2e, 10, 100);

        this.lights = {
            directional: null,
            spotlight: null,
            ambient: null
        };

        this.objects = [];
        this.fish = [];
        this.predators = [];
        
        // Flocking system
        this.flockingSystem = new FlockingSystem();
        
        // Bait (goal) object
        this.bait = null;
    }

    init = async (shaderManager) => {
        // Setup lighting
        this.setupLights();

        // Load Scene.fbx model
        await this.loadSceneModel();

        // Create placeholder geometry for testing
        this.createTestScene();

        // Create team names scene (in separate area)
        this.createTeamNamesScene();
    }

    loadSceneModel = async () => {
        const loader = new FBXLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/models/Scene.fbx',
                (fbx) => {
                    this.scene.add(fbx);
                    console.log('✓ Scene.fbx loaded with textures');
                    resolve(fbx);
                },
                (progress) => {
                    //console.log('Loading Scene.fbx:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading Scene.fbx:', error);
                    reject(error);
                }
            );
        });
    }

    setupLights = () => {
        // Ambient light
        this.lights.ambient = new THREE.AmbientLight(0x404040, 1.0);
        this.scene.add(this.lights.ambient);

        // Directional light (sun)
        this.lights.directional = new THREE.DirectionalLight(0xffffff, 1.0);
        this.lights.directional.position.set(5, 10, 5);
        this.lights.directional.castShadow = true;
        this.scene.add(this.lights.directional);

        // Spotlight (BBM 412 requirement)
        this.lights.spotlight = new THREE.SpotLight(0xffffff, 2.0);
        this.lights.spotlight.position.set(0, 10, 0);
        this.lights.spotlight.angle = Math.PI / 6;
        this.lights.spotlight.penumbra = 0.2;
        this.lights.spotlight.decay = 2;
        this.lights.spotlight.distance = 50;
        this.lights.spotlight.castShadow = true;

        // Spotlight target
        this.lights.spotlight.target.position.set(0, 0, 0);
        this.scene.add(this.lights.spotlight);
        this.scene.add(this.lights.spotlight.target);

        // Helper for spotlight (for debugging)
        const spotLightHelper = new THREE.SpotLightHelper(this.lights.spotlight);
        this.scene.add(spotLightHelper);
    }

    createTestScene = () => {
        // Ground plane
        // const groundGeometry = new THREE.PlaneGeometry(50, 50);
        // const groundMaterial = new THREE.MeshStandardMaterial({
        //     color: 0x2a4858,
        //     roughness: 0.8,
        //     metalness: 0.2
        // });
        // const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        // ground.rotation.x = -Math.PI / 2;
        // ground.receiveShadow = true;
        // this.scene.add(ground);

        // Test cube (Morphology #1 for BBM 412)
        const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6b6b,
            roughness: 0.5,
            metalness: 0.3
        });
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cube.position.set(0, 1, 0);
        cube.castShadow = true;
        cube.receiveShadow = true;
        this.scene.add(cube);
        this.objects.push(cube);

        // Test sphere (Morphology #2 for BBM 412)
        const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
        const sphereMaterial = new THREE.MeshStandardMaterial({
            color: 0x4ecdc4,
            roughness: 0.3,
            metalness: 0.7
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.set(4, 1, 0);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        this.scene.add(sphere);
        this.objects.push(sphere);

        // Test cone (Morphology #3 for BBM 412)
        const coneGeometry = new THREE.ConeGeometry(1, 2, 32);
        const coneMaterial = new THREE.MeshStandardMaterial({
            color: 0xf9ca24,
            roughness: 0.4,
            metalness: 0.5
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.set(-4, 1, 0);
        cone.castShadow = true;
        cone.receiveShadow = true;
        this.scene.add(cone);
        this.objects.push(cone);
    }

    createTeamNamesScene = () => {
        // This will be located at a separate area (e.g., y = -50)
        // For now, create placeholder text using 3D objects
        const nameGeometry = new THREE.BoxGeometry(1, 1, 1);
        const nameMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

        // TODO: Replace with actual team member names using 3D text or assembled cubes
        const namePlaceholder = new THREE.Mesh(nameGeometry, nameMaterial);
        namePlaceholder.position.set(0, -50, 0);
        this.scene.add(namePlaceholder);
    }
    
    /**
     * Spawn a school of fish
     */
    spawnFishSchool = (count = 50) => {
        const fishGeometry = new THREE.ConeGeometry(0.15, 0.5, 8);
        fishGeometry.rotateX(Math.PI * -0.5); // Point forward
        
        const fishMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a90e2,
            roughness: 0.6,
            metalness: 0.4,
            emissive: 0x1a3a5a,
            emissiveIntensity: 0.2
        });
        
        for (let i = 0; i < count; i++) {
            // Create fish entity
            const fish = new Fish();
            
            // Random spawn position (in a cluster)
            fish.position.set(
                -5 + Math.random() * 10,
                2 + Math.random() * 3,
                -5 + Math.random() * 10
            );
            
            // Random initial velocity
            fish.velocity.set(
                -0.5 + Math.random(),
                -0.2 + Math.random() * 0.4,
                -0.5 + Math.random()
            );
            
            // Create mesh
            const mesh = new THREE.Mesh(fishGeometry, fishMaterial.clone());
            mesh.castShadow = true;
            fish.setMesh(mesh);
            this.scene.add(mesh);
            
            // Add to flocking system
            this.flockingSystem.addFish(fish);
            this.fish.push(fish);
        }
        
        console.log(`✓ Spawned ${count} fish`);
    }
    
    /**
     * Create bait (goal) object
     */
    createBait = (position = new THREE.Vector3(10, 3, 10)) => {
        const baitGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const baitMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.7
        });
        
        this.bait = new THREE.Mesh(baitGeometry, baitMaterial);
        this.bait.position.copy(position);
        this.scene.add(this.bait);
        
        // Set bait position in flocking system
        this.flockingSystem.setBaitPosition(position);
        
        console.log('✓ Created bait at', position);
    }
    
    /**
     * Add obstacle for fish to avoid
     */
    addObstacle = (position, radius = 1.0) => {
        const obstacle = {
            position: position.clone(),
            boundingRadius: radius
        };
        
        // Add to flocking system
        this.flockingSystem.addObstacle(obstacle);
        
        // Add wireframe helper for extra visibility
        const wireframeGeometry = new THREE.SphereGeometry(radius * 1.1, 16, 16);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        wireframeMesh.position.copy(position);
        this.scene.add(wireframeMesh);
        
        console.log(`✓ Added obstacle at (${position.x}, ${position.y}, ${position.z}) with radius ${radius}`);
        
        return obstacle;
    }

    updateShader = (shaderManager) => {
        // This will be used to switch materials when shader changes
        // For now using standard materials, will integrate custom shaders later
        console.log('Scene shader updated to:', shaderManager.activeShader);
    }

    update = (deltaTime) => {
        // Animate test objects (simple rotation for demonstration)
        this.objects.forEach((obj, index) => {
            obj.rotation.y += deltaTime * (0.5 + index * 0.2);
        });

        // Update flocking system
        this.flockingSystem.update(deltaTime);
        
        // Animate bait (pulsing effect)
        if (this.bait) {
            const time = Date.now() * 0.001;
            const scale = 1.0 + Math.sin(time * 3) * 0.2;
            this.bait.scale.setScalar(scale);
        }
    }
}
