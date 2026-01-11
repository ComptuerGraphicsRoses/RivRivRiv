# Flocking Frenzy - Architecture Documentation

**Three.js Modular Codebase Architecture**  
**BBM 412 Computer Graphics Project - 2025 Fall**

## Overview

This document describes the architectural design of the Flocking Frenzy project, built with Three.js using a CDN-based, modular approach. The codebase is organized to meet all BBM 412 requirements while maintaining separation of concerns and extensibility.

## Technology Decisions

### Why Three.js via CDN?

- **No build tools required** - Simplifies development workflow
- **ES6 modules** - Modern JavaScript with import/export
- **Import maps** - Clean dependency management
- **Fast iteration** - No compilation step

### Core Libraries

- **Three.js v0.170.0** - WebGL abstraction and 3D utilities
- **Pure JavaScript ES6+** - No frameworks, maximum control
- **Custom GLSL shaders** - Manual shader programming for BBM 412

## Architecture Principles

1. **Modular Design** - Each system in separate file
2. **Single Responsibility** - Classes focused on one task
3. **Event-Driven** - Communication via events and callbacks
4. **Data-Oriented** - Efficient update loops for performance

## Module Organization

```
┌─────────────────────────────────────────────────────┐
│                     main.js                         │
│  Entry Point - Orchestrates all subsystems          │
│  - Renderer initialization                          │
│  - Main update/render loop                          │
│  - Event coordination                               │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────┴───────┬──────────┬──────────┬─────────┐
       │               │          │          │         │
       ▼               ▼          ▼          ▼         ▼
┌──────────┐   ┌──────────┐  ┌────────┐  ┌────┐  ┌────────┐
│ Camera   │   │  Scene   │  │ Shader │  │ UI │  │  Game  │
│ (6 DOF)  │   │ Manager  │  │Manager │  │Mgr │  │ State  │
└──────────┘   └──────────┘  └────────┘  └────┘  └────────┘
     │               │            │         │         │
     │         ┌─────┴─────┐      │         │         │
     │         │           │      │         │         │
     │         ▼           ▼      │         │         │
     │    ┌────────┐  ┌───────┐  │         │         │
     │    │ Fish   │  │Predator│  │         │         │
     │    │(Boids) │  │  (AI)  │  │         │         │
     │    └────────┘  └───────┘  │         │         │
     │         │           │      │         │         │
     └─────────┴───────────┴──────┴─────────┴─────────┘
                         │
                    ┌────┴────┐
                    │ Shaders │
                    │ (GLSL)  │
                    └─────────┘
```

## Core Modules

### 1. main.js - Application Entry Point

**Responsibilities:**
- Initialize Three.js renderer
- Coordinate all subsystems
- Main render loop (60 FPS)
- Global event handling

**Key Code:**
```javascript
class FlockingFrenzy {
    constructor() {
        this.renderer = new THREE.WebGLRenderer(...)
        this.camera = new CameraController(...)
        this.sceneManager = new SceneManager()
        this.shaderManager = new ShaderManager()
        // ...
    }
    
    animate() {
        requestAnimationFrame(this.animate)
        this.update(deltaTime)
        this.render()
    }
}
```

### 2. Camera.js - FPS Camera Controller

**BBM 412 Requirements:**
- ✅ 6 DOF movement (3 translation + 3 rotation)
- ✅ Smooth camera transition to names scene

**Features:**
- WASD + Space/Shift movement
- Mouse look with pointer lock
- Animated transitions (ease-in-out)
- State saving/restoration

**Movement System:**
```javascript
// Translation axes: X, Y, Z
moveForward/Backward  // Z-axis
moveLeft/Right        // X-axis
moveUp/Down          // Y-axis

// Rotation axes: Pitch, Yaw (Roll not needed for FPS)
pitch  // X rotation (look up/down)
yaw    // Y rotation (look left/right)
```

### 3. Scene.js - Scene Management

