# Rapport d’analyse business et de stratégie marketing — Smart Offers

**Périmètre :** moteur d’offres personnalisées de `lecourteau-server`  
**Date d’analyse :** 6 septembre 2026  
**Objet :** analyse des stratégies S1 à S18, et non analyse des segments clients

## 1. Synthèse de direction

Le système Smart Offers est une mécanique de promotion personnalisée couvrant cinq objectifs commerciaux : créer une habitude après les premières commandes, renforcer la fidélité, réactiver les clients, augmenter le panier et développer l’affinité ou la découverte de catégories.

La nomenclature historique va de S1 à S18. Toutefois, **S1 est retirée du système** : le job quotidien supprime sa règle et ses offres actives. Le portefeuille opérationnel comprend donc actuellement **17 stratégies, de S2 à S18**.

### Verdict global

- **À développer sous contrôle : S8, S9 et S17.** Ce sont les meilleurs compromis entre volume, conversion observée et revenu associé. S8 convertit le mieux à grande échelle; S9 génère le plus de revenu; S17 valide la pertinence de la personnalisation par affinité.
- **À conserver et tester davantage : S4, S5, S6, S7, S14, S15 et S16.** Les signaux sont favorables, mais les volumes convertis sont trop faibles ou les coûts incomplets pour conclure définitivement.
- **À corriger avant amplification : S2, S10, S11 et S12.** S2 et S12 sont massivement distribuées pour très peu de commandes; S10 coûte cher; S11 combine faible conversion et configuration cadeau ambiguë.
- **À repenser : S13 et S18.** S13 a la plus faible conversion du portefeuille. S18 ne démontre pas encore que la découverte forcée d’une catégorie crée suffisamment de valeur.
- **S3 est utile mais perfectible.** Son rabais fixe de 7 $ à partir de 35 $ est lisible, mais il est moins efficace que les meilleures stratégies de réactivation et de fidélité.

### Décision recommandée

Ne pas piloter ce programme avec le seul « revenu généré ». Ce revenu est associé à des commandes utilisant une offre, mais il n’est pas nécessairement causé par l’offre. La décision doit reposer sur un test avec groupe témoin et sur la **marge incrémentale** :

> marge incrémentale = marge des exposés − marge du témoin − coût réel de l’avantage − coût du canal

## 2. Méthode, données et limites

L’analyse combine :

- la logique de sélection et de priorité dans `jobs/personalizedOfferCron.job.js`;
- les règles actuellement enregistrées dans `smartofferrules`;
- les offres générées et activées dans `personalizedoffers`;
- les commandes non annulées ayant `personalizedOfferApplied = true`;
- les montants de commande, rabais et cadeaux enregistrés.

La période observable va du **5 août au 6 septembre 2026**. Les chiffres sont donc des signaux précoces.

### Définitions

- **Générées :** toutes les offres créées, y compris celles encore préparées.
- **Activées :** offres ayant reçu une date `validFrom`.
- **Commandes observées :** commandes non annulées liées à l’offre.
- **Conversion observée :** commandes observées ÷ offres activées.
- **Revenu associé :** total des commandes utilisant l’offre; ce n’est pas du revenu incrémental prouvé.
- **Coût visible :** rabais monétaire enregistré, augmenté de la valeur de base enregistrée des cadeaux. Les points et certains cadeaux ne sont pas intégralement valorisés.

### Limites importantes

1. Les configurations des stratégies ont changé pendant la période. Une même stratégie peut donc contenir plusieurs variantes historiques.
2. Le système mesure un état final (`viewed`, `clicked`, `applied`) et non un entonnoir cumulatif complet. Les taux de vue et de clic ne sont pas interprétables comme un funnel marketing standard.
3. Le coût des points de fidélité n’est pas valorisé et certains cadeaux n’ont pas de `basePrice` enregistré.
4. Les offres sont attribuées par règles, sans groupe témoin aléatoire. La causalité et la cannibalisation ne peuvent pas être mesurées.
5. Les champs `status = applied` et les commandes finales ne concordent pas toujours, notamment pour S8, S17 et S18. Le rapport privilégie les commandes non annulées pour l’impact commercial.

## 3. Tableau de performance comparée

