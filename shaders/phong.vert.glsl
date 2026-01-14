// Phong Lighting Vertex Shader (Realistic Lighting)
// Three.js built-in uniforms: modelMatrix, modelViewMatrix, projectionMatrix, normalMatrix
// Three.js built-in attributes: position, normal, uv

// Varying outputs
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
    // Transform normal to world space
    vNormal = normalize(normalMatrix * normal);
    
    // Transform position to world space
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPosition = worldPosition.xyz;
    
    // Pass UV coordinates
    vUv = uv;
    
    // Final vertex position in clip space
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
