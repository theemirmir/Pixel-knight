# Pixel Knight

This repository currently contains a browser-saved snapshot of Pixel Knight. The snapshot is preserved with only trailing whitespace normalized, so no game behavior or visual styling is changed.

## Important recovery status

The saved HTML is **not a complete deployable build**. It was captured from a Vite development server and references files that were not included by the browser save:

- `src/game/input.ts`
- `src/game/map.ts`
- `src/game/knight.ts`
- `src/game/tiles.ts`
- `src/game/camera.ts`
- `src/game/palette.ts`
- `src/game/healthBar.ts`
- `src/net/lobby.ts`
- `src/style.css` (the current CSS is embedded in the HTML, but the module still imports this file)

The included `Pixel Knight_files/client` file is Vite's development/HMR client, not a production dependency. The lobby UI also depends on a separate HTTP/WebSocket multiplayer server. GitHub Pages can host the built front end but cannot run that server.

## Files currently preserved

- `Pixel Knight.html` — the saved page, with only trailing whitespace normalized
- `Pixel Knight_files/main.ts` — the captured Vite-transformed entry module, including an inline source map
- `Pixel Knight_files/client` — the captured Vite development client
- `CURSOR_PROMPT.md` — a focused prompt for recovering and preparing the original project

No images, audio files, fonts, or other standalone assets are referenced by the preserved HTML. The favicon is embedded as a data URL, and the game art appears to be canvas-drawn by the missing source modules.

## Safe path to a working GitHub Pages build

1. Recover the original project source, especially the files listed above and the multiplayer server source/configuration.
2. Restore its original `package.json` and lockfile rather than guessing dependency versions.
3. Run the existing project locally and verify lobby creation, joining, movement, jumping, dashing, slashing, health, elimination, and match restart.
4. Configure the front-end build with a relative or repository-aware base path (for Vite, commonly `base: './'` or `base: '/REPOSITORY_NAME/'`).
5. Configure the production front end to use an externally hosted HTTPS/WSS backend through an environment variable. Do not commit secrets.
6. Build the project and publish only the production output to GitHub Pages. Do not deploy the captured Vite client.

Until those sources are recovered, committing this repository is safe, but enabling GitHub Pages would publish a page whose scripts fail to load. The original files in the parent `code` folder have not been modified.
