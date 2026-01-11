// Underwater Stylized Vertex Shader (NPR - Non-Photorealistic Rendering)

uniform float time;
uniform float waveAmplitude;
uniform float waveFrequency;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;

void main() {
    // Transform normal to world space
    vNormal = normalize(normalMatrix * normal);
    
    // Apply wave displacement for underwater effect
    vec3 displacedPosition = position;
    float wave = sin(position.x * waveFrequency + time) * cos(position.z * waveFrequency + time);
    displacedPosition.y += wave * waveAmplitude;
    
    // Transform position to world space
    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vPosition = worldPosition.xyz;
    
    // Calculate depth (distance from camera)
    vec4 viewPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
    vDepth = -viewPosition.z;
    
    // Pass UV coordinates
    vUv = uv;
    
    // Final vertex position in clip space
    gl_Position = projectionMatrix * viewPosition;
}
