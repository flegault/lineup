# Lineup

Application web autonome pour former deux équipes de hockey amical équilibrées.

Elle permet de gérer ou importer un bassin de joueurs, choisir les présences, affecter les positions par clic, puis optimiser deux équipes équilibrées. Les statistiques, graphiques, archives et données du match sont conservés localement dans le navigateur.

## Utilisation

Ouvrez `index.html` dans un navigateur moderne. Aucune installation ni serveur n’est nécessaire.

Les données du bassin, du match en cours, des préférences et de l’historique sont stockées dans `localStorage` sur l’appareil utilisé.

## Règles d’affaires

Les règles appliquées par l’application sont décrites dans [la documentation des règles d’affaires](docs/regles-affaires.md).

L’architecture et les détails d’implémentation sont décrits dans [la documentation technique](docs/technique.md).

## Déploiement sur GitHub Pages

1. Envoyez le contenu de ce dépôt sur la branche `main` de [`flegault/lineup`](https://github.com/flegault/lineup).
2. Dans GitHub, ouvrez **Settings → Pages**.
3. Choisissez **Deploy from a branch**, puis la branche `main` et le dossier `/ (root)`.
4. Dans **Custom domain**, inscrivez `lineup.imaginemoi.ca`.
5. Chez votre fournisseur DNS, créez un enregistrement `CNAME` pour `lineup` qui pointe vers `flegault.github.io`.
6. Activez **Enforce HTTPS** lorsqu’il devient disponible.

Avant de lier le domaine, vérifiez `imaginemoi.ca` dans les paramètres GitHub afin de protéger ses sous-domaines.

## Licence

Ce projet est distribué sous licence MIT; consultez le fichier [`LICENSE`](LICENSE).
