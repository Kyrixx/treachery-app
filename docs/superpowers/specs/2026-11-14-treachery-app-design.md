# Treachery App — design et plan

## Context

Le groupe joue à Magic en mode Treachery, autour d'une même table, chacun avec son téléphone.
Il faut une app web publique (URL donnée au groupe) qui :
- crée une room avec un nombre de joueurs (4 à 8) et les raretés d'identités autorisées ;
- laisse les joueurs rejoindre en temps réel et se déclarer prêts ;
- lance le tirage et donne à chaque joueur son rôle et son identité, en secret.

Source des règles et des cartes : https://mtgtreachery.net/fr/ .
Le dossier `/Users/thomaschapuis/PhpstormProjects/treachery-app` est vide : projet neuf.

## Objectifs / non-objectifs

- Objectifs : mobile-first, temps réel, secret garanti côté serveur, crédit des illustrateurs, déploiement Docker sur le VPS de l'utilisateur, dernières versions des outils.
- Non-objectifs : comptes utilisateurs, suivi de partie (points de vie, dévoilements), app grand public, mode « Backstab Rumble ».
- Anti-objectif : un joueur peut lire l'identité d'un autre (devtools, réseau). Le serveur n'envoie jamais à un client une identité autre que la sienne, sauf celle du Leader.

## Approches considérées

- **Serveur temps réel maison, état en mémoire (choisi).** Le serveur fait le tirage et n'envoie que la carte du joueur. Limite acceptée : un redémarrage perd les rooms en cours.
- Supabase/Firebase : écarté, le secret des cartes demande des règles d'accès fines et une fonction serveur.
- PHP + Mercure : écarté, service en plus à héberger.
- Langage du backend comparé : Node, Bun, Go, Rust, Elixir. **Choix utilisateur : Go** (binaire unique, image Docker ~15 Mo, Go déjà installé). Coût accepté : types des messages écrits en Go et en TypeScript.
- Frontend : **React** (choix utilisateur). Hébergement : **VPS de l'utilisateur** avec Docker.

## Données métier (vérifiées sur le site)

| Joueurs | Leader | Traître | Assassin | Gardien |
|---|---|---|---|---|
| 4 | 1 | 1 | 2 | 0 |
| 5 | 1 | 1 | 2 | 1 |
| 6 | 1 | 1 | 3 | 1 |
| 7 | 1 | 1 | 3 | 2 |
| 8 | 1 | 2 | 3 | 2 |

- 62 identités. Raretés : U (23), R (21), M (14), S (4, toutes Traître, « chaotiques »).
- Par rôle : Leader U5/R3/M5 · Gardien U7/R7/M4 · Assassin U7/R8/M3 · Traître U4/R3/M2/S4.
- JSON : `https://mtgtreachery.net/rules/oracle/treachery-cards.json` (anglais), champs `id`, `name`, `types.subtype`, `rarity`, `text`, `artist`…
- Images : `https://mtgtreachery.net/images/cards/en/trd/062 - Leader - The Void Tyrant.jpg`. Les images FR n'existent pas à cette adresse (404) : elles ne sont publiées qu'en PNG sur Google Drive. **Décision d'implémentation : images EN.**
- Le Leader se révèle au début. Les autres rôles restent secrets.

## Design

### Versions (vérifiées le 14/11/2026)
- Go **1.27.4** (local : 1.27.3, à mettre à jour). WebSocket : `github.com/coder/websocket` **v1.8.15**, seule dépendance Go.
- Node **26.13.1 LTS**, utilisé seulement pour builder le front.
- React **19.3.1**, Vite **8.3.8**, `@vitejs/plugin-react` **6.3.0**, TypeScript **7.0.2**.
- Versions fixées dans `go.mod`, `package.json`, `.nvmrc`. Re-vérifier au moment d'installer.

### Structure (le moins de fichiers possible)
```
go.mod
main.go        // HTTP + WebSocket + embed du front
room.go        // état des rooms, messages, handlers
draw.go        // répartition, faisabilité, tirage (fonctions pures)
cards.json     // données réduites, embarquées dans le binaire
draw_test.go
room_test.go
tools/fetchcards/main.go
web/           // Vite + React + TS
  src/App.tsx, src/useRoom.ts, src/types.ts, src/styles.css
  public/cards/<id>.jpg
Dockerfile, docker-compose.yml, Caddyfile
```
- `main.go` sert `web/dist` via `//go:embed` et `http.FileServerFS`. Toute route inconnue renvoie `index.html`. WebSocket sur `/ws`.
- Pas de router React : l'URL `/r/ABCD` est lue depuis `location.pathname`.
- CSS simple mobile-first, pas de lib UI.
- i18n maison (`web/src/i18n.ts`, FR + EN), langue du navigateur par défaut, sélecteur dans le pied de page. Le serveur renvoie des codes d'erreur, jamais du texte.
- Concurrence : un seul `sync.Mutex` global sur la map des rooms. `// ponytail: mutex global, un mutex par room si beaucoup de rooms simultanées.`
- Aléatoire : `math/rand/v2` (graine cryptographique par défaut).

### Cartes
- `go run ./tools/fetchcards`, lancé une fois : télécharge le JSON et les images EN dans `web/public/cards/<id>.jpg`. Écrit `cards.json` réduit (`id, name, role, rarity, artist`). Résultat commité : l'app ne dépend pas du site pendant la partie.
- Chaque carte affichée porte « Illustration : <artist> ». Pied de page : crédits mtgtreachery.net et mention WotC.

