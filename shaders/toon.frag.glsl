// Toon/Cel-Shading Fragment Shader

precision mediump float;

// Lighting uniforms
uniform vec3 ambientColor;
uniform float ambientIntensity;

uniform vec3 directionalLightDir;
uniform vec3 directionalLightColor;
uniform float directionalLightIntensity;

uniform vec3 spotLightPosition;
uniform vec3 spotLightDirection;
uniform vec3 spotLightColor;
uniform float spotLightIntensity;
uniform float spotLightAngle;
uniform float spotLightPenumbra;
uniform bool spotLightEnabled;

// Three.js built-in: cameraPosition
uniform vec3 materialColor;

// Texture support
uniform sampler2D map;
uniform bool hasTexture;

// Toon shading parameters
uniform float toonLevels; // Number of discrete shading levels (default: 4.0)

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vPosition);
    
    // Sample texture if available
    vec3 baseColor = materialColor;
    if (hasTexture) {
        vec4 texColor = texture2D(map, vUv);
        baseColor = texColor.rgb * materialColor;
    }
    
    // Ambient light
    vec3 ambient = ambientColor * ambientIntensity;
    
    // Directional light (cel-shaded)
    vec3 lightDir = normalize(-directionalLightDir);
    float diffuseFactor = max(dot(normal, lightDir), 0.0);
    
    // Quantize diffuse factor into discrete levels (cel-shading effect)
    diffuseFactor = floor(diffuseFactor * toonLevels) / toonLevels;
    
    vec3 diffuse = directionalLightColor * directionalLightIntensity * diffuseFactor;
    
    // Spotlight contribution (cel-shaded)
    vec3 spotContribution = vec3(0.0);
    if (spotLightEnabled) {
        vec3 lightToFrag = vPosition - spotLightPosition;
        float distance = length(lightToFrag);
        vec3 spotDir = normalize(lightToFrag);
        
        // Spotlight cone angle calculation
        float theta = dot(spotDir, normalize(spotLightDirection));
        float outerCone = cos(spotLightAngle + spotLightPenumbra);
        float innerCone = cos(spotLightAngle);
        float epsilon = innerCone - outerCone;
        float intensity = clamp((theta - outerCone) / epsilon, 0.0, 1.0);
        
        if (intensity > 0.0) {
            // Attenuation (quadratic falloff)
            float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);
            
            // Spotlight diffuse
            vec3 spotLightDir = normalize(-lightToFrag);
            float spotDiffuse = max(dot(normal, spotLightDir), 0.0);
            
            // Quantize spotlight diffuse for toon effect
            spotDiffuse = floor(spotDiffuse * toonLevels) / toonLevels;
            
            spotContribution = spotLightColor * spotLightIntensity * intensity * attenuation * spotDiffuse;
        }
    }
    
    // Rim lighting for toon effect (optional enhancement)
    float rimAmount = 1.0 - max(dot(viewDir, normal), 0.0);
    rimAmount = smoothstep(0.6, 1.0, rimAmount);
    vec3 rim = vec3(1.0) * rimAmount * 0.3;
    
    // Combine lighting with base color
    vec3 finalColor = baseColor * (ambient + diffuse) + spotContribution + rim;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
