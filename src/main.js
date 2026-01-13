/**
 * Main Application Entry Point
 * Flocking Frenzy - BBM 412 Computer Graphics Project
 */

import * as THREE from 'three';
import { CameraController } from './Camera.js';
import { SceneManager } from './Scene.js';
import { ShaderManager } from './ShaderManager.js';
import { UIManager } from './UI.js';
import { GameState } from './GameState.js';

class FlockingFrenzy {
    constructor() {
        // Get canvas element
        this.canvas = document.getElementById('canvas');
        
        // Initialize Three.js renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Initialize subsystems
        this.camera = new CameraController(this.canvas);
        this.sceneManager = new SceneManager();
        this.shaderManager = new ShaderManager();
        this.ui = new UIManager();
        this.gameState = new GameState();
        
        // Timing
        this.clock = new THREE.Clock();
        this.deltaTime = 0;
        

        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize game
        this.init();
    }
    
    async init() {
        console.log('Initializing Flocking Frenzy...');
        console.log('Three.js Revision:', THREE.REVISION);
        
        try {
            // Load shaders
            await this.shaderManager.loadShaders();
            console.log('✓ Shaders loaded');
            
            // Initialize scene with default shader
            await this.sceneManager.init(this.shaderManager);
            console.log('✓ Scene initialized');
            
            // Spawn fish school
            this.sceneManager.spawnFishSchool(80);
            
            // Create bait (goal)
            this.sceneManager.createBait(new THREE.Vector3(15, 3, 0));
            
            // Add test obstacles for fish to avoid
            this.sceneManager.addObstacle(new THREE.Vector3(5, 3, 0), 1.5);
            this.sceneManager.addObstacle(new THREE.Vector3(10, 4, 5), 1.0);
            this.sceneManager.addObstacle(new THREE.Vector3(8, 2, -3), 1.2);
            
            // Setup UI
            this.ui.init(this.gameState);
            console.log('✓ UI initialized');
            
            // Start render loop
            this.animate();
            console.log('✓ Render loop started');
            
            console.log('Flocking Frenzy initialized successfully!');
            console.log('Press H for help');
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', this.onWindowResize);
        
        // Keyboard input
        window.addEventListener('keydown', this.onKeyDown);
        
        // UI events will be handled by UIManager
    }
    
    onWindowResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.updateAspect(width / height);
        this.renderer.setSize(width, height);
    }
    
    onKeyDown = (event) => {
        switch (event.key.toLowerCase()) {
            case 'h':
                // Toggle help menu
                this.ui.toggleHelp();
                break;
            case 'p':
                this.gameState.togglePause();
                break;
            case '1':
                // Switch to Phong shader
                this.shaderManager.setActiveShader('phong');
                this.sceneManager.updateShader(this.shaderManager);
                console.log('Switched to Phong shader (realistic lighting)');
                break;
                
            case '2':
                // Switch to Underwater shader
                this.shaderManager.setActiveShader('underwater');
                this.sceneManager.updateShader(this.shaderManager);
                console.log('Switched to Underwater shader (stylized)');
                break;
                
            case 'n':
                // Animate camera to team names scene
                this.camera.animateToNamesScene();
                break;
        }
        
        // Pass keyboard events to camera controller
        this.camera.onKeyDown(event);
    }
    
    update(deltaTime) {
        
        // Update camera
        this.camera.update(deltaTime);
        
        // Update scene (fish, predators, etc.)
        if (!this.gameState.paused) {
            this.sceneManager.update(deltaTime);
        }
        
        // Update game state
        this.gameState.update(deltaTime);
        
        // Update UI
        this.ui.update(this.gameState);
        
        // Update shader uniforms
        this.shaderManager.updateUniforms(
            this.camera.camera,
            this.sceneManager.lights,
            deltaTime
        );
    }
    
    render() {
        this.renderer.render(this.sceneManager.scene, this.camera.camera);
    }
    
    animate = () => {
        requestAnimationFrame(this.animate);
        
        this.deltaTime = this.clock.getDelta();
        
        this.update(this.deltaTime);
        this.render();
    }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new FlockingFrenzy();
});
