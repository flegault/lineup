# Règles d’affaires actuelles

Ce document décrit le comportement effectivement appliqué par la version actuelle de Lineup.

## Joueurs

- Un joueur possède un nom, une ou plusieurs positions parmi gardien, défenseur et attaquant, une note pour chacune de ces positions et un niveau de cardio.
- Les notes et le cardio sont normalisés à des nombres entiers de 0 à 10 à l’ouverture de l’application. Les nouveaux exemples utilisent aussi des entiers.
- La note d’une position est conservée si cette position est désactivée puis réactivée. Une position nouvellement activée commence à 5.
- Un joueur est soit régulier, soit remplaçant. Ce statut influence la présence initiale, mais pas son poids dans l’algorithme.
- Un joueur est en forme ou blessé. Un joueur blessé reste dans le bassin, mais ne peut pas être présent, être ajouté comme remplaçant ni être choisi comme gardien.

## Présences et date

- Lors de l’initialisation d’un nouveau match, tous les réguliers en forme sont cochés. Les choix manuels suivants sont conservés.
- Les remplaçants en forme sont absents au départ et sont ajoutés un à la fois avec la modale « Ajouter un remplaçant ».
- La date du match est initialisée à la date du jour. Mélanger les équipes ne la change pas.
- Retirer un joueur des présences le retire aussi de son équipe et des gardiens désignés; les autres joueurs et équipes sont conservés tels quels.

## Génération et équilibre

- La génération exige exactement deux gardiens présents et désignés.
- Elle exige au moins huit autres joueurs présents afin de viser deux défenseurs et deux attaquants par équipe, en plus d’un gardien par équipe.
- Les deux gardiens désignés sont répartis, un dans chaque équipe. Les autres joueurs sont distribués aléatoirement dans plusieurs compositions candidates.
- La composition retenue minimise l’écart de force ajustée, de force en défense et de force en attaque. Lorsque l’option est active, elle pénalise aussi les écarts de nombre de défenseurs et d’attaquants.
- La force ajustée est la somme des notes aux positions attribuées, à laquelle s’ajoute le cardio moyen des patineurs. L’impact du cardio diminue avec les remplaçants et est nul à partir de quatre remplaçants par équipe.
- Le réglage « Variété : tenir compte des X derniers matchs » est enregistré dans les données locales, mais n’influence pas encore le calcul de génération actuel.
- Après une génération, l’organisateur peut modifier une position de match, glisser un joueur d’une équipe à l’autre ou utiliser le bouton de déplacement; ces ajustements ne relancent pas automatiquement la génération.

## Disponibilité, partage et historique

- « Joueurs présents » compte tous les joueurs présents et en forme.
- « Gardiens disponibles » compte les joueurs présents, en forme et capables de jouer gardien, qu’ils soient désignés ou non.
- La date, les équipes, les noms d’équipe et les positions attribuées sont copiés dans l’historique seulement après confirmation de l’archivage.
- Le partage produit un texte copiable contenant la date et les deux équipes. Aucun envoi par e-mail ou SMS n’est effectué par l’application.

## Persistance

- Les joueurs, réglages, match courant et historique sont stockés uniquement dans `localStorage` du navigateur.
- Vider les données de site du navigateur efface ces informations; elles ne sont pas synchronisées entre appareils.
