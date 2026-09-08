# Gradient — skate route planner

Route planning for electric skateboards. Given a chain of stops (origin, any number of
waypoints, destination), it profiles the terrain, colours the route by gradient, and
scores it against a specific board's climb limit, braking limit and battery capacity.

UI follows the Google Maps Directions pattern: full-screen map behind a floating white
panel with a stacked list of stop inputs (blue dot origin, grey numbered waypoints, red
pin destination), a reverse-order button, and a saved-places chip row backed by
`localStorage` (`gradient-presets-v1`) — click the ★ on any stop to save it, click a
saved chip to fill whichever stop was last focused.

Status: working prototype. Scores routes correctly. Does **not** yet optimise for
gradient — see [Limitation 1](#1-routing-is-not-gradient-aware-blocking).

---

## Run it

Three flat files, no build step, no package manager, no API keys.

```
index.html
manifest.webmanifest
sw.js
```

Serve over HTTPS from one directory. GitHub Pages works. Opening `index.html`
from `file://` runs the app but the service worker will not register, so nothing
installs or caches.

```bash
python3 -m http.server 8080   # localhost is treated as a secure origin
```

---

## Architecture

Single-file vanilla JS. No framework, no bundler. Leaflet 1.9.4 from unpkg is the
only runtime dependency.

### Data flow

```
address strings
  → Nominatim geocode          (1 req/sec, hard rate limit)
  → OSRM route                 (returns GeoJSON polyline, no elevation)
  → resample every 50 m
  → Open-Meteo elevation       (batched 100 coords/request)
  → 3-point moving average     (DEM noise suppression)
  → per-segment grade + energy integration
  → verdict + SVG profile + Leaflet overlay
```

### External services

| Service | Endpoint | Key | Notes |
|---|---|---|---|
| Geocoding | `nominatim.openstreetmap.org` | none | 1 req/sec ceiling; usage policy forbids production load |
| Routing | `routing.openstreetmap.de/routed-bike` | none | primary; no uptime guarantee |
| Routing fallback | `router.project-osrm.org` | none | driving profile only |
| Elevation | `api.open-meteo.com/v1/elevation` | none | 30 m DEM, CORS enabled |
| Tiles | `tile.openstreetmap.org` | none | respect the tile usage policy |

### Key functions in `index.html`

| Function | Contract |
|---|---|
| `haversine(a, b)` | metres between two `[lat, lon]` pairs |
| `resample(coords, step)` | walks the polyline emitting a point every `step` m, carrying the remainder across vertices. Unit-tested: gaps are exactly `step` except the final remainder |
| `elevations(pts)` | chunks at 100 coords per request, returns a flat array aligned to `pts` |
| `segWh(dist, grade, mass, v)` | Wh consumed over one segment |
| `band(grade)` | `{c: hex, k: label}` for a gradient. **Asymmetric — see below** |
| `profileSVG(pts, elev, cum)` | the hero elevation chart |

---

## The physics model

Do not "simplify" this. The numbers were validated by hand against an independent
calculation before the code was written.

```js
const G=9.81, RHO=1.2, CDA=0.65, CRR=0.02, EFF=0.80, USABLE=0.87;

f_roll = CRR * mass * G
f_air  = 0.5 * RHO * CDA * v²
f_grav = mass * G * sin(atan(grade))
f      = max(0, f_roll + f_air + f_grav)      // clamped: no regen credited
Wh     = (f * distance) / EFF / 3600
```

`mass` is rider + kit + the active mode's vehicle mass (6.8 kg e-skate, 22 kg
e-bike, 14 kg e-scooter, 12 kg EUC). `USABLE` discounts nameplate capacity for BMS
cutoff and the reality that nobody rides to 0%.

**Regression values** (e-skate defaults: mass 116.8 kg, drivetrain 80%):

| Case | Expected |
|---|---|
| Flat, 25 km/h, 1 km | 14.5 Wh |
| Flat, 40 km/h, 1 km | 24.7 Wh |
| 1.9 km with 60 m ascent, 25 km/h | 51.4 Wh |

If a change moves these by more than ~5%, the change is wrong.

**Human-powered modes** (push skate, pedal bike, kick scooter) run the same
integration with muscular efficiency (~24%) instead of drivetrain efficiency, so
Wh is metabolic energy and the UI shows kcal (×0.86). Spot values: ~27 kcal/km
pushing at 12 km/h, ~25 kcal/km pedalling at 20 km/h, ~17 kcal/km kicking at
12 km/h. The "battery" is a comfortable day's output (fully available, no BMS
cutoff) and verdict copy switches to food/effort wording.

**The clamp at zero matters.** Descents draw nothing rather than returning energy.
This is deliberate: the reference board (Journ-E Phantom) publishes only
"Electronic brake EBS" with no regeneration claim, while a sibling board in the same
range is explicitly marketed as regenerative. Assume no recovery until measured.
If you add a regen toggle, cap recovery at 60% of the negative term — real-world
recovery on this class of hardware runs 3–8% of consumption.

---

## Gradient bands are deliberately asymmetric

```
≤ -12%   past braking       (oxblood)
≤  -8%   steep descent      (rust)
≤  -4%   watch your speed   (ochre)
  ±4%    easy going         (moss)
<  10%   working climb      (sage)
<  15%   hard climb         (ochre)
≥  15%   at the motor limit (rust)
```

