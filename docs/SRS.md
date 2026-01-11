# Software Requirements Specification (SRS)
# Flocking Frenzy – Underwater Survival Puzzle

**Course:** BBM 412 - Computer Graphics – 2025 Fall  
**Project Type:** WebGL 3D Game - AI & Games Theme  
**Genre/Mechanic:** Flocking Algorithm (Boids) - Learning to Play  
**Technology Stack:** WebGL 2.x Library, JavaScript, GLSL, HTML5  

---

## 1. Introduction

### 1.1 Purpose of the Document

This document defines the **complete functional and non-functional requirements** of the **Flocking Frenzy** project for **BBM 412 Computer Graphics Final Project**. The purpose is to provide a clear, unambiguous, and extensible specification that guides both implementation and evaluation against BBM 412 mandatory requirements.

### 1.2 Project Overview

**Flocking Frenzy** is a **3D puzzle-based simulation game** where the player guides a school of fish through environmental manipulation rather than direct control. The game is implemented using **WebGL 2.x** with custom **GLSL shaders**, **JavaScript**, and **HTML5**.

**Core Innovation:**  
The player does **not** directly control the fish. Instead, they **strategically place environmental objects** (rocks, currents, lights, predators, bait) during a preparation phase. Once the simulation starts, a **boids-based flocking algorithm** governs fish behavior, and the player can only observe the outcome.

### 1.3 Relationship to BBM 412 Requirements

This project is designed to meet **all mandatory BBM 412 requirements** including:
- WebGL-based 3D rendering with custom shaders
- Minimum 2 distinct shader programs with runtime switching
- 6 DOF camera movement (FPS camera)
- At least 3 different object morphologies
- Movable and transformable objects (6 DOF)
- Spotlight with 6 DOF control and intensity adjustment
- Scoring system
- Help menu (H key toggle)
- Group member names displayed as 3D objects with animated camera transition

### 1.4 Document Scope

This SRS covers:
- **Functional Requirements** (gameplay, UI, simulation, AI)
- **Non-Functional Requirements** (performance, quality, usability)
- **Technical Requirements** (shaders, rendering, libraries)
- **BBM 412 Compliance Matrix**

---

## 2. Game Concept and Design

### 2.1 High-Level Concept

**Genre:** 3D Puzzle, Simulation Strategy  
**Theme:** Underwater ecosystem manipulation  
**Objective:** Guide a school of fish from spawn to goal region while maximizing survival rate

### 2.2 Core Gameplay Loop

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PREPARATION PHASE                                        │
│    - Level loads with predefined inventory                 │
│    - Player uses FPS camera to place items in 3D space     │
│    - UI shows remaining inventory items                    │
│    - "Start Simulation" button disabled until all placed   │
├─────────────────────────────────────────────────────────────┤
│ 2. SIMULATION PHASE (max 20 seconds)                       │
│    - Fish school spawns and boids algorithm activates      │
│    - Predator AI hunts fish                                │
│    - Fish respond to placed obstacles, currents, lights    │
│    - Score decreases with fish deaths and time passing     │
│    - Fish reaching goal region are counted as "saved"      │
├─────────────────────────────────────────────────────────────┤
│ 3. EVALUATION PHASE                                        │
│    - Calculate survival percentage                         │
│    - WIN: ≥ required percentage reached goal              │
│    - LOSE: < required percentage or time expired          │
│    - Display final score with visual/audio feedback       │
│    - Option: Restart level or proceed to next             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Win/Lose Conditions

| Condition Type | Criteria | Outcome |
|----------------|----------|---------|
| **Victory** | `(saved_fish / total_fish) ≥ required_percentage` | Award score, unlock next level |
| **Defeat** | `(saved_fish / total_fish) < required_percentage` OR `time > 20 seconds` | No score, must replay level |

### 2.4 Level Progression System

* Game consists of **multiple discrete levels**
* Each level defines:
  * Total fish count (e.g., 80-120)
  * Required survival percentage (e.g., 60%-80%)
  * Inventory composition (e.g., 3 rocks, 2 spiked rocks, 1 bait, 1 current)
  * Environmental layout (spawn zone, obstacles, goal zone)
  * Predator count (0-2 sharks)

