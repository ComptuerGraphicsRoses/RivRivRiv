/**
 * Shader Manager
 * Loads and manages GLSL shader programs with runtime switching
 */

import * as THREE from 'three';

export class ShaderManager {
    constructor() {
        this.shaders = {
            phong: {
                vertex: null,
                fragment: null,
                material: null,
                uniforms: null
            },
            underwater: {
                vertex: null,
                fragment: null,
                material: null,
                uniforms: null
            }
        };
        
        this.activeShader = 'phong';
        this.time = 0;
    }
    
    loadShaders = async () => {
        // Load Phong shaders
        const phongVert = await this.loadShaderFile('./shaders/phong.vert.glsl');
        const phongFrag = await this.loadShaderFile('./shaders/phong.frag.glsl');
        
        this.shaders.phong.vertex = phongVert;
        this.shaders.phong.fragment = phongFrag;
        this.shaders.phong.uniforms = this.createPhongUniforms();
        
        // Load Underwater shaders
        const underwaterVert = await this.loadShaderFile('./shaders/underwater.vert.glsl');
        const underwaterFrag = await this.loadShaderFile('./shaders/underwater.frag.glsl');
        
        this.shaders.underwater.vertex = underwaterVert;
        this.shaders.underwater.fragment = underwaterFrag;
        this.shaders.underwater.uniforms = this.createUnderwaterUniforms();
        
        console.log('All shaders loaded successfully');
    }
    
    loadShaderFile = async (path) => {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load shader: ${path}`);
            }
            return await response.text();
        } catch (error) {
            console.error('Shader loading error:', error);
            throw error;
        }
    }
    
    createPhongUniforms = () => {
        return {
            // Ambient light
            ambientColor: { value: new THREE.Color(0x404040) },
            ambientIntensity: { value: 1.0 },
            
            // Directional light
            directionalLightDir: { value: new THREE.Vector3(1, -1, 1).normalize() },
            directionalLightColor: { value: new THREE.Color(0xffffff) },
            directionalLightIntensity: { value: 1.0 },
            
            // Spotlight
            spotLightPosition: { value: new THREE.Vector3(0, 10, 0) },
            spotLightDirection: { value: new THREE.Vector3(0, -1, 0) },
            spotLightColor: { value: new THREE.Color(0xffffff) },
            spotLightIntensity: { value: 2.0 },
            spotLightAngle: { value: Math.PI / 6 },
            spotLightPenumbra: { value: 0.2 },
            spotLightEnabled: { value: true },
            
            // Camera
            cameraPosition: { value: new THREE.Vector3(0, 5, 10) },
            
            // Material properties
            materialColor: { value: new THREE.Color(0xffffff) },
            materialShininess: { value: 32.0 }
        };
    }
    
    createUnderwaterUniforms = () => {
        return {
            // Time for animation
            time: { value: 0.0 },
            
            // Wave parameters
            waveAmplitude: { value: 0.1 },
            waveFrequency: { value: 0.5 },
            
            // Water colors
            waterColor: { value: new THREE.Color(0x2a9fd6) },
            deepWaterColor: { value: new THREE.Color(0x0a3d5c) },
            
            // Fog
            fogDensity: { value: 0.02 },
            
            // Caustics
            causticStrength: { value: 1.5 },
            causticScale: { value: 2.0 },
            
            // Camera (needed for depth calculations)
            cameraPosition: { value: new THREE.Vector3(0, 5, 10) }
        };
    }
    
    setActiveShader = (shaderName) => {
        if (this.shaders[shaderName]) {
            this.activeShader = shaderName;
        } else {
            console.error('Unknown shader:', shaderName);
        }
    }
    
    getActiveMaterial = () => {
        const shader = this.shaders[this.activeShader];
        
        // Create material if not exists
        if (!shader.material) {
            shader.material = new THREE.ShaderMaterial({
                vertexShader: shader.vertex,
                fragmentShader: shader.fragment,
                uniforms: shader.uniforms,
                side: THREE.DoubleSide
            });
        }
        
        return shader.material;
    }
    
    updateUniforms = (camera, lights, deltaTime) => {
        this.time += deltaTime;
        
        // Update Phong shader uniforms
        if (this.shaders.phong.uniforms) {
            this.shaders.phong.uniforms.cameraPosition.value.copy(camera.position);
            
            if (lights.directional) {
                this.shaders.phong.uniforms.directionalLightDir.value.copy(
                    lights.directional.position
                ).normalize();
            }
            
            if (lights.spotlight) {
                this.shaders.phong.uniforms.spotLightPosition.value.copy(
                    lights.spotlight.position
                );
                
                const targetDir = new THREE.Vector3();
                targetDir.subVectors(
                    lights.spotlight.target.position,
                    lights.spotlight.position
                ).normalize();
                this.shaders.phong.uniforms.spotLightDirection.value.copy(targetDir);
            }
        }
        
        // Update Underwater shader uniforms
        if (this.shaders.underwater.uniforms) {
            this.shaders.underwater.uniforms.time.value = this.time;
            this.shaders.underwater.uniforms.cameraPosition.value.copy(camera.position);
        }
    }
}
