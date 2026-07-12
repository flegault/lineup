# Règles d’affaires actuelles

Ce document décrit le comportement appliqué par la version actuelle de Lineup.

## Joueurs

- Un joueur possède un nom, une ou plusieurs positions parmi gardien, défense et attaque, une note entière de 0 à 10 pour chaque position jouable et un cardio entier de 0 à 10.
- La note d’une position est conservée si elle est désactivée puis réactivée. Une position activée pour la première fois commence à 5.
- Un joueur est régulier ou remplaçant. Ce statut influence la présence initiale, mais pas sa force.
- Un joueur est actif ou inactif. Un inactif reste dans le bassin, mais il est exclu des présences, des équipes, des gardiens disponibles et des remplaçants sélectionnables.
- Une fiche sans position est marquée « À compléter » et ne peut pas participer à une optimisation.
- Toutes les listes utilisent la même présentation : nom, positions G/D/A toujours colorées, niveau sous chaque pastille et cardio.

## Consultation du bassin

- « Ajouter un joueur » et le clic sur un joueur ouvrent le formulaire dans une modale; la liste conserve toute la largeur de la page.
- Annuler, fermer ou utiliser Échap abandonne les changements non enregistrés sans confirmation.
- Un ajout ou une modification refuse un nom déjà utilisé en ignorant casse, accents et espaces superflus.
- Les erreurs du formulaire restent dans la modale et ne suppriment pas les valeurs saisies.
- Les réguliers et remplaçants sont triés alphabétiquement, sans regrouper les inactifs à part.
- Chaque section affiche ses nombres totaux d’actifs et d’inactifs. Ces totaux ne changent pas avec les filtres.
- Chaque section possède une recherche par nom et un filtre Tous/Actifs/Inactifs indépendants.
- La recherche utilise une correspondance « contient » sans distinction de casse ou d’accents.
- Les remplaçants sont paginés après filtrage, à raison de 10 par page. Les réguliers ne sont pas paginés.

## Présences et date

- À l’initialisation ou après la génération d’un bassin, tous les réguliers actifs sont présents.
- La carte « Joueurs présents » ouvre la gestion des présences.
- La gestion affiche les réguliers par défaut et permet de passer aux remplaçants.
- Les réguliers sont triés alphabétiquement.
- Les remplaçants ayant déjà joué sont triés par date de match la plus récente, puis alphabétiquement; ceux n’ayant jamais joué sont placés à la fin.
- Seuls les matchs archivés comptent comme participation.
- Retirer une présence retire aussi ce joueur de son équipe, sans modifier les autres affectations.
- Modifier une présence conserve la position de défilement, l’onglet, la recherche et le focus dans la modale.
- La date est initialisée à aujourd’hui. Optimiser les équipes ne la modifie jamais.
- « Recommencer » conserve la date et les présences, puis vide uniquement les affectations des deux équipes.

## Affectation aux équipes

- Une carte au-dessus des équipes affiche les joueurs présents non assignés lorsqu’il y en a.
- Toucher un joueur ouvre la modale « Modifier » et les combinaisons équipe/position permises par sa fiche.
- La combinaison actuelle est sélectionnée. La toucher de nouveau retire le joueur de l’équipe tout en conservant sa présence.
- Toucher une autre combinaison affecte ou réaffecte immédiatement le joueur, sans fermer la modale.
- Le bouton « OK » ferme la modale lorsque les ajustements sont terminés.
- « Rendre absent » le retire de son équipe et des présences.
- Un joueur ne peut apparaître qu’une seule fois dans les deux équipes.
- Un joueur affecté comme gardien peut changer d’équipe, mais doit rester gardien.
- Toutes les positions jouables d’un joueur polyvalent restent colorées et visibles; sa position affectée possède en plus un indicateur de sélection.
- Les noms « Blancs » et « Noirs » sont modifiables directement et persistent.

