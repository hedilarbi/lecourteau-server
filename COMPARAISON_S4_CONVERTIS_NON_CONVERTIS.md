# Comparaison S4 — Convertis contre non-convertis avec trois commandes à vie

**Définition de la cohorte :** exactement trois commandes valides à vie avant la première activation S4  
**Exclusion :** tous les utilisateurs qui avaient déjà quatre commandes ou plus  
**Période historique :** 5 août au 6 septembre 2026

## 1. Population comparable

| Cohorte | Utilisateurs |
|---|---:|
| Utilisateurs avec exactement 3 commandes avant S4 | **95** |
| Ayant ensuite converti S4 | **3** |
| N’ayant jamais converti S4 | **92** |
| Conversion observée | **3,16 %** |

Cette cohorte est désormais cohérente avec le nouvel objectif de S4 : transformer le troisième achat à vie en quatrième commande.

Seulement trois utilisateurs ont converti. Les résultats doivent donc être considérés comme des hypothèses comportementales, et non comme une preuve statistique.

## 2. Comparaison synthétique

| Indicateur | Convertis | Non-convertis | Lecture |
|---|---:|---:|---|
| Utilisateurs | 3 | 92 | Échantillon converti très faible |
| Récence moyenne lors de l’entrée | 0,60 j | 2,71 j | Convertis exposés très rapidement |
| Récence médiane | 0,56 j | 0,86 j | Deux groupes exposés presque immédiatement |
| Durée moyenne des trois achats | 16,84 j | 16,44 j | Cadence presque identique |
| Panier moyen sur les trois achats | **35,03 $** | **24,07 $** | Écart de capacité de dépense |
| Troisième panier moyen | **34,35 $** | **24,57 $** | Écart proche de 10 $ |
| Troisième panier médian | 28,20 $ | 22,22 $ | Convertis plus proches des seuils historiques |
| Compatibilité avec le seuil reçu | **66,67 %** | **39,13 %** | Friction plus faible chez les convertis |
| Promotion antérieure identifiable | 33,33 % | 34,78 % | Pratiquement identique |
| Activations moyennes | 1,67 | 1,51 | Pas d’effet clair de répétition |
| Jeton push actuel | 66,67 % | 43,48 % | Hypothèse de joignabilité, non concluante |

## 3. Cadence des trois premières commandes

### Convertis

- commande 1 → commande 2 : 9,39 jours en moyenne;
- commande 2 → commande 3 : 7,45 jours;
- période totale commande 1 → commande 3 : 16,84 jours.

### Non-convertis

- commande 1 → commande 2 : 7,47 jours en moyenne;
- commande 2 → commande 3 : 8,96 jours;
- période totale commande 1 → commande 3 : 16,44 jours.

La cadence totale est presque identique. Elle ne permet pas, sur cet échantillon, de distinguer les futurs convertis.

Cela signifie que la fréquence seule ne suffit pas pour déterminer à qui le cadeau sera utile. Le niveau de panier semble plus discriminant.

## 4. Comportement de panier

### Évolution des trois paniers

| Panier | Convertis | Non-convertis |
|---|---:|---:|
| Première commande moyenne | 36,48 $ | 24,18 $ |
| Deuxième commande moyenne | 34,25 $ | 23,46 $ |
| Troisième commande moyenne | 34,35 $ | 24,57 $ |
| Évolution commande 1 → 3 | −2,13 $ | +0,39 $ |

Les convertis ont une capacité de dépense supérieure dès leur première commande. S4 ne crée probablement pas cette capacité; elle l’exploite.

Les non-convertis restent stables autour de 24 $. Pour eux :

- l’ancien seuil de 35 $ demandait une hausse d’environ 43 %;
- le seuil de 25 $ était proche de leur moyenne;
- le seuil actuel de 20 $ est normalement atteignable.

### Conversion selon le troisième panier

| Troisième panier historique | Utilisateurs | Convertis | Conversion observée |
|---|---:|---:|---:|
| Moins de 20 $ | 42 | 1 | 2,38 % |
| 20–24,99 $ | 12 | 0 | 0 % |
| 25–34,99 $ | 19 | 1 | 5,26 % |
| 35 $ et plus | 22 | 1 | 4,55 % |

La direction générale favorise les paniers déjà proches des seuils, mais les cellules d’une à zéro conversion sont beaucoup trop petites pour établir une règle définitive.

## 5. Moment d’activation

| Temps depuis la troisième commande | Utilisateurs | Convertis | Conversion observée |
|---|---:|---:|---:|
| Moins d’un jour | 67 | 3 | 4,48 % |
| 1–3 jours | 7 | 0 | 0 % |
| 4–7 jours | 15 | 0 | 0 % |
| 8–14 jours | 4 | 0 | 0 % |
| 15 jours et plus | 2 | 0 | 0 % |

