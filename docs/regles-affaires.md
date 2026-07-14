# Règles d’affaires actuelles

## Fiche joueur

- Un joueur possède un nom, un statut Régulier ou Remplaçant et un état Actif ou Inactif.
- Les positions jouables sont Gardien, Défense et Attaque.
- Un joueur D ou A possède toujours une cote offensive et une cote défensive entières de 0 à 10.
- Un gardien exclusif possède une cote de gardien et un cardio. Un gardien polyvalent possède également les cotes offensive et défensive.
- Une cote déjà saisie est conservée lorsqu’une position est décochée puis réactivée.
- Une fiche importée sans position est indiquée « À compléter » et ne peut pas être optimisée.
- Un joueur inactif reste dans la liste, mais est exclu des présences, des équipes et des gardiens disponibles.

## Liste des joueurs

- Joueurs affiche une seule liste à la fois avec le sélecteur Réguliers/Remplaçants.
- Les totaux actifs et inactifs sont affichés séparément.
- Le filtre Actifs est sélectionné par défaut; Inactifs et Tous sont également disponibles.
- Le filtre de position Gardien/Défense/Attaque/Tous se combine aux autres filtres. Un joueur polyvalent apparaît pour chaque position qu’il peut jouer.
- La recherche par nom utilise une correspondance « contient » sans distinction de casse ou d’accent et reste active au changement de statut.
- Les deux listes sont alphabétiques. Les remplaçants sont paginés par groupes de 10.
- Ajouter un joueur ou toucher sa ligne ouvre le formulaire dans une modale.
- Un nom en double est refusé sans distinction de casse, d’accent ou d’espaces superflus.
- Les pastilles G/D/A montrent leur cote sur une seule ligne. Une position non jouable associée à une cote OFF ou DÉF est atténuée; la position assignée est mise en évidence.

## Présences et gardiens

- Un nouveau match sélectionne tous les réguliers actifs et aucun remplaçant.
- La carte Joueurs présents ouvre la modale des présences.
- Les réguliers sont alphabétiques. Les remplaçants sont classés par dernière participation archivée, de la plus récente à la plus ancienne, puis par nom.
- Les filtres de nom et de position sont conservés entre les deux listes, et la modale garde une taille stable.
- Retirer une présence enlève aussi les assignations du joueur sans modifier les autres.
- Cliquer Gardiens disponibles ouvre une modale avec un emplacement par équipe.
- Tous les gardiens exclusifs présents doivent être sélectionnés.
- Exactement deux gardiens exclusifs sont placés automatiquement, un par équipe. Leur placement valide est conservé; sinon l’ordre alphabétique détermine les côtés.
- Moins de deux gardiens disponibles bloque l’optimisation. Au-delà de deux gardiens exclusifs présents, ils doivent recevoir une autre position ou être retirés des présences.
- Avec moins de deux gardiens exclusifs et au moins deux gardiens disponibles, l’organisateur complète la sélection manuellement.
- Les gardiens choisis sont verrouillés et ne peuvent être modifiés que depuis leur modale dédiée.

## Cycle du match

- La date commence vide et est obligatoire uniquement pour Archiver.
- Optimiser ne modifie jamais la date.
- Copier le message reste permis sans date; la ligne de date est alors omise.
- Une assignation manuelle, une modification manuelle des gardiens ou une optimisation marque le match comme préparé.
- Une date, un changement de présence ou le placement automatique des gardiens ne marque pas le match comme préparé.
- Nouveau réinitialise immédiatement un match non préparé.
- Pour un match préparé, Nouveau propose d’effacer, d’archiver ou d’annuler.
- Un archivage exige une date, un gardien et au moins trois autres joueurs dans chaque équipe.
- Les présents non assignés et l’écart numérique entre équipes n’empêchent pas l’archivage.
- Après Nouveau ou Archiver, la date et les assignations sont vidées et les réguliers actifs redeviennent présents.
- Recommencer conserve la date et les présences, puis efface toutes les assignations. Deux gardiens exclusifs présents sont aussitôt replacés automatiquement.

