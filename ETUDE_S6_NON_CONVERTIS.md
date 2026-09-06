# Étude comportementale S6 — Utilisateurs non convertis

**Période :** 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu une S6 activée, à l’exclusion de tous ceux ayant converti S6  
**Règle contrôlée :** cinq à sept commandes dans les 30 jours précédant la première activation

## 1. Résumé de direction

S6 est différente de S4 et S5. Sa population historique correspond réellement à une logique de **forte fréquence** : 168 des 169 non-convertis respectent la règle technique, 67,3 % possèdent au moins 11 commandes à vie et 41,1 % en possèdent au moins 21.

Le problème principal n’est donc pas un mauvais placement. C’est le risque de payer des clients qui commandent déjà : **81,97 % des non-convertis suffisamment observés recommandent sous 14 jours sans utiliser S6**.

L’offre actuelle de 5 $ dès 25 $ est plus convaincante que l’ancien cadeau dès 40 $, mais son seuil reste éloigné du panier médian de 15,68 $. Seulement 9,52 % avaient un dernier panier déjà compatible avec le seuil reçu.

### Conclusions principales

1. 169 non-convertis analysés après exclusion de 11 convertis.
2. 168, soit 99,4 %, étaient correctement placés selon la règle actuelle.
3. 113 utilisateurs correctement placés ont au moins 11 commandes à vie.
4. 69 ont au moins 21 commandes à vie.
5. La dernière commande date médianement de 0,88 jour.
6. Les cinq à sept commandes récentes couvrent environ 23 jours.
7. Le dernier panier médian est de 15,68 $.
8. Seulement 9,52 % avaient un dernier panier atteignant le seuil de leur offre.
9. 77,38 % ont fini par recommander sans convertir S6.
10. Le retour sans S6 atteint 57,04 % à 7 jours et 81,97 % à 14 jours.

## 2. Population

| Indicateur | Volume |
|---|---:|
| Offres S6 générées | 355 |
| Offres activées | 347 |
| Utilisateurs uniques avec offre générée | 182 |
| Utilisateurs uniques avec offre activée | 180 |
| Convertis exclus | 11 |
| **Non-convertis analysés** | **169** |
| Correctement placés | **168** |
| Incorrectement placés | 1 |

L’unique placement non conforme présentait quatre commandes sur 30 jours. Le ciblage technique historique est donc très propre.

## 3. Intensité d’achat

### Commandes sur 30 jours

| Commandes récentes | Non-convertis correctement placés |
|---|---:|
| 5 | 122 |
| 6 | 29 |
| 7 | 17 |

### Commandes à vie

| Commandes historiques | Utilisateurs | Part |
|---|---:|---:|
| 5 | 18 | 10,7 % |
| 6–7 | 15 | 8,9 % |
| 8–10 | 22 | 13,1 % |
| 11–20 | 44 | 26,2 % |
| 21 et plus | 69 | **41,1 %** |

S6 ne doit pas automatiquement être transformée en jalon `orderCount === 5`. La majorité de sa population appartient bien à une logique de fidélité intensive. Si un jalon de sixième commande est souhaité, il faudrait le séparer de S6 plutôt que détruire ce rôle.

## 4. Récence et cadence

- Récence moyenne : 2,93 jours
- Récence médiane : **0,88 jour**
- Période moyenne couvrant les commandes récentes : 21,87 jours
- Période médiane : 22,95 jours

Comme S4 et S5, S6 est souvent activée lors du scan suivant immédiatement une commande. Or le retour médian sans S6 intervient environ cinq jours plus tard.

**Conséquence :** une offre à durée courte envoyée immédiatement consomme sa validité pendant une période où le client a peu de raisons de commander.

## 5. Historique de l’offre

| Variante | Offres générées | Applications enregistrées |
|---|---:|---:|
| Article gratuit dès 40 $ | 101 | 0 |
| 5 $ dès 25 $ | 254 | 12 offres, 11 utilisateurs |

L’ancienne variante cadeau à 40 $ n’a produit aucune conversion. Toutes les conversions observées appartiennent au bonus panier de 5 $ dès 25 $.

Certaines offres `bonus_basket` historiques conservent un ancien champ `freeItem`, mais ce champ n’est pas utilisé par le calcul d’un bonus panier. Il s’agit néanmoins d’une dette de normalisation des données.

La comparaison favorise clairement le rabais fixe, mais elle reste temporelle et non randomisée.

## 6. Comportement de panier

- Panier moyen récent : 19,23 $
- Dernier panier moyen : 18,00 $
- Dernier panier médian : **15,68 $**
- Évolution moyenne sur les commandes récentes : −1,95 $
- Compatibilité naturelle avec le seuil reçu : **9,52 %**

Pour le client médian, atteindre 25 $ exige 9,32 $ supplémentaires, soit une hausse de 59 %. Après le rabais de 5 $, sa dépense nette resterait supérieure d’environ 4,32 $ à son comportement récent.

### Retour sans S6 selon le dernier panier

| Dernier panier | Population mature à 14 jours | Retours | Taux |
|---|---:|---:|---:|
| Moins de 20 $ | 76 | 63 | 82,89 % |
| 20–24,99 $ | 22 | 20 | **90,91 %** |
| 25–34,99 $ | 12 | 8 | 66,67 % |
| 35 $ et plus | 12 | 9 | 75,00 % |

