# Étude comportementale S4 — Utilisateurs non convertis

**Période :** 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu une S4 activée, à l’exclusion de tous ceux ayant converti S4  
**Règle de placement contrôlée :** exactement trois commandes valides dans les 30 jours précédant la première activation

## 1. Résumé de direction

S4 ne présente pas le défaut majeur de récence observé sur S2 et S3. **553 des 569 non-convertis, soit 97,2 %, étaient correctement placés** selon la règle technique.

Le problème est différent : S4 intervient souvent immédiatement après une commande auprès de clients déjà très actifs. Leur dernière commande date médianement de **0,92 jour** et près de la moitié ont déjà au moins 11 commandes historiques. Parmi les non-convertis suffisamment observés, **49,77 % recommandent sous 14 jours sans utiliser S4**.

S4 risque donc surtout de subventionner une commande qui aurait eu lieu naturellement. Son faible taux d’utilisation ne signifie pas nécessairement que le cadeau est mauvais; il peut signifier que le client n’a pas besoin de promotion, que l’offre arrive trop tôt ou que son seuil/cadeau n’est pas adapté.

### Conclusions principales

1. 569 utilisateurs non convertis ont été analysés après exclusion de 15 convertis.
2. 553 sont correctement placés selon la condition `ordersLast30d === 3`.
3. La dernière commande date en moyenne de 4,43 jours et médianement de 0,92 jour.
4. Les trois commandes récentes sont réalisées sur une période médiane de 17,12 jours.
5. 47,6 % des correctement placés ont déjà au moins 11 commandes historiques.
6. Le dernier panier médian est de 20 $, et seulement 34 % atteignaient déjà le seuil de leur variante S4.
7. 60,4 % ont fini par recommander sans convertir S4.
8. Le retour sans S4 atteint 31,5 % à 7 jours et 49,77 % à 14 jours.
9. 64 % avaient déjà bénéficié d’au moins une promotion explicitement identifiable.

## 2. Population étudiée

| Indicateur | Volume |
|---|---:|
| Offres S4 générées | 1 030 |
| Offres activées | 1 007 |
| Utilisateurs uniques avec offre générée | 591 |
| Utilisateurs uniques avec offre activée | 584 |
| Convertis exclus | 15 |
| **Non-convertis analysés** | **569** |
| Correctement placés | **553** |
| Incorrectement placés | 16 |

Les 16 placements non conformes se répartissent entre 15 utilisateurs avec seulement deux commandes sur 30 jours et un utilisateur avec une seule commande visible. Ils peuvent provenir d’écarts de dates, d’historique modifié ou d’anciennes générations.

## 3. Ce que S4 cible réellement

La condition actuelle est :

```js
ordersLast30d === 3
```

Elle ne signifie pas « troisième commande à vie ». Elle signifie « exactement trois commandes dans les 30 derniers jours ».

### Nombre total de commandes avant S4

| Commandes historiques | Utilisateurs correctement placés | Part |
|---|---:|---:|
| 3 | 90 | 16,3 % |
| 4–5 | 70 | 12,7 % |
| 6–10 | 130 | 23,5 % |
| 11 et plus | 263 | **47,6 %** |

S4 est donc principalement une stratégie de **récompense de cadence mensuelle**, pas une stratégie de passage à la quatrième commande. Le positionnement marketing et les KPI doivent refléter cette réalité.

## 4. Récence et cadence

- Récence moyenne de la dernière commande : 4,43 jours
- Récence médiane : **0,92 jour**
- Période moyenne couvrant les trois dernières commandes : 17,42 jours
- Période médiane : 17,12 jours

### Retour sans S4 selon la récence

| Dernière commande avant S4 | Utilisateurs | Population mature à 14 jours | Retours sous 14 jours | Taux |
|---|---:|---:|---:|---:|
| 0–2 jours | 342 | 246 | 122 | 49,59 % |
| 3–6 jours | 82 | 75 | 39 | 52,00 % |
| 7–13 jours | 84 | 73 | 40 | **54,79 %** |
| 14–20 jours | 38 | 28 | 11 | 39,29 % |
| 21–30 jours | 7 | 6 | 1 | 16,67 % |