| Stratégie | Proposition actuellement configurée | Activées | Commandes | Conv. observée | Revenu associé | Panier moyen | Coût visible | Revenu / coût visible | Lecture |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| S1 | Ancienne offre d’acquisition | 0 | 0 | — | — | — | — | — | Retirée |
| S2 | Churros gratuits dès 20 $ | 16 659 | 17 | 0,10 % | 602,44 $ | 35,44 $ | 135,93 $ | 4,43× | Surdistribuée |
| S3 | 7 $ dès 35 $ | 5 072 | 22 | 0,43 % | 973,99 $ | 44,27 $ | 150,00 $ | 6,49× | À optimiser |
| S4 | Churros gratuits dès 20 $ | 1 006 | 15 | 1,49 % | 622,56 $ | 41,50 $ | 136,50 $ | 4,56× | Prometteuse |
| S5 | 130 points dès 25 $ | 434 | 9 | 2,07 % | 367,68 $ | 40,85 $ | non valorisé | — | Prometteuse, mesure incomplète |
| S6 | 5 $ dès 25 $ | 346 | 12 | 3,47 % | 494,42 $ | 41,20 $ | 60,00 $ | 8,24× | Très bon signal |
| S7 | 150 points dès 25 $ | 106 | 3 | 2,83 % | 116,89 $ | 38,96 $ | non valorisé | — | Volume insuffisant |
| S8 | 25 % sans seuil | 2 484 | 99 | **3,99 %** | 2 781,06 $ | 28,09 $ | 653,59 $ | 4,26× | Meilleure conversion à volume significatif |
| S9 | 8 $ dès 25 $ | 4 339 | 99 | 2,28 % | **3 421,15 $** | 34,56 $ | 630,47 $ | 5,43× | Meilleur revenu associé |
| S10 | 30 % dès 20 $ | 5 790 | 97 | 1,68 % | 2 993,73 $ | 30,86 $ | 784,17 $ | 3,82× | Puissante mais coûteuse |
| S11 | Pizza gratuite dès 20 $ | 4 095 | 33 | 0,81 % | 1 189,59 $ | 36,05 $ | ≥ 245,30 $ | ≤ 4,85× | Faible, coût cadeau incomplet |
| S12 | Churros gratuits sans seuil | 9 083 | 43 | 0,47 % | 1 275,21 $ | 29,66 $ | ≥ 424,60 $ | ≤ 3,00× | Surdistribuée et peu efficace |
| S13 | 200 points dès 30 $ | 1 627 | 3 | **0,18 %** | 119,50 $ | 39,83 $ | non valorisé | — | À repenser |
| S14 | Pizza gratuite dès 50 $ | 1 758 | 9 | 0,51 % | 486,35 $ | 54,04 $ | ≥ 79,80 $ | ≤ 6,09× | Panier intéressant, conversion faible |
| S15 | Churros gratuits dès 60 $ | 566 | 5 | 0,88 % | 372,93 $ | 74,59 $ | ≥ 50,80 $ | ≤ 7,34× | Bon levier de panier, petit volume |
| S16 | Churros gratuits dès 65 $ | 151 | 3 | 1,99 % | 254,90 $ | **84,97 $** | incomplet | — | Prometteuse, échantillon minime |
| S17 | 25 % sur catégorie favorite dès 25 $ | 3 414 | 61 | 1,79 % | 2 157,91 $ | 35,38 $ | 413,68 $ | 5,22× | Personnalisation validée |
| S18 | 30 % sur catégorie à découvrir | 849 | 3 | 0,35 % | 100,83 $ | 33,61 $ | 23,29 $ | 4,33× | Preuve insuffisante |

**Attention :** « revenu / coût visible » n’est pas un ROI incrémental et ne tient pas compte du coût matière, du coût des points, de la cannibalisation ni des frais opérationnels.

## 4. Analyse et comparaison de chacune des 18 stratégies

### S1 — Acquisition / première commande

**Statut : retirée.** Le code supprime la règle S1 et ses offres encore actives. Son ancienne logique d’accueil n’est donc plus comparable statistiquement aux stratégies actuelles.

**Comparaison :** l’absence de S1 laisse l’acquisition hors du portefeuille Smart Offers, alors que S2 commence seulement après une première commande. S1 devrait rester retirée tant qu’un vrai test d’acquisition n’est pas défini avec CAC, première marge et taux de deuxième commande.