## Gardiens et optimisation

- Chaque équipe doit contenir exactement un gardien pour optimiser.
- S’il y a exactement deux gardiens présents qui jouent uniquement gardien, l’application en place automatiquement un dans chaque équipe et conserve leur placement existant.
- S’il y a plus de deux gardiens présents qui jouent uniquement gardien, l’optimisation est bloquée. Il faut ajouter une position à certains joueurs ou retirer des gardiens des présences.
- Dans les autres cas, l’organisateur affecte manuellement un gardien à chaque équipe.
- « Optimiser les équipes » conserve les gardiens, redistribue les autres joueurs présents et ne change pas la date.
- Au moins six patineurs sont requis, soit un gardien et trois patineurs par équipe.
- Avec trois patineurs, l’optimisation cherche au moins un défenseur et un attaquant par équipe; à quatre ou plus, elle vise deux défenseurs et deux attaquants.

## Équilibre et statistiques

- L’algorithme évalue 2 500 compositions aléatoires et conserve celle ayant le plus petit écart.
- Le calcul compare la force ajustée, la défense et l’attaque. Lorsque l’équilibre des positions est activé, il pénalise aussi les écarts de nombre en défense et en attaque.
- La force ajustée additionne les notes aux positions affectées et un apport du cardio moyen des patineurs.
- L’effet du cardio diminue avec le nombre de joueurs au-delà des quatre patineurs de base et devient nul à partir de quatre joueurs additionnels.
- Les statistiques et graphiques se recalculent après chaque présence ou affectation.
- Le réglage de variété de 0 à 5 derniers matchs demeure conservé, mais n’influence pas encore le calcul actuel.

## Génération, importation, exportation et effacement

- La configuration des joueurs est accessible avec le bouton engrenage.
- Le générateur fonctionne seulement lorsque le bassin est vide et demande les totaux de réguliers, remplaçants et gardiens exclusifs de chaque statut.
- Les gardiens exclusifs sont inclus dans les totaux et sont les seuls joueurs générés pouvant jouer gardien. Les autres reçoivent D, A ou D+A.
- Les joueurs générés sont actifs, portent des noms numérotés et reçoivent des niveaux et un cardio entiers de 0 à 10.
- La génération n’impose aucun minimum et sélectionne les réguliers générés comme présents, sans les affecter à une équipe.
- Le format complet est `REG | Nom | G,D,A,cardio | ACTIF` ou `REM | Nom | G,D,A,cardio | INACTIF`.
- `x` signifie que la position n’est pas jouée. L’état est toujours explicite dans un export.
- Un ancien format sans état reste accepté et crée un joueur actif.
- Une fiche sans position peut être importée avec `REG | Nom | ACTIF` ou `REM | Nom | INACTIF`.
- Les doublons de nom, sans égard aux majuscules, accents et espaces superflus, sont ignorés.
- L’export peut être copié ou téléchargé en fichier texte puis réimporté.
- La syntaxe exportée utilise uniquement des codes ASCII; seuls les noms peuvent contenir des accents.
- Le fichier téléchargé utilise UTF-8 avec BOM pour préserver les accents des noms. L’import accepte les textes avec ou sans BOM.
- Effacer le bassin supprime les joueurs et vide les présences et équipes courantes, mais conserve l’historique, les noms d’équipe et les préférences.

## Archivage et persistance

- Archiver copie la date, les noms d’équipe et les noms des joueurs, puis vide les équipes courantes.
- Un identifiant de joueur invisible est conservé dans l’archive uniquement pour calculer sa dernière participation.
- « Effacer l’historique » supprime toutes les archives sans modifier le bassin ni le match courant.
- Le texte de partage contient la date, les équipes, les joueurs et leur position.
- Les joueurs, préférences, match courant et archives sont stockés uniquement dans `localStorage`.
- Les données ne sont ni synchronisées ni sauvegardées sur un serveur.