A +10% climb is "working". A -10% descent is "steep" and one band more severe.
This is the core product thesis and a reviewer will try to symmetrise it.

**Rationale:** on a bicycle, uphill is the cost. On a skateboard, uphill costs
energy but downhill costs control. A grade the motors will grind up is a grade the
electronic brake may not hold, and electronic braking is *weakest on a full pack*
because a full battery has nowhere to put regenerated current — so the danger peaks
immediately after charging. A downhill grade past the braking limit returns a `stop`
verdict, not a warning. Keep it that way.

---

## Known limitations

### 1. Routing is not gradient-aware (blocking)

OSRM has no elevation support and cannot cost on slope. The app therefore **scores
the route it was handed** rather than searching for a flatter one. This is the gap
between the current prototype and the stated product goal.

### 2. DEM resolution is coarser than a street

Free DEMs (SRTM, Copernicus GLO-30) are 30 m horizontal. A street is ~15 m wide, so
each sample averages the road with the terrain beside it. Long climbs resolve fine;
short steep pitches get smoothed away — exactly the ones that matter here. No free
1 m LiDAR exists for South Africa. The 3-point moving average in `sm` suppresses
noise but cannot add resolution. Do not present gradients to users as precise.

### 3. Nominatim is not viable in production

Its usage policy caps automated use at 1 req/sec and prohibits heavy traffic. The
1100 ms delay in the click handler respects this for one user; it will not survive
real traffic.

### 4. No surface or smoothness costing

OSM `surface=*` and `smoothness=*` tags are sparse in Cape Town. A route over
cobbles scores identically to smooth tar. Small wheels care enormously about this.

---

## Roadmap

### Task 1 — Swap in gradient-aware routing (highest value)

Replace `route()` with GraphHopper. Its custom-model DSL exposes `average_slope` and
`max_slope` as first-class costing variables, which is the only clean way to get the
asymmetric cost into the search rather than the scoring.

```json
{
  "profile": "bike",
  "custom_model": {
    "priority": [
      { "if": "average_slope > 6",  "multiply_by": 0.4 },
      { "if": "average_slope > 12", "multiply_by": 0.05 },
      { "if": "average_slope < -8", "multiply_by": 0.15 },
      { "if": "average_slope < -12","multiply_by": 0.0 },
      { "if": "surface == COBBLESTONE || surface == GRAVEL", "multiply_by": 0.2 }
    ],
    "speed": [
      { "if": "true", "limit_to": 30 }
    ]
  }
}
```

Note the asymmetry survives into the routing weights: -12% is hard-blocked at 0.0
while +12% is merely heavily penalised at 0.05.

GraphHopper also returns elevation inline when `elevation=true`, which removes the
Open-Meteo round trip and roughly halves the request count.

Self-hosting alternatives if the free tier is too small: Valhalla (dynamic costing,
heavier to run) or BRouter (light, custom profile language, cyclist-oriented).

**Done when:** requesting a route between two points separated by a ridge returns a
path around it rather than over it, and the returned route differs measurably from
the OSRM path on at least one Cape Town test case.

### Task 2 — Route alternatives, ranked

Request `alternatives=true`, score each with the existing pipeline, present them
sorted by verdict severity rather than by duration. The scoring code already
handles this; only the UI is missing.

**Done when:** the user sees 2–3 options with distance, climbing and battery cost
side by side, and the flattest is not necessarily first if it is far longer.

### Task 3 — Board profiles as data (partially done)

`MODES` in `index.html` already holds per-transport-mode physics
(`cda/crr/eff/usable/speed/vehicleKg`), board presets (`Wh|climbLimit|brakeLimit`)
and mode-specific braking verdict copy, persisted via `gradient-transport-v1`.
Still missing: derating — a rider near the load limit should see the climb
limit reduced, since rated climb figures assume a light rider.

### Task 4 — Replace geocoding

Photon, Pelias, or a self-hosted Nominatim. Remove the 1100 ms delay once done.

### Task 5 — Crowdsource gradient corrections

The only realistic path past Limitation 2. Record rider GPS traces with barometric
altitude where available, aggregate per OSM way, override the DEM where enough
traces agree. This is a product in itself, not a patch.

---

## Constraints

- No build step. If a change requires webpack, reconsider it.
- No `localStorage` or `sessionStorage` if this is ever pasted into a Claude artifact
  preview — they are unsupported there. Plain files on a real host are fine.
- The service worker must never cache routing or geocoding responses. A cached route
  hides a closed road. Tiles and elevation are cached permanently and deliberately:
  terrain height does not change.
- Keyboard focus is visible and the layout is responsive to mobile. Keep both.

---

## Legal note — keep this in the UI

Electric skateboards cannot be legally ridden on public roads in South Africa. Under
the National Road Traffic Act 93 of 1996 anything self-propelled is a motor vehicle,
motor vehicles on public roads must be registered and licensed, and no registration
category exists for a motorised skateboard — so there is no compliance route to take.
Pavements form part of the public road reserve and are covered by the same position.

The practical exposure is not a traffic fine but personal liability and insurance
response after an incident on an unregistered vehicle.

This means a "private property" mode — estates, campuses, private trails, promenades
— is arguably the real product rather than a feature. The disclaimer currently in the
footer should not be removed.