Même les petits paniers reviennent très fortement sans S6. Le seuil ne doit donc pas être baissé pour tout le monde sans mesure de marge : cela pourrait surtout rendre le rabais accessible à des commandes déjà certaines.

## 7. Retour sans conversion

| Fenêtre | Population suffisamment observée | Retours sans S6 | Taux |
|---|---:|---:|---:|
| 3 jours | 149 | 38 | 25,50 % |
| 7 jours | 142 | 81 | **57,04 %** |
| 14 jours | 122 | 100 | **81,97 %** |
| 30 jours | 53 | 49 | **92,45 %** |

Au total, 130 utilisateurs correctement placés, soit 77,38 %, ont recommandé après leur première S6 sans jamais convertir S6.

- délai moyen : 6,36 jours;
- délai médian : 5,24 jours.

Ce comportement démontre une fréquence naturelle très forte. Une remise systématique risque davantage de réduire la marge que de créer une commande.

## 8. Expositions répétées

| Activations S6 | Non-convertis |
|---|---:|
| 1 | 75 |
| 2 | 53 |
| 3 | 28 |
| 4 | 13 |

55,6 % ont reçu au moins deux activations. Pour une population commandant déjà très souvent, la répétition peut installer l’attente d’un rabais de 5 $.

Le cooldown reste géré dans la configuration. Son réglage devrait être évalué avec la marge et la fréquence incrémentale, pas avec le seul taux d’utilisation.

## 9. Fidélité et sensibilité promotionnelle

- 68,45 % avaient déjà bénéficié d’une promotion identifiable.
- Solde actuel moyen : 2 261 points.
- Solde actuel médian : 1 649 points.

La population est à la fois très fidèle, fortement exposée aux promotions et riche en points. Elle présente un risque élevé de dépendance promotionnelle.

Une stratégie de reconnaissance ou d’accès privilégié peut être plus rentable qu’une remise immédiate répétée.

## 10. Canal et joignabilité

| Indicateur | Résultat |
|---|---:|
| Dernière commande via application | 92,9 % |
| Ramassage | 82,1 % |
| Application actuellement installée | 98,81 % |
| Jeton push actuel | 70,24 % |

S6 possède la meilleure joignabilité observée jusqu’ici. Ce canal peut être utilisé pour une communication relationnelle sans nécessairement accorder un rabais à chaque fois.

## 11. Typologie comportementale

### Nouveau client à cinq commandes à vie

18 non-convertis seulement.

**Lecture :** potentiel jalon de sixième commande, mais trop petit pour représenter toute S6.

**Action :** traiter séparément si le parcours S2–S5 doit continuer par jalons.

### Client très fréquent et petit panier

Il commande cinq à sept fois par mois, souvent autour de 15–20 $.

**Lecture :** forte valeur par fréquence, mais le seuil de 25 $ lui demande un comportement inhabituel.

**Action :** ne pas baisser automatiquement le seuil; tester plutôt un bonus lié à la fréquence ou à un produit complémentaire rentable.

### Client fidèle déjà promotionné

Il possède de nombreux points et a reçu plusieurs avantages.

**Lecture :** risque de sursubvention.

**Action :** reconnaissance non monétaire, accès anticipé, statut ou rappel d’une récompense déjà disponible.

### Client qui ralentit

Il avait une cadence élevée, mais dépasse désormais son délai habituel de retour.

**Lecture :** meilleur candidat à une intervention réellement incrémentale.

**Action :** activer S6 seulement après dépassement de sa cadence attendue, plutôt qu’immédiatement après une commande.

## 12. Recommandations

### Conserver le rôle de fréquence

La condition actuelle `ordersLast30d >= 5 && ordersLast30d <= 7` correspond correctement à une stratégie de fidélité intensive. Contrairement à S4/S5, il n’est pas recommandé de la remplacer immédiatement par un simple compteur à vie.

### Changer le moment, pas nécessairement le type

Conserver provisoirement 5 $ dès 25 $, mais ne pas l’activer moins d’un jour après la commande. Tester un déclenchement :

- à J+5;
- lorsque le délai depuis la dernière commande dépasse la cadence individuelle;
- ou après un signal de ralentissement.

### Introduire un groupe sans rabais

| Groupe | Traitement |
|---|---|
| Témoin | Message relationnel sans avantage |
| A | 5 $ dès 25 $ immédiatement |
| B | 5 $ dès 25 $ au dépassement de cadence |
| C | Avantage non monétaire ou rappel de récompense |

### KPI

- marge incrémentale;
- délai de retour par rapport à la cadence attendue;
- fréquence à 30 et 60 jours;
- évolution du panier;
- coût promotionnel par commande réellement incrémentale;
- dépendance aux promotions.

## Conclusion

S6 cible correctement des clients très fréquents, mais son offre est distribuée à une population qui recommande presque systématiquement sans elle. Son fort taux de conversion historique par rapport aux autres stratégies ne suffit pas à prouver sa rentabilité.

La meilleure amélioration consiste à **détecter un ralentissement par rapport à la cadence personnelle avant d’accorder les 5 $**. Cela protège la marge tout en conservant S6 comme outil de fidélité intensive.
