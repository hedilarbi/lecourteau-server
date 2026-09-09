# Étude de valeur du système Smart Offers

**Période analysée :** 5 août au 7 septembre 2026  
**Question :** Smart Offers a-t-il produit une valeur directe par augmentation du panier, ou une valeur indirecte par création d’habitude et réactivation?

## Réponse de direction

Smart Offers a généré de l’activité mesurable, mais les données actuelles ne permettent pas encore d’affirmer qu’il a créé une valeur incrémentale nette à l’échelle du système.

Les 553 commandes ayant réellement appliqué une Smart Offer ont augmenté leur panier brut de **6,01 $ en moyenne** par rapport aux trois commandes précédentes du même client. Toutefois, la réduction monétaire mesurée était d’environ **6,42 $ par commande**. Après remise, le panier net était donc **0,41 $ inférieur** à la référence historique.

Le signal varie fortement selon l’objectif :

- les stratégies panier, fidélité et affinité montrent une hausse nette positive, mais sur de faibles volumes;
- la réactivation représente 388 des 553 commandes converties et affiche une valeur nette inférieure de 2,68 $ au panier historique;
- 27,96 % des utilisateurs ayant utilisé une offre de réactivation et disposant de 14 jours d’observation ont commandé une nouvelle fois après leur retour;
- aucun groupe témoin ne permet de déterminer combien de ces commandes auraient eu lieu sans offre.

La conclusion professionnelle est donc : **valeur potentielle et signaux positifs localisés, mais ROI causal global non démontré**.

## 1. Périmètre et entonnoir

| Indicateur | Résultat |
|---|---:|
| Offres générées | 64 333 |
| Offres activées | 62 076 |
| Utilisateurs uniques activés | 9 008 |
| Commandes avec Smart Offer transactionnellement appliquée | 553 |
| Utilisateurs uniques ayant appliqué une offre | 509 |
| Conversion par offre activée | **0,89 %** |
| Utilisateurs activés ayant utilisé au moins une offre | **5,65 %** |

Le statut des offres indique 580 applications, mais seulement 553 commandes valides portent réellement `personalizedOfferApplied: true`. L’analyse économique utilise les 553 transactions vérifiées.

Le système a généré environ **7,1 offres par utilisateur activé** en un mois. Cette répétition importante dilue le taux par offre et crée un risque de fatigue promotionnelle.

## 2. Valeur directe globale

Pour chaque commande convertie, la référence est la moyenne des trois commandes antérieures du même utilisateur.

| Mesure | Résultat |
|---|---:|
| Chiffre d’affaires brut associé | 18 801,91 $ |
| Chiffre d’affaires net après remise | 15 251,79 $ |
| Réductions monétaires mesurées | 3 550,12 $ |
| Panier brut moyen converti | 34,00 $ |
| Panier historique moyen de référence | 27,99 $ |
| Hausse brute moyenne | **+6,01 $** |
| Hausse brute médiane | +4,64 $ |
| Commandes dont le panier brut a augmenté | **66,37 %** |
| Valeur nette moyenne versus historique | **−0,41 $** |

En valeur agrégée approximative :

- hausse brute observée versus référence : environ **+3 324 $**;
- remises monétaires mesurées : **−3 550 $**;
- solde net avant coût matière : environ **−227 $**.

Ce calcul ne signifie pas une perte comptable de 227 $. Une commande réellement créée par une offre de réactivation apporte un revenu qui n’aurait peut-être pas existé. Le problème est qu’en l’absence de témoin, cette part incrémentale est inconnue.

### Limites de coût

La base ne valorise pas complètement :

- le coût matière des articles offerts;
- le passif économique des points de fidélité distribués;
- la marge par article;
- les éventuels changements de composition du panier.

Le résultat net réel est donc probablement un peu inférieur au calcul ci-dessus pour les offres gratuites et les points.

## 3. Valeur directe selon l’objectif

| Groupe | Commandes converties | Panier brut | Référence historique | Hausse brute | Net après avantage versus référence |
|---|---:|---:|---:|---:|---:|
| Réactivation | 388 | 32,42 $ | 27,82 $ | +4,60 $ | **−2,68 $** |
| Habitude | 55 | 36,44 $ | 32,08 $ | +4,36 $ | **+0,82 $** |
| Fidélité | 24 | 36,14 $ | 21,41 $ | +14,73 $ | **+11,64 $*** |
| Panier | 22 | 50,34 $ | 35,17 $ | +15,17 $ | **+14,31 $*** |
| Affinité | 61 | 35,14 $ | 25,29 $ | +9,85 $ | **+3,06 $** |
| Découverte | 3 | 33,82 $ | 30,38 $ | +3,43 $ | −4,33 $ |

