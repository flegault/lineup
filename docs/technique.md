# Documentation technique

## Architecture

Lineup est une SPA statique sans framework, serveur applicatif, dépendance externe ni compilation.

- `index.html` contient l’en-tête, la navigation et les points de montage.
- `styles.css` contient la présentation mobile-first, les composants et le radar SVG.
- `app.js` contient l’état, les vues, les règles métier et les événements.

GitHub Pages sert directement les fichiers et `CNAME` associe le domaine personnalisé.

## Stockage local

La clé principale est `lineup-v1`. Si elle n’existe pas, les anciennes clés sont supprimées et un état neuf est créé.

```text
state
├── schemaVersion: 1
├── players[]
│   ├── id, name
│   ├── positions[]
│   ├── ratings { goalie, offense, defense }
│   ├── cardio
│   ├── status: regulier | remplacant
│   ├── active
│   └── incomplete
├── settings
│   ├── white, black
│   ├── balancePositions
│   └── similarityMode: similar | mixed | different
├── match
│   ├── date
│   ├── present[]
│   ├── goalies { white, black }
│   ├── teams { white[], black[] }
│   │   └── { playerId, position }
│   └── prepared
└── history[]
    ├── date
    └── teams
        ├── white { name, players[] { id, name } }
        └── black { name, players[] { id, name } }
```

Les joueurs constituent l’unique source de vérité. Les équipes courantes ne conservent plus de copie des fiches.

## Rendu

`render()` reconstruit Match, Joueurs ou Historique. `renderModal()` monte séparément les modales dans `#modal-root`.

`playerIdentity()` produit la même représentation dans la liste des joueurs, les présences, À assigner, les équipes et les gardiens. Les pastilles compactes affichent G, D ou A avec leur cote sur la même ligne.

Les recherches sont normalisées en Unicode NFD pour ignorer les accents. Les filtres de la page Joueurs et de la modale des présences, incluant la position, restent en mémoire sans être persistés.

## Gardiens et assignations

`reconcileGoalies()` nettoie les choix invalides et place automatiquement deux gardiens exclusifs. `goalieValidation()` vérifie la disponibilité, l’unicité et l’inclusion de tous les gardiens exclusifs.

Les identifiants verrouillés dans `match.goalies` doivent correspondre aux entrées G des équipes. `applyGoalieSelections()` maintient cet invariant après chaque changement.

La modale ordinaire ne propose que D et A. La modale dédiée change les gardiens par sélection directe dans la colonne d’une équipe.

## Optimisation et statistiques

`optimizeTeams()` conserve les gardiens, répartit tous les autres présents et évalue 2 500 candidats.

Pour chaque équipe, `teamStats()` calcule :

```text
gardien = cote G du gardien
attaque = somme OFF des joueurs non gardiens
défense = somme DEF des joueurs non gardiens
cardio = moyenne réelle des joueurs non gardiens
cardio effectif = cardio × (1 - min(max(nombre - 4, 0), 4) / 4)
```

Le score d’un candidat est la moyenne des écarts normalisés G, OFF, DEF et cardio effectif. Lorsque l’équilibre des positions est activé, un cinquième composant compare les nombres D et A.

`latestHistoryMatch()` choisit l’archive dont la date est la plus récente. `historicalReference()` construit les paires de coéquipiers encore présents; `candidateSimilarity()` calcule la proportion de ces paires réunies dans un candidat, sans dépendre du côté Blancs/Noirs.

Le meilleur score d’équilibre est déterminé en premier. Les candidats à au plus `0,03` de ce score sont admissibles, ce qui correspond à trois points de qualité. Similaires maximise ensuite la proportion répétée, Différentes la minimise et Mélangées conserve le meilleur score. Sans paire comparable, le mode est forcé à Mélangées.

Le pourcentage affiché vaut `100 × (1 - score)`, borné entre 0 et 100.

Le radar est un SVG à quatre axes. G et cardio sont normalisés sur 10; OFF et DEF utilisent comme dénominateur commun le plus grand effectif non gardien des deux équipes multiplié par 10. Le tableau reste la référence pour les valeurs exactes.

## Cycle et archives

`prepared` passe à vrai lors d’une assignation manuelle, d’un choix manuel de gardien ou d’une optimisation. Cette propriété est persistée afin de préserver la confirmation Nouveau après rechargement.

`resetMatch()` vide date et assignations, restaure les réguliers actifs et réconcilie les gardiens. `restartAssignments()` conserve date et présences. L’archivage crée une copie minimale `{ id, name }`, puis appelle la remise à zéro.

`lastPlayed()` utilise les identifiants archivés pour classer les remplaçants.

## Import et export

`parseImport()` accepte uniquement :

```text
REG | Nom | GDA | G,OFF,DEF,CARDIO | ACTIF
REM | Nom | INACTIF
```

Les lignes sont validées indépendamment. `x` doit correspondre à une cote non applicable. Le fichier téléchargé commence par `\uFEFF`; le presse-papiers reste sans BOM.

## Mobile et accessibilité

- Les cartes interactives sont des boutons ou libellés natifs.
- Les modales utilisent `role="dialog"` et `aria-modal="true"`.
- La modale des présences a une hauteur stable et seule sa liste défile.
- Le radar possède une description accessible et toutes ses valeurs existent aussi dans un tableau.
- Les indicateurs combinent couleur, icône et texte.
- Échap ferme une modale et le focus revient au déclencheur lorsque possible.
- Les modifications d’assignation restaurent le défilement de la page, celui de la modale et le focus avec `preventScroll`.
- Aucun dialogue natif ni glisser-déposer n’est utilisé.

## Vérification

```powershell
node --check app.js
git diff --check
```

Les vérifications manuelles couvrent le stockage neuf, joueurs, import/export, présences, gardiens, optimisation, nouveau match, archivage, historique, radar et affichage mobile.
