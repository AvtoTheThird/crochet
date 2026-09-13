# PixelCount Studio

SvelteKit app for turning uploaded pixel art into tapestry / run-length stitch patterns.

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

SPA mode (`ssr = false`) with `@sveltejs/adapter-static` — ready for later platform features (auth, paywall).

Studio workflow steps are real routes so the browser back/forward buttons work:

| URL | Step |
|-----|------|
| `/studio/load` | Load image |
| `/studio/crop` | Crop |
| `/studio/grid` | Grid setup |
| `/studio/colors` | Color correction |
| `/studio/count` | Count |
| `/studio/walk` | Pattern walk |

`/` and `/studio` redirect to `/studio/load`. Future pages (`/login`, `/profile`, `/gallery`, …) can sit alongside `/studio` without conflicting.

The previous vanilla HTML/JS sources are archived under `_legacy/`.