La majorité reçoit S4 juste après sa troisième commande récente. Une offre promotionnelle envoyée moins de 24 heures après un achat peut être ignorée simplement parce que le besoin de recommander n’existe pas encore.

La zone de 7 à 13 jours paraît comportementalement plus naturelle, mais ces retours ne prouvent aucun effet de S4 puisqu’elle n’a pas été utilisée.

## 5. Historique des variantes S4

S4 a conservé le type `free_item`, mais le produit et le seuil ont changé.

| Configuration | Offres générées | Applications |
|---|---:|---:|
| Article dessert précis dès 25 $ | 105 | 0 |
| Catégorie dessert sans produit précis dès 25 $ | 210 | 0 |
| Deuxième article dessert précis dès 25 $ | 34 | 0 |
| Churros dès 35 $ | 305 | 5 |
| Churros dès 20 $ | 376 | 10 |

La version à 20 $ produit le meilleur signal brut. Cette comparaison reste temporelle et non expérimentale. Les anciennes offres sans produit explicite pouvaient fonctionner par catégorie, mais leur promesse était moins déterministe.

Parmi les non-convertis correctement placés lors de leur première exposition :

- 309 ont commencé avec un cadeau dès 25 $;
- 120 avec un cadeau dès 35 $;
- 124 avec un cadeau dès 20 $.

## 6. Comportement de panier

Sur les trois dernières commandes avant S4 :

- panier moyen : 22,74 $;
- dernier panier moyen : 22,39 $;
- dernier panier médian : **20,00 $**;
- évolution moyenne entre la première et la troisième commande récente : −0,43 $.

Seulement **34 %** avaient un dernier panier égal ou supérieur au seuil de la variante reçue.

### Retour sans S4 selon le dernier panier

| Dernier panier | Population mature à 14 jours | Retours | Taux |
|---|---:|---:|---:|
| Moins de 20 $ | 218 | 109 | 50,00 % |
| 20–29,99 $ | 108 | 58 | 53,70 % |
| 30–39,99 $ | 48 | 20 | 41,67 % |
| 40 $ et plus | 54 | 26 | 48,15 % |

Le retour naturel est élevé dans toutes les classes de panier. La principale question n’est donc pas « qui reviendra ? », mais « chez qui le cadeau génère-t-il une commande ou une marge supplémentaire ? ».

Le seuil actuel de 20 $ est proche du panier médian et beaucoup plus cohérent que les anciens seuils de 25 $ et 35 $.

## 7. Comportement après S4

| Fenêtre | Population suffisamment observée | Retours sans S4 | Taux |
|---|---:|---:|---:|
| 3 jours | 526 | 77 | 14,64 % |
| 7 jours | 492 | 155 | **31,50 %** |
| 14 jours | 428 | 213 | **49,77 %** |
| 30 jours | 177 | 127 | **71,75 %** |

Au total, 334 utilisateurs correctement placés, soit 60,4 %, ont recommandé après leur première S4 sans jamais convertir S4.

- délai moyen avant retour : 9,24 jours;
- délai médian : 7,23 jours.

Ce comportement est très différent de S2 et S3. La population S4 possède déjà une forte propension à commander. Donner systématiquement un cadeau peut réduire la marge sans créer de fréquence additionnelle.

## 8. Expositions répétées

Pour l’ensemble des non-convertis :

| Activations S4 | Utilisateurs |
|---|---:|
| 1 | 287 |
| 2 | 181 |
| 3 | 85 |
| 4 | 16 |

La répétition est moins extrême que pour S2/S3, mais près de la moitié ont reçu au moins deux activations. Comme la majorité recommande naturellement, une nouvelle S4 peut être créée après un nouveau cycle de trois commandes sur 30 jours.

Le cooldown doit rester géré dans la configuration. D’un point de vue business, il doit être suffisamment long pour mesurer si le cadeau modifie réellement la cadence, plutôt que récompenser chaque séquence déjà naturelle.

## 9. Historique promotionnel

Parmi les correctement placés, **64,01 %** avaient déjà bénéficié d’un avantage identifiable avant S4 : code promotionnel, Smart Offer ou abonnement.

Deux interprétations sont possibles :

1. ces utilisateurs sont sensibles aux promotions;
2. le système concentre déjà beaucoup de subventions sur les clients les plus actifs.

