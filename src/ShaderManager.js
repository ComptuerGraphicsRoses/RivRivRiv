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
            toon: {
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

        // Load Toon shaders
        const toonVert = await this.loadShaderFile('./shaders/toon.vert.glsl');
        const toonFrag = await this.loadShaderFile('./shaders/toon.frag.glsl');

        this.shaders.toon.vertex = toonVert;
        this.shaders.toon.fragment = toonFrag;
        this.shaders.toon.uniforms = this.createToonUniforms();

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

            // Material properties
            materialColor: { value: new THREE.Color(0xffffff) },
            materialShininess: { value: 32.0 },

            // Texture support
            map: { value: null },
            hasTexture: { value: false }
        };
    }

    createToonUniforms = () => {
        return {
            // Lighting
            ambientColor: { value: new THREE.Color(0x404040) },
            ambientIntensity: { value: 1.0 },

            directionalLightDir: { value: new THREE.Vector3(1, -1, 1).normalize() },
            directionalLightColor: { value: new THREE.Color(0xffffff) },
            directionalLightIntensity: { value: 1.0 },

            // Material properties
            materialColor: { value: new THREE.Color(0xffffff) },

            // Toon shading parameters
            toonLevels: { value: 4.0 },

            // Texture support
            map: { value: null },
            hasTexture: { value: false }
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

    /**
     * Create a shader material for a specific shader type with optional texture
     * @param {string} shaderName - 'phong' or 'toon'
     * @param {THREE.Texture} texture - Optional texture to apply
     * @returns {THREE.ShaderMaterial} The created shader material
     */
    createShaderMaterial = (shaderName, texture = null) => {
        const shader = this.shaders[shaderName];
        if (!shader) {
            console.error('Unknown shader:', shaderName);
            return null;
        }

        // Clone uniforms to avoid sharing references
        const uniforms = THREE.UniformsUtils.clone(shader.uniforms);

        // Set texture if provided
        if (texture) {
            uniforms.map.value = texture;
            uniforms.hasTexture.value = true;
        }

        return new THREE.ShaderMaterial({
            vertexShader: shader.vertex,
            fragmentShader: shader.fragment,
            uniforms: uniforms,
            side: THREE.DoubleSide
        });
    }

    updateUniforms = (camera, lights, deltaTime) => {
        this.time += deltaTime;

        // Update Phong shader uniforms
        if (this.shaders.phong.uniforms) {
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

        // Update Toon shader uniforms
        if (this.shaders.toon.uniforms) {
            if (lights.directional) {
                this.shaders.toon.uniforms.directionalLightDir.value.copy(
                    lights.directional.position
                ).normalize();
            }
        }
    }
}