**Responsibilities:**
- Three.js scene initialization
- Lighting setup (ambient, directional, spotlight)
- Object hierarchy management
- Update all scene objects

**Lighting Configuration:**
```javascript
- Ambient Light    → Base illumination
- Directional Light → Sun/main light source
- Spotlight        → BBM 412 required, 6 DOF controllable
```

### 4. ShaderManager.js - Shader System

**BBM 412 Requirements:**
- ✅ At least 2 shader programs
- ✅ GLSL source files separate (4 files minimum)
- ✅ Runtime switching between shaders
- ✅ Shaders affect entire scene

**Shader Programs:**

**1. Phong Shader (Realistic Lighting)**
- `phong.vert.glsl` + `phong.frag.glsl`
- Blinn-Phong lighting model
- Ambient + Diffuse + Specular components
- Directional light + Spotlight support
- Attenuation for spotlight

**2. Underwater Shader (NPR - Stylized)**
- `underwater.vert.glsl` + `underwater.frag.glsl`
- Vertex displacement (wave effect)
- Procedural caustics (noise-based)
- Depth fog (blue-teal gradient)
- Color grading for underwater atmosphere

**Switching Mechanism:**
```javascript
// Key press → setActiveShader() → updateMaterials()
'1' key → Phong shader
'2' key → Underwater shader
```

### 5. UI.js - User Interface Manager

**Components:**
- HUD (score, timer, survival %)
- Help menu (H key toggle)
- Inventory panel (preparation phase)
- Object transform controls
- Game control buttons

**Update Flow:**
```
GameState → UI.update() → DOM manipulation
```

### 6. GameState.js - Game Logic

**Game Phases:**
```
PREPARATION → SIMULATION → EVALUATION
     ↓             ↓            ↓
  Place items   Run boids   Check win/lose
```

**Scoring System:**
```javascript
Starting: 100 points
- Fish death:  -10 points each
- Time penalty: -0.5 points/second
+ Win bonus:   +50 points
```

## Shader Pipeline

### Uniform Data Flow

```
Camera Position  ─┐
Light Positions  ─┤
Light Colors     ─┼→ ShaderManager.updateUniforms()
Time (animation) ─┤      ↓
Material Props   ─┘   GPU Uniforms → Vertex Shader → Fragment Shader
                           ↓
                      Rendered Frame
```

### Shader Uniforms

**Phong Shader:**
```glsl
uniform vec3 ambientColor;
uniform vec3 directionalLightDir;
uniform vec3 spotLightPosition;
uniform vec3 cameraPosition;
uniform float materialShininess;
// ... etc
```

**Underwater Shader:**
```glsl
uniform float time;              // Animation
uniform float waveAmplitude;     // Wave displacement
uniform vec3 waterColor;         // Color grading
uniform float causticStrength;   // Caustic intensity
uniform float fogDensity;        // Depth fog
```

## Future Systems (TODO)

### Fish.js - Boids Entity
```javascript
class Fish {
    position: Vector3
    velocity: Vector3
    acceleration: Vector3
    
    applyBehaviors() {
        separation()
        alignment()
        cohesion()
        seekGoal()
        avoidObstacles()
    }
}
```

### FlockingSystem.js - Boids Algorithm
```javascript
class FlockingSystem {
    fish: Fish[]
    
    update(deltaTime) {
        for each fish {
            neighbors = findNeighbors()
            forces = calculateForces(neighbors)
            fish.applyForces(forces)
            fish.updatePosition(deltaTime)
        }
    }
}
```

### Predator.js - AI Behavior
```javascript
class Predator {
    target: Fish | null
    
    update() {
        target = findNearestFish()
        steerToward(target)
        checkCapture()
    }
}
```

### Objects.js - Placeable Items
```javascript
class Rock extends PlaceableObject { }
class SpikedRock extends PlaceableObject { }
class Bait extends PlaceableObject { }
class Current extends PlaceableObject { }
```

## Performance Considerations