**Difficulty Scaling:**
- Early levels: Few obstacles, generous survival threshold, no predators
- Later levels: Complex layouts, tight survival margins, multiple predators, limited inventory

---

## 3. Player Interaction and Camera System

### 3.1 Camera Requirements (BBM 412 Mandatory)

**Primary Camera Mode:** First-Person (FPS)

**Controls:**
| Input | Action |
|-------|--------|
| `W` | Move forward |
| `S` | Move backward |
| `A` | Strafe left |
| `D` | Strafe right |
| `Space` | Move up |
| `Shift` | Move down |
| Mouse Move | Look around (free rotation) |
| `ESC` | Release mouse control |

**Camera Characteristics:**
- **6 Degrees of Freedom (DOF):** 3 translation axes + 3 rotation axes
- Mouse capture when user clicks canvas
- Adjustable field of view
- Smooth movement

### 3.2 Special Camera Transition (BBM 412 Mandatory)

**Trigger:** Keyboard shortcut (e.g., `N` key)

**Behavior:**
1. Store current camera position and rotation
2. Smoothly animate camera to "Group Name Scene" location
3. Display team member names as 3D objects
4. View names from top-down perspective
5. After a few seconds (or second key press), animate back to original position

**Constraint:**  
Camera movement must be animated smoothly. **No instant teleportation allowed.**

### 3.3 Inventory Placement Mechanics

**Placement Mode (Preparation Phase Only):**
- Click on 3D surface → raycast to determine placement position
- Selected inventory item type highlighted in UI
- Click to place → decrement inventory count
- Placed items show semi-transparent preview before confirmation
- Cannot place items during simulation phase

**Selection Methods (BBM 412 compliant):**
- Number keys `1-6` select item type
- OR UI panel with item icons

---

## 4. Inventory System and Interactive Objects

### 4.1 Placeable Object Types

| Object | BBM 412 Morphology | Behavior | Fish Interaction |
|--------|-------------------|----------|------------------|
| **Rock** | ✅ Morphology #1 | Static obstacle | Avoid (obstacle avoidance) |
| **Spiked Rock** | ✅ Morphology #2 | Static lethal obstacle | Die on collision |
| **Bait (Food)** | ✅ Morphology #3 | Attraction point | Seek toward position |
| **Current (Arrow)** | ✅ (Optional bonus) | Directional force field | Velocity influenced |
| **Spotlight** | ✅ (Light source) | Repulsion zone | Avoid illuminated area |
| **Predator (Shark)** | ✅ Morphology #4 | AI-controlled hunter | Death if caught |

**Note:** Bait object is **mandatory at goal location** to attract fish toward win zone.

### 4.2 Object Transformation (BBM 412 Mandatory)

**At least 3 objects must be selectable and transformable (6 DOF):**

**During Preparation Phase:**
- Click object to select
- UI panel displays:
  - **Position sliders:** X, Y, Z translation
  - **Rotation sliders:** X, Y, Z Euler angles
  - **Scale sliders:** Uniform or per-axis (optional)
- Gizmo/visual handles for direct manipulation (optional advanced feature)

**Objects with 6 DOF:**
1. Rock (translate + rotate)
2. Spiked Rock (translate + rotate)
3. Bait (translate + rotate)
4. Current (translate + rotate to set direction)
5. Spotlight (translate + rotate for cone direction)

### 4.3 Spotlight Specification (BBM 412 Critical Requirement)

**Mandatory Features:**
- **6 DOF Control:**
  - **Translation:** X, Y, Z position sliders
  - **Rotation:** Direction vector or Euler angles (to aim cone)
- **Intensity Control:** Slider 0.0 - 10.0
- **On/Off Toggle:** Checkbox or button
- **Spotlight Parameters:**
  - `spotAngle` (inner cone): e.g., 30°
  - `penumbraAngle` (outer cone): e.g., 45°
  - Color: Adjustable (e.g., white, yellow, blue)
  - Attenuation: Distance-based falloff (linear + quadratic)