**Décision :** ne pas la réactiver automatiquement. Si l’acquisition devient un objectif, créer une nouvelle expérimentation dédiée plutôt que recycler l’historique S1.

### S2 — Transformer la première commande en habitude

**Mécanique :** après exactement une commande et au moins quatre jours de récence; Churros gratuits dès 20 $, validité 24 h, priorité 98.

**Performance :** 16 659 activations pour 17 commandes, soit 0,10 %. C’est de très loin le plus grand volume d’exposition pour un rendement minimal.

**Comparaison :** S2 convertit quatre fois moins que S3 et près de quinze fois moins que S4. Le cadeau est identique à S4, ce qui suggère que le problème tient davantage au moment, à la largeur d’éligibilité ou à la pression d’envoi qu’au produit offert.

**Décision :** réduire fortement la distribution. Tester J+3 contre J+7, validité 24 h contre 72 h et cadeau contre 15 % dès 20 $. KPI principal : deuxième commande incrémentale à 14 jours, pas simple utilisation du coupon.

### S3 — Consolider après deux commandes

**Mécanique :** exactement deux commandes et au moins sept jours depuis la dernière; 7 $ dès 35 $, validité 72 h, priorité 96.

**Performance :** 0,43 % de conversion, panier moyen 44,27 $ et ratio revenu/coût visible de 6,49×.

**Comparaison :** meilleure que S2, mais inférieure à S4 et S6. Son seuil représente une hausse de panier crédible, mais le rabais de 7 $ équivaut à 20 % au seuil, ce qui est généreux.

**Décision :** conserver comme challenger. Tester 5 $ dès 30 $ contre 7 $ dès 35 $, en mesurant marge et troisième commande à 30 jours.

### S4 — Récompenser le troisième achat récent

**Mécanique :** exactement trois commandes sur 30 jours; Churros gratuits dès 20 $, validité 48 h, priorité 88.

**Performance :** 1,49 % de conversion et panier moyen de 41,50 $.

**Comparaison :** quinze fois plus efficace que S2 avec un cadeau proche. Elle est moins performante que S5/S6 en taux, mais dispose de davantage de volume.

**Décision :** conserver. Tester si le cadeau entraîne réellement une quatrième visite plutôt que de subventionner une visite déjà probable. Le seuil pourrait être rapproché du panier naturel du client plutôt que fixé à 20 $.

### S5 — Fidélité par points

**Mécanique :** quatre commandes sur 30 jours; 130 points dès 25 $, validité 48 h, priorité 82.

**Performance :** 2,07 % de conversion; coût économique non mesuré.

**Comparaison :** conversion supérieure à S4, mais inférieure à S6. Les points protègent généralement mieux la trésorerie immédiate qu’un rabais, tout en créant une dette de récompense future.

**Décision :** conserver, à condition de valoriser les points consommés et expirés. Corriger immédiatement le titre qui annonce **75 points** alors que le corps et la configuration en accordent **130**.

### S6 — Fidélité par rabais fixe

**Mécanique :** cinq à sept commandes sur 30 jours; 5 $ dès 25 $, validité 48 h, priorité 55.

**Performance :** **3,47 %**, meilleur taux du bloc fidélité, avec un ratio revenu/coût visible de 8,24×.

**Comparaison :** sur les données observées, S6 bat S5 et S7. Elle est simple à comprendre et son coût maximum est connu, contrairement aux pourcentages.

**Décision :** stratégie de référence du bloc fidélité. La maintenir et la comparer à une version points de valeur économique équivalente.

### S7 — Reconnaissance VIP

**Mécanique :** au moins huit commandes sur 30 jours; 150 points dès 25 $, validité 24 h, priorité 40.

**Performance :** 2,83 %, mais seulement trois commandes observées.

**Comparaison :** signal supérieur à S5, inférieur à S6, sans puissance statistique. Une validité de 24 h peut être trop courte même pour des clients très actifs.

**Décision :** poursuivre à petite échelle. Tester 48 h et un avantage exclusif non monétaire. Le KPI doit inclure la rétention à 60 jours, pas seulement la conversion immédiate.

### S8 — Réactivation précoce

**Mécanique :** 10 à 17 jours depuis la dernière commande, avec au moins deux commandes historiques; 25 % sans seuil, validité 48 h, priorité 68.

**Performance :** **3,99 %**, meilleur taux à volume significatif; 2 781,06 $ de revenu associé.

