# Infinite Tower

An endless vertical platformer for the web featuring customizable avatars, responsive touch/keyboard controls, and a built-in pixel editor for crafting player skins. The project is implemented in vanilla HTML, CSS, and JavaScript with no runtime dependencies, making it easy to host on any static site platform.

## Features
- Endless runner gameplay with dynamic difficulty scaling, high-score tracking, and momentum-based movement.
- Pixel-art editor that saves custom designs to local storage and can export/import JSON files.
- Multiple visual themes, audio controls (music + SFX with volume/mute), and keyboard/touch input support.
- Accessible UI patterns (ARIA attributes, focus management, reduced-motion friendly), prepared for mobile and desktop play.

## Getting Started

The app loads ES modules, so you need to serve the files over HTTP instead of opening `index.html` directly from the filesystem.

```bash
# Option 1: using npm (installs http-server locally)
npm install
npm run dev

# Option 2: without npm dependencies (requires Python 3)
python3 -m http.server 5173
```

Then open http://localhost:5173 in your browser.

> **Note:** The preload link in `index.html` expects `docs/fonts/revamped-font/Revamped-X3q1a.ttf`. Add the font files or update the path before publishing.

## Project Structure

```
.
├── assets/         # Game art + audio used by the canvas and UI
├── index.html      # App shell and layout
├── js/
│   ├── app.js      # Entry point; wires the game and settings modules
│   ├── game.js     # Core gameplay loop, collision, scoring logic
│   ├── settings.js # Theme switching, settings panel behavior, audio hooks
│   ├── pixel/      # Pixel editor UI + persistence helpers
│   └── utils/      # Local storage and numeric helpers
└── style.css       # Layout, theming, responsive design
```

## Recommended Workflow
1. **Install dependencies:** `npm install` (installs only a lightweight static server).
2. **Run locally:** `npm run dev` serves the site with live reloading disabled for simplicity.
3. **Edit assets or scripts:** Update files under `assets/`, `js/`, or `style.css`.
4. **Commit regularly:** Follow conventional commits or a similar style to keep history clean.
5. **Publish:** Deploy the `WWW` directory to GitHub Pages, Netlify, Vercel, or any static host.

## Scripts

| Command        | Description                                |
| -------------- | ------------------------------------------ |
| `npm run dev`  | Serve the project on http://localhost:5173 |

## Contributing

If you plan to accept contributions:
- Document coding standards (e.g., formatting rules, linting) and preferred style in a `CONTRIBUTING.md`.
- Track feature ideas or bugs in GitHub Issues to keep scope organized.

## License

Choose and include a license that matches how you want others to use the project (MIT, Apache-2.0, proprietary, etc.). Add the full text in a `LICENSE` file before publishing the repository.