**Fish Behavior:**  
Fish within spotlight cone apply **negative force** (avoidance) to their velocity, steering away from illuminated area.

---

## 5. Fish School and Boids Algorithm

### 5.1 Fish Entity Specification

**Properties per Fish:**
- Position – 3D world-space location
- Velocity – Current movement direction and speed
- Acceleration – Force accumulator
- Max speed – Speed cap (e.g., 2.0 units/sec)
- Max force – Steering force limit
- Perception radius – Neighbor detection range
- Alive state – Whether fish is alive
- Goal reached state – Whether fish reached goal

**Rendering:**
- All fish use same 3D model or geometry
- Efficient rendering technique for 100+ fish
- Optional: Color variation for visual distinction (same species)

### 5.2 Boids Algorithm Requirements

**Mandatory Behaviors:**

Each fish must exhibit the following steering behaviors:

1. **Separation** – Avoid crowding neighbors
2. **Alignment** – Steer toward average heading of neighbors
3. **Cohesion** – Steer toward average position of neighbors  
4. **Goal Seeking** – Steer toward goal region (mandatory for BBM 412 theme)
5. **Obstacle Avoidance** – Avoid collision with static obstacles

**Behavior Parameters:**
- Perception radius for detecting neighbors
- Separation distance threshold
- Force weights for each behavior (tunable per level)
- Maximum speed and maximum steering force limits

**Expected Result:**  
Emergent flocking behavior where fish move as a cohesive school while navigating toward goal and avoiding obstacles.

### 5.3 Fish Count and Performance

**Target Count:** ~100 fish per level

**Performance Requirements:**
- Maintain 60 FPS on modern hardware
- Efficient rendering of large number of identical objects
- Optimized neighbor queries for boids algorithm

### 5.4 Fish Mortality Rules

**Fish Dies When:**
1. Collision with **Spiked Rock** (distance < threshold)
2. **Caught by Predator** (distance < capture radius)
3. (Optional toggle) Collision with another fish (if fish-fish collision death enabled)

**Fish Does NOT Die When:**
- Collision with regular rock (only avoidance behavior)
- Illuminated by spotlight (only avoidance behavior)

---

## 6. Predator AI System

### 6.1 Predator Characteristics

**Entity Type:** Shark (visually distinct from fish)

**Properties:**
- 3D position and velocity
- Detection radius for searching prey
- Capture radius for killing fish
- Movement speed (faster than fish)

### 6.2 AI Behavior Requirements

**Mandatory Behavior:**
1. Continuously search for nearest fish within detection range
2. Move toward target fish using steering behavior
3. Kill fish when within capture distance
4. Idle or wander when no fish detected (optional)

**AI Complexity:**
- Simple local steering (no global pathfinding required)
- Deterministic behavior
- Based on Reynolds steering behaviors

### 6.3 Predator Count per Level

- Level 1-2: 0 predators
- Level 3-4: 1 predator
- Level 5+: 1-2 predators

---

## 7. Scoring System (BBM 412 Mandatory)

### 7.1 Score Initialization

**Starting Value:** 100 points

### 7.2 Score Modification Rules

| Event | Score Change |
|-------|--------------|
| **Fish death** | -10 points per fish |
| **Time penalty** | -0.5 points per second elapsed |
| **Level completion bonus** | +50 points (only on win) |

**Final Score:**  
Starting score (100) minus penalties, plus bonus if successful. Minimum score is 0.

### 7.3 Score Display (BBM 412 Mandatory)

**UI Requirements:**
- **Continuous display** during simulation (top-right corner)
- **Font:** Large, readable (e.g., 32px bold)
- **Color coding:**
  - **Green** if `score ≥ 70` (on track for win)
  - **Red** if `score < 70` (danger zone)

**Final Score Screen:**
- Larger font (e.g., 64px)
- Display survival percentage: `"82% of fish survived"`
- Visual feedback:
  - Green "SUCCESS" if win
  - Red "FAILED" if loss

### 7.4 Audio Feedback (Optional Enhancement)

