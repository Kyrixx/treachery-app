# Treachery app

Tirage de rôles/identités Treachery (MTG) en temps réel, pour un groupe d'amis autour d'une table. Design : `docs/superpowers/specs/2026-11-14-treachery-app-design.md`.

## Stack et versions
- Backend Go 1.27, package `main` à la racine (`main.go`, `room.go`, `draw.go`). Seule dépendance : `github.com/coder/websocket`.
- Front React 19 + Vite 8 + TypeScript 7 dans `web/`, buildé dans `web/dist` puis embarqué via `go:embed`.
- Toujours viser les dernières versions stables (vérifier en ligne, pas de mémoire).

## Règles à respecter
- Secret des identités : le serveur n'envoie jamais à un client la carte d'un autre joueur, sauf celle du Leader. `TestGameFlowKeepsIdentitiesSecret` le vérifie.
- Aucun texte affiché en dur : tout passe par `web/src/i18n.ts` (`en` = référence, `fr` typé `Record<Key, string>` donc complet). Le serveur n'envoie que des codes d'erreur (`appError{Code, Params}`), traduits côté client via `error_<code>` ; `TestEveryErrorCodeIsTranslated` le vérifie.
- Le format des messages WS est dupliqué : structs dans `room.go`, types dans `web/src/types.ts`. Modifier les deux.
- Un mutex global protège tout l'état ; `handle` est appelé sous ce verrou.
- `web/dist/.gitkeep` est commité et Vite a `emptyOutDir: false` : `go build` marche sur un clone neuf.
- Images en anglais (`web/public/cards/<id>.jpg`) : les FR ne sont publiées que sur Google Drive.

## Commandes
- `go test -race ./...`
- `cd web && npm run build` / `npm run dev` / `npm run typecheck`
- `go run ./tools/fetchcards` : régénère `cards.json` et les images
- `docker compose up -d --build` avec `DOMAIN` dans `.env`
