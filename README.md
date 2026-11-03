# Gather

A quieter place for photo albums and the people you want to keep close. Built with React, TypeScript and Vite, with original responsive styling and locally bundled fonts and sample photographs.

## Run

Requires Node.js 22.12+ (tested with Node 24) and npm.

```sh
git clone https://github.com/LucaNeerhut/Test.git
cd Test
npm ci
npm run dev
```

Open the address printed by Vite in your terminal, usually `http://localhost:5173`. Keep the terminal running while you use the app. If you already cloned the repository, run the npm commands from its root directory.

To serve a production build, run `npm run build` followed by `npm run preview`.

### Standalone download

After `npm ci`, run `npm run build:portable` to generate `exports/Gather.html` and `exports/Gather.zip`. These generated files are intentionally excluded from Git; the complete builder and bundled assets are included in the source. No extra tools beyond Node.js and npm are needed to rebuild them.

Extract the ZIP and open `Gather.html` in Chrome or Edge. The standalone HTML includes the app, fonts and sample photos. No server or publication is needed. Keep the file in the same location and use the same browser to retain local albums. Browser storage restrictions can vary. The managed cloud browser blocks `file://` navigation, so the automated portable test also exercises the exact HTML offline at an intercepted local test address. This local version has the same scope described below: there are no real accounts or online sharing.

## What works

- A finite album feed from sample friends, with circle filters, search and sorting.
- Create, edit and delete photo albums; upload and resize JPEG, PNG, WebP or AVIF images; reorder photos and add captions. Up to 30 photos per album, 15 MB per source file.
- Album audiences and smaller audiences for individual photos: friends, family, besties, public or only you. An audience preview shows which photos each circle would see.
- Editable circles, saved albums, personal notes and a simple private love reaction.
- A yearbook grouped by year, automatically starting with a cover highlight from new albums. Star or unstar any of your photos to curate it.
- Export a standalone HTML yearbook with embedded photographs. Choose an audience edition to exclude photos outside that audience. The downloaded file can be opened offline and printed to PDF from the browser.
- Preferences for album cadence and an in-app prompt.
- IndexedDB persistence, storage error reporting and stale-tab write protection.

## Scope of this version

This is a functional **local-first preview**, not a hosted social network. Sample people are fictional. Albums, circles, notes and reactions are saved in this browser on this device. They survive refresh, but clearing site data removes them. The yearbook export is a portable copy of its selected highlights; it is not a full database backup.

Audience controls currently drive previews and export filtering. They are **not authenticated access control**. There is no sign-up, online photo storage, invitation delivery, cross-device sync, scheduled job, push notification or real publication. Exporting produces a file; whoever receives it can view all its contents, and later privacy changes cannot revoke that file.

For a production release, the next step is an authenticated backend with server-enforced album and photo permissions, private object storage, membership and invitation handling, backups, and scheduled yearbook generation. Do not upload sensitive personal photographs to a shared browser preview.

## Validation

```sh
npm run build       # TypeScript and optimized production build
npm test            # Audience, seed integrity and IndexedDB tests
npm run test:e2e     # Real Chromium browser flows
npm run test:portable # Offline standalone artifact (run build:portable first)
```

Before running browser tests locally, install Playwright's browser with `npx playwright install chromium`. The tests use Playwright-managed Chromium by default, or `/usr/bin/chromium` when it is already available. To choose another installed Chromium browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path. The standard browser suite starts a Vite server when needed; the portable suite does not need a server. Test results and traces are generated under ignored directories.

## Design

Warm paper, sage green, editorial serif headings, album collages and small personal touches. There are no follower counts, public popularity metrics, autoplay or infinite scrolling. The mobile layout includes a collapsible navigation drawer and usable upload, editing and yearbook flows.

Sample asset provenance is recorded in [docs/PHOTO_SOURCES.md](docs/PHOTO_SOURCES.md). Replace demo photographs with your own or separately licensed images before a public launch.