**Sounds:**
- `success.mp3` – Played on level completion
- `failure.mp3` – Played on level failure
- `fish_death.mp3` – Played when fish dies (optional, may be too frequent)

---

## 8. Rendering and Shading

### 8.1 Rendering Requirements

**3D Rendering:**
- Fully 3D scene (not 2D or 2.5D)
- Perspective projection
- Support for textured 3D models
- Efficient rendering of many objects

### 8.2 Shader Programs (BBM 412 Critical Requirement)

**Mandatory:** At least **2 distinct shader programs**

Each shader program consists of:
- 1 vertex shader
- 1 fragment shader

**Requirements:**
- Shaders must be written manually in GLSL
- Source code must exist as **separate text files** (not embedded in HTML/JS)
- Minimum 4 GLSL files total (2 vertex + 2 fragment)
- Both shaders must affect the **entire rendered scene** (not just specific objects)
- Shaders must produce **significantly different visual effects**

### 8.3 Shader Types

**Shader Program 1: Realistic Lighting**
- Purpose: Photorealistic rendering
- Features: Ambient, diffuse, and specular lighting
- Supports directional lights and spotlight

**Shader Program 2: Stylized Underwater**
- Purpose: Non-photorealistic artistic rendering
- Features: Underwater atmosphere with caustic light patterns, depth fog, blue-teal color grading
- Creates distinct underwater aesthetic

### 8.4 Shader Switching (BBM 412 Mandatory)

**Requirements:**
- User can switch between shader programs at runtime
- Switching triggered by keyboard input (e.g., `1` and `2` keys) or UI button
- Shader change must be instant (no loading delay)
- Change affects all objects in scene simultaneously

---

## 9. Help Menu and User Interface

### 9.1 Help Menu (BBM 412 Mandatory)

**Trigger:** Press `H` or `h` key

**Behavior:**
- First press → Show help overlay
- Second press → Hide help overlay

**Content Sections:**

```markdown
# FLOCKING FRENZY - HELP

## OBJECTIVE
Guide the fish school to the goal region. At least 60% must survive!

## CONTROLS
Camera Movement:
  W/A/S/D - Move horizontally
  Space   - Move up
  Shift   - Move down
  Mouse   - Look around
  ESC     - Release pointer lock

General:
  1 - Phong shader
  2 - Underwater shader
  H - Toggle this help menu
  N - View team member names

## INVENTORY PLACEMENT
- Select item with number keys (1-6) or UI panel
- Click on surface to place item
- All items must be placed before starting simulation

## ITEM TYPES
Rock        - Fish avoid it
Spiked Rock - Fish die on impact
Bait        - Attracts fish (place at goal!)
Current     - Pushes fish in arrow direction
Spotlight   - Fish avoid light (use to block paths)
Predator    - Hunts and eats fish

## SCORING
- Start with 100 points
- Lose 10 points per fish death
- Lose 0.5 points per second
- Green score = winning, Red score = danger

## WIN CONDITION
At least 60% of fish reach the goal within 20 seconds.

Press H to close this menu.
```

**Styling:**
- Semi-transparent dark background (`rgba(0,0,0,0.85)`)
- White text, good contrast
- Centered on screen, scrollable if needed
- Font size: 16px (readable)

---

### 9.2 UI Panels and HUD

**HUD Elements (Always Visible):**
1. **Score Display** (top-right)
   - Current score (large font)
   - Color-coded (green/red)

2. **Timer** (top-center)
   - Countdown from 20 seconds
   - Red when < 5 seconds

3. **Survival Percentage** (top-left)
   - `"Alive: 87/100 (87%)"`

**Inventory Panel (Preparation Phase):**
- List of available items with counts
- Selected item highlighted
- Icons/thumbnails for each item type

**Simulation Controls:**
- "Start Simulation" button (disabled until inventory empty)
- "Restart Level" button (during/after simulation)

---

## 10. Group Member Names Scene (BBM 412 Mandatory)

### 10.1 Name Display Requirement

**Specification:**
- Team member names assembled using **3D objects**
- Objects must be thematically appropriate (underwater theme preferred)
- Examples: Cubes arranged as letters, 3D text models, decorated objects forming names

