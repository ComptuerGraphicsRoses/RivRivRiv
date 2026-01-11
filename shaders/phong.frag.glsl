// Phong Lighting Fragment Shader (Realistic Lighting)

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

uniform vec3 cameraPosition;
uniform vec3 materialColor;
uniform float materialShininess;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vPosition);
    
    // Ambient light
    vec3 ambient = ambientColor * ambientIntensity;
    
    // Directional light (Blinn-Phong)
    vec3 lightDir = normalize(-directionalLightDir);
    float diffuseFactor = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = directionalLightColor * directionalLightIntensity * diffuseFactor;
    
    // Specular (Blinn-Phong)
    vec3 halfDir = normalize(lightDir + viewDir);
    float specFactor = pow(max(dot(normal, halfDir), 0.0), materialShininess);
    vec3 specular = directionalLightColor * specFactor;
    
    // Spotlight contribution
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
            
            // Spotlight specular
            vec3 spotHalfDir = normalize(spotLightDir + viewDir);
            float spotSpec = pow(max(dot(normal, spotHalfDir), 0.0), materialShininess);
            
            spotContribution = spotLightColor * spotLightIntensity * intensity * attenuation * (spotDiffuse + spotSpec * 0.5);
        }
    }
    
    // Combine all lighting
    vec3 finalColor = materialColor * (ambient + diffuse + specular) + spotContribution;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
