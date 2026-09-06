# Étude comportementale S5 — Utilisateurs non convertis

**Période :** 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu une S5 activée, à l’exclusion de tous ceux ayant converti S5  
**Règle historique contrôlée :** exactement quatre commandes dans les 30 jours précédant la première activation

## 1. Résumé de direction

S5 reproduit le problème de positionnement initial de S4. La règle `ordersLast30d === 4` sélectionne principalement des clients déjà fidèles, et non des clients venant d’effectuer leur quatrième commande à vie.

Parmi les 263 non-convertis correctement placés selon l’ancienne règle, **148, soit 56,3 %, avaient déjà au moins 11 commandes historiques**. Seulement 34 utilisateurs se trouvaient réellement au jalon de quatre commandes à vie.

La population commande déjà très fréquemment : dernière commande médiane inférieure à un jour, quatre achats réalisés sur environ 21 jours, et retour sans S5 de **64,08 % sous 14 jours**. Le risque de cannibalisation est donc très élevé.

### Conclusions principales

1. 271 non-convertis ont été analysés après exclusion de 9 convertis.
2. 263 respectaient la règle historique des quatre commandes sur 30 jours.
3. Seulement 34 avaient exactement quatre commandes à vie.
4. 56,3 % avaient déjà au moins 11 commandes.
5. Le dernier panier médian est de 17,90 $, contre un seuil de 25 $ pour les variantes à points.
6. Seulement 17,11 % avaient un dernier panier compatible avec le seuil de leur variante reçue.
7. Le solde actuel médian est de 1 517 points; 83,65 % possèdent actuellement au moins 500 points.
8. 73,76 % ont fini par recommander sans convertir S5.
9. 64,08 % recommandent sous 14 jours sans S5 parmi les utilisateurs suffisamment observés.

## 2. Population

| Indicateur | Volume |
|---|---:|
| Offres S5 générées | 445 |
| Offres activées | 434 |
| Utilisateurs uniques avec offre générée | 284 |
| Utilisateurs uniques avec offre activée | 280 |
| Convertis exclus | 9 |
| **Non-convertis analysés** | **271** |
| Correctement placés selon l’ancienne règle | 263 |
| Placements non conformes | 8 |

Les huit placements non conformes avaient trois commandes, et non quatre, dans les 30 jours précédant leur première S5.

## 3. S5 cible-t-elle le cinquième achat ?

La condition historique est :

```js
ordersLast30d === 4
```

Elle cible une fréquence mensuelle, pas le quatrième achat à vie.

| Commandes à vie avant S5 | Non-convertis correctement placés | Part |
|---|---:|---:|
| 4 | 34 | 12,9 % |
| 5–6 | 24 | 9,1 % |
| 7–10 | 57 | 21,7 % |
| 11 et plus | 148 | **56,3 %** |

Si S5 doit être la suite logique de S4 et provoquer la cinquième commande, la règle appropriée est `orderCount === 4`.

## 4. Récence et fréquence

- Récence moyenne : 3,54 jours
- Récence médiane : **0,95 jour**
- Période moyenne couvrant les quatre dernières commandes : 19,79 jours
- Période médiane : 20,96 jours

### Retour sans S5 selon la récence

| Récence | Utilisateurs | Population mature à 14 jours | Retours sous 14 jours | Taux |
|---|---:|---:|---:|---:|
| 0–2 jours | 174 | 130 | 83 | 63,85 % |
| 3–6 jours | 46 | 44 | 27 | 61,36 % |
| 7–13 jours | 27 | 20 | 16 | **80,00 %** |
| 14–20 jours | 12 | 8 | 5 | 62,50 % |
| 21–30 jours | 4 | 4 | 1 | 25,00 % |

S5 est activée immédiatement après une commande chez la majorité des utilisateurs. Comme pour S4, l’offre risque d’expirer avant la prochaine intention d’achat ou de récompenser un retour qui aurait eu lieu naturellement.

