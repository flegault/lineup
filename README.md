# Lineup

Application web autonome pour former deux équipes de hockey amical équilibrées.

Elle permet de gérer un bassin de joueurs, leurs positions et niveaux, de choisir les présents, de désigner les gardiens, puis de générer et ajuster les équipes. Toutes les données sont conservées localement dans le navigateur.

## Utilisation

Ouvrez `index.html` dans un navigateur moderne. Aucune installation ni serveur n’est nécessaire.

Les données du bassin, du match en cours, des réglages et de l’historique sont stockées dans `localStorage` sur l’appareil utilisé.

## Déploiement sur GitHub Pages

1. Envoyez le contenu de ce dépôt sur la branche `main` de [`flegault/lineup`](https://github.com/flegault/lineup).
2. Dans GitHub, ouvrez **Settings → Pages**.
3. Choisissez **Deploy from a branch**, puis la branche `main` et le dossier `/ (root)`.
4. Dans **Custom domain**, inscrivez `lineup.imaginemoi.ca`.
5. Chez votre fournisseur DNS, créez un enregistrement `CNAME` pour `lineup` qui pointe vers `flegault.github.io`.
6. Activez **Enforce HTTPS** lorsqu’il devient disponible.

Avant de lier le domaine, vérifiez `imaginemoi.ca` dans les paramètres GitHub afin de protéger ses sous-domaines.

## Licence

Ce projet est prévu pour être distribué sous licence MIT. Ajoutez un fichier `LICENSE` lors de la création du dépôt GitHub, avec `ImagineMoi` comme titulaire du droit d’auteur.
