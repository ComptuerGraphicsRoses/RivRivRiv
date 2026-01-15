// Underwater Fragment Shader
// Features: Depth Fog + Color Grading
precision mediump float;

// --- UNIFORMS ---
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

uniform vec3 materialColor;
uniform float materialShininess;

uniform sampler2D map;
uniform bool hasTexture;

// Underwater specific uniforms
uniform vec3 waterColor;       // Deep water color (teal/blue)
uniform vec3 shallowColor;     // Shallow water tint
uniform float fogDensity;      // How quickly fog builds up
uniform float fogStart;        // Distance where fog starts
uniform float fogEnd;          // Distance where fog is complete
uniform float colorShift;      // Amount of color grading (0-1)

// --- VARYINGS ---
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vPosition);

    // 1. Initialize Light Accumulator
    vec3 totalLight = vec3(0.0);

    // 2. Ambient Light (slightly boosted underwater for visibility)
    totalLight += ambientColor * ambientIntensity;

    // 3. Directional Light (Blinn-Phong)
    vec3 lightDir = normalize(-directionalLightDir);
    float NdotL = max(dot(normal, lightDir), 0.0);
    totalLight += directionalLightColor * directionalLightIntensity * NdotL;

    // Specular (Blinn-Phong)
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float specular = pow(NdotH, materialShininess);
    vec3 specularColor = directionalLightColor * directionalLightIntensity * specular * 0.5;

    // 4. Spotlight
    if (spotLightEnabled) {
        vec3 lightToFrag = vPosition - spotLightPosition;
        float distance = length(lightToFrag);
        
        // Attenuation
        float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);

        vec3 spotDir = normalize(lightToFrag);
        float theta = dot(spotDir, normalize(spotLightDirection));
        float outerCone = cos(spotLightAngle + spotLightPenumbra);
        float innerCone = cos(spotLightAngle);
        float epsilon = innerCone - outerCone;
        float intensity = clamp((theta - outerCone) / epsilon, 0.0, 1.0);

        if (intensity > 0.0) {
            vec3 spotLightDir = normalize(-lightToFrag);
            float spotNdotL = max(dot(normal, spotLightDir), 0.0);
            totalLight += spotLightColor * spotLightIntensity * intensity * attenuation * spotNdotL;
        }
    }

    // 5. Material / Texture Sampling
    vec3 albedo = materialColor;
    if (hasTexture) {
        vec4 texColor = texture2D(map, vUv);
        albedo = texColor.rgb * materialColor;
    }

    // 6. Combine lighting with albedo
    vec3 litColor = (totalLight * albedo) + specularColor;

    // ========== UNDERWATER EFFECTS ==========

    // 7. Color Grading - shift colors towards underwater tones
    // Reduce reds, enhance blues/greens
    vec3 gradedColor = litColor;
    gradedColor.r *= (1.0 - colorShift * 0.4); // Reduce red (absorbed by water)
    gradedColor.g *= (1.0 - colorShift * 0.1); // Slightly reduce green
    gradedColor.b *= (1.0 + colorShift * 0.2); // Boost blue
    
    // Mix with shallow water tint
    gradedColor = mix(gradedColor, gradedColor * shallowColor, colorShift * 0.3);

    // 8. Depth Fog - use world-space distance from camera
    float distanceFromCamera = length(cameraPosition - vPosition);
    float fogFactor = smoothstep(fogStart, fogEnd, distanceFromCamera);
    fogFactor = clamp(fogFactor * fogDensity, 0.0, 1.0);
    
    // Mix scene color with deep water fog color
    vec3 finalColor = mix(gradedColor, waterColor, fogFactor);

    // 9. Gamma correction
    vec3 correctedColor = pow(finalColor, vec3(1.0 / 2.2));

    gl_FragColor = vec4(correctedColor, 1.0);
}

