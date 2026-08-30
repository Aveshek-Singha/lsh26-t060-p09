# Third-Party Licenses

Every dependency, font and data source used by this project, with its licence.
Nothing here is copied source: all third-party code arrives through `npm` and is
installed from the public registry, not vendored into this repository.

## Direct dependencies

| Dependency | Version | Purpose | License | Source |
|---|---|---|---|---|
| next | 16.3.3 | Application framework, routing, server actions | MIT | https://github.com/vercel/next.js |
| react | 19.2.8 | UI library | MIT | https://github.com/facebook/react |
| react-dom | 19.2.8 | React DOM renderer | MIT | https://github.com/facebook/react |
| mongodb | 7.6.0 | Official MongoDB Node.js driver | Apache-2.0 | https://github.com/mongodb/node-mongodb-native |
| zod | 4.5.4 | Runtime validation of server-action input | MIT | https://github.com/colinhacks/zod |
| leaflet | 1.9.4 | Map rendering for the home-service view | BSD-2-Clause | https://github.com/Leaflet/Leaflet |
| server-only | 0.0.1 | Build-time guard against importing server code into a client bundle | MIT | https://github.com/vercel/next.js |

## Development dependencies

| Dependency | Version | Purpose | License | Source |
|---|---|---|---|---|
| typescript | 5.9.3 | Type checking | Apache-2.0 | https://github.com/microsoft/TypeScript |
| tailwindcss | 4.3.3 | Styling | MIT | https://github.com/tailwindlabs/tailwindcss |
| @tailwindcss/postcss | 4.3.3 | Tailwind PostCSS plugin | MIT | https://github.com/tailwindlabs/tailwindcss |
| vitest | 4.1.11 | Unit test runner | MIT | https://github.com/vitest-dev/vitest |
| @playwright/test | 1.62.1 | End-to-end test runner | Apache-2.0 | https://github.com/microsoft/playwright |
| tsx | 4.23.13 | Runs the seed and verification scripts | MIT | https://github.com/privatenumber/tsx |
| @types/node | 24.13.3 | Node type definitions | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react | 19.2.18 | React type definitions | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react-dom | 19.2.5 | React DOM type definitions | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/leaflet | 1.9.22 | Leaflet type definitions | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

## Fonts

Both are loaded through `next/font/google`, which self-hosts them at build time.
No external font CDN is contacted at runtime.

| Font | Use | License | Source |
|---|---|---|---|
| Archivo | Headings and interface text | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Archivo |
| IBM Plex Mono | Number plates, odometer readings, money, day counts | SIL Open Font License 1.1 | https://fonts.google.com/specimen/IBM+Plex+Mono |

## Services used at runtime

| Service | Purpose | Terms | Notes |
|---|---|---|---|
| OpenStreetMap tiles | Map imagery on the service map | ODbL — attribution required | The required "© OpenStreetMap contributors" credit is rendered in the map's bottom-right corner. No API key. |
| OSRM demo router | Optional road route from the workshop to a customer | Public demo endpoint, no key | Strictly an enhancement. The app computes a straight-line distance itself and labels it as an estimate whenever the router does not answer, so the feature never depends on a third party being up. |
| Google Maps directions | The "Directions" links | Plain deep links | No SDK, no key, no data sent beyond the coordinates in the URL. |

### A note on react-leaflet

`react-leaflet`, the usual React wrapper, ships under the **Hippocratic License
2.1**, which is not an OSI-approved permissive licence and is outside the
families this event permits. It was deliberately **not** used. Leaflet itself is
BSD-2-Clause and is driven directly from a small client component instead.

## Data

| Asset | Purpose | Notes |
|---|---|---|
| `data/seed-case.json` | Seed fleet: 27 owners, 42 vehicles, 165 service items | Case `PUB-01`, extracted unmodified from the problem P09 public dataset supplied by the event organisers for this challenge. Reformatted into this project's field names by `lib/seed/normalize.ts`; no values were invented or altered. |

Owner names, phone numbers and number plates in that dataset are synthetic
sample data provided by the organisers. No real personal data is stored.

Email addresses and home-service addresses are **generated demo data**, not part
of the published dataset. Emails sit on `example.com`, which IANA reserves for
documentation and which accepts no mail. Addresses are real Dhaka neighbourhoods
at their approximate centroids — a recognisable city rather than a surveyed
address book.

## Notable transitive dependencies

The full installed tree is 78 packages, overwhelmingly MIT. Three warrant an
explicit note because they are not MIT/Apache/BSD/ISC:

| Package | License | Why it is present | Assessment |
|---|---|---|---|
| `@img/sharp-*` | Apache-2.0 **AND LGPL-3.0-or-later** | Optional platform binary that Next.js installs for image optimisation | **Not used by this application.** There is no `next/image` usage anywhere in the source, so no image optimisation runs. It is an optional transitive dependency of the framework, is not redistributed in this repository, and is not linked into any code we wrote. |
| `lightningcss` | MPL-2.0 | CSS transformer used internally by Tailwind v4 | Build-time only. MPL-2.0 is file-level copyleft and imposes no obligation on separate works that merely use the tool; the package is not modified and not redistributed here. |
| `caniuse-lite` | CC-BY-4.0 | Browser support data used by the CSS build | Build-time data table, unmodified, not redistributed. |

Remaining transitive licences in the tree: MIT (78), Apache-2.0 (12), ISC (4),
BSD-3-Clause (1), BSD-2-Clause (1), 0BSD (1).

No dependency in the tree is AGPL, GPL, SSPL, non-commercial, or personal-use-only.

## This project

The application source in this repository is the team's own work, written during
the event.
