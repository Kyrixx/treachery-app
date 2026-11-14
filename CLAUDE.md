# Treachery app

Real-time role and identity draw for the MTG Treachery variant, for a group of friends playing around one table, each on their phone.

## Stack and versions
- Backend: Go 1.27, `main` package at the repo root (`main.go`, `room.go`, `draw.go`). Only dependency: `github.com/coder/websocket`.
- Frontend: React 19 + Vite 8 + TypeScript 7 in `web/`, built into `web/dist` and embedded with `go:embed`.
- Always target the latest stable versions (check online, not from memory).

## Rules
- Identity secrecy: the server never sends a client another player's card, except the Leader's. `TestGameFlowKeepsIdentitiesSecret` enforces it.
- No hardcoded UI text: everything goes through `web/src/i18n.ts` (`en` is the reference, `fr` is typed `Record<Key, string>` so it must be complete). The server only sends error codes (`appError{Code, Params}`), translated client-side via `error_<code>`; `TestEveryErrorCodeIsTranslated` enforces it.
- Cards and the role distribution live only in Go (`cards.json`, `distribution` in `draw.go`); the client reads them from `GET /api/catalog` (rules page, card gallery). Don't copy them into TS.
- The WebSocket message format is duplicated: Go structs in `room.go`, TS types in `web/src/types.ts`. Change both.
- One global mutex guards all state; `handle` runs under that lock and is followed by `save()`.
- Rooms survive restarts via a JSON snapshot (`persist.go`, `DATA_FILE`). Snapshot types (`savedRoom`, `savedPlayer`) hold tokens and cards: never send them to clients. New `Player`/`Room` fields must be added to the snapshot too.
- `web/dist/.gitkeep` is committed and Vite uses `emptyOutDir: false`, so `go build` works on a fresh clone.
- Card images are English (`web/public/cards/<id>.jpg`): French ones are only published on Google Drive.
- Design docs under `docs/superpowers/` are local only (git-ignored).

## Commands
- `go test -race ./...`
- `cd web && npm test` (Vitest + jsdom; `FakeSocket` in `web/src/test/` drives the WebSocket)
- `cd web && npm run build` / `npm run dev` / `npm run typecheck`
- `go run ./tools/fetchcards`: regenerates `cards.json` and the images
- CI (`.github/workflows/ci.yml`) tests every push/PR and publishes `ghcr.io/tchapuis/treachery-app` from `main`
