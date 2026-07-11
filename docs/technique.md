# Documentation technique

## Architecture

Lineup est une SPA statique sans framework, serveur applicatif, dépendance externe ni compilation.

- `index.html` fournit la navigation et les points de montage.
- `styles.css` contient la présentation mobile-first, les composants joueurs, graphiques et modales.
- `app.js` contient l’état, les migrations, les trois vues, les règles métier et les événements.
- `docs/regles-affaires.md` décrit le comportement fonctionnel.

GitHub Pages sert directement les fichiers et `CNAME` associe le site à `lineup.imaginemoi.ca`.

## État local

La clé principale est `lineup-hockey-v2`; `lineup-hockey-v1` est lue comme solution de repli.

```text
state
├── players[]
│   ├── id, name
│   ├── positions[]
│   ├── ratings { goalie, defense, attack }
│   ├── cardio
│   ├── status: regulier | remplacant
│   ├── active: boolean
│   └── incomplete: boolean
├── settings
│   ├── white, black
│   ├── balancePositions
│   └── historyDepth
├── match
│   ├── date
│   ├── present[]
│   ├── teams { white[], black[] }
│   └── presenceInitialized
└── history[]
    ├── date
    └── teams
        ├── white { name, players[] { id, name } }
        └── black { name, players[] { id, name } }
```

Une entrée d’équipe courante est `{ player, position }`. Une archive conserve seulement le nom de l’équipe et des objets `{ id, name }`; l’identifiant est technique et n’est jamais affiché.

## Migration et normalisation

- L’ancien `injured: true` devient `active: false`; les autres anciens joueurs deviennent actifs.
- `injured` n’est plus réécrit dans la sauvegarde.
- Les propriétés manquantes, cotes et tableaux d’équipe sont normalisés.
- Les anciennes entrées contenant `assignedPosition` deviennent `{ player, position }`.
- Les équipes courantes sont nettoyées des joueurs absents ou inactifs au chargement.
- Les anciennes archives contenant des copies complètes et des positions sont réduites automatiquement au nouveau format `{ id, name }`.

## Rendu et composant joueur

`render()` reconstruit `matchView()`, `playersView()` ou `historyView()`. Les modales sont montées séparément dans `#modal-root`.

`playerIdentity()` fournit la présentation uniforme du joueur. Toutes les positions possèdent leur couleur; une position affectée reçoit en plus l’état visuel sélectionné.

Les filtres Joueurs sont conservés en mémoire dans `playerFilters`, mais ne sont pas persistés. La recherche utilise une normalisation Unicode NFD pour retirer les accents avant la comparaison.

## Présences et affectations

La carte de synthèse des présences ouvre une modale dynamique :

- `attendanceTab` choisit réguliers ou remplaçants;
- `attendanceQuery` filtre le nom;
- `lastPlayed()` cherche la date la plus récente d’un match archivé contenant l’identifiant du joueur.

Les remplaçants sont triés par date décroissante, puis par nom; une date absente les place après les joueurs ayant déjà participé.

Les affectations n’utilisent aucun glisser-déposer. La modale « Modifier » produit seulement les combinaisons permises, empêche un deuxième gardien dans la même équipe et garantit l’unicité du joueur avec `removeFromTeams()` avant l’ajout. Le choix actuel possède `aria-pressed="true"`; le sélectionner de nouveau retire l’affectation. Les modifications sont immédiates et la modale reste ouverte jusqu’au bouton « OK ».

## Optimisation

`ensureGoaliesForOptimization()` applique les règles des gardiens exclusifs ou valide leur placement manuel. `optimizeTeams()` conserve ensuite ces gardiens et crée 2 500 répartitions candidates des autres joueurs présents.

Le score additionne :

```text
écart de force ajustée
+ écart de force en défense
+ écart de force en attaque
+ 5 × écarts de nombres D/A (si activé)
```

La force ajustée vaut :

```text
somme des notes aux positions affectées
+ cardio moyen des patineurs × (1 - min(joueurs additionnels, 4) / 4)
```

L’indicateur visuel est `max(0, 100 - score × 2)` et ne modifie pas l’algorithme.

## Import, export et réinitialisation

`parseImport()` accepte les formats historiques et le nouveau champ ACTIF/INACTIF. Il valide chaque ligne indépendamment et renvoie joueurs, doublons et erreurs.

`exportText()` produit un format réimportable trié par statut puis par nom. Le téléchargement utilise un `Blob` local et une URL temporaire.

La réinitialisation du bassin vide `players`, `match.present` et `match.teams`, tout en conservant `history` et `settings`.

## Accessibilité et mobile

- Les cartes interactives sont de vrais boutons ou libellés natifs.
- Les modales utilisent `role="dialog"` et `aria-modal="true"`.
- Les actions disposent de noms accessibles et de zones tactiles d’au moins 44 px.
- Sur mobile, les modales deviennent des panneaux presque plein écran et les équipes sont empilées.
- La sélection d’un joueur fait défiler vers le formulaire sans ouvrir le clavier.
- Aucun `alert()`, `confirm()` ni glisser-déposer n’est utilisé.

## Vérification

```powershell
node --check app.js
git diff --check
```

Tests manuels recommandés : migration Actif/Inactif, filtres et pagination, import/export, présences, affectations et retraits, gardiens exclusifs, optimisation, archivage et affichage mobile.
