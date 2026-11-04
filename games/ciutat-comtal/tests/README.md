# Ciutat Comtal browser tests

Headless Playwright scripts that drive the real game through its debug handle (`window.__game`).
They step the simulation directly, so the results don't depend on frame rate.

## Setup

```bash
npm i -D playwright@1 three@0.128.0
cp node_modules/three/build/three.min.js games/ciutat-comtal/tests/three.min.js
```

The scripts serve `three.min.js` locally in place of the cdnjs copy, and block every other network request.
Set `THREE_JS=/path/to/three.min.js` to use a different copy.

## Scripts

| Script | What it checks |
| --- | --- |
| `run.js` | Boots, starts a new game, walks; prints any page errors |
| `logic.js` | Missions 1–3, driving acceleration |
| `logic2.js` | Missions 3–6: race autopilot, wanted level and police, Pinta Ràpid, Torrent's route, explosions, map, pause |
| `life.js` | Breakable props, punch combo, bat, street events, police on foot, pigeons, fireworks |
| `acts.js`, `acts2.js` | Shops, armour, taxi, vigilante, races with rivals, rampage, helicopter, roadblocks, traffic lights, bumpers, saving |
| `ui.js`, `perf.js`, `skid.js` | Controls card and prompts, performance readout, skid marks |

Run one with `node games/ciutat-comtal/tests/logic2.js`. Screenshots are written to `tests/out/`.