### Target Performance
- **60 FPS** with 100 fish
- **WebGL instancing** for fish rendering
- **Spatial partitioning** for neighbor queries (octree/grid)
- **Frustum culling** for off-screen objects

### Optimization Strategies

1. **Efficient Boids Algorithm**
   - Spatial hashing for neighbor detection
   - Early-exit conditions
   - Update budget per frame

2. **Rendering**
   - InstancedMesh for fish school
   - Level of Detail (LOD) for distant objects
   - Batch draw calls

3. **Memory**
   - Object pooling for particles
   - Reuse geometries and materials
   - Minimize uniform updates

## BBM 412 Compliance Checklist

### ✅ Currently Implemented
- [x] WebGL 2.x + JavaScript + GLSL + HTML
- [x] 6 DOF camera (FPS controller)
- [x] 2+ shader programs (Phong + Underwater)
- [x] Separate GLSL files (4 files)
- [x] Runtime shader switching
- [x] Help menu (H key)
- [x] Basic scene structure
- [x] Scoring framework

### 🚧 In Progress
- [ ] 3+ different object morphologies
- [ ] 3+ movable objects (6 DOF transform)
- [ ] Spotlight with UI controls (6 DOF + intensity)
- [ ] Team names as 3D objects
- [ ] Animated camera transition to names

### ⬜ TODO
- [ ] Boids flocking algorithm
- [ ] Fish school (100+ entities)
- [ ] Predator AI
- [ ] Placeable objects (rocks, bait, etc.)
- [ ] Level system
- [ ] Win/lose evaluation

## Development Workflow

### Adding New Features

1. **Plan** - Design module interface
2. **Implement** - Create .js file in `/src`
3. **Integrate** - Import in main.js
4. **Test** - Verify in browser console
5. **Document** - Update this file

### Debugging Tips

- Use `console.log()` liberally
- Check browser console for errors
- Verify shader compilation (check warnings)
- Use Three.js helpers (AxesHelper, SpotLightHelper)
- Monitor FPS with stats.js (optional)

### Git Workflow

```bash
# Feature branch
git checkout -b feature/boids-algorithm

# Implement and commit
git add src/FlockingSystem.js
git commit -m "feat: implement boids flocking algorithm"

# Merge to main
git checkout main
git merge feature/boids-algorithm
```

## File Organization Summary

```
RivRivRiv/
├── index.html                 # Entry point with import map
├── styles.css                 # Global styles
├── src/                       # JavaScript modules
│   ├── main.js               # ✅ Application orchestrator
│   ├── Camera.js             # ✅ FPS camera (6 DOF)
│   ├── Scene.js              # ✅ Scene & lighting
│   ├── ShaderManager.js      # ✅ Shader switching
│   ├── UI.js                 # ✅ HUD & controls
│   ├── GameState.js          # ✅ Game logic
│   ├── Fish.js               # ⬜ TODO
│   ├── FlockingSystem.js     # ⬜ TODO
│   ├── Predator.js           # ⬜ TODO
│   ├── Objects.js            # ⬜ TODO
│   └── Level.js              # ⬜ TODO
├── shaders/                   # GLSL shaders
│   ├── phong.vert.glsl       # ✅ Phong vertex
│   ├── phong.frag.glsl       # ✅ Phong fragment
│   ├── underwater.vert.glsl  # ✅ Underwater vertex
│   └── underwater.frag.glsl  # ✅ Underwater fragment
├── assets/                    # Resources
│   ├── models/               # ⬜ 3D models
│   ├── textures/             # ⬜ Textures
│   └── levels/               # ⬜ Level JSON files
└── docs/                      # Documentation
    ├── SRS.md                # Requirements spec
    ├── FINAL_GOAL.md         # BBM 412 requirements
    └── NEW_ARCHITECTURE.md   # ✅ This file
```

---

**Document Status:** Complete  
**Last Updated:** 2026-01-11  
**Author:** Development Team
