# Treachery

Tirage des rôles et identités pour le mode [Treachery](https://mtgtreachery.net/fr/) de Magic: The Gathering.
Chaque joueur ouvre l'app sur son téléphone, rejoint la room, se met prêt ; l'hôte lance le tirage.

## Développer

Prérequis : Go 1.27, Node 26 (`nvm use`).

```sh
cd web && npm install && npm run build && cd ..   # une fois : go:embed a besoin de web/dist
go run .                                          # serveur sur :8080
cd web && npm run dev                             # front sur :5173, proxy /ws → :8080
```

Tests : `go test -race ./...` et `cd web && npm test && npm run typecheck`.

Pour rafraîchir les cartes depuis mtgtreachery.net : `go run ./tools/fetchcards`.

## Déployer sur un VPS

Prérequis : Docker, un (sous-)domaine qui pointe vers le VPS, ports 80 et 443 ouverts.

```sh
git clone <repo> treachery && cd treachery
cp .env.example .env        # renseigner DOMAIN
docker compose up -d --build
```

Caddy obtient le certificat HTTPS tout seul. Mettre à jour : `git pull && docker compose up -d --build`.
Les rooms vivent en mémoire : un redémarrage coupe les parties en cours.

## Crédits

Identités, textes et illustrations : [mtgtreachery.net](https://mtgtreachery.net/). Chaque illustration appartient à son artiste, crédité sur la carte.
Magic: The Gathering © Wizards of the Coast. Projet non officiel, usage privé.
