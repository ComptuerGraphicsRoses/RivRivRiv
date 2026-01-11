# Flocking Frenzy

**BBM 412 Computer Graphics - 2025 Fall**  
**Project:** Underwater Boids Simulation & Puzzle Game

## Quick Start

### Requirements
- Modern web browser with WebGL 2.0 support (Chrome, Firefox, Edge)
- Node.js (for local development server)

### Running the Project

1. Start a local server:
```bash
cd /home/zerohidz/TEMP_DEV/RivRivRiv
npx serve .
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

### Controls

#### Camera Movement (FPS)
- `W` / `A` / `S` / `D` - Move horizontally
- `Space` - Move up
- `Shift` - Move down
- `Mouse` - Look around (click to capture pointer)
- `ESC` - Release pointer lock

#### General
- `H` - Toggle help menu
- `1` - Switch to Phong shader (realistic lighting)
- `2` - Switch to Underwater shader (stylized NPR)
- `N` - View team member names

### Project Structure

```
RivRivRiv/
├── index.html              # Main HTML with Three.js import map
├── styles.css              # Global CSS for UI and canvas
├── src/                    # JavaScript modules
│   ├── main.js            # Entry point & render loop
│   ├── Camera.js          # FPS camera controller (6 DOF)
│   ├── Scene.js           # Scene management & lighting
│   ├── ShaderManager.js   # GLSL shader loading & switching
│   ├── UI.js              # HUD and interface management
│   ├── GameState.js       # Game state & scoring logic
│   ├── Fish.js            # Fish entity (TODO)
│   ├── FlockingSystem.js  # Boids algorithm (TODO)
│   ├── Predator.js        # Shark AI (TODO)
│   ├── Objects.js         # Placeable objects (TODO)
│   └── Level.js           # Level loading (TODO)
├── shaders/               # GLSL shader files
│   ├── phong.vert.glsl    # Phong vertex shader
│   ├── phong.frag.glsl    # Phong fragment shader
│   ├── underwater.vert.glsl  # Underwater vertex shader
│   └── underwater.frag.glsl  # Underwater fragment shader
├── assets/                # Resources (TODO)
│   ├── models/
│   ├── textures/
│   └── levels/
└── docs/                  # Documentation
    ├── SRS.md            # Software Requirements Specification
    ├── FINAL_GOAL.md     # BBM 412 requirements
    └── NEW_ARCHITECTURE.md  # Architecture documentation (TODO)
```

## Technology Stack

- **Three.js v0.170.0** - 3D rendering library (via CDN)
- **WebGL 2.0** - Graphics API
- **GLSL ES 3.00** - Shader language
- **JavaScript ES6+** - Application logic
- **HTML5 / CSS3** - UI and layout

## BBM 412 Requirements Status

✅ = Implemented | 🚧 = In Progress | ⬜ = TODO

- ✅ WebGL 2.x + JavaScript + GLSL + HTML
- ✅ No game engines (using library for abstraction)
- ✅ Fully 3D scene
- ✅ 6 DOF camera (FPS mode)
- ✅ At least 2 shader programs (Phong + Underwater)
- ✅ Runtime shader switching (1 and 2 keys)
- ✅ GLSL files separate (4 files)
- ✅ Help menu (H key toggle)
- 🚧 Scoring system (basic implementation)
- 🚧 Team names as 3D objects (placeholder)
- 🚧 Animated camera transition (basic implementation)
- ⬜ 3+ different object morphologies
- ⬜ 3+ movable/transformable objects (6 DOF)
- ⬜ Spotlight with 6 DOF + intensity control
- ⬜ Boids flocking algorithm
- ⬜ Fish school (100+ entities)
- ⬜ Predator AI
- ⬜ Level system

## Development Status

### Current Phase: Base Structure Setup ✅

The basic codebase structure is now complete with:
- Three.js integration via CDN
- Modular JavaScript architecture
- Shader system with 2 distinct programs
- FPS camera with pointer lock
- HUD and UI framework
- Basic scene with test geometry

### Next Steps

1. Implement boids flocking algorithm
2. Create fish entity and school system
3. Add predator AI behavior
4. Implement placeable objects (rocks, bait, etc.)
5. Create level system
6. Add team names 3D scene
7. Polish shaders and lighting
8. Performance optimization

## Team Members

- [Team member names to be added]

## License

Academic project for BBM 412 - Not for commercial use
