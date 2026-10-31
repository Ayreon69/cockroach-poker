# Cockroach Poker

**Glisse une bestiole, annonce n'importe quoi, et regarde-les douter.**

👉 **Jouer : https://cockroach-poker-kksi.onrender.com** (la première ouverture peut prendre jusqu'à une minute, le temps que le serveur gratuit se réveille)

Jeu multijoueur en ligne de bluff, à jouer entre amis depuis un navigateur, sur téléphone ou ordinateur, sans compte ni installation.
D'après *Cockroach Poker* (*Kakerlakenpoker*, *Le Poker des Cafards*), de Jacques Zeimet, édité par Drei Magier Spiele (projet de fans, non officiel, avec ses propres illustrations).

## Règles en bref

- 64 cartes : huit bestioles (cafard, chauve-souris, mouche, crapaud, rat, scorpion, araignée, punaise), en huit exemplaires chacune. Tout est distribué ; à 3, 5 ou 6, certains ont une carte de plus, c'est normal.
- À son tour, on glisse une carte face cachée à un autre joueur en annonçant une bestiole, vraie ou fausse.
- Le receveur **répond** « c'est vrai » ou « c'est faux » : s'il a raison, celui qui lui a glissé la carte la prend face visible devant lui ; sinon, c'est lui qui la prend.
- Ou bien il **regarde la carte** en secret et la refile à quelqu'un qui ne l'a pas encore vue, avec la même annonce ou une autre. Quand tous l'ont vue, le dernier doit répondre.
- Celui qui prend la carte lance la suivante.
- On perd dès qu'on a quatre bestioles identiques devant soi, ou quand c'est à soi de lancer une carte et qu'on n'en a plus. Un seul perdant : tous les autres gagnent.
- À deux : dix cartes écartées sans être regardées, pas de passe, et l'on perd à cinq bestioles identiques.

Les règles viennent du livret de l'éditeur (version française distribuée par Gigamic) : distribution complète et inégale, passe vers un joueur qui n'a pas vu la carte, dernier receveur obligé de répondre, joueur qui prend la carte lançant la suivante, deux conditions de défaite et variante à deux. Sont des choix de ce jeu : le tirage au sort du premier joueur (le livret fait commencer le plus jeune), la donne qui part de lui, le temps de réflexion réglable avec pilote automatique, et la défaite par main vide annoncée dès la révélation de la carte qui y mène.

## Fonctionnalités

- Tables privées de 2 à 6 joueurs avec code à 4 lettres, lien d'invitation, partage natif et QR code
- Une carte en trois gestes : la carte dans ta main, le joueur, puis la bestiole parmi huit grandes planches
- Trois boutons clairs pour répondre : « C'est vrai », « C'est faux », et « Regarder et passer » quand quelqu'un ne l'a pas encore vue
- Le trajet de la carte au centre de la table : qui l'a eue, qui l'a vue, et l'annonce en cours
- La révélation : la réponse claque, la carte se retourne, un tampon tombe (« Démasqué ! », « Gobé ! »…)
- Les cartes face visible rangées en piles par bestiole, qu'on compte des yeux comme sur une vraie table
- Aucune aide à la mémoire ni au calcul : ni compteur, ni alerte de danger, ni historique des annonces. Le serveur n'envoie que l'annonce en cours, le trajet en cours et le nombre de cartes en main de chacun
- Bots qui bluffent de façon variée et ne connaissent que leur main, les cartes visibles et le trajet en cours ; partie d'entraînement en un clic
- Reprise automatique après une coupure, pilote automatique si un joueur s'absente ou laisse filer son temps, spectateurs
- Réactions et petites phrases, règles illustrées consultables en jeu, distinctions de fin de partie
- Sons synthétisés et vibrations ; animations brèves qui s'effacent pour qui préfère moins de mouvement

## Développement

```bash
npm install
npm run dev:server   # serveur temps réel sur http://localhost:3090
npm run dev:client   # interface sur http://localhost:5181
npm test             # règles, bots, minuteries et secrets
npm run build && npm run e2e   # partie complète avec de vrais clients connectés et un spectateur
```

`CR_FAST=1` accélère les bots et les chronos (tests locaux uniquement).

## Architecture

- `shared/` : contrat client/serveur (vues, bestioles, seuil de défaite)
- `server/` : Express + Socket.IO, moteur de table (`room.ts`), bots (`bots.ts`). Le serveur fait autorité : la main d'un joueur ne sort que vers lui, la bestiole en transit seulement vers ceux qui l'ont regardée, et les cartes écartées à deux jamais
- `client/` : React + Vite + Framer Motion. Les huit bestioles sont gravées en SVG dans `components/Beasts.tsx`, la table dans `screens/Table.tsx`, la révélation dans `screens/Reveal.tsx`
- Déploiement : un seul service Node (`npm ci && npm run build`, puis `npm start`)