## Assignation et optimisation

- Les joueurs présents sans équipe apparaissent dans la section À assigner.
- Toucher un joueur ouvre Modifier et présente uniquement ses combinaisons équipe/position D ou A.
- Toucher de nouveau la combinaison sélectionnée enlève le joueur de l’équipe tout en le gardant présent.
- Rendre absent enlève le joueur des présences et de son équipe.
- Un joueur ne peut apparaître qu’une fois.
- Optimiser exige deux gardiens valides et au moins six autres joueurs.
- L’algorithme évalue 2 500 répartitions, conserve les gardiens et limite l’écart numérique à un joueur.
- Optimiser ouvre une modale contenant l’équilibre des positions et le choix Similaires/Mélangées/Différentes par rapport au match archivé ayant la date la plus récente.
- Similaires maximise les paires de coéquipiers répétées; Mélangées ignore l’historique; Différentes minimise ces paires.
- Les absents et nouveaux joueurs ne participent pas à la comparaison historique. Sans paire comparable, Mélangées est imposé.
- L’équilibre demeure prioritaire : la similitude départage seulement les candidats situés à trois points ou moins du meilleur équilibre.
- Les dernières options d’optimisation utilisées sont conservées localement. L’équilibre du nombre d’attaquants et de défenseurs est activé par défaut.
- Avec trois joueurs non gardiens par équipe, la cible comporte au moins un D et un A; à quatre ou plus, elle vise deux D et deux A.

## Statistiques

- Les quatre dimensions sont évaluées séparément : Gardien, Attaque, Défense et Cardio.
- Attaque additionne les cotes offensives de tous les joueurs non gardiens.
- Défense additionne leurs cotes défensives.
- Cardio affiche la moyenne réelle des joueurs non gardiens.
- Son influence dans l’optimisation est complète jusqu’à quatre joueurs non gardiens, puis diminue de 25 % par joueur additionnel et devient nulle à huit.
- L’équilibre global est calculé à partir des écarts normalisés des quatre dimensions et, si activé, de l’écart de nombres D/A.
- Le radar normalise seulement le dessin. Le tableau conserve les valeurs réelles.
- Les statistiques, le radar et la répartition G/D/A sont recalculés après chaque modification.

## Indicateurs de disponibilité

- Joueurs présents : 14 et plus vert, 12 à 13 jaune, 11 ou moins rouge. Sous 8, le minimum requis est explicitement indiqué.
- Gardiens : exactement deux exclusifs vert; sélection polyvalente possible jaune; moins de deux disponibles ou plus de deux exclusifs rouge.
- Une icône et un texte accompagnent toujours la couleur.

## Import, export et génération

- Le format complet est `REG | Nom | DA | x,7,5,6 | ACTIF`.
- Les cotes sont toujours dans l’ordre `G,OFF,DEF,CARDIO`.
- Les codes importés et exportés sont ASCII; seuls les noms peuvent contenir des accents.
- Un gardien exclusif utilise par exemple `REG | Bobby | G | 8,x,x,1 | ACTIF`.
- Une fiche sans position utilise `REG | Nom | ACTIF`.
- L’ancien format n’est pas accepté.
- Les doublons sont ignorés selon la même normalisation que le formulaire.
- Le téléchargement texte utilise UTF-8 avec BOM; la copie n’ajoute pas de BOM.
- Le générateur crée uniquement des gardiens exclusifs G. Les autres joueurs reçoivent D, A ou DA ainsi que des cotes OFF/DÉF et un cardio entiers.

## Historique et persistance

- Une archive conserve la date, les noms d’équipe et les objets techniques `{ id, name }` des joueurs, sans leurs positions.
- Les matchs sont repliés par défaut. La date et la suppression restent visibles; les équipes apparaissent au développement.
- Effacer l’historique ne modifie ni les joueurs ni le match courant.
- Toutes les données restent uniquement dans le navigateur.
