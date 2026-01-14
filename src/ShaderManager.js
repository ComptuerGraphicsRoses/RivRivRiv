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
                uniforms: null,
                materials: [] // Track all created materials for this shader
            },
            toon: {
                vertex: null,
                fragment: null,
                material: null,
                uniforms: null,
                materials: [] // Track all created materials for this shader
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
            ambientColor: { value: new THREE.Color(0x7296DD) },
            ambientIntensity: { value: 1.5 },

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
            spotLightEnabled: { value: false },

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
            ambientColor: { value: new THREE.Color(0x7296DD) },
            ambientIntensity: { value: 1.5 },

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
            spotLightEnabled: { value: false },

            // Material properties
            materialColor: { value: new THREE.Color(0xffffff) },
            materialShininess: { value: 4.0 },

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

        const material = new THREE.ShaderMaterial({
            vertexShader: shader.vertex,
            fragmentShader: shader.fragment,
            uniforms: uniforms,
            side: THREE.DoubleSide
        });

        // Track this material so we can update its uniforms later
        shader.materials.push(material);

        return material;
    }

    updateUniforms = (camera, lights, deltaTime) => {
        this.time += deltaTime;

        // Helper function to update uniforms for a shader and all its materials
        const updateShaderUniforms = (shader, lights) => {
            if (!shader.uniforms) return;

            // Prepare uniform updates
            const updates = {};

            // Sync ambient light
            if (lights.ambient) {
                updates.ambientColor = lights.ambient.color;
                updates.ambientIntensity = lights.ambient.intensity;
            }

            // Sync directional light
            if (lights.directional) {
                updates.directionalLightDir = lights.directional.position.clone().normalize();
                updates.directionalLightColor = lights.directional.color;
                updates.directionalLightIntensity = lights.directional.intensity;
            }

            // Sync spotlight
            if (lights.spotlight) {
                updates.spotLightEnabled = true;
                updates.spotLightPosition = lights.spotlight.position;
                updates.spotLightColor = lights.spotlight.color;
                updates.spotLightIntensity = lights.spotlight.intensity;

                const targetDir = new THREE.Vector3();
                targetDir.subVectors(
                    lights.spotlight.target.position,
                    lights.spotlight.position
                ).normalize();
                updates.spotLightDirection = targetDir;
            }
            else {
                updates.spotLightEnabled = false;
            }

            // Apply updates to base uniforms
            for (const [key, value] of Object.entries(updates)) {
                if (shader.uniforms[key]) {
                    if (value instanceof THREE.Color || value instanceof THREE.Vector3) {
                        shader.uniforms[key].value.copy(value);
                    } else {
                        shader.uniforms[key].value = value;
                    }
                }
            }

            // Apply updates to all tracked materials
            shader.materials.forEach(material => {
                if (!material.uniforms) return;

                for (const [key, value] of Object.entries(updates)) {
                    if (material.uniforms[key]) {
                        if (value instanceof THREE.Color || value instanceof THREE.Vector3) {
                            material.uniforms[key].value.copy(value);
                        } else {
                            material.uniforms[key].value = value;
                        }
                    }
                }
            });
        };

        // Update Phong shader and all its materials
        updateShaderUniforms(this.shaders.phong, lights);

        // Update Toon shader and all its materials
        updateShaderUniforms(this.shaders.toon, lights);
    }
}