Les trois conversions viennent d’offres activées moins d’un jour après la troisième commande. Toutefois, 64 utilisateurs exposés dans la même fenêtre n’ont pas converti.

Il ne faut donc pas conclure que l’envoi immédiat est supérieur. La taille des groupes tardifs est insuffisante, et l’ancienne logique générait naturellement la majorité des offres dès le scan suivant la troisième commande mensuelle.

## 6. Variantes reçues

### Première variante de la cohorte

| Seuil du cadeau | Convertis | Non-convertis |
|---|---:|---:|
| 20 $ | 1 | 20 |
| 25 $ | 0 | 47 |
| 35 $ | 2 | 25 |

Deux conversions avec un seuil de 35 $ ne prouvent pas que ce seuil est supérieur : les utilisateurs convertis avaient eux-mêmes des paniers historiques beaucoup plus élevés.

Le seuil doit être analysé relativement au panier attendu, et non isolément.

## 7. Expositions répétées

| Activations S4 | Convertis | Non-convertis |
|---|---:|---:|
| 1 | 2 | 54 |
| 2 | 0 | 29 |
| 3 | 1 | 9 |

Le volume ne montre aucun avantage clair aux répétitions. Avec seulement trois conversions, il faut conserver le cooldown dans la configuration et expérimenter un nombre maximum d’expositions plutôt qu’inscrire une nouvelle limite arbitraire dans le code.

## 8. Canal et mode de commande

| Indicateur | Convertis | Non-convertis |
|---|---:|---:|
| Troisième commande via application | 100 % | 84,8 % |
| Troisième commande via web | 0 % | 15,2 % |
| Ramassage | 66,7 % | 79,3 % |
| Livraison | 33,3 % | 20,7 % |
| Application actuellement installée | 100 % | 96,7 % |
| Jeton push actuel | 66,7 % | 43,5 % |

La meilleure joignabilité apparente des convertis est une piste, mais trois personnes ne suffisent pas pour créer une règle de ciblage par canal.

## 9. Commande de conversion

Pour les trois convertis :

- panier moyen de la quatrième commande : **41,53 $**;
- panier médian : **46,20 $**;
- valeur de base moyenne du cadeau enregistré : **9,10 $**;
- réduction monétaire supplémentaire enregistrée : 0 $, conformément au fonctionnement `free_item`.

Le panier de conversion est supérieur au panier historique moyen des convertis. Cela reste du revenu associé, pas nécessairement du revenu incrémental.

## 10. Profil comportemental probable

Le converti S4 observé :

1. a réalisé trois commandes en environ 17 jours;
2. possède déjà une capacité de panier proche de 35 $;
3. reçoit S4 immédiatement après sa troisième commande;
4. utilise principalement l’application;
5. est potentiellement plus joignable par push;
6. réalise une quatrième commande autour de 42 $ avec un cadeau d’environ 9 $.

Le non-converti présente une cadence comparable, mais un panier stable autour de 24 $. La différence semble donc davantage économique que liée à la fréquence.

## 11. Recommandations

### Conserver la nouvelle condition à vie

La correction `orderCount === 3` élimine les anciens clients fidèles de S4 et rend la stratégie cohérente avec le jalon de quatrième commande.

### Ne pas personnaliser automatiquement à partir de trois conversions

Les données actuelles ne permettent pas de décider définitivement :

- que le seuil de 35 $ est meilleur;
- que l’envoi immédiat est meilleur;
- que la livraison ou l’application causent la conversion.

### Test à mettre en place sur les futurs utilisateurs

| Groupe | Offre | Moment |
|---|---|---|
| Témoin | Aucun cadeau | — |
| A | Churros dès 20 $ | J+1 |
| B | Churros dès 20 $ | J+5 ou cadence individuelle |
| C | Churros dès panier moyen +10 % | Cadence individuelle |

Stratifier aléatoirement les groupes selon le panier historique, afin que les gros et petits paniers soient répartis équitablement.

### KPI

- quatrième commande incrémentale à 14 et 30 jours;
- marge incrémentale après coût matière du cadeau;
- délai jusqu’à la quatrième commande;
- panier de la quatrième commande;
- cinquième commande à 30–60 jours.

## Conclusion

Après exclusion des clients déjà fidèles, S4 montre une conversion de 3,16 %, mais sur seulement trois cas. La cadence des trois premiers achats est presque identique entre convertis et non-convertis.

Le signal dominant est le panier : **35,03 $ en moyenne chez les convertis contre 24,07 $ chez les non-convertis**. L’offre actuelle semble surtout fonctionner lorsque le client possède déjà la capacité de franchir le seuil, plutôt que provoquer à elle seule une hausse durable de dépense.
