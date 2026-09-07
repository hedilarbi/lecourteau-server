# Étude comportementale S13 à S16 — Ciblage panier et faible conversion

> **Rectification importante :** les taux de conformité initialement calculés
> mesurent la conformité aux bornes actuellement codées, et non aux tranches
> métier attendues. Le code cible S13 `< 20 $`, S14 `20–34,99 $`, S15
> `35–50 $` et S16 `> 50 $`. Si les tranches métier de référence sont S13
> `20–30 $`, S14 `30–40 $`, S15 `40–55 $` et S16 `> 55 $`, le ciblage actuel
> est incorrect et l'analyse doit être recalculée après réalignement des bornes.

**Période observée :** 5 août au 6 septembre 2026  
**Méthode :** reconstruction du profil au moment de la première activation de chaque stratégie, rapprochement avec les commandes ayant réellement appliqué l’offre, puis observation des commandes ultérieures sans utilisation de l’offre.

## Résumé de direction

Les utilisateurs sont presque toujours affectés à la tranche actuellement codée : de 99,2 % à 100 % de conformité selon la stratégie. Cela ne signifie pas qu'ils respectent les tranches métier attendues. S13, notamment, cible actuellement les paniers inférieurs à 20 $, ce qui explique sa médiane de 15,13 $.

Le problème principal est commercial : S13, S14 et S15 demandent une hausse de panier trop importante. Les utilisateurs continuent souvent à commander sans appliquer l’offre, ce qui montre qu’ils sont actifs mais que la récompense ou son seuil ne correspond pas à leur comportement.

Les quatre stratégies cumulent également trois facteurs défavorables :

1. des cooldowns de seulement 3 à 6 jours;
2. entre 47,7 % et 73,5 % des non-convertis ont déjà utilisé une promotion;
3. chaque non-converti reçoit en moyenne entre 2,2 et 2,5 activations sur une période d’environ un mois.

Le taux de conversion de l’offre ne suffit pas pour évaluer ces stratégies. Leur objectif est d’augmenter le panier; le bon KPI est donc la marge et le panier incrémental comparés à un groupe témoin.

## Vue d’ensemble

| Stratégie | Utilisateurs | Convertis | Taux | Ciblage conforme | Panier 90 j médian des non-convertis | Commandes à vie médianes |
|---|---:|---:|---:|---:|---:|---:|
| S13 — Petits paniers | 655 | 3 | **0,46 %** | 99,69 % | 15,13 $ | 9 |
| S14 — Paniers intermédiaires | 722 | 9 | **1,25 %** | 99,31 % | 26,16 $ | 8 |
| S15 — Grands paniers | 240 | 5 | **2,08 %** | 99,17 % | 39,48 $ | 8 |
| S16 — Très grands paniers | 71 | 3 | **4,23 %** | 100 % | 55,48 $ | 8 |

La conversion augmente avec la valeur habituelle du panier. Les clients S16 sont moins nombreux mais plus proches du seuil et répondent davantage.

## Configuration actuelle et effort demandé

| Stratégie | Configuration DB actuelle | Panier médian | Hausse nécessaire pour atteindre le seuil |
|---|---|---:|---:|
| S13 | 200 points dès 30 $ | 15,13 $ | **+98 %** |
| S14 | Article offert dès 50 $ | 26,16 $ | **+91 %** |
| S15 | Article offert dès 60 $ | 39,48 $ | **+52 %** |
| S16 | Article offert dès 65 $ | 55,48 $ | **+17 %** |

S13 et S14 demandent presque de doubler le panier. S15 demande encore une hausse supérieure à 50 %. S16 est la seule stratégie dont le seuil actuel reste proche du comportement habituel.

## S13 — Développer les petits paniers

### Population

- 1 677 offres générées et 1 664 activées;
- 655 utilisateurs uniques;
- 652 non-convertis;
- 99,69 % correctement ciblés;
- 9 commandes à vie médianes;
- 4 commandes médianes sur 90 jours;
- panier 90 jours médian : **15,13 $**;
- dernier panier médian : **13 $**;
- récence médiane : 6,8 jours;
- cadence médiane : 12,33 jours;
- 47,7 % avaient déjà utilisé une promotion;
- 2,54 activations moyennes par non-converti.

### Capacité historique à atteindre le seuil

Parmi les 652 non-convertis :

- 575, soit **88,2 %**, n’avaient jamais atteint le seuil de leur première variante durant les 90 jours précédents;
- 53 l’avaient atteint sur moins du quart de leurs commandes;
- aucun utilisateur ne l’avait atteint sur au moins la moitié de ses commandes.

Le seuil ne représente pas une progression raisonnable : il demande un changement complet de comportement.

### Variantes historiques par utilisateur