**Comparaison :** bat nettement S9, S10, S11 et S12 en conversion. Elle intervient avant que l’habitude ne soit complètement perdue. En revanche, 25 % sans seuil peut cannibaliser des retours naturels.

**Décision :** garder comme champion de réactivation, mais tester 15 % dès 25 $ contre 25 % sans seuil. Une baisse de générosité est acceptable si la marge incrémentale progresse.

### S9 — Réactivation intermédiaire

**Mécanique :** 18 à 29 jours d’inactivité; 8 $ dès 25 $, validité 48 h, priorité 78.

**Performance :** 2,28 %, **plus haut revenu associé du portefeuille** à 3 421,15 $, panier moyen de 34,56 $.

**Comparaison :** convertit moins que S8, mais produit davantage de revenu et un meilleur ratio revenu/coût visible. Elle est plus efficiente que S10.

**Décision :** conserver et augmenter prudemment son poids expérimental. Tester 6 $ dès 30 $ afin de réduire le taux de subvention actuellement très élevé au seuil.

### S10 — Réactivation à 30–59 jours

**Mécanique :** 30 à 59 jours; 30 % dès 20 $, validité 48 h, priorité 92.

**Performance :** 1,68 %, 2 993,73 $ de revenu associé et 784,17 $ de rabais visible, le coût monétaire le plus élevé.

**Comparaison :** moins efficace et plus coûteuse que S8 et S9. Elle reste meilleure que S11/S12 en conversion, ce qui montre que la fenêtre temporelle compte davantage que la seule générosité.

**Décision :** réduire 30 % à 20–25 %, ou relever le seuil. Ne pas scaler avant mesure de l’incrémentalité.

### S11 — Réactivation à 60–89 jours

**Mécanique :** 60 à 89 jours; Pizza Focaccia gratuite dès 20 $, validité 24 h, priorité 94.

**Performance :** 0,81 % et coût cadeau incomplet.

**Comparaison :** deux fois moins efficace que S10 et cinq fois moins que S8. Le cadeau principal peut attirer, mais ajoute friction et coût opérationnel.

**Décision :** corriger et tester. La règle ne contient ni `freeItem` ni `freeItems`, uniquement une catégorie cible; le moteur accepte alors un article gratuit de cette catégorie, ce qui est moins précis que le message « Pizza Focaccia ». Configurer explicitement le produit/taille et tester 48 h.

### S12 — Réactivation longue, 90 jours et plus

**Mécanique :** Churros gratuits sans seuil, validité configurée à 48 h, priorité 97.

**Performance :** 9 083 activations pour 43 commandes, soit 0,47 %. C’est le deuxième plus grand volume et l’un des plus faibles rendements.

**Comparaison :** nettement inférieure à toutes les autres réactivations. Le problème est structurel : après 90 jours, une promotion seule ne corrige pas forcément la raison du départ.

**Décision :** plafonner la pression et enrichir la stratégie : test « nouvelle offre/menu + preuve sociale » contre cadeau. Exclure les clients manifestement perdus après un nombre défini d’échecs. Harmoniser aussi la copie, qui dit 24 h, avec la configuration à 48 h.

### S13 — Hausse du petit panier

**Mécanique :** au moins trois commandes sur 90 jours et panier moyen inférieur à 20 $; 200 points dès 30 $, validité 48 h.

**Performance :** **0,18 %**, taux le plus faible des stratégies actives.

**Comparaison :** très inférieure à S14–S16. Demander à un client sous 20 $ d’atteindre 30 $ représente un saut d’au moins 50 %, contre une récompense différée et abstraite.

**Décision :** mettre en pause ou reconstruire. Tester un seuil personnalisé proche de `panier moyen + 15 %`, avec un petit avantage immédiat plutôt que 200 points.

### S14 — Hausse du panier moyen

**Mécanique :** panier historique entre 20 $ et 35 $; Pizza gratuite dès 50 $, validité 48 h.

**Performance :** 0,51 %, panier observé de 54,04 $.

**Comparaison :** convertit moins que S15/S16. Le seuil exige une hausse de 43 % à 150 % selon le panier initial, ce qui explique probablement la faible adoption.

**Décision :** tester un seuil dynamique ou 40–45 $. Mesurer l’augmentation par rapport au panier contrefactuel, pas le panier final seul.

### S15 — Hausse du panier élevé