Sans groupe témoin, il est impossible de distinguer fidélité naturelle et fidélité achetée.

## 10. Canal et joignabilité

### Dernière commande avant S4

| Canal | Utilisateurs |
|---|---:|
| Application | 502 |
| Web | 51 |

| Mode | Utilisateurs |
|---|---:|
| Ramassage (`pick up` + `pickup`) | 452 |
| Livraison | 101 |

Cette population est très largement mobile et orientée ramassage.

### État actuel

- application déclarée installée : 97,29 %;
- jeton push présent : 60,76 %.

### Événements historiques S4

| Événement | Utilisateurs uniques | Offres uniques |
|---|---:|---:|
| Notification enregistrée | 349 | 603 |
| Vue enregistrée | 151 | 173 |
| Clic notification | 19 | 23 |
| Clic dans l’offre | 50 | 53 |
| Application | 15 | 15 |

La couverture événementielle reste partielle. Une offre activée ne doit pas être assimilée à une notification livrée.

## 11. Typologie comportementale

### Clients réellement au quatrième achat

90 utilisateurs n’avaient que trois commandes historiques.

**Lecture :** groupe cohérent avec une stratégie de création d’habitude.

**Action :** tester le cadeau contre un groupe témoin, avec envoi proche de leur cadence attendue.

### Réguliers historiques momentanément à trois commandes mensuelles

263 utilisateurs possèdent au moins 11 commandes historiques.

**Lecture :** fidélité déjà établie; fort risque de cannibalisation.

**Action :** privilégier reconnaissance, points ou avantage surprise moins systématique plutôt qu’un cadeau automatique.

### Clients à panier inférieur au seuil

Ils ont une cadence élevée, mais leur panier reste sous le seuil reçu.

**Lecture :** le cadeau cherche simultanément à stimuler fréquence et panier, ce qui rend son effet difficile à interpréter.

**Action :** séparer l’objectif de fidélité de l’objectif d’augmentation du panier.

### Clients revenant sans offre

Ils représentent la majorité des retours observés.

**Lecture :** potentiel de marge perdue si l’offre est appliquée à une commande déjà probable.

**Action :** utiliser un groupe témoin et retarder l’envoi jusqu’à proximité de la date de retour attendue.

## 12. Recommandations

### Ne pas modifier immédiatement la condition `ordersLast30d === 3`

La condition place correctement la majorité des utilisateurs selon la définition actuelle. Il faut d’abord décider ce que S4 représente :

- un jalon de quatrième commande à vie;
- ou une récompense de trois commandes sur 30 jours.

Si l’objectif est le quatrième achat à vie, la règle doit devenir `orderCount === 3`. Si l’objectif est la cadence mensuelle, la règle actuelle est correcte mais le message et la mesure doivent être adaptés.

### Retarder le déclenchement

Ne pas activer S4 immédiatement après la troisième commande récente. Tester un envoi :

- à J+5;
- à J+7;
- ou à la date habituelle de retour calculée à partir de l’historique individuel.

### Tester l’incrémentalité

| Groupe | Traitement |
|---|---|
| Témoin | Aucun cadeau |
| A | Churros dès 20 $, déclenchement actuel |
| B | Churros dès 20 $, déclenchement à J+7 |
| C | Points ou reconnaissance non monétaire à J+7 |

Mesurer : délai jusqu’à la prochaine commande, marge incrémentale, panier incrémental et fréquence à 30–60 jours.

### Éviter la récompense permanente

Pour les utilisateurs ayant déjà au moins 11 commandes, limiter S4 ou les orienter vers une logique fidélité S5–S7. Leur comportement montre qu’ils n’ont probablement pas besoin du même mécanisme qu’un nouveau client arrivant à sa quatrième commande.

## Verdict

S4 cible correctement sa règle technique, mais cette règle ne représente pas le jalon que son positionnement laisse entendre. La population est largement composée de clients très expérimentés, venant de commander et susceptibles de recommander sans avantage.

Le risque principal n’est pas la non-conversion : c’est la **cannibalisation potentielle de clients déjà fidèles**. Avant de changer le type d’offre, il faut clarifier l’objectif de S4, retarder son déclenchement et mesurer son effet contre un groupe témoin.