\* Le coût matière des articles offerts et la valeur future des points ne sont pas soustraits.

### Interprétation

#### Réactivation

La réactivation concentre :

- **70,2 %** des commandes converties;
- 12 577,91 $ de panier brut;
- 2 825,22 $ de remises monétaires, soit près de 80 % de toutes les remises mesurées.

Elle tire le résultat direct vers le bas. Elle peut néanmoins rester rentable si elle crée suffisamment de commandes qui n’auraient pas existé sans l’offre. C’est précisément ce que seul un groupe témoin peut mesurer.

#### Panier

Le meilleur signal direct provient des stratégies panier : +15,17 $ de panier brut moyen et +14,31 $ net mesuré versus historique. Toutefois, il repose sur seulement 22 commandes et ne comprend pas tout le coût des articles ou points.

#### Affinité

S17 présente un signal plus crédible en volume : 61 commandes, 80,33 % avec un panier supérieur à la référence, et +3,06 $ net après réduction. Cette stratégie mérite un test contrôlé prioritaire.

#### Fidélité

Le signal est élevé mais ne repose que sur 24 commandes. Ces clients sont naturellement très actifs; le risque de payer une commande qui aurait eu lieu de toute façon est important.

## 4. Résultat selon le type d’offre

| Type | Commandes | Valeur nette moyenne versus historique |
|---|---:|---:|
| Réduction sur commande | 279 | **−3,31 $** |
| Bonus fixe panier | 147 | −0,22 $ |
| Réduction de catégorie | 64 | **+2,72 $** |
| Article offert | 46 | +5,92 $ avant coût matière |
| Points de fidélité | 17 | +16,59 $ avant coût futur des points |

Les réductions générales en pourcentage sont le format le moins convaincant économiquement. Les bonus fixes permettent au moins de plafonner le coût. Les points semblent prometteurs, mais l’échantillon est faible et leur coût futur doit être intégré.

## 5. Création d’habitude

Sur les utilisateurs ayant reçu une première offre du groupe HABITUDE :

| Fenêtre | Cohorte mature | Ont recommandé | Retour avec une offre HABITUDE | Retour sans appliquer l’offre |
|---|---:|---:|---:|---:|
| 7 jours | 6 429 | 5,60 % | 0,23 % | 4,64 % |
| 14 jours | 6 120 | 9,18 % | 0,46 % | 7,89 % |
| 30 jours | 5 360 | 10,93 % | 0,67 % | 9,33 % |

### Après une conversion HABITUDE

Parmi les utilisateurs ayant appliqué une offre HABITUDE et ayant assez de recul :

- 9 sur 39 ont recommandé sous 7 jours : **23,08 %**;
- 10 sur 28 sous 14 jours : **35,71 %**;
- 6 sur 7 sous 30 jours : 85,71 %, échantillon trop petit pour conclure.

### Verdict habitude

Il existe un signal de répétition après conversion, mais seulement 55 commandes HABITUDE ont utilisé une offre. La majorité des retours de la cohorte se fait sans application de l’offre. Les données ne prouvent donc pas encore que Smart Offers crée l’habitude plutôt que d’accompagner une habitude qui se serait construite naturellement.

## 6. Réactivation

| Fenêtre après la première activation | Cohorte mature | Retour total | Retour avec offre de réactivation | Retour sans appliquer l’offre |
|---|---:|---:|---:|---:|
| 7 jours | 12 630 | 7,57 % | 1,81 % | 5,73 % |
| 14 jours | 11 177 | 12,74 % | 2,71 % | 10,20 % |
| 30 jours | 7 190 | **16,24 %** | **3,50 %** | **13,64 %** |

Les catégories ne sont pas parfaitement additives, car un utilisateur peut commander avec une offre puis recommander naturellement dans la même fenêtre.

### Après une conversion de réactivation

- 49 sur 300 ont recommandé sous 7 jours : **16,33 %**;
- 59 sur 211 sous 14 jours : **27,96 %**;
- 29 sur 71 sous 30 jours : **40,85 %**.