## 5. Évolution de l’offre

| Variante | Offres générées | Applications |
|---|---:|---:|
| 7 $ dès 40 $ | 144 | 0 |
| 75 points dès 25 $ | 153 | 4 |
| 50 points dès 25 $ | 1 | 0 |
| 130 points dès 25 $ | 147 | 5 |

Le passage d’un rabais de 7 $ à des points a produit les premières conversions observées. Toutefois, les variantes sont temporelles, non randomisées, et les volumes convertis restent très faibles.

Parmi les non-convertis correctement placés lors de leur première S5 :

- 134 ont commencé avec 7 $ dès 40 $;
- 75 avec 75 points dès 25 $;
- 54 avec 130 points dès 25 $.

Le seuil de 40 $ explique probablement une grande partie de l’échec de la première variante.

## 6. Comportement de panier

Sur les quatre commandes précédant S5 :

- panier moyen : 20,18 $;
- dernier panier moyen : 20,02 $;
- dernier panier médian : **17,90 $**;
- évolution moyenne entre la première et la quatrième : −0,37 $.

Seulement **17,11 %** avaient un dernier panier compatible avec le seuil de la variante reçue.

### Retour sans S5 selon le dernier panier

| Dernier panier | Population mature à 14 jours | Retours | Taux |
|---|---:|---:|---:|
| Moins de 20 $ | 119 | 76 | 63,87 % |
| 20–24,99 $ | 35 | 22 | 62,86 % |
| 25–34,99 $ | 20 | 15 | 75,00 % |
| 35 $ et plus | 32 | 19 | 59,38 % |

Tous les groupes présentent un retour élevé sans S5. Le seuil de 25 $ demande environ 40 % de dépense supplémentaire au client médian. Les points sont différés alors que l’effort demandé est immédiat.

## 7. Comportement de fidélité et points

État actuel des soldes parmi les non-convertis correctement placés :

- solde moyen : 2 090,66 points;
- solde médian : 1 517 points;
- 83,65 % possèdent au moins 500 points;
- 0,76 % seulement ont un solde nul.

Les récompenses du catalogue coûtent actuellement entre 460 et 2 700 points. Un bonus de 130 points représente :

- 28,3 % du coût de la récompense la moins chère;
- 8,6 % du solde du client médian;
- une valeur peu urgente pour un client pouvant déjà réclamer plusieurs récompenses.

Ces soldes sont actuels et peuvent différer de ceux détenus au moment de l’offre. Le signal reste néanmoins important : **le frein peut être l’utilisation des points existants, pas leur accumulation**.

Une offre de points est peu attractive si l’utilisateur ne comprend pas ce qu’ils débloquent ou possède déjà un solde inutilisé.

## 8. Retour sans conversion

| Fenêtre | Population suffisamment observée | Retours sans S5 | Taux |
|---|---:|---:|---:|
| 3 jours | 252 | 56 | 22,22 % |
| 7 jours | 235 | 108 | **45,96 %** |
| 14 jours | 206 | 132 | **64,08 %** |
| 30 jours | 67 | 54 | **80,60 %** |

Au total, 194 utilisateurs correctement placés, soit 73,76 %, ont recommandé après leur première S5 sans la convertir.

- délai moyen : 7,40 jours;
- délai médian : 5,34 jours.

Ce comportement confirme une forte fidélité naturelle. S5 ne doit pas être évaluée uniquement par le revenu des commandes qui utilisent les points; il faut mesurer si elle avance réellement la prochaine commande ou améliore la rétention.

## 9. Expositions répétées

| Activations S5 | Non-convertis |
|---|---:|
| 1 | 164 |
| 2 | 73 |
| 3 | 31 |
| 4 | 3 |

39,5 % ont eu au moins deux activations. La répétition d’un bonus de points peut produire peu d’urgence, particulièrement chez les clients dont le solde est déjà élevé.