**Mécanique :** panier historique entre 35 $ et 50 $; Churros gratuits dès 60 $, validité 48 h.

**Performance :** 0,88 %, panier moyen de 74,59 $, ratio revenu/coût visible de 7,34×.

**Comparaison :** meilleure que S14 en conversion et en panier, mais moins que S16 en conversion. L’effort demandé est plus réaliste pour son public naturel.

**Décision :** conserver en test. Comparer seuil fixe de 60 $ et seuil personnalisé à `panier moyen + 15 %`.

### S16 — Valorisation des très grands paniers

**Mécanique :** panier historique supérieur à 50 $; Churros gratuits dès 65 $, validité 48 h.

**Performance :** 1,99 % et panier moyen de 84,97 $, mais seulement trois commandes.

**Comparaison :** meilleur taux du bloc panier et plus haut panier, avec un échantillon trop réduit. Le coût cadeau n’est pas correctement remonté sur les commandes observées.

**Décision :** continuer sans élargissement majeur, réparer la mesure du cadeau, puis juger après au moins 30 conversions.

### S17 — Affinité avec la catégorie préférée

**Mécanique :** au moins trois commandes sur 90 jours et une catégorie représentant au moins 60 % des articles; 25 % sur cette catégorie dès 25 $, validité 48 h.

**Performance :** 1,79 %, 61 commandes et 2 157,91 $ de revenu associé.

**Comparaison :** beaucoup plus probante que S18. Elle combine pertinence personnelle et faible friction cognitive. Elle est cependant très généreuse pour un comportement déjà établi.

**Décision :** conserver comme champion de personnalisation, tout en testant 15 % et 20 %. L’objectif est de déterminer le rabais minimal qui conserve le même niveau de réponse.

### S18 — Découverte d’une nouvelle catégorie

**Mécanique :** au moins trois commandes et aucune commande dans la catégorie la plus vendue du restaurant; 30 % sur cette catégorie, message à 30 $ mais seuil technique actuel à 20 $, validité 72 h.

**Performance :** trois commandes non annulées, soit 0,35 %. Le statut des offres en compte neuf comme appliquées, ce qui révèle aussi une anomalie d’intégrité à investiguer.

**Comparaison :** cinq fois moins efficace que S17. Une catégorie populaire globalement n’est pas nécessairement pertinente individuellement; la stratégie demande au client de changer son comportement.

**Décision :** ne pas amplifier. Corriger le seuil contradictoire, puis tester une recommandation de produit complémentaire ou un échantillon gratuit plutôt qu’un rabais de 30 % sur une catégorie entière.

## 5. Comparaisons stratégiques transversales

### Habitude : S2–S4

**Classement : S4 > S3 > S2.** La récompense semble fonctionner lorsqu’elle reconnaît une habitude déjà émergente. La distribution très large de S2 détruit son efficacité apparente. Il faut optimiser le moment de déclenchement avant d’augmenter la valeur de l’offre.

### Fidélité : S5–S7

**Classement actuel : S6 > S7 > S5**, avec réserve sur les faibles volumes et le coût des points. Le rabais fixe de S6 est le signal le plus robuste. Les points restent stratégiquement intéressants s’ils provoquent une commande supplémentaire et si leur passif est mesuré.

### Réactivation : S8–S12

**Classement : S8 > S9 > S10 > S11 > S12.** Plus l’inactivité est longue, plus le taux baisse malgré une générosité croissante. La meilleure stratégie est donc d’intervenir tôt, avant la rupture d’habitude. Au-delà de 60–90 jours, le ciblage et le message doivent changer, pas seulement le rabais.

### Augmentation du panier : S13–S16

**Classement indicatif : S16 > S15 > S14 > S13.** Les seuils fixes fonctionnent mieux lorsque l’écart avec le panier naturel est faible. S13 illustre l’échec d’un seuil trop ambitieux. Le bon design est un seuil individualisé, idéalement de 10 à 20 % au-dessus du panier attendu.

### Personnalisation : S17 contre S18

**S17 domine S18.** Récompenser une préférence connue est plus performant que pousser une catégorie populaire mais inconnue du client. S18 doit être repositionnée comme cross-sell guidé, avec une recommandation de produit précise.

## 6. Risques business et marketing prioritaires

### Dérive entre le code et la base de données