### Verdict réactivation

Smart Offers participe visiblement à certains retours : 3,5 % de la cohorte mature à 30 jours a utilisé une offre de réactivation. Toutefois, 13,64 % est revenu sans appliquer l’offre. Sans utilisateurs éligibles volontairement laissés sans offre, il est impossible de savoir si les 3,5 % représentent des commandes créées ou des commandes naturelles subventionnées.

Les nouvelles règles S19/S20 devraient améliorer cette situation en évitant d’offrir une remise aux clients qui ne sont pas encore en retard sur leur cadence.

## 7. Panier et affinité : retour naturel élevé

| Groupe | Retour total à 14 jours | Retour avec l’offre du groupe | Retour naturel |
|---|---:|---:|---:|
| Panier | 40,41 % | 0,68 % | 35,81 % |
| Affinité | 41,02 % | 3,16 % | 35,81 % |
| Fidélité | 73,18 % | 3,76 % | 68,67 % |

Ces utilisateurs commandent déjà fréquemment. Une forte conversion ne serait pas nécessairement une réussite : elle pourrait simplement transférer une commande naturelle vers une commande remisée.

Pour ces groupes, il faut mesurer :

- le panier additionnel;
- la marge additionnelle;
- la variation de composition du panier;
- la fréquence après l’offre;
- le coût complet de l’avantage.

## 8. Ce qui est démontré et ce qui ne l’est pas

### Démontré par les données

- 509 utilisateurs uniques ont utilisé au moins une Smart Offer.
- 553 commandes et 18 801,91 $ de panier brut sont associés à une utilisation réelle.
- Les paniers convertis sont en moyenne 6,01 $ supérieurs aux trois paniers précédents.
- Les remises monétaires dépassent cette hausse brute d’environ 227 $.
- Panier, affinité et fidélité montrent des signaux directs positifs sur de petits volumes.
- 27,96 % des utilisateurs réactivés par une offre ont recommandé sous 14 jours dans la cohorte mature.
- Les offres sont extrêmement répétées : 64 333 générations pour 9 008 utilisateurs activés.

### Non démontré

- que les 553 commandes n’auraient pas existé sans Smart Offers;
- que le chiffre d’affaires net incrémental est positif;
- que la marge incrémentale est positive;
- que S02–S05 créent davantage d’habitude qu’une absence d’offre;
- que les retours de réactivation sont causés par l’offre;
- que les points et articles gratuits sont rentables après leur coût complet.

## 9. Décision recommandée

Il ne faut ni arrêter tout le système ni conclure qu’il est déjà rentable. Il faut transformer Smart Offers en dispositif mesurable.

### Groupe témoin permanent

Pour chaque stratégie, réserver aléatoirement 10 % des utilisateurs éligibles :

```text
90 % → offre
10 % → aucune offre pendant la fenêtre de mesure
```

L’affectation doit être stable par utilisateur et stratégie afin d’éviter qu’un utilisateur change de groupe chaque jour.

### KPI causal

Pour chaque stratégie :

```text
Lift de conversion = taux offre − taux témoin
Commandes incrémentales = conversions observées − conversions attendues du témoin
CA incrémental = CA offre − CA attendu du témoin
Marge incrémentale = marge additionnelle − remise − coût article − coût des points
```

### Priorités

1. Réduire la répétition et augmenter les cooldowns.
2. Mesurer S19/S20 séparément des anciennes cohortes de réactivation.
3. Tester les bonus fixes contre les pourcentages généraux.
4. Tester S17 avec témoin, car son volume et son signal net sont intéressants.
5. Recalibrer S13–S15 autour de seuils atteignables.
6. Ajouter le coût matière et la valeur comptable des points au modèle analytique.

## Conclusion finale

Smart Offers **apporte une activité commerciale visible**, mais sa valeur nette globale n’est pas encore prouvée. Sur les commandes converties, l’augmentation du panier brut compense presque les remises, sans les dépasser complètement. La valeur indirecte est plausible — notamment 28 % de nouvelle commande sous 14 jours après une réactivation réussie — mais elle ne peut pas être attribuée causalement au système sans groupe témoin.

Le meilleur diagnostic actuel est donc :

> **Smart Offers possède des poches de valeur, mais le système historique distribue trop d’offres, subventionne fortement la réactivation et ne dispose pas encore de la mesure expérimentale nécessaire pour prouver son ROI.**