| Variante initiale | Utilisateurs | Convertis | Taux |
|---|---:|---:|---:|
| 5 $ dès 35 $ | 488 | 2 | 0,41 % |
| 150 points dès 30 $ | 93 | 0 | 0 % |
| 200 points dès 30 $ | 74 | 1 | 1,35 % |

Le volume des variantes en points est trop faible pour conclure qu’elles sont supérieures.

### Retour naturel

- 25,44 % recommandaient sous 7 jours sans appliquer S13;
- 37,80 % sous 14 jours;
- 61,21 % sous 30 jours parmi les cohortes suffisamment observées.

Les utilisateurs ne sont pas inactifs. Ils continuent à commander, mais à leur niveau de panier habituel.

### Diagnostic

Le profil est correctement ciblé, mais l’objectif demandé est irréaliste. Une offre à 30–35 $ ne développe pas progressivement un panier habituel de 13–15 $.

**Test recommandé :** seuil personnalisé autour de `panier moyen + 5 $`, ou une tranche fixe proche de 20 $, avec une récompense limitée. Comparer 200 points dès 20 $ à une faible remise fixe et à un témoin.

## S14 — Faire progresser les paniers intermédiaires

### Population

- 1 820 offres générées et 1 814 activées;
- 722 utilisateurs uniques;
- 713 non-convertis;
- 99,31 % correctement ciblés;
- 8 commandes à vie médianes;
- 4 commandes médianes sur 90 jours;
- panier 90 jours médian : **26,16 $**;
- dernier panier médian : 24,90 $;
- récence médiane : 7,76 jours;
- cadence médiane : 15,21 jours;
- 63,81 % avaient déjà utilisé une promotion;
- 2,52 activations moyennes.

### Capacité historique à atteindre le seuil

- 507 non-convertis sur 713, soit **71,1 %**, n’avaient jamais atteint le seuil de leur première variante;
- seulement 6 l’avaient atteint sur au moins la moitié de leurs commandes historiques.

La configuration actuelle à 50 $ demande une hausse médiane de 91 %.

### Variantes historiques

| Variante initiale | Utilisateurs | Convertis | Taux |
|---|---:|---:|---:|
| 7 $ dès 45 $ | 534 | 5 | 0,94 % |
| Article offert dès 40 $ | 147 | 4 | **2,72 %** |
| Article offert dès 50 $ | 41 | 0 | 0 % |

Le meilleur signal historique est l’article offert à 40 $, mais le volume reste limité. Le passage à 50 $ n’a produit aucune conversion sur 41 utilisateurs.

### Retour naturel

- 23,21 % sous 7 jours sans S14;
- 36,52 % sous 14 jours;
- 57,21 % sous 30 jours.

### Diagnostic

Les utilisateurs sont actifs et correctement classés, mais le seuil de 50 $ ne correspond pas à un panier médian de 26 $. Une progression vers 32–35 $ serait plus crédible.

**Test recommandé :** article offert dès 35 $ contre une récompense légère dès 35 $, avec témoin. Mesurer le panier incrémental plutôt que la seule application.

## S15 — Faire progresser les grands paniers

### Population

- 577 offres générées et 576 activées;
- 240 utilisateurs uniques;
- 235 non-convertis;
- 99,17 % correctement ciblés;
- 8 commandes à vie médianes;
- 4 commandes médianes sur 90 jours;
- panier 90 jours médian : **39,48 $**;
- dernier panier médian : 42,05 $;
- récence médiane : 9,77 jours;
- cadence médiane : 17,5 jours;
- 69,79 % avaient déjà utilisé une promotion;
- 2,38 activations moyennes.

### Capacité historique à atteindre le seuil

- 60 utilisateurs, soit 25,5 %, n’avaient jamais atteint le seuil de leur première variante;
- la fréquence médiane d’atteinte du seuil était de 25 % des commandes;
- la configuration actuelle à 60 $ demande une hausse de 52 % par rapport au panier médian.

### Variantes historiques

| Variante initiale | Utilisateurs | Convertis | Taux |
|---|---:|---:|---:|
| 7 $ dès 50 $ | 178 | 4 | **2,25 %** |
| Article offert dès 45 $ | 45 | 1 | 2,22 % |
| Article offert dès 60 $ | 15 | 0 | 0 % |

Les deux variantes proches du comportement habituel donnent des résultats comparables. Le seuil actuel de 60 $ n’a enregistré aucune conversion, mais son échantillon est très faible.

### Retour naturel

- 18,18 % sous 7 jours sans S15;
- 28,71 % sous 14 jours;
- 48,68 % sous 30 jours.

### Diagnostic

Le ciblage est correct, mais 60 $ est une ambition trop élevée pour un panier habituel de 39–42 $. Le seuil de 45–50 $ correspond mieux à une progression réaliste.

**Test recommandé :** article offert dès 45 $ contre une remise fixe plafonnée dès 50 $, avec témoin.