Les valeurs par défaut du code sont très différentes des règles actuelles en base. Exemples : S8 vaut 10 % dès 25 $ dans le code mais 25 % sans seuil en base; S10 vaut 20 % dès 25 $ dans le code mais 30 % dès 20 $ en base; S17 vaut 10 % dans le code mais 25 % en base.

La base écrase normalement les défauts. Mais si une règle est supprimée ou mal migrée, le job peut recréer une ancienne stratégie économiquement très différente. **Les règles doivent avoir une source de vérité versionnée.**

### Incohérences de promesse

- S5 : le titre annonce 75 points, le corps et la règle en accordent 130.
- S11 : la copie promet une Pizza Focaccia précise, la règle n’enregistre qu’une catégorie.
- S12 : la copie annonce 24 h, la règle configure 48 h.
- S18 : la copie annonce un seuil de 30 $, la règle applique 20 $.
- S16 : faute de copie « désert » au lieu de « dessert ».

Ces écarts exposent à la déception client, au support et à une perte de confiance.

### Pression promotionnelle

La base utilise des cooldowns de 3 à 6 jours pour presque toutes les stratégies, alors que les défauts du code prévoyaient souvent 14 à 60 jours. Même avec un cooldown global après utilisation, cette fréquence peut habituer les clients à attendre une promotion et dégrader le prix de référence.

### Priorité et cannibalisation

Le moteur retient la stratégie ayant le score/priorité le plus élevé. S2, S3, S10, S11 et S12 peuvent donc évincer des offres potentiellement plus rentables. La priorité devrait intégrer une estimation de valeur attendue :

> score = probabilité incrémentale de commande × marge attendue − coût attendu de l’offre

## 7. Plan d’action recommandé

### Dans les 7 jours

1. Corriger les quatre incohérences de promesse et la faute S16.
2. Versionner chaque modification de règle avec date de début et fin.
3. Réconcilier les statuts `applied` avec les commandes finales.
4. Enregistrer le coût matière de chaque cadeau et la valeur économique des points.
5. Ajouter un plafond de pression : pas plus d’une offre activée par client sur une fenêtre définie, même sans conversion.

### Dans les 30 jours

Lancer des tests avec 10 à 20 % de groupe témoin sans offre :

- S8 : 25 % sans seuil contre 15 % dès 25 $;
- S9 : 8 $ dès 25 $ contre 6 $ dès 30 $;
- S17 : 25 % contre 15 % sur la catégorie favorite;
- S2 : envoi J+3 contre J+7 et 24 h contre 72 h;
- S13–S16 : seuil fixe contre seuil personnalisé `panier attendu + 15 %`.

Ne changer qu’une variable économique à la fois pour rendre le résultat interprétable.

### Dans les 60 à 90 jours

- Faire de S8, S9 ou S17 un champion seulement après confirmation de marge incrémentale positive.
- Suspendre les variantes qui n’améliorent ni fréquence, ni panier, ni rétention par rapport au témoin.
- Remplacer le classement par priorité statique par un classement fondé sur la valeur attendue.
- Créer un tableau de pilotage par **stratégie et variante**, jamais uniquement par identifiant S2–S18.

## 8. KPI de gouvernance à suivre par stratégie

Chaque stratégie doit afficher :

1. clients éligibles, offres générées, notifications réellement livrées;
2. vues et clics cumulés par événement;
3. conversion exposés contre conversion témoin;
4. revenu incrémental et marge incrémentale;
5. coût du rabais, coût matière du cadeau et coût futur des points;
6. variation du panier par rapport au panier attendu;
7. répétition de commande à 14, 30 et 60 jours;
8. taux de désinstallation, désabonnement et plaintes;
9. nombre d’expositions nécessaires avant conversion;
10. résultat par variante de configuration et période de validité.

## Conclusion

Le moteur possède une couverture stratégique riche, mais sa performance n’est pas homogène. La valeur actuelle se concentre surtout sur la **réactivation précoce (S8–S9)** et la **personnalisation par affinité (S17)**. À l’inverse, les envois très larges après la première commande ou après une longue inactivité produisent beaucoup d’offres pour peu de commandes.

La priorité business n’est donc pas de créer davantage d’offres, mais de **réduire la surdistribution, harmoniser les règles et les messages, mesurer le coût complet, puis prouver l’incrémentalité par expérimentation contrôlée**.
