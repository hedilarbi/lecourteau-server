# Comparaison S3 — Convertis contre non-convertis correctement placés

**Période :** 5 août au 6 septembre 2026  
**Définition du bon placement :** exactement deux commandes valides avant la première activation S3 et dernière commande datant de 7 à 17 jours  
**Objectif :** comprendre ce qui distingue la conversion S3 au sein d’une population réellement conforme à la nouvelle règle

## 1. Population comparable

| Cohorte | Utilisateurs |
|---|---:|
| Utilisateurs uniques ayant eu une S3 activée | 1 538 |
| Correctement placés lors de leur première S3 | 457 |
| Correctement placés et ayant ensuite converti S3 | **9** |
| Correctement placés et n’ayant jamais converti S3 | **448** |
| Taux de conversion de cette population | **1,97 %** |

Cette comparaison utilise le placement lors de la **première activation S3**. C’est la méthode la plus cohérente pour étudier une cohorte marketing : elle mesure la situation au moment où l’utilisateur entre dans la stratégie.

L’échantillon converti ne contient que neuf personnes. Les différences sont donc des signaux comportementaux, pas encore des conclusions statistiquement solides.

## 2. Qualité de placement des conversions historiques

S3 compte 22 convertis historiques au total.

- 9 étaient correctement placés lors de leur première entrée dans S3;
- parmi eux, 6 étaient encore dans la fenêtre de 7–17 jours au moment précis de l’offre finalement utilisée;
- 15 conversions ont eu lieu sur une offre appliquée trop tard;
- 1 conversion présentait une seule commande antérieure visible.

Répartition des 15 conversions tardives au moment de l’application :

| Récence | Conversions historiques |
|---|---:|
| 18–29 jours | 3 |
| 30–59 jours | 2 |
| 60–89 jours | 3 |
| 90 jours et plus | 7 |

Cela ne signifie pas que ces conversions sont mauvaises commercialement. Elles appartiennent cependant à une logique de réactivation, et non à une troisième commande rapide. Les comptabiliser comme succès S3 surestime la performance de la stratégie « habitude ».

## 3. Comparaison synthétique

| Indicateur | Convertis correctement placés | Non-convertis correctement placés | Lecture |
|---|---:|---:|---|
| Utilisateurs | 9 | 448 | Petit échantillon converti |
| Récence moyenne à l’entrée | 8,76 j | 8,77 j | Identique |
| Récence médiane | 7,85 j | 7,80 j | Identique |
| Délai médian commande 1 → 2 | 26,99 j | 32,02 j | Légèrement plus rapide chez les convertis |
| Premier panier moyen | 49,89 $ | 27,63 $ | Convertis historiquement plus dépensiers |
| Deuxième panier moyen | **36,32 $** | **26,32 $** | Écart majeur de 10 $ |
| Deuxième panier médian | **36,00 $** | **22,20 $** | Seuil de 35 $ adapté aux convertis seulement |
| Variation moyenne du panier | −13,58 $ | −1,32 $ | Forte baisse chez les convertis après un premier gros achat |
| Historique promotionnel explicite | 22,22 % | 27,46 % | Pas d’avantage apparent aux chasseurs de promotions |
| Nombre moyen d’activations S3 | 1,56 | 2,24 | Répéter davantage ne garantit pas la conversion |
| Application actuellement installée | 100 % | 95,54 % | Différence faible, échantillon réduit |
| Jeton push actuellement présent | 55,56 % | 39,73 % | Joignabilité potentiellement importante |

## 4. Facteur principal : compatibilité avec le seuil de 35 $

Le deuxième panier moyen des convertis est de 36,32 $, pratiquement au niveau du seuil demandé. Leur panier médian est de 36 $.

Chez les non-convertis :

- deuxième panier moyen : 26,32 $;
- deuxième panier médian : 22,20 $;
- effort nécessaire pour atteindre 35 $ pour le client médian : **12,80 $**, soit environ **58 % de panier supplémentaire**.

### Conversion selon le deuxième panier

| Deuxième panier historique | Utilisateurs correctement placés | Convertis | Conversion S3 |
|---|---:|---:|---:|
| Moins de 25 $ | 263 | 3 | 1,14 % |
| 25–34,99 $ | 79 | 1 | 1,27 % |
| 35–44,99 $ | 62 | 2 | 3,23 % |
| 45 $ et plus | 53 | 3 | **5,66 %** |

Les utilisateurs ayant déjà démontré leur capacité à dépenser au moins 35 $ convertissent nettement davantage. Le taux observé est environ cinq fois supérieur pour les paniers de 45 $ et plus que pour les paniers inférieurs à 25 $.

**Interprétation :** S3 fonctionne surtout auprès des utilisateurs pour lesquels le seuil ne demande pas un changement majeur de comportement.

## 5. Formation de l’habitude

### Conversion selon le délai entre les deux commandes

| Commande 1 → commande 2 | Éligibles correctement placés | Convertis | Conversion |
|---|---:|---:|---:|
| Moins de 7 jours | 67 | 0 | 0 % |
| 7–13 jours | 58 | 2 | 3,45 % |
| 14–29 jours | 97 | 3 | 3,09 % |
| 30–59 jours | 75 | 1 | 1,33 % |
| 60 jours et plus | 160 | 3 | 1,88 % |

La meilleure zone observée se situe entre 7 et 29 jours entre les deux achats. Aucun des 67 utilisateurs ayant commandé deux fois en moins d’une semaine n’a converti, mais cet effet demande confirmation.