Le cooldown doit rester géré par la configuration. La stratégie doit toutefois avoir une règle de sortie et une limite d’expositions décidées au niveau business.

## 10. Historique promotionnel et canal

Parmi les correctement placés :

- 65,78 % avaient déjà bénéficié d’une promotion identifiable;
- 93,5 % avaient commandé via l’application lors de leur dernière commande;
- 80,6 % utilisaient le ramassage;
- 98,1 % sont actuellement marqués application installée;
- 66,54 % ont actuellement un jeton push.

Cette population est fortement numérique, fidèle et déjà exposée aux avantages. Un bonus générique de points risque d’être perçu comme ordinaire.

## 11. Traçabilité marketing

Sur l’ensemble de l’historique S5 :

| Événement | Utilisateurs uniques | Offres uniques |
|---|---:|---:|
| Notification enregistrée | 180 | 264 |
| Vue enregistrée | 79 | 95 |
| Clic notification | 13 | 16 |
| Clic dans l’offre | 35 | 38 |
| Application | 9 | 9 |

La couverture événementielle reste incomplète. Les offres activées ne doivent pas être interprétées comme autant de messages effectivement livrés.

## 12. Typologie comportementale

### Nouveau client au jalon de quatre commandes

Seulement 34 non-convertis appartiennent réellement à ce groupe.

**Action :** les conserver dans une S5 corrigée à `orderCount === 4`, puis tester si les points provoquent une cinquième commande.

### Client fidèle avec beaucoup de commandes et beaucoup de points

Il constitue la majorité de l’historique S5.

**Action :** ne plus le traiter comme un nouveau jalon. Lui proposer une stratégie de fidélité distincte, éventuellement orientée utilisation de récompense, statut ou exclusivité.

### Petit panier très fréquent

Dernier panier inférieur à 20 $, retour fréquent, seuil à 25 $.

**Action :** ne pas lui demander simultanément d’augmenter son panier et d’attendre une valeur future. Tester un seuil plus proche de son comportement.

### Client avec solde dormant

Solde suffisant pour une récompense mais faible utilisation.

**Action :** rappeler une récompense accessible plutôt qu’ajouter automatiquement 130 points.

## 13. Recommandations

### Clarifier le rôle de S5

Si S5 est la suite de S4 dans le parcours d’habitude :

```js
orderCount === 4
```

La condition mensuelle `ordersLast30d === 4` doit alors être remplacée. Cela exclura les anciens clients fidèles et permettra de mesurer proprement la cinquième commande.

### Adapter l’offre au solde

Deux traitements doivent être distingués :

- solde inférieur à la première récompense : bonus permettant de s’en rapprocher concrètement;
- solde déjà suffisant : rappel « une récompense est disponible » plutôt que points supplémentaires.

### Adapter le seuil

Le seuil fixe de 25 $ est supérieur au comportement médian. Tester :

- 130 points dès 20 $;
- nombre de points personnalisé permettant d’atteindre le prochain palier;
- aucun seuil pour une petite quantité de points;
- rappel de récompense existante sans subvention supplémentaire.

### Expérimentation proposée

| Groupe | Traitement |
|---|---|
| Témoin | Aucun bonus |
| A | 130 points dès 20 $ |
| B | Points nécessaires pour atteindre la prochaine récompense, avec plafond |
| C | Rappel d’une récompense déjà disponible |

KPI : cinquième commande incrémentale, marge, utilisation future des points, coût réel des récompenses et sixième commande à 30–60 jours.

## Conclusion

S5 a historiquement été distribuée surtout à des clients déjà très fidèles. Leur fort retour sans conversion et leur solde élevé rendent un bonus générique de points peu différenciant.

Avant de conclure que les points ne fonctionnent pas, il faut isoler les utilisateurs ayant réellement quatre commandes à vie, aligner le seuil sur leur panier et personnaliser la récompense selon leur solde. La première correction logique est donc probablement `orderCount === 4`, si S5 doit bien représenter le jalon suivant de S4.
