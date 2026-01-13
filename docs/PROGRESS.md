# Flocking Frenzy - Development Progress

**Project:** BBM 412 Computer Graphics - Underwater Boids Simulation  
**Last Updated:** 2026-01-11  
**Status:** Base Structure Complete ✅

---

## BBM 412 Requirements Tracking

### ✅ Completed Requirements

#### Core Infrastructure
- [x] **WebGL 2.x + JavaScript + GLSL + HTML** - Using Three.js v0.170.0 via CDN
- [x] **No game engines** - Using Three.js library for WebGL abstraction only
- [x] **Fully 3D scene** - Perspective projection with proper depth rendering
- [x] **6 DOF camera** - FPS controller with WASD movement + mouse look + Space/Shift for Y-axis
- [x] **Separate GLSL files** - 4 files total:
  - `shaders/phong.vert.glsl`
  - `shaders/phong.frag.glsl`
  - `shaders/underwater.vert.glsl`
  - `shaders/underwater.frag.glsl`
- [ ] **2+ shader programs** - Phong (realistic) + Underwater (stylized NPR)
  - [ ] Çalışmıyor
  - [ ] **Runtime shader switching** - Keys `1` and `2` switch between shaders
  - [ ] Çalışmıyor
- [x] **Help menu** - `H` key toggles detailed help overlay
- [x] **Scoring system framework** - Point tracking with penalties implemented

#### Scene Components
- [x] **Basic scene with test objects** - Cube, Sphere, Cone rendering correctly
- [x] **Lighting setup** - Ambient + Directional + Spotlight configured

#### Visual Elements
- [ ] **Team names as 3D objects** - Placeholder exists, needs actual 3D text/object arrangement
  - [x] *Trigger:* `N` key
  - [ ] Tekrar N'ye basınca eski yere geri gelmiyor
  - [ ] Yazılar yok

---
### BUGS

- [ BUG ] Shaders doesn't work (or change, normal view is ok but underwater shader doesnt work when I press 2)
- [ BUG ] Help menu appears but top of it is cut off, we can not see everything

---

#### Gameplay Core - Boids System
- [x] **Boids flocking algorithm** - Reynolds steering behaviors
  - [x] Separation (avoid crowding)
  - [x] Alignment (match neighbor heading)
  - [x] Cohesion (move toward group center)
  - [x] Goal seeking (attract to bait)
  - [x] Obstacle avoidance (rocks, spiked rocks)
  - [ ] Balık modeli ve animasyonu eklenecek
  - [ ] FleeBehavior ekle köpek balığından kaçsınlar

- [x] **Fish school (100+ entities)** - InstancedMesh for performance
  - Fish entity class with position/velocity/acceleration
  - Efficient neighbor detection (spatial partitioning)
  - Render 100+ fish at 60 FPS

- [ ] **Predator AI (shark)** - Simple pursuit behavior
  - Prey detection radius
  - Steering toward nearest fish
  - Kill radius for collision detection

#### Interactive Objects
- [ ] **Placeable objects system**
  - [x] Rock - Static obstacle (fish avoid)
    - [ ] Taşın rengi yok
  - [ ] SpikedRock - Lethal obstacle (fish die on contact)
    - [ ] 3d model eksik (Dursun veya Sinan)
    - [ ] 3d boundry model eksik (Dursun veya Sinan)
    - [ ] Balık ölme kodlanmalı
  - [ ] Huge Rock - Devasa olan işte şittirmeyn beni
    - [ ] 3d model eksik (Dursun veya Sinan)
    - [ ] 3d boundry model eksik (Dursun veya Sinan)
    - [ ] Balık ölme kodlanmalı
  - [x] Bait - Attraction point (goal seeking)
    - [ ] 10 balık değince yok olsun tek balık değil (opsiyonel)
    - [ ] Yem bittiğinde final noktasına gitmeleri gerek (yenilemeyen bait veya direk final noktası gibi bi şey koyalım)
  - [x] (Spotlight already exists for lighting)

- [x] **Spotlight UI controls** - Must meet BBM 412 requirements
  - [x] Position değiştirme (X, Y, Z)
  - [x] Direction/rotation sliders (6 DOF total)
  - [x] Intensity slider (0.0 - 10.0)
  - [x] On/Off toggle

- [ ] **Object transformation controls** - For at least 3 objects
  - [x] Click-to-select mechanism (envanterde var)
    - [ ] (kaya koyunca geri alamıyoz bug var, en son çözeriz)
  - [x] Position (X, Y, Z)
  - [x] Rotation (X, Y, Z)

#### Game Systems
- [ ] **Level system**
  - [ ] JSON level definitions
  - [x] Inventory management (preparation phase)
  - [ ] Spawn zones and goal zones

- [ ] **Win/lose evaluation**
  - [ ] Survival percentage calculation
  - [ ] Timer enforcement (20 seconds)
  - [ ] Victory condition: ≥60% fish reach goal
  - [ ] Score bonus on win (+50 points)

- [ ] **Complete scoring integration**
  - [ ] Fish death penalty (-10 points)
  - [ ] Time penalty (-0.5 points/second)
  - [ ] Real-time HUD updates
  - [ ] Final score screen

- [ ] Game Loop Programlanacak
  - [ ] Envanterdeki her şey koyulduğunda tuşa basınca simülasyon başlaması
  - [ ] End screen
  - [ ] Pause screen
  - [ ] Falan filan
---

## Known Issues

### Current
- [ ] Missing favicon.ico (non-critical, browser warning only)

---

## Fikirler

- [ ] Balıkları takip eden spotlight eklenebilir (kullanıcının eklediğine ek olarak)