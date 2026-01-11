// Underwater Stylized Fragment Shader (NPR - Non-Photorealistic Rendering)

uniform float time;
uniform vec3 waterColor;
uniform vec3 deepWaterColor;
uniform float fogDensity;
uniform float causticStrength;
uniform float causticScale;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;

// Procedural noise function for caustics
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Caustics pattern
float caustics(vec2 uv, float time) {
    vec2 p = uv * causticScale;
    float n1 = noise(p + vec2(time * 0.5, time * 0.3));
    float n2 = noise(p * 2.0 - vec2(time * 0.4, time * 0.6));
    float n3 = noise(p * 4.0 + vec2(time * 0.2, -time * 0.5));
    
    return (n1 + n2 * 0.5 + n3 * 0.25) / 1.75;
}

void main() {
    vec3 normal = normalize(vNormal);
    
    // Calculate caustic light pattern
    vec2 causticUV = vPosition.xz * 0.1;
    float causticPattern = caustics(causticUV, time);
    causticPattern = pow(causticPattern, 3.0); // Sharpen the pattern
    vec3 causticColor = vec3(0.7, 0.9, 1.0) * causticPattern * causticStrength;
    
    // Depth-based fog (gradient from shallow to deep water)
    float fogFactor = 1.0 - exp(-vDepth * fogDensity);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    
    // Base color with blue-teal gradient
    vec3 baseColor = mix(vec3(0.2, 0.6, 0.8), vec3(0.1, 0.3, 0.5), fogFactor);
    
    // Simple lighting (fresnel-like effect)
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    vec3 fresnelColor = mix(baseColor, vec3(0.5, 0.8, 1.0), fresnel * 0.3);
    
    // Combine base color with caustics
    vec3 finalColor = fresnelColor + causticColor;
    
    // Apply depth fog (fade to deep water color)
    finalColor = mix(finalColor, deepWaterColor, fogFactor * 0.6);
    
    // Color grading for underwater atmosphere (boost blue/cyan channels)
    finalColor.r *= 0.7;
    finalColor.g *= 0.9;
    finalColor.b *= 1.2;
    
    // Slight brightness variation based on depth
    finalColor *= (1.0 - fogFactor * 0.4);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