Une hypothèse plausible est que deux achats très rapprochés peuvent répondre à une circonstance ponctuelle, tandis qu’un retour après une à quatre semaines représente davantage une habitude reproductible.

## 6. Évolution du panier

Chez les convertis correctement placés :

- premier panier moyen : 49,89 $;
- deuxième panier moyen : 36,32 $;
- baisse moyenne : 13,58 $;
- six utilisateurs sur neuf ont diminué leur panier.

Chez les non-convertis :

- premier panier moyen : 27,63 $;
- deuxième panier moyen : 26,32 $;
- baisse moyenne : 1,32 $;
- 44,2 % ont augmenté leur panier et 45,3 % l’ont diminué.

Les convertis semblent être des clients à **capacité de dépense élevée mais en baisse après un premier gros panier**. S3 leur fournit une raison de revenir vers un panier proche de 35–40 $. À l’inverse, le non-converti typique a un comportement stable autour de 22–27 $; le seuil de 35 $ est structurellement éloigné de sa norme.

## 7. Variante à 5 $ contre variante à 7 $

Dans la population correctement placée :

| Première variante reçue | Convertis | Non-convertis | Taux observé |
|---|---:|---:|---:|
| 5 $ dès 35 $ | 4 | 177 | 2,21 % |
| 7 $ dès 35 $ | 5 | 271 | 1,81 % |

Le passage de 5 $ à 7 $ ne montre pas d’amélioration dans cette comparaison corrigée du placement. Cependant, les variantes appartiennent à des périodes différentes et les neuf conversions ne permettent pas une conclusion définitive.

**Signal business :** augmenter la récompense sans réduire le seuil ne semble pas avoir résolu la friction principale.

## 8. Exposition et joignabilité

### Nombre d’activations

| Activations S3 | Convertis correctement placés | Non-convertis correctement placés |
|---|---:|---:|
| 1 | 6 | 166 |
| 2 | 1 | 111 |
| 3 | 2 | 69 |
| 4 | 0 | 102 |

Aucun converti correctement placé n’a eu quatre activations, alors que 102 non-convertis en ont reçu quatre. La répétition seule ne transforme donc pas une offre mal adaptée au panier.

### Canal

| Indicateur | Convertis | Non-convertis |
|---|---:|---:|
| Dernière commande via application | 77,8 % | 71,7 % |
| Dernière commande via web | 22,2 % | 28,3 % |
| Ramassage | 66,7 % | 82,1 % |
| Livraison | 33,3 % | 17,9 % |
| Jeton push actuel | 55,6 % | 39,7 % |

Les convertis paraissent plus joignables par push et utilisent davantage la livraison. Avec neuf cas seulement, ces écarts doivent servir d’hypothèses de test, pas de règles de ciblage.

## 9. Commande de conversion

Pour les neuf convertis correctement placés lors de leur entrée :

- panier moyen de conversion : **41,84 $**;
- panier médian de conversion : **37,50 $**;
- rabais moyen constaté : **6,78 $**.

L’offre réussit donc à produire une commande légèrement supérieure au seuil, mais pas un panier exceptionnellement élevé. Son intérêt économique dépend de la part réellement incrémentale de ces commandes.

## 10. Profil comportemental du converti S3 probable

Le profil qui ressort est :

1. deuxième commande récente, environ huit jours avant S3;
2. panier historique déjà compatible avec 35 $;
3. capacité de dépense élevée démontrée dès la première commande;
4. intervalle de 7 à 29 jours entre les deux premiers achats plus favorable;
5. meilleure joignabilité numérique possible;
6. conversion en une à trois activations, sans bénéfice visible d’une quatrième répétition.

À l’inverse, le non-converti typique a un deuxième panier autour de 22 $, doit augmenter fortement sa dépense et reçoit parfois plusieurs fois la même proposition sans que son comportement change.

## 11. Recommandation stratégique

La nouvelle fenêtre de récence de 7–17 jours corrige le mélange avec la réactivation. La prochaine optimisation ne devrait pas changer immédiatement le type `bonus_basket`; elle devrait rendre le seuil cohérent avec la capacité de dépense.

### Proposition de ciblage économique

- Conserver 7 $ dès 35 $ pour les utilisateurs dont au moins un panier historique atteint environ 35–40 $.
- Tester 5 $ dès 28–30 $ pour ceux dont le panier typique se situe entre 22 $ et 30 $.
- Ne pas envoyer quatre fois la même offre si les trois premières activations n’ont produit aucune réponse.
- Maintenir un groupe témoin pour mesurer les troisièmes commandes qui auraient eu lieu naturellement.

### Test recommandé

| Groupe | Population | Offre |
|---|---|---|
| Témoin | Tous les S3 correctement placés | Aucun avantage |
| A | Panier historique ≥35 $ | 5 $ dès 35 $ |
| B | Panier historique ≥35 $ | 7 $ dès 35 $ |
| C | Panier historique <35 $ | 5 $ dès panier attendu +10 % |

KPI principal : marge incrémentale de la troisième commande. KPI secondaire : quatrième commande à 30–60 jours.

## Conclusion

Une fois la population correctement placée, la récence ne distingue presque pas les convertis des non-convertis : elle est proche de 8,8 jours dans les deux groupes. La différence principale est économique.

Le converti S3 avait déjà un deuxième panier moyen supérieur à 35 $, alors que le non-converti moyen se situait environ 10 $ plus bas. **S3 convertit lorsqu’elle accompagne un comportement de dépense déjà existant; elle échoue lorsqu’elle demande de créer brutalement ce comportement.**
