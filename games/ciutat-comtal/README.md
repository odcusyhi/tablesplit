# Ciutat Comtal

An original open-world action game set in a stylised, low-poly Barcelona. It runs in the browser
with Three.js r128 (loaded from cdnjs). Every model, texture, sound and music track is generated
in code, so there are no asset files.

This folder sits outside the tablesplit app. Vite does not build it, ESLint (which only covers
`*.ts` / `*.tsx`) does not lint it, and Netlify does not deploy it.

## Run locally

Any static file server works:

```bash
npx serve games/ciutat-comtal
```

## What is in it

- **City:** the Eixample grid with chamfered octagonal blocks and alternating one-way streets,
  cut by the Diagonal. Ciutat Vella (Raval, Gòtic, Born) with procedurally generated alleys,
  La Rambla with a Miró-style pavement mosaic, Barceloneta's long thin blocks, the beach,
  the port, Montjuïc with its castle, Collserola/Tibidabo, and Park Güell. Pavements use the
  *panot* flower tile.
- **Landmarks:** Sagrada Família (with its crane), Torre Glòries, Arc de Triomf, Sant Pau,
  the Cathedral, the Columbus column, the beach towers and golden fish, the sail hotel,
  and a stadium.
- **Systems:** walking, sprinting, jumping and swimming. Arcade driving with handbrake drifts,
  jumps, curb physics and crash damage, smoke, fire and explosions. Stealing cars by force.
  Traffic AI that obeys the one-way grid. Pedestrians that panic. Punching and a pistol with
  auto-aim. A 0–5 star wanted level: police pursue along the grid, ram you, shoot from 2 stars
  and arrest you when you are stopped. Pinta Ràpid garages, hospital and arrest respawns,
  a day/night cycle, a rotating radar, a full map, two procedurally generated radio stations,
  touch controls, and a localStorage save.
- **Story:** six missions (homecoming, timed deliveries, a pickpocket chase, a checkpoint race
  down the Diagonal, a van theft with a 3-star escape, and a pursuit to Montjuïc castle),
  plus 20 hidden panot collectibles.

## Rendering

The look recreates mid-2000s console rendering techniques. Every texture is original and generated in code.

- A post-processing pass applies a warm colour grade, bloom, a frame-feedback "trails" blur, a vignette and film grain.
  Trails turn off when the viewer prefers reduced motion or when the game drops to its low-quality mode.
- A sky dome shader draws a gradient, the sun disk with its glow, and drifting clouds. Fog blends distant buildings into the horizon haze.
- Street lamps and car lights get additive glows (coronas), with pools of light on the ground at night and a headlight on the player's car.
- Facades are textured with balconies, shutters, AC units and grime streaks. A shopfront band runs along the ground floor
  (shops, bars, graffitied metal shutters, entrance portals), and building bases are darkened to fake ambient occlusion.
  Roads have worn asphalt detail and faded markings.
- Plane trees, palms and pines are drawn as transparent leaf cards, and they cast cut-out shadows.
- Cars have extruded bodies with wheel arches, glass cabins, bumpers, chrome rims and reflective paint.
  The water has animated ripples and reflects the sky.
- People are jointed: hips, knees, shoulders and elbows, with a walk cycle that bends the knees, bobs and twists the body.
  Each person's torso, head and hair are merged into one vertex-coloured mesh to keep draw calls down.
  The crowd mixes locals, office workers, tourists and older residents, with varied build, height, clothes,
  hairstyles and accessories (backpacks, bags, caps, sunglasses).
- Buildings have stone cornices and ledges. Streets have benches, coloured recycling containers and Bicing bike docks.
- The pause menu has a graphics setting (alts / mitjans / baixos). Unless you pick one yourself, the game lowers it automatically below 30 fps.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Mouse (click to capture) | Camera |
| F | Enter or exit a vehicle; takes it by force if someone is driving |
| Shift / Space | Sprint / jump (handbrake in a vehicle) |
| Click / Ctrl | Punch or shoot |
| Q | Switch weapon |
| R / H | Radio station / horn |
| M / P | Map / pause |
| C / N | Camera distance / mute |
