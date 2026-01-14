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
- [x] **2+ shader programs** - Phong (realistic) + Underwater (stylized NPR)
  - [x] Çalışmıyor
  - [x] **Runtime shader switching** - Keys `1` and `2` switch between shaders
  - [x] Çalışmıyor
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

- [x] Shaders doesn't work (or change, normal view is ok but underwater shader doesnt work when I press 2)
- [x] Help menu appears but top of it is cut off, we can not see everything

---

#### Gameplay Core - Boids System
- [x] **Boids flocking algorithm** - Reynolds steering behaviors
  - [x] Separation (avoid crowding)
  - [x] Alignment (match neighbor heading)
  - [x] Cohesion (move toward group center)
  - [x] Goal seeking (attract to bait)
  - [x] Obstacle avoidance (rocks, spiked rocks)
  - [ ] Balık modeli ve animasyonu eklenecek

- [x] **Fish school (100+ entities)** - InstancedMesh for performance
  - [x] Fish entity class with position/velocity/acceleration
  - [x] Efficient neighbor detection (spatial partitioning)
  - [x] Render 100+ fish at 60 FPS

- [x] **Predator AI (shark)** - Simple pursuit behavior
  - [x] Prey detection radius
  - [x] Steering toward nearest fish
  - [x] Kill radius for collision detection

#### Interactive Objects
- [ ] **Placeable objects system**
  - [x] Rock - Static obstacle (fish avoid)
    - [x] Taşın rengi yok
  - [x] SpikedRock - Lethal obstacle (fish die on contact)
    - [x] 3d model eksik (Dursun veya Sinan)
    - [x] 3d boundry model eksik (Dursun veya Sinan)
    - [x] Balık ölme kodlanmalı
  - [x] Huge Rock - Devasa olan işte şittirmeyn beni
    - [x] 3d model eksik (Dursun veya Sinan)
    - [x] 3d boundry model eksik (Dursun veya Sinan)
    - [x] Balık ölme kodlanmalı
  - [x] Bait - Attraction point (goal seeking)
    - [ ] 10 balık değince yok olsun tek balık değil (opsiyonel)
    - [x] Yem bittiğinde final noktasına gitmeleri gerek (yenilemeyen bait veya direk final noktası gibi bi şey koyalım)
    - [x] Final noktası kontrolü distance ile yapılabilir
  - [x] (Spotlight already exists for lighting)

- [x] **Spotlight UI controls** - Must meet BBM 412 requirements
  - [x] Position değiştirme (X, Y, Z)
  - [x] Direction/rotation sliders (6 DOF total)
  - [x] Intensity slider (0.0 - 10.0)
  - [x] On/Off toggle

- [x] **Object transformation controls** - For at least 3 objects
  - [x] Click-to-select mechanism (envanterde var)
    - [x] (kaya koyunca geri alamıyoz bug var, en son çözeriz)
  - [x] Position (X, Y, Z)
  - [x] Rotation (X, Y, Z)

#### Game Systems
- [x] **Level system**
  - [x] Inventory management (preparation phase)
  - [x] Spawn zones and goal zones
  - [x] AABB collision ekle
  - [x] Balıkların belli bi yükseklikten yukarı ve zeminden aşağı gitmesini engelleyeceğiz
- [x] **Win/lose evaluation**
  - [x] Survival percentage calculation
  - [x] Timer enforcement (20 seconds)
  - [x] Victory condition: ≥60% fish reach goal

- [x] **Complete scoring integration**
  - [x] Fish death penalty (-10 points)
  - [x] Time penalty (-0.5 points/second)
  - [x] Real-time HUD updates
  - [x] Final score screen

- [x] Game Loop Programlanacak
  - [x] Envanterdeki her şey koyulduğunda tuşa basınca simülasyon başlaması
  - [x] End screen
---

## Known Issues


---

## Fikirler


- [x] Boid simülasyonu değerlerini fine tune edip balık sürüsü gibi olmasını sağlama

- [x] Sahne sınırlarını implement edeceğim
  - [x] Kamera sınırları aşamayacak
  - [x] Balıklar sınırları aşamayacak
  - [x] Köpek balığı sınırları aşamayacak

- [x] item yerleştirme bug'ını çözmek

- [ ] Köpek balığının obstacle avoidance'ı eklenecekz

- [x] Yemleri duvarın dışına koyabiliyoruz, kötü

- [ ] Yorum satırlarının falan temizlenmesi 