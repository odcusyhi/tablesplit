# Ciutat Comtal

An original open-world action game set in a stylised, low-poly Barcelona. It runs in the browser
with Three.js r128 (loaded from cdnjs). Every model, texture, sound and music track is generated
in code, so there are no asset files.

This folder sits outside the tablesplit app. Vite does not build it, ESLint (which only covers
`*.ts` / `*.tsx`) does not lint it, and Netlify does not deploy it.

## Tests

Browser tests live in `tests/`; see `tests/README.md`.

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

## Getting around

- **Llamp 600:** a sport motorbike, 0–174 km/h in 3 s, that leans into turns. It appears in traffic and parked.
- **Bus Comtal:** a 12 m city bus in traffic. Take one and press **T** for the bus route: stop next to the shelters
  (8 stops on the radar) to pick up the people waiting there. You're paid per stop and per passenger, with a €200 bonus for a full route.
- **Boats:** speedboats (*Llanxa Ràpida*) and a slow tourist boat (*Gavina del Port*) moored along the Moll de la Fusta,
  off the Barceloneta and on the beach. They only float on water, run aground at the shore, and leave a wake.
  Wade in from the quay to board; get out at sea to swim.
- **Telefèric:** cable car towers carry red cabins from the Barceloneta beach over the port up to Montjuïc.
  Walk into the purple light (T on the radar) to ride for €5; the mouse looks around during the ride.
- **Metro:** 8 stations (Catalunya, Drassanes, Barceloneta, Sagrada Família, Glòries, Diagonal, Espanya, Gràcia).
  Walk down the stairs, pick a destination with a number key (€2), ride the tunnel and come out at the other station.

## Side jobs and shops

- **Taxi fares:** in a Taxi Comtal, press **T**. Pick up the waving fare (blue blip) and drive them to their destination before the meter runs out.
  Pay depends on distance and time left, with a €250 bonus every five fares.
- **Vigilante:** in a police car, press **T**. Wreck fleeing suspects; each level pays more and gives the suspect more speed.
- **Street races:** blue lights, marked C on the radar. *Volta de l'Eixample* (two laps), *Pujada a Montjuïc* and *Sprint de la Platja*,
  each against three AI rivals who slow down for corners. Prizes are €2000, €700 and €250 for first to third.
- **Destrucció:** orange lights, marked D. Smash 25 things in 60 seconds for €1000.
- **Shops:** green lights, opened by walking in and bought with keys 1–6.
  - **Bars** (B) restore health.
  - **Armeria Comtal** (A) sells the pistol, ammo, body armour and the bat.
  - **Roba Passeig** (R) sells six outfits for Nil.
- **Armour** absorbs damage before health and shows as a blue bar under the health bar.

## Police tactics

- **Helicopter** from 4 stars: circles overhead, keeps you spotted, lights you with a searchlight at night and shoots at 5 stars.
- **Roadblocks** from 3 stars: two patrol cars parked across the street ahead of you.
- **Traffic lights** at Eixample intersections cycle in a green wave, and traffic stops for them. Police in pursuit don't.

## Driving feel

Skid marks, tyre smoke and squeal when sliding, handbraking or braking hard. The camera follows the direction of a slide.
Bumpers fall off as a car gets wrecked, and Pinta Ràpid puts them back. A single impact can take at most 40 % of a car's health, and police rams do half damage.

## Performance

Press **F3** for a readout of frame rate, CPU time per frame, draw calls, triangles and object counts.
People more than 45 m from the camera stop casting shadows and are hidden beyond 140 m; cars stop casting shadows beyond 110 m.
Your position, armour and outfit are saved along with mission progress.

## Street life

- **Breakables:** 665 lamp posts, 290 benches, 350 recycling containers, 224 Bicing bikes and 37 fire hydrants.
  Cars smash through them (lamp posts tip over and their lights go out), and the bat or a kick breaks them.
  Bullets knock things over or shoot out lamps, and explosions scatter whatever is nearby. Debris tumbles with physics.
  A broken hydrant becomes a water geyser that launches cars. Broken props repair themselves after 90 s once you are far away.
- **Fighting:** a punch-punch-kick combo where the kick floors the target, plus a baseball bat (one on the beach, one in El Raval).
  People stagger when hit, and about one in five hits back. Hitting a car makes its driver get out and fight;
  hitting a parked car sets off its alarm.
- **Police on foot:** at a wanted level, officers get out of their cars when you are on foot. They chase and punch you,
  shoot from two stars, and arrest you if they catch you.
- **Street events** happen every 15–30 s near you: strangers start fights while onlookers gather and egg them on,
  bag thieves run off chased by their victims (knock them down for a cash reward), and groups stand around chatting.
- **La Rambla** has a living statue, a busker playing rumba you can hear as you approach, and a dancer.
- **Ambient:** pigeon flocks on the plazas take off when you run or drive through them, or when there is gunfire.
  Gulls circle over the sea, and fireworks go off over the Barceloneta every night from 22:00 to 01:00.
- **Speech:** people shout in Catalan in speech bubbles, with a short voice blip.
- **Stats:** the pause menu keeps a street record of things smashed, people knocked down and brawls witnessed.

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
| Click / Ctrl | Punch combo (jab, cross, kick), swing the bat, or shoot |
| Q | Switch weapon (fists, bat, pistol) |
| R / H | Radio station / horn |
| M / P | Map / pause |
| C / N | Camera distance / mute |
| I | Show or hide the on-screen controls card |
| T | Start or stop a taxi, vigilante or bus-route job (in a taxi, police car or bus) |
| 1–9 | Buy in a shop or pick a metro destination |
| F3 | Performance readout |