**Position:** Separate area of the scene (distinct from main gameplay area)

### 10.2 Camera Transition Requirement

**Trigger:** Keyboard shortcut (e.g., `N` key)

**Behavior:**
1. Save current camera position and rotation
2. Smoothly animate camera to name scene location
3. Show team member names from appropriate viewing angle (e.g., top-down)
4. After a few seconds (or on second key press), animate back to saved position

**Requirements:**
- Camera movement must be **animated smoothly** (no instant teleportation)
- Animation duration: approximately 2 seconds
- Names must be clearly visible from the camera position

---

## 11. Technical Requirements and Constraints

### 11.1 Technology Stack

| Component | Technology |
|-----------|------------|
| **Rendering** | WebGL 2.x (via library) |
| **Language** | JavaScript (ES6+) |
| **Shader Language** | GLSL ES 3.00 |
| **UI** | HTML5 + CSS3 |

### 11.2 External Libraries (BBM 412 Compliance)

**Allowed:**
- WebGL 2.x libraries (for abstraction and productivity)
- Math/utility libraries
- UI libraries for debug panels

**Must Document:**
- All external libraries must be cited in final presentation
- Shader code must be original (not copied)

**Not Allowed:**
- Game engines (Unity, Unreal, Godot)

### 11.3 Performance Requirements

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Frame Rate** | 60 FPS | ≥ 30 FPS |
| **Fish Count** | 100 fish | 80-120 fish |
| **Memory** | < 500 MB | < 1 GB |

**Optimization:**
- Efficient instanced rendering for large number of fish
- Spatial optimization for boids algorithm
- Frustum culling

### 11.4 Browser Compatibility

**Primary Target:** Modern desktop browsers (Chrome, Firefox, Edge)

**Minimum Requirements:**
- WebGL 2.0 support
- Modern JavaScript (ES6+)
- Mouse capture API

---

## 12. Non-Functional Requirements

### 12.1 Usability

- **Intuitive controls:** WASD standard, clear UI feedback
- **Help always accessible:** H key toggle
- **Visual clarity:** High contrast UI, readable fonts
- **Error prevention:** Disable invalid actions (e.g., start simulation without inventory placement)

### 12.2 Reliability

- **No crashes:** Handle edge cases (e.g., all fish dead, timer overflow)
- **Consistent physics:** Deterministic simulation (no NaN/Inf values)
- **Save state:** Allow level restart without page reload

### 12.3 Maintainability

- **Modular code:** Separate files for Fish, Predator, Level, UI, Shaders
- **Comments:** JSDoc for public functions
- **Configuration:** Level data in JSON files, tunable parameters

### 12.4 Extensibility

**Design allows:**
- Adding new item types (e.g., decoy, barrier)
- Adjusting boids parameters per level
- Multiple predator types (different speeds, behaviors)
- Post-game analytics (heat maps, fish paths)

---

## 13. BBM 412 Compliance Matrix

| Requirement | Status | Description |
|-------------|--------|-------------|
| **WebGL 2.x + JS + GLSL + HTML** | ✅ | WebGL 2 library, custom GLSL shaders, JavaScript, HTML5 |
| **No game engines** | ✅ | Using library (not engine) for WebGL abstraction |
| **Fully 3D (not 2D/2.5D)** | ✅ | 3D space with perspective projection |
| **Scoring system** | ✅ | Points displayed with visual feedback |
| **Camera 6 DOF** | ✅ | FPS camera with 3 translation + 3 rotation axes |
| **3+ different morphologies** | ✅ | Fish, Rock, Spiked Rock, Bait, Shark (5 types) |
| **3+ movable objects (6 DOF)** | ✅ | Multiple objects with translation and rotation control |
| **Mouse/keyboard selection** | ✅ | Object selection via mouse and keyboard |
| **At least 1 spotlight** | ✅ | Spotlight with cone shape |
| **Spotlight 6 DOF control** | ✅ | Position and direction control |
| **Spotlight intensity adjustment** | ✅ | Adjustable intensity |
| **2+ shader programs** | ✅ | Realistic (Phong) + Stylized (Underwater NPR) |
| **Shaders affect entire scene** | ✅ | Full scene rendering with selected shader |
| **Shaders significantly different** | ✅ | Photorealistic vs artistic underwater style |
| **GLSL source files separate** | ✅ | 4 separate .glsl files minimum |
| **Runtime shader switching** | ✅ | Keyboard keys to switch shaders |
| **Group names as 3D objects** | ✅ | 3D objects forming team member names |
| **Animated camera transition** | ✅ | Smooth animation to name scene (no teleport) |
| **Help menu (H key)** | ✅ | Toggle overlay with controls and instructions |

