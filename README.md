# Lineup

Application web autonome pour préparer deux équipes équilibrées.

Lineup permet de gérer ou importer une liste de joueurs, choisir les présences, assigner les gardiens et les autres positions, puis optimiser les équipes. Les statistiques, le radar, les archives et le match courant sont conservés localement dans le navigateur.

## Utilisation

Ouvrir `index.html` dans un navigateur moderne ou visiter le site publié avec GitHub Pages.

- **Match** : date, présences, gardiens, optimisation, équipes, statistiques et partage.
- **Joueurs** : réguliers et remplaçants, filtres, ajout et modification.
- **Historique** : compositions archivées.
- **Configuration** : import, export, génération et effacement des joueurs.

## Données

L’application est sans serveur, compte ou dépendance externe. Les données sont conservées dans `localStorage` sous la clé `lineup-v1`.

La mise à jour vers cette version initialise volontairement un nouveau stockage et supprime les anciennes données locales.

## Documentation

- [Règles d’affaires](docs/regles-affaires.md)
- [Documentation technique](docs/technique.md)
- [Roadmap](docs/roadmap.md)

## Déploiement

Le dépôt est publié directement avec GitHub Pages. Le fichier `CNAME` associe le domaine personnalisé.

## Licence

MIT — voir [LICENSE](LICENSE).
