// Toon/Cel-Shading Fragment Shader
precision mediump float;

// --- UNIFORMS (Unchanged) ---
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
// We can use shininess for the size of the toon specular highlight
uniform float materialShininess; 

uniform sampler2D map;
uniform bool hasTexture;

uniform float toonLevels; 

// --- VARYINGS ---
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vPosition);

    // 1. Initialize Light Accumulator
    // We accumulate pure light intensity first, just like Blinn-Phong
    vec3 totalLight = vec3(0.0);

    // 2. Ambient Light
    totalLight += ambientColor * ambientIntensity;

    // 3. Directional Light (The Main Fix)
    // FIX: Added the negative sign (-) to match your Blinn-Phong shader.
    // Without this, the light comes from behind the object.
    vec3 lightDir = normalize(-directionalLightDir); 
    
    float NdotL = max(dot(normal, lightDir), 0.0);
    
    // Toon Quantization (Stepping)
    // using floor() creates cleaner bands than ceil()
    float lightBand = floor(NdotL * toonLevels) / toonLevels;
    
    // Smooth the edge slightly to avoid aliasing artifacts (optional, keeps it crisp)
    float change = fwidth(NdotL);
    float smoothedBand = smoothstep(lightBand - change, lightBand + change, NdotL);
    
    // If you prefer hard edges, just use: float finalBand = lightBand;
    float dirIntensity = (lightBand > 0.0) ? 1.0 : 0.0; // Binary on/off or stepped
    
    // Let's use the stepped value for intensity
    totalLight += directionalLightColor * directionalLightIntensity * lightBand;

    // Optional: Toon Specular (uses materialShininess)
    // This adds a "dot" of gloss typical in anime/cartoons
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    // Use a sharp step for specular instead of a gradient
    float specThreshold = 1.0 - (0.1 / max(materialShininess * 0.01, 0.001)); 
    float specIntensity = step(0.98, NdotH); // Hard cutoff
    // Add specular to light (usually stylistic choice to add it here or at end)
    vec3 specularColor = directionalLightColor * directionalLightIntensity * specIntensity * 0.5;

    // 4. Spotlight
    if (spotLightEnabled) {
        vec3 lightToFrag = vPosition - spotLightPosition;
        float distance = length(lightToFrag);
        
        // Attenuation (Matches Blinn-Phong)
        float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);

        vec3 spotDir = normalize(lightToFrag);
        float theta = dot(spotDir, normalize(spotLightDirection));
        float outerCone = cos(spotLightAngle + spotLightPenumbra);
        float innerCone = cos(spotLightAngle);
        float epsilon = innerCone - outerCone;
        float intensity = clamp((theta - outerCone) / epsilon, 0.0, 1.0);

        if (intensity > 0.0) {
            // FIX: Match Blinn-Phong direction logic
            vec3 spotLightDir = normalize(-lightToFrag);
            float spotNdotL = max(dot(normal, spotLightDir), 0.0);
            
            // Toon Quantization for Spot
            float spotBand = floor(spotNdotL * toonLevels) / toonLevels;
            
            // Add to total light
            totalLight += spotLightColor * spotLightIntensity * intensity * attenuation * spotBand;
        }
    }

    // 5. Material / Texture Sampling
    vec3 albedo = materialColor;
    if (hasTexture) {
        vec4 texColor = texture2D(map, vUv);
        albedo = texColor.rgb * materialColor;
    }

    // 6. Rim Lighting (Optional stylistic addition)
    // Rim light makes 3D objects pop against the background in toon shading
    float rimDot = 1.0 - max(dot(viewDir, normal), 0.0);
    float rimThreshold = 0.9;
    float rimAmount = step(rimThreshold, rimDot); // Hard edge rim
    // Only apply rim on the dark side of the directional light
    float rimIntensity = rimAmount * (1.0 - NdotL) * 0.3; 
    vec3 rimColor = vec3(1.0) * rimIntensity;

    // 7. Final Combine
    // (Diffuse Light * Color) + Specular + Rim
    vec3 finalColor = (totalLight * albedo) + specularColor ;//+ rimColor;

    vec3 correctedColor = pow(finalColor, vec3(1.0 / 2.2));

    // gamma corrected
    gl_FragColor = vec4(correctedColor, 1.0);
    //gl_FragColor = vec4(finalColor, 1.0);
}