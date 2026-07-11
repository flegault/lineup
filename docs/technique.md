# Documentation technique

## Architecture

Lineup est une application monopage statique sans framework, serveur applicatif ni étape de compilation.

- `index.html` contient la structure minimale, la navigation et les points de montage de l’application et des modales.
- `styles.css` contient toute la présentation, les dispositions adaptatives et les états visuels.
- `app.js` contient l’état, la persistance, le rendu des vues, l’algorithme d’équilibrage et les gestionnaires d’événements.
- `README.md` décrit l’utilisation et le déploiement.
- `docs/regles-affaires.md` décrit les comportements fonctionnels.

Le navigateur charge directement les trois fichiers de l’application. Aucune dépendance externe n’est téléchargée à l’exécution.

## Cycle de rendu

L’application utilise un état JavaScript unique et trois vues : `match`, `players` et `history`.

La fonction `render()` reconstruit le contenu de `#app` selon la vue active. Les fonctions `matchView()`, `form()` et `history()` produisent le HTML correspondant. Les modales sont rendues séparément dans `#modal-root`.

Les interactions reposent principalement sur la délégation d’événements au niveau de `document` :

- `click` traite la navigation, les actions, les modales et les déplacements accessibles;
- `change` traite les présences, gardiens, réglages, date, positions et noms d’équipe;
- `input` met à jour les valeurs visibles des curseurs;
- `submit` valide et sauvegarde le formulaire joueur;
- les événements `dragstart`, `dragover`, `dragleave` et `drop` gèrent le glisser-déposer.

Après une modification métier, l’état est sauvegardé puis la vue est généralement reconstruite. Le formulaire joueur fait exception pour certains changements afin de préserver la saisie en cours.

## Persistance locale

La clé principale est `lineup-hockey-v2`. Au chargement, l’application tente aussi de récupérer l’ancienne clé `lineup-hockey-v1`.

Schéma logique actuel :

```text
state
├── players[]
│   ├── id, name
│   ├── positions[]
│   ├── ratings { goalie, defense, attack }
│   ├── cardio
│   ├── status: regulier | remplacant
│   └── injured: boolean
├── settings
│   ├── white, black
│   ├── balancePositions
│   └── historyDepth
├── match
│   ├── date
│   ├── present[]
│   ├── goalies[]
│   ├── teams { white[], black[] } | null
│   └── presenceInitialized
└── history[]
    ├── date
    ├── whiteName, blackName
    └── teams { white[], black[] }
```

Les identifiants dans `present` et `goalies` font référence aux joueurs. Les équipes et l’historique conservent actuellement des copies complètes des joueurs avec leur position attribuée.

### Migration et normalisation

- Les propriétés absentes sont complétées avec les valeurs par défaut.
- Un ancien joueur sans statut devient régulier.
- Un ancien joueur sans indicateur de blessure devient en forme.
- Les notes de position manquantes commencent à 5.
- Les notes et le cardio existants sont arrondis à des entiers.
- Une erreur de lecture JSON réinitialise l’état en mémoire aux valeurs par défaut.

Il n’existe pas de synchronisation entre navigateurs et aucune sauvegarde distante. Effacer les données du site supprime le bassin et l’historique.

## Génération des équipes

La génération commence par valider deux gardiens désignés, présents et en forme, puis exige au moins huit autres joueurs.

L’algorithme produit 2 500 compositions candidates :

1. mélanger les joueurs autres que les gardiens;
2. diviser la liste en deux groupes, avec un joueur supplémentaire dans la première équipe si l’effectif est impair;
3. attribuer les positions de match selon les positions disponibles et, si l’option est active, les cibles de deux défenseurs et deux attaquants;
4. calculer le score d’écart;
5. conserver la composition ayant le score le plus faible.

Le score additionne :

- l’écart de force ajustée totale;
- l’écart de force en défense;
- l’écart de force en attaque;
- lorsque l’équilibre des positions est actif, cinq fois les écarts de nombre de défenseurs et d’attaquants.

La force ajustée d’une équipe est :

```text
somme des notes aux positions attribuées
+ cardio moyen des patineurs × (1 - min(remplaçants, 4) / 4)
```

Le nombre de remplaçants correspond au nombre de patineurs au-delà des quatre premiers. Le cardio ne contribue donc plus à partir de quatre remplaçants.

Le réglage de variété est persisté et affiché, mais il n’est pas encore intégré au score de génération.

L’interface transforme le score d’écart en un indicateur de lecture `max(0, 100 - score × 2)`. Ce pourcentage est uniquement une visualisation : il ne change pas la composition choisie. Les graphiques comparent les totaux de gardien, défense, attaque et cardio, puis affichent tous les joueurs selon leur position attribuée; « remplaçant » n’est jamais traité comme une position.

## Interactions après génération

- Modifier la position d’un joueur met à jour les statistiques sans regénérer les équipes.
- Déposer un joueur dans l’autre équipe le déplace sans échange automatique.
- Le bouton « Vers… » applique le même déplacement pour les utilisateurs au clavier.
- Retirer un joueur des présences le retire de son équipe et des gardiens désignés sans toucher aux autres joueurs.
- Renommer une équipe met à jour les réglages globaux, les statistiques et le texte de partage.
- Mélanger les équipes ne modifie jamais la date du match.
- La liste des présences peut être repliée; cet état d’interface est conservé en mémoire pendant la session, mais pas dans `localStorage`.

## Modales et accessibilité

Les validations et confirmations utilisent une modale interne avec `role="dialog"` et `aria-modal="true"`. L’application n’utilise pas `alert()` ni `confirm()`.

Les contrôles utilisent des éléments HTML natifs. Le déplacement par bouton complète le glisser-déposer, qui dépend d’un pointeur. La mise en évidence visuelle d’une zone de dépôt est appliquée pendant le survol.

## Vérification et débogage

Vérification syntaxique :

```powershell
node --check app.js
```

Vérification des erreurs de diff :

```powershell
git diff --check
```

Tests manuels recommandés :

1. créer, modifier et supprimer un joueur;
2. recharger la page et confirmer la persistance;
3. vérifier les réguliers, remplaçants et blessés;
4. générer avec deux gardiens et au moins huit autres joueurs;
5. déplacer et retirer des joueurs puis vérifier les statistiques;
6. archiver un match et vérifier sa date et sa composition;
7. tester à largeur mobile et au clavier.

Pour repartir d’un état vierge pendant le développement, supprimer la clé `lineup-hockey-v2` dans les outils de développement du navigateur. Cette opération efface les données locales de l’utilisateur.

## Déploiement

GitHub Pages sert directement la branche configurée. Le fichier `CNAME` associe le site à `lineup.imaginemoi.ca`. Comme l’application utilise uniquement des chemins relatifs et aucun routage côté serveur, aucun traitement de construction n’est requis.
