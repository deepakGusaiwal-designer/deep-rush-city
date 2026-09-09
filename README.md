# Deep Rush City 🏙️🏎️

A high-octane browser-based 3D open-world sandbox game built with **React**, **Three.js**, and a custom rigid-body vehicle simulation. Own the streets, drift through neon intersections, steal cars, run cab shifts, pull off high-stakes bank heists, fly jetpacks, evade lethal police pursuit — or get **WASTED** / **BUSTED** trying.

## Features

### Driving & physics
- **Rigid-body "bicycle model" vehicles** — mass, engine force, aero drag and rolling resistance, per-axle tyre slip angles with cornering stiffness and a friction circle, yaw inertia, longitudinal weight transfer.
- **Real driving feel** — launch wheelspin, ~1 G braking, understeer at the grip limit, **handbrake rear-lock drifting**, six-speed gear readout and live lateral-G on the speedo.
- **Nitro** — cuts drag and lifts the ceiling to ~200 km/h on a stock sports car (260+ on the hypercar), more with booster upgrades.
- **Impulse-based collisions** — momentum exchange with traffic and police (mass ratios matter: a van shrugs off a hatchback), off-centre hits spin the car, buildings scrape and bounce.
- **Vehicle damage** — bodywork health, engine smoke that thickens as damage grows, wrecked engines that die; repair at the mission board or press **R**.

### GTA systems
- **Wanted level (★–★★★★★)** — heat builds from hitting pedestrians, ramming traffic, stealing cars and heists; it only cools while no cop can see you.
- **Police pursuit AI** — cruisers with flashing lightbars and sirens spawn out of sight, intercept, ram and box you in. Stop next to one and you're **BUSTED** (fine + precinct respawn).
- **Health & armor** — traffic, cops and hard crashes hurt; slow regen after a quiet spell. Hit zero and you're **WASTED** (hospital bill + respawn at Fountain Plaza).
- **Grand theft auto** — walk up to any traffic car and press **E** to take it.
- **Jetpack (J)** — fly over the city: Space thrusts, Ctrl pushes down, Shift is the afterburner. Fuel drains in the air and refills on the ground; land on rooftops, but run dry up high and the landing hurts.
- **Notifications, splash screens, minimap blips** for cops, missions, hidden packages and the hospital.

### Missions
Open the **Mission Board (M)** or walk into a glowing marker in the city:

| Mission | Type | What you do |
|---|---|---|
| 📦 Hot Wheels Courier | Delivery | Pick up a crate at the garage and deliver it across town — too much damage destroys the cargo. |
| 🏁 Neon Circuit | Race | Six checkpoints against the clock, time bonus on finish. |
| 🚨 Street Justice | Vigilante | A stolen car flees through the city; ram it until it stops. |
| 💰 The Reserve Job | Heist | Crack the vault at the Reserve Bank, get 3 stars, lose the cops and reach the Marina safehouse. |
| 🚖 Cab Job (T) | Freelance | Pick up passengers, beat the clock, build a fare streak. |

Plus **12 hidden packages** scattered on the sidewalks ($100 each, $2000 bonus for the set).

## Tech Stack

| Category      | Technology |
|---------------|------------|
| UI Framework  | React 18 + TypeScript |
| 3D Rendering  | Three.js |
| Physics       | Custom planar rigid-body model (`VehicleController`) |
| State         | Zustand |
| Styling       | Tailwind CSS |
| Icons         | lucide-react |
| Audio         | Procedural Web Audio (engine, sirens, stingers) |
| Build Tool    | Vite |

## Project Structure

```
├── index.html                  # App entry HTML
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component wiring engine + HUD
│   ├── index.css                # Global styles / Tailwind / splash animations
│   ├── components/
│   │   ├── HUD/
│   │   │   ├── GTAHealthBar.tsx     # Health, armor, vehicle condition
│   │   │   ├── WantedStars.tsx      # ★ wanted meter
│   │   │   ├── MissionHUD.tsx       # Story-mission objective banner
│   │   │   ├── MissionMenu.tsx      # Mission board (M): jobs, repair, stats
│   │   │   ├── SplashOverlay.tsx    # WASTED / BUSTED / MISSION PASSED
│   │   │   ├── NotificationFeed.tsx # Toast feed
│   │   │   ├── CabMissionHUD.tsx, MiniMap.tsx, Speedometer.tsx, ...
│   │   ├── LoadingScreen.tsx
│   │   └── POIPopup.tsx
│   ├── game/                    # Core game engine & systems
│   │   ├── CityGameEngine.ts    # Main engine: scene, tick loop, vitals, respawn, wiring
│   │   ├── VehicleController.ts # Rigid-body car physics, collisions, damage
│   │   ├── WantedSystem.ts      # Heat / star logic
│   │   ├── PoliceManager.ts     # Cruiser spawning, pursuit AI, busted detection
│   │   ├── MissionDirector.ts   # Courier / race / vigilante / heist + hidden packages
│   │   ├── MissionManager.ts    # Cab job
│   │   ├── TrafficManager.ts    # AI traffic (now shoved by real impulses)
│   │   ├── PedestrianManager.ts # AI pedestrians
│   │   ├── SmokeEffects.ts      # Engine damage smoke
│   │   ├── CityEnvironment.ts, RouteGuideManager.ts, FollowCamera.ts,
│   │   ├── LightingManager.ts, TireEffectsManager.ts, ImpactEffects.ts, AudioManager.ts
│   ├── player/                  # On-foot protagonist
│   ├── store/useGameStore.ts    # Zustand global game state
│   ├── data/vehicles.ts         # Vehicle stats & POIs
│   └── types/game.ts            # Shared TypeScript types
└── public/models/               # GLB city, vehicle, and prop assets
```

## Getting Started

```bash
npm install
npm run dev       # dev server with HMR
npm run build     # type-check + production bundle in dist/
npm run preview   # serve the production build
```

## Controls

| Key | On foot | Driving |
|---|---|---|
| **W A S D** | Move | Throttle / steer / brake-reverse |
| **Shift** | Sprint | Nitro |
| **Space** | Jump / jetpack thrust | Handbrake (drift) |
| **J** | Equip / remove jetpack | — |
| **Ctrl** | Jetpack descend | — |
| **E** | Enter / steal car, start mission at marker | Exit car |
| **H** | — | Horn |
| **M** | Mission board | Mission board |
| **T** | Cab job | Cab job |
| **U** | Customs shop | Customs shop |
| **C** | — | Camera mode |
| **N** | Day / sunset / night | Day / sunset / night |
| **R** | Reset & repair car | Reset & repair car |
| **Mouse drag / wheel** | Orbit / zoom | Orbit / zoom |

Touch controls appear automatically on mobile.

## Development notes

- In dev builds the engine is exposed as `window.__engine`; `engine.stop()` then `engine.tick(1/60, false)` steps the simulation deterministically (used for automated smoke tests).
- Static building colliders are extracted from the city GLB; container groups are skipped so a block-level parent never becomes one giant box.

## License

Private project — not currently licensed for redistribution.
