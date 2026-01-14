// Phong Lighting Fragment Shader (Realistic Lighting)

precision mediump float;

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
uniform float materialShininess;

// Texture support
uniform sampler2D map;
uniform bool hasTexture;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vPosition);

    // 1. Initialize Accumulators
    // We sum up all light contributions before applying material colors
    vec3 totalDiffuse = vec3(0.0);
    vec3 totalSpecular = vec3(0.0);

    // 2. Ambient Light
    totalDiffuse += ambientColor * ambientIntensity;

    // 3. Directional Light (Blinn-Phong)
    vec3 lightDir = normalize(-directionalLightDir);
    float diffFactor = max(dot(normal, lightDir), 0.0);
    
    // FIX: Add to accumulator
    totalDiffuse += directionalLightColor * directionalLightIntensity * diffFactor;

    // Specular
    vec3 halfDir = normalize(lightDir + viewDir);
    float specFactor = pow(max(dot(normal, halfDir), 0.0), materialShininess);
    
    // FIX: Add Intensity here too, and add to specular accumulator
    totalSpecular += directionalLightColor * directionalLightIntensity * specFactor;

    // 4. Spotlight
    if (spotLightEnabled) {
        vec3 lightToFrag = vPosition - spotLightPosition;
        float distance = length(lightToFrag);
        
        // Attenuation (Same caution as before regarding scale constants)
        float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);

        vec3 spotDir = normalize(lightToFrag);
        float theta = dot(spotDir, normalize(spotLightDirection));
        float outerCone = cos(spotLightAngle + spotLightPenumbra);
        float innerCone = cos(spotLightAngle);
        float epsilon = innerCone - outerCone;
        float intensity = clamp((theta - outerCone) / epsilon, 0.0, 1.0);

        if (intensity > 0.0) {
            vec3 spotLightDir = normalize(-lightToFrag);
            
            // Spot Diffuse
            float spotDiffuseFactor = max(dot(normal, spotLightDir), 0.0);
            // FIX: Add to Diffuse Accumulator (This will get colored by texture later)
            totalDiffuse += spotLightColor * spotLightIntensity * intensity * attenuation * spotDiffuseFactor;

            // Spot Specular
            vec3 spotHalfDir = normalize(spotLightDir + viewDir);
            float spotSpecFactor = pow(max(dot(normal, spotHalfDir), 0.0), materialShininess);
            // FIX: Add to Specular Accumulator (This stays white/light colored)
            totalSpecular += spotLightColor * spotLightIntensity * intensity * attenuation * spotSpecFactor;
        }
    }

    // 5. Material / Texture Sampling
    vec3 albedo = materialColor;
    if (hasTexture) {
        vec4 texColor = texture2D(map, vUv);
        albedo = texColor.rgb * materialColor;
    }

    // 6. Final Combination
    // Standard Lighting Equation: (Diffuse * Albedo) + Specular
    vec3 finalColor = (totalDiffuse * albedo) + totalSpecular;

    vec3 correctedColor = pow(finalColor, vec3(1.0 / 2.2));

    // gamma corrected
    gl_FragColor = vec4(correctedColor, 1.0);
    //gl_FragColor = vec4(finalColor, 1.0);
}