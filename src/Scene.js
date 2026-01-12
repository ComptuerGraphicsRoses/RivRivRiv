/**
 * Scene Manager
 * Manages Three.js scene, lighting, and objects
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';

export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x158DA0); // Deep water color
        this.scene.fog = new THREE.Fog(0x158DA0, 0, 20);

        this.lights = {
            directional: null,
            spotlight: null,
            ambient: null
        };

        this.objects = [];
        this.fish = [];
        this.predators = [];
        this.skybox = null;
    }

    init = async (shaderManager) => {
        // Setup lighting
        this.setupLights();

        // Setup skybox
        await this.setupSkybox();

        // Load Scene.fbx model
        await this.loadSceneModel();

        // Create placeholder geometry for testing
        //this.createTestScene();

        this.createGroundPlane();

        // Create team names scene (in separate area)
        this.createTeamNamesScene();
    }

    loadSceneModel = async () => {
        const loader = new FBXLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/models/Scene.fbx',
                (fbx) => {
                    fbx.scale.set(0.01, 0.01, 0.01);
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

    setupSkybox = async () => {
        const loader = new THREE.TextureLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                '../assets/textures/skyrender.png',
                (texture) => {
                    // Create GroundedSkybox with the loaded texture
                    this.skybox = new GroundedSkybox(texture, 15, 15);
                    this.skybox.position.y = 10; // Adjust height as needed
                    this.scene.add(this.skybox);

                    console.log('✓ Skybox loaded successfully');
                    resolve(this.skybox);
                },
                undefined,
                (error) => {
                    console.error('Error loading skybox texture:', error);
                    reject(error);
                }
            );
        });
    }

    setupLights = () => {
        // Ambient light
        this.lights.ambient = new THREE.AmbientLight(0x7296DD, 1.5);
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
        // Ground plane with sandy texture
        this.createGroundPlane();

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

    createGroundPlane() {
        const groundGeometry = new THREE.PlaneGeometry(100, 100);

        // Load sandy texture
        const textureLoader = new THREE.TextureLoader();
        const sandyTexture = textureLoader.load('../assets/models/SandyDry_S.jpg');

        // Configure texture wrapping and repeat for better appearance
        sandyTexture.wrapS = THREE.RepeatWrapping;
        sandyTexture.wrapT = THREE.RepeatWrapping;
        sandyTexture.repeat.set(20, 20); // Adjust repeat for better tiling

        const groundMaterial = new THREE.MeshStandardMaterial({
            map: sandyTexture,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = 0.01;
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
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

        // Update fish (boids simulation) - TODO
        // Update predators (AI) - TODO
    }
}