**Overall Compliance:** 100% of mandatory BBM 412 requirements met

---

## 14. Out of Scope (Explicitly Excluded)

The following features are **intentionally excluded** to maintain project focus and meet deadline:

- **Multiplayer support**
- **Advanced post-processing** (bloom, SSAO, depth of field)
- **Global pathfinding** (A*, navmesh)
- **Procedural level generation**
- **Advanced physics** (cloth, fluid, soft bodies)
- **Mobile/touch controls**
- **VR/AR support**
- **Advanced AI** (neural networks, genetic algorithms)

---

## 15. Risk Assessment and Mitigation

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| **Performance with 100 fish** | Medium | High | Use instanced rendering, spatial optimization |
| **Shader complexity bugs** | Medium | Medium | Test incrementally, validate shader inputs |
| **Boids behavior unpredictable** | Low | High | Tune parameters iteratively, debug visualization |
| **Library learning curve** | High | Medium | Allocate learning time, use documentation |
| **Time constraint** | High | Critical | Prioritize BBM 412 requirements first |

---

## 16. Acceptance Criteria (Definition of Done)

**The project is complete when:**

### 16.1 Functional Completeness
- [ ] All BBM 412 mandatory features implemented and tested
- [ ] At least 3 playable levels with varying difficulty
- [ ] Boids algorithm produces emergent flocking behavior
- [ ] Predator AI successfully hunts fish
- [ ] Scoring system accurate and displayed correctly
- [ ] Win/lose conditions trigger properly

### 16.2 Technical Quality
- [ ] 60 FPS with 100 fish on target hardware
- [ ] No console errors or warnings
- [ ] Shaders compile without errors
- [ ] Code follows modular architecture

### 16.3 Usability
- [ ] All controls documented in help menu
- [ ] UI elements readable and functional
- [ ] No blocking bugs or crashes

### 16.4 Presentation Readiness
- [ ] Demo video recorded (gameplay, features showcase)
- [ ] Presentation slides prepared
- [ ] Shader code included in presentation with explanations
- [ ] External libraries cited

---

## 17. Appendix

### 17.1 Reference Materials

**WebGL and Graphics Programming:**
- WebGL 2.0 Specification
- GLSL ES 3.00 Specification
- Common WebGL libraries documentation

**Boids Algorithm:**
- Reynolds, C. W. (1987). "Flocks, herds and schools: A distributed behavioral model"
- https://www.red3d.com/cwr/boids/

**Shader Resources:**
- The Book of Shaders: https://thebookofshaders.com/
- Shadertoy (inspiration): https://www.shadertoy.com/

**Project Requirements:**
- Reference: `docs/FINAL_GOAL.md`

### 17.2 Glossary

| Term | Definition |
|------|------------|
| **Boids** | Flocking simulation algorithm (emergent group behavior) |
| **6 DOF** | 6 Degrees of Freedom (3 translation + 3 rotation axes) |
| **NPR** | Non-Photorealistic Rendering (stylized/artistic graphics) |
| **Instancing** | GPU technique to render many identical objects efficiently |
| **Raycast** | Ray-object intersection test in 3D space |
| **Frustum Culling** | Optimization to skip rendering objects outside camera view |
| **Attenuation** | Distance-based reduction of light intensity |

---

**Document Version:** 2.0  
**Last Updated:** 2026-01-11  
**Status:** Final - Ready for Implementation