### Rooms et flux
1. Accueil : « Créer une room » ou « Rejoindre » (code 4 lettres) + pseudo.
2. Création : nombre de joueurs (4–8) + cases U / R / M / S (S décochée par défaut). Le serveur refuse une config impossible avec un message clair (le client ne la pré-calcule pas, pour ne pas dupliquer les données).
3. Lobby : joueurs en temps réel, bouton « Prêt ». Lien de partage (Web Share API, repli copie). L'hôte voit « Lancer le tirage », actif quand la room est pleine et tout le monde prêt.
4. Tirage côté serveur : rôles mélangés selon le tableau, puis une identité distincte par joueur, parmi celles du rôle et des raretés autorisées.
5. Écran joueur : carte cachée, « Maintenir pour voir ». Rôle, image, nom, artiste. Le Leader et son identité sont visibles par tous.
6. « Nouvelle partie » (hôte) : mêmes joueurs, mêmes réglages, retour au lobby.

### Reconnexion et cycle de vie
- À l'arrivée, le serveur donne `playerId` + `token` secret, stockés en `localStorage`. À la reconnexion, le client renvoie le token et récupère l'état et sa carte.
- Avant tirage, un joueur déconnecté plus de 5 min quitte le lobby. Après tirage, il garde sa place.
- Rooms supprimées après 6 h sans activité (un `time.Ticker`).
- Pas de transfert d'hôte : l'hôte revient via son token.

### Protocole WebSocket (JSON, `{type, ...}`)
- Client → serveur : `create {nickname, playerCount, rarities}`, `join {code, nickname}`, `resume {code, token}`, `ready {value}`, `start`, `reset`.
- Serveur → client : `welcome {code, playerId, token}`, `room {players, settings, phase, hostId, leader?}`, `you {role, card}` (seulement au joueur concerné), `error {error: {code, params}}`.
- Validation à l'entrée : pseudo 1–20 caractères, code `[A-Z]{4}`, nombre 4–8, raretés ⊂ {U,R,M,S}, taille de message limitée.
- Types dupliqués : structs Go dans `room.go`, types TS dans `web/src/types.ts`.

### Docker et hébergement
- `Dockerfile` en 3 étapes : `node:26-alpine` build le front → `golang:1.27-alpine` build le binaire (`CGO_ENABLED=0`) → `gcr.io/distroless/static` (non-root), port 8080.
- `docker-compose.yml` : `app` + `caddy` (HTTPS automatique, WebSocket sans config spéciale). `Caddyfile` : `{$DOMAIN} { reverse_proxy app:8080 }`.
- Prérequis : un domaine ou sous-domaine qui pointe vers le VPS, ports 80/443 ouverts.

### Dev local
- `cd web && npm run dev` (Vite, proxy `/ws` → `localhost:8080`) + `go run .` en parallèle.

## Plan d'implémentation

0. `git init`, commit du design dans `docs/superpowers/specs/2026-11-14-treachery-app-design.md`. `CLAUDE.md` du projet avec les conventions (versions, structure, commandes).
1. Squelette : `go.mod`, `web/` (Vite React TS), proxy Vite, `.gitignore`.
2. `tools/fetchcards` → `cards.json` + `web/public/cards/`. Vérifier le chemin FR des images.
3. `draw.go` : table de répartition, `feasible(playerCount, rarities)`, `draw(players, settings)`.
4. `room.go` + `main.go` : état en mémoire, handlers WS, envoi ciblé de `you`, nettoyage.
5. `web/` : écrans Accueil, Création, Lobby, Carte ; hook `useRoom` (WS, reconnexion auto, `localStorage`).
6. Docker : `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.dockerignore`, README « Déployer ».

## Tests

`go test -race ./...`, stdlib uniquement (`testing`, `net/http/httptest`).
- `draw_test.go` (golden path) : pour 4 à 8 joueurs, les comptes de rôles respectent le tableau ; identités distinctes ; bon rôle ; rareté autorisée.
- `draw_test.go` (cas limites) : `feasible` faux pour 8 joueurs avec seulement S ; vrai pour 8 joueurs avec U seul ; `draw` renvoie une erreur si infaisable.
- `room_test.go` (intégration WS via `httptest.NewServer`) : 4 clients rejoignent, se mettent prêts, l'hôte lance ; chaque client reçoit exactement un `you` avec sa carte ; aucun message `room` ne contient d'identité autre que celle du Leader. `start` refusé si un joueur n'est pas prêt. `resume` avec le token rend la même carte.
- Front : Vitest + jsdom + Testing Library. `useRoom` (reprise de session, reconnexion, socket remplacé ignoré), `i18n` (interpolation, changement de langue, erreurs serveur), écran de jeu (Leader visible, carte révélée seulement pendant l'appui).

## Vérification de bout en bout

- `go test -race ./...` vert, `npx tsc --noEmit` dans `web/` sans erreur.
- Dev local, 4 onglets (dont un en vue mobile) : créer, rejoindre, prêt, tirage, recharger un onglet → la carte revient.
- `docker compose up --build` avec `DOMAIN=localhost` : même parcours via https://localhost.
- Inspecter les frames WS dans les devtools : aucune identité d'un autre joueur (hors Leader).
