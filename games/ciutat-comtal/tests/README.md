# Ciutat Comtal browser tests

Headless Playwright scripts that drive the real game through its debug handle (`window.__game`).
They step the simulation directly, so the results don't depend on frame rate.

## Setup

```bash
npm i -D playwright@1 three@0.128.0
cp node_modules/three/build/three.min.js games/ciutat-comtal/tests/three.min.js
```

The scripts serve `three.min.cjs` locally in place of the cdnjs copy, and block every other network request.
Set `THREE_JS=/path/to/three.min.cjs` to use a different copy.

## Scripts

| Script | What it checks |
| --- | --- |
| `run.cjs` | Boots, starts a new game, walks; prints any page errors |
| `logic.cjs` | Missions 1–3, driving acceleration |
| `logic2.cjs` | Missions 3–6: race autopilot, wanted level and police, Pinta Ràpid, Torrent's route, explosions, map, pause |
| `life.cjs` | Breakable props, punch combo, bat, street events, police on foot, pigeons, fireworks |
| `acts.cjs`, `acts2.cjs` | Shops, armour, taxi, vigilante, races with rivals, rampage, helicopter, roadblocks, traffic lights, bumpers, saving |
| `transport.cjs` | Motorbike, bus and bus route, boats (boarding, top speed, running aground, swimming out), cable car round trip, metro ride |
| `ui.cjs`, `perf.cjs`, `skid.cjs` | Controls card and prompts, performance readout, skid marks |

Run one with `node games/ciutat-comtal/tests/logic2.cjs`. Screenshots are written to `tests/out/`.

Known flaky test: in `logic2.cjs` the mission 4 race autopilot drives blind at full speed. It sometimes rams enough cross-traffic to wreck its car. Re-run before treating that as a regression.