## S16 — Valoriser les très grands paniers

### Population

- 157 offres générées et 156 activées;
- seulement 71 utilisateurs uniques;
- 68 non-convertis;
- ciblage conforme à **100 %**;
- 8 commandes à vie médianes;
- 3 commandes médianes sur 90 jours;
- panier 90 jours médian : **55,48 $**;
- dernier panier médian : 55,73 $;
- récence médiane : 6,29 jours;
- cadence médiane : 20,74 jours;
- 73,53 % avaient déjà utilisé une promotion;
- 2,21 activations moyennes.

### Capacité historique à atteindre le seuil

- seulement 6 non-convertis n’avaient jamais atteint le seuil de leur variante;
- la fréquence médiane d’atteinte était de 33,3 %;
- le seuil actuel de 65 $ exige une hausse raisonnable d’environ 17 %.

### Variantes historiques

| Variante initiale | Utilisateurs | Convertis | Taux |
|---|---:|---:|---:|
| 10 $ dès 65 $ | 40 | 1 | 2,50 % |
| 250 points dès 60 $ | 14 | 1 | 7,14 % |
| 350 points dès 60 $ | 9 | 1 | 11,11 % |
| Article offert dès 65 $ | 8 | 0 | 0 % |

Les volumes sont trop petits pour déclarer les points gagnants. S16 possède néanmoins le meilleur taux global des quatre stratégies, soit 4,23 %, et son seuil est le plus cohérent.

### Retour naturel

- 14,75 % sous 7 jours sans S16;
- 22,64 % sous 14 jours;
- 38,46 % sous 30 jours.

### Diagnostic

S16 ne présente pas un défaut évident de ciblage. Le principal risque est de récompenser des clients qui atteignent déjà régulièrement un panier élevé. Il faut mesurer l’augmentation de marge, pas seulement la conversion.

**Test recommandé :** 250 points dès 60–65 $ contre l’article offert actuel et un groupe témoin. Ne pas conclure à partir des 23 utilisateurs historiques ayant reçu des points.

## Causes communes du faible taux

### 1. Seuils incompatibles avec le comportement

S13, S14 et S15 demandent respectivement environ +98 %, +91 % et +52 % par rapport au panier médian actuel. Le seuil devient un obstacle plutôt qu’un objectif atteignable.

### 2. Les utilisateurs commandent sans l’offre

Les retours naturels à 14 jours vont de 22,6 % à 37,8 %, très au-dessus des taux d’application de 0,46 % à 4,23 %. La fréquence d’achat n’est pas le problème principal.

### 3. Répétition excessive

Les cooldowns actuels sont :

- S13 : 6 jours;
- S14 : 4 jours;
- S15 : 4 jours;
- S16 : 3 jours.

Avec une validité de 48 heures, ces valeurs permettent plusieurs expositions rapprochées. Les non-convertis ont effectivement reçu plus de deux activations en moyenne durant la période.

### 4. Saturation promotionnelle

La part ayant déjà utilisé une promotion augmente avec le panier : 47,7 % pour S13, 63,8 % pour S14, 69,8 % pour S15 et 73,5 % pour S16. Une nouvelle récompense peut déplacer une commande plutôt que créer de la valeur additionnelle.

### 5. KPI incomplet

Une stratégie panier peut réussir sans que l’offre soit appliquée si le message augmente le panier ou accélère la commande. À l’inverse, une conversion peut détruire de la marge si le client aurait commandé au même montant sans récompense.

## Recommandations transversales

1. Calculer dans le profiling un seuil de panier personnel atteignable, par exemple le panier moyen récent majoré de 15 à 25 %, avec arrondi commercial.
2. Ne générer une stratégie panier que si le seuil proposé a déjà été atteint occasionnellement ou reste dans une progression raisonnable.
3. Augmenter les cooldowns à au moins 21 jours avant tout nouveau test.
4. Limiter les activations répétées d’une même stratégie sans conversion.
5. Créer un groupe témoin permanent pour chaque tranche.
6. Mesurer le panier incrémental, la marge incrémentale et le coût de récompense, pas uniquement le taux d’application.
7. Séparer les utilisateurs déjà dépendants des promotions des utilisateurs encore peu exposés.
8. Ne pas modifier S16 sur la base de ses variantes historiques sans élargir l’échantillon.

## Conclusion

Les profils sont correctement visés selon les règles actuellement programmées, mais les règles définissent uniquement une tranche de panier. Elles ne vérifient pas si le seuil de l’offre est réaliste pour l’utilisateur.

S13 et S14 sont les plus mal calibrées, S15 doit revenir vers un seuil de 45–50 $, et S16 nécessite surtout un test contrôlé. La priorité n’est pas d’augmenter la générosité : elle est de rapprocher le seuil du comportement individuel et de réduire fortement la répétition.
