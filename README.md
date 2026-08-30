# Service Register — Vehicle Service Due Predictor

LofiStack Hackathon 2026 · Problem **P09** · Team 060

A Dhaka servicing workshop keeps its schedule in a register book and in the
manager's head, so it finds out something was due only when the customer turns
up with a problem. This works out what is due on every vehicle, and tells the
workshop who to call today.

## What It Does

Every vehicle carries service items that fall due on their own terms:

- **Fixed date** — insurance, tax token, fitness certificate, battery warranty.
  The expiry date is the due date.
- **Time** — engine oil, air filter, AC service, coolant, spark plugs. Due a set
  number of months after the last service.
- **Distance** — brake pads, tyres, timing belt. Due after a set number of
  kilometres, converted into a **date** using how far that particular vehicle
  actually runs per day, measured from its own odometer history.

Each item is marked **overdue**, **due soon** (within 30 days) or **fine**, and
every result states the reasoning that produced it — `Runs 51.4 km/day · 1,240 km
to go`, or `Last done 26 Feb 2026 + 6 months`. Nothing is a black box.

## MVP Requirements Implemented

- [x] **1. A fleet with realistic data.** 42 vehicles belonging to 27 owners, each with
      3–5 service items across all three rule types, plus odometer readings and past
      service records.
- [x] **2. A next due date for every item, from its own rule.** Distance items are
      estimated from that vehicle's daily running. Every item is marked overdue,
      due soon or fine.
- [x] **3. A daily call list.** Which owner to ring, about which vehicle, which items
      are due and why — ordered by a stated rule, explained on the page.
- [x] **4. A vehicle page per owner, and recording a service.** Every item with its next
      due date and cost. Recording a completed service resets that one item and grows
      the service history.

### Bonus features

- [x] **8-week workload forecast** so busy weeks are visible in advance (`/forecast`).
- [x] **Odometer entry** that recalculates every distance-based estimate on the vehicle.
- [x] **Copy-ready reminder message** per owner, naming the items due and the cost.

## How the call list is ordered

The brief requires an order that can be explained, so it is stated on the page
and shown per row:

```
score = clamp(days overdue of the worst item, -30, +180)
      + min(total value of due work in thousands of taka, 40)
```

Urgency leads; money breaks ties. The value term is capped at 40 points so an
expensive job can never outrank a badly overdue safety item — brakes before
bodywork. Each row prints its own arithmetic, so any position in the list can be
checked by hand.

## How distance items are estimated

```
rate       = (latest km − earliest km) ÷ days between those readings
target km  = odometer at last service + the item's interval
due date   = working date + (target km − current km) ÷ rate
```

Two vehicles with the same interval and the same last service get **different**
due dates when they run different distances — which is the point. A vehicle with
fewer than two readings, or one that has not moved, is reported as *no estimate*
rather than being given a fabricated date.

## The working date

The dataset states that "today" is a property of the case, **not the clock**, so
the application stores a working date and shows it in the header. Change it and
every estimate recalculates — which is also the quickest way to see the distance
rules working. It defaults to the seeded case date, `2026-08-30`.

## How to Run Locally

```bash
npm install
cp .env.example .env.local     # then fill in MONGODB_URI
npm run seed                   # loads 27 owners and 42 vehicles
npm run dev                    # http://localhost:3000
```

### Other commands

| Command | What it does |
|---|---|
| `npm run check:db` | Verifies the Atlas connection and reports what is seeded |
| `npm run seed` | Resets the fleet to the seeded state (idempotent) |
| `npm test` | 52 unit tests over the pure due-date engine |
| `npm run test:e2e` | 18 end-to-end tests, one block per required feature |
| `npm run verify:reset` | Proves against the real database that recording a service resets one item only |
| `npm run build` | Production build |

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string |
| `MONGODB_DB` | no | Database name, defaults to `lsh26_p09` |
| `MONGODB_DNS_SERVERS` | no | Only for networks whose DNS refuses SRV/TXT lookups, which `mongodb+srv://` needs. Symptom: `querySrv ECONNREFUSED`. Leave unset in production. |

The event also supplied Google OAuth and Cloudinary credentials. **Neither is
used.** No required feature involves user accounts or file uploads, so no
authentication or media pipeline was built — a judge can open any page and use
the whole application with no login.

## What Is Mocked

**Nothing is mocked.** Every figure on screen is computed from data in MongoDB
by the engine in `lib/domain/`, and every write goes to the database.

Two things are worth stating plainly:

- **The fleet is seeded sample data**, not a real workshop's records. It is case
  `PUB-01` from the organisers' published P09 dataset — 27 owners, 42 vehicles —
  loaded unmodified. Names, phone numbers and plates in it are synthetic.
- **Costs are the expected price recorded against each item**, not live quotes.
  The reminder message says so to the customer.

## Architecture

```
lib/domain/     pure due-date engine — no database, no React, fully unit tested
lib/db/         MongoDB client, collections, repository (all queries and writes)
lib/seed/       loads and normalises the seed case
actions/        server actions: record service, add reading, set working date
features/       UI grouped by feature (call-list, vehicle, owner, shell)
app/            routes
tests/          unit (domain) and e2e (Playwright)
```

Due dates and statuses are **derived on every read, never stored**. At 42
vehicles the whole pass is sub-millisecond, and it makes staleness structurally
impossible after a service is recorded or the working date moves.

Money is handled as **integer paisa** throughout and formatted only at the edge,
so no total drifts. Dates are `YYYY-MM-DD` strings with their own arithmetic
helpers, because `new Date("2026-08-30")` parses as UTC and shifts a day in local
time, and `setMonth` overflows 31 Jan + 1 month into March.

## What We Would Build Next

- **Record a service from the call list**, without opening the vehicle page.
- **Mark a call as made**, so the list reflects who has already been rung today.
- **SMS delivery** for the reminder, rather than copy and paste.
- **Per-item intervals set by the workshop**, instead of the seeded defaults.
- **A capacity model** on the forecast — bays and hours, not just item counts —
  so a heavy week is measured against what the workshop can actually absorb.

## Live URL

_Not yet deployed._

## Testing

70 automated tests, all passing:

- **52 unit tests** over the engine — month-end clamping, zero and negative
  running rates, single-reading vehicles, targets already passed, the exact
  overdue/due-soon boundaries, money round-trips, and the ordering rule
  including its caps.
- **18 end-to-end tests** — one block per required feature, plus the odometer
  flow, both themes, a 375 px viewport, and a missing vehicle returning 404.

`npm run verify:reset` additionally checks the single-item reset constraint
against the live database for all three rule types.
