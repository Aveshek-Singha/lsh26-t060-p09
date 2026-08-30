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
      are due and why — ordered by a stated rule, explained on the page. The list is
      keyed by **owner**, so someone with three vehicles is one call, not three, and is
      searchable by plate, owner, phone or item with All / Overdue / Due soon filters.
- [x] **4. A vehicle page per owner, and recording a service.** Every item with its next
      due date and cost. Recording a completed service resets that one item and grows
      the service history.

### Bonus features

- [x] **8-week workload forecast** so busy weeks are visible in advance (`/forecast`).
- [x] **Odometer entry** that recalculates every distance-based estimate on the vehicle.
- [x] **Copy-ready reminder message** per owner, naming the items due and the cost.

### Beyond the brief

Built after the four required features were complete and tested:

- **Service map** (`/map`) — every customer on the call list plotted on a real
  map of Dhaka, grouped by area so a home-service round can be planned by
  geography. Selecting a customer zooms to them and draws the route from the
  workshop with distance and drive time.
- **Dashboard** (`/dashboard`) — fleet health, work by rule, the eight-week
  workload and outstanding value by item, with filters that redraw every chart
  and a table view of the same numbers.
- **Called today** (`/called`) — the day's contact record, with undo.
- **Email reminder** — opens a prefilled Gmail draft (recipient, subject, body)
  and logs the owner as contacted. It never sends automatically.
- **Search with suggestions** on the call list, and **status filters plus sorting**
  on the fleet.
- **Record a service from the call list**, without opening the vehicle page.
- **Mark an owner as called** — stored against the working date, so advancing the
  date brings yesterday's calls back.
- **Print and CSV export** of the day's list.
- **Loading skeletons** on the list pages.

## Email

The email button opens a **Gmail compose draft** with the recipient, subject and
body already written, and logs the owner as contacted. **Nothing is sent
automatically** — the operator reads the message and presses Send.

That is a deliberate choice, not a shortcut. The event supplied no mail
credential, and the seeded addresses are on `example.com`, the domain IANA
reserves for documentation, which accepts no mail — so an automatic send could
only ever bounce. Composing in the operator's own account also means replies come
back to them.

Owner addresses are **generated demo data**, derived from the name
(`salma.ahmed@example.com`). Two owners in the dataset share a name, so
collisions fall back to appending the owner id. `npm run check:emails` verifies
every owner has a unique one.

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

The unit of the list is the **owner**, not the vehicle: the workshop rings a
person. An owner's score is computed over the union of their vehicles' due
items, so three vehicles each a little overdue can outrank one vehicle that is
slightly worse — which is right, because it is a single trip to the workshop.
In the seeded fleet this turns 41 vehicle rows into 27 calls.

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
| `npm run check:emails` | Confirms every owner carries a unique demo address |
| `npm run seed` | Resets the fleet to the seeded state (idempotent) |
| `npm test` | 86 unit tests over the pure due-date engine |
| `npm run test:e2e` | 51 end-to-end tests, one block per required feature |
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
lib/domain/     pure due-date engine and statistics — no database, no React
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

- **SMS delivery** for the reminder, rather than copy and paste.
- **Per-item intervals set by the workshop**, instead of the seeded defaults.
- **A capacity model** on the forecast — bays and hours, not just item counts —
  so a heavy week is measured against what the workshop can actually absorb.

## Live URL

**https://lsh26-t060-p09.vercel.app**

Opens on the call list with the fleet already seeded — no setup, no login.
`https://lsh26-t060-p09.vercel.app/api/health` reports what the running instance can see.

## Testing

79 automated tests, all passing:

- **86 unit tests** over the engine, the dashboard statistics and the distance maths — month-end clamping, zero and negative
  running rates, single-reading vehicles, targets already passed, the exact
  overdue/due-soon boundaries, money round-trips, and the ordering rule
  including its caps.
- **51 end-to-end tests** — one block per required feature, plus the odometer
  flow, both themes, a 375 px viewport, and a missing vehicle returning 404.

`npm run verify:reset` additionally checks the single-item reset constraint
against the live database for all three rule types.
