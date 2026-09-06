# Étude comportementale S7 — Utilisateurs non convertis

**Période :** 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu une S7 activée, à l’exclusion de tous ceux ayant converti S7  
**Règle contrôlée :** au moins huit commandes dans les 30 jours précédant la première activation

## 1. Résumé de direction

S7 cible correctement une population VIP extrêmement active. Parmi les 40 non-convertis analysés, 39 respectent la règle. Près de la moitié ont au moins 21 commandes historiques et neuf en ont au moins 51.

Cette population n’a pratiquement pas besoin d’une offre pour revenir : **38 utilisateurs sur 39 recommandent sans convertir S7**, avec un retour médian en 2,21 jours. Le taux de retour sans S7 atteint 91,18 % sous 14 jours.

La stratégie actuelle de 150 points dès 25 $ présente également une faible compatibilité avec le panier : le dernier panier médian est de 14,60 $ et seulement 12,82 % atteignaient déjà le seuil de leur variante.

Le rôle de S7 devrait être la reconnaissance VIP et la prévention d’un ralentissement inhabituel, pas l’achat systématique d’une commande presque certaine.

## 2. Population

| Indicateur | Volume |
|---|---:|
| Offres S7 générées | 116 |
| Offres activées | 108 |
| Utilisateurs uniques avec offre générée | 45 |
| Utilisateurs uniques avec offre activée | 43 |
| Convertis exclus | 3 |
| **Non-convertis analysés** | **40** |
| Correctement placés | **39** |
| Incorrectement placés | 1 |

La cohorte est petite. Les taux doivent être interprétés comme des signaux opérationnels et non comme des estimations stables.

## 3. Intensité de fidélité

### Commandes sur 30 jours

| Commandes récentes | Utilisateurs correctement placés |
|---|---:|
| 8 | 21 |
| 9–10 | 8 |
| 11–15 | 8 |
| 16 et plus | 2 |

### Commandes à vie

| Commandes historiques | Utilisateurs | Part |
|---|---:|---:|
| 8–10 | 7 | 17,9 % |
| 11–20 | 13 | 33,3 % |
| 21–50 | 10 | 25,6 % |
| 51 et plus | 9 | **23,1 %** |

S7 est bien une stratégie VIP de fréquence, et non un jalon simple du parcours. La condition `ordersLast30d >= 8` correspond à ce rôle.

## 4. Cadence et récence

- Récence moyenne à l’activation : 2,67 jours
- Récence médiane : 1,71 jour
- Période moyenne couvrant les commandes du mois : 24,16 jours
- Période médiane : 25,22 jours

Après l’activation, le retour sans S7 intervient :

- en 4,23 jours en moyenne;
- en seulement **2,21 jours en médiane**.

L’offre est donc souvent activée alors que la prochaine commande est déjà imminente.

## 5. Retour sans conversion

| Fenêtre | Population suffisamment observée | Retours sans S7 | Taux |
|---|---:|---:|---:|
| 3 jours | 39 | 24 | **61,54 %** |
| 7 jours | 37 | 27 | **72,97 %** |
| 14 jours | 34 | 31 | **91,18 %** |
| 30 jours | 26 | 26 | **100 %** |

Au total, 38 des 39 correctement placés, soit **97,44 %**, ont recommandé sans utiliser S7.

Le programme ne peut pas considérer ces retours comme un échec relationnel. Au contraire, ils démontrent que la fidélité existe déjà. Le défi est de la préserver sans réduire inutilement la marge.

## 6. Historique des variantes

| Type | Configuration | Offres | Applications |
|---|---|---:|---:|
| Bonus panier | 7 $ dès 35 $ | 35 | 2 |
| Points | 100 points dès 25 $ | 48 | 1 |
| Points | 150 points dès 25 $ | 33 | 0 |

Les trois conversions historiques appartiennent aux anciennes versions. La version actuelle de 150 points ne compte encore aucune conversion.

Cette absence ne prouve pas que 150 points sont moins attractifs : la variante est récente et la population très petite. Elle montre néanmoins qu’augmenter les points ne crée pas automatiquement de l’urgence chez des clients qui commandent déjà.

Plusieurs anciennes offres contiennent aussi un champ `freeItem` résiduel alors que leur type est `bonus_basket` ou `loyalty_points`. Ce champ n’est pas utilisé dans ces calculs, mais devrait être nettoyé dans les données historiques ou les nouvelles écritures.

## 7. Panier

- Panier moyen sur les huit dernières commandes : 16,60 $
- Dernier panier moyen : 18,01 $
- Dernier panier médian : **14,60 $**
- Évolution moyenne : +0,46 $
- Compatibilité avec le seuil reçu : **12,82 %**

Pour le client médian, atteindre 25 $ demande environ 71 % de dépense supplémentaire. Le bonus de 150 points est différé, tandis que l’effort financier est immédiat.

### Retour sans S7 selon le dernier panier

| Dernier panier | Population mature à 14 jours | Retours | Taux |
|---|---:|---:|---:|
| Moins de 20 $ | 27 | 25 | 92,59 % |
| 20–24,99 $ | 4 | 3 | 75,00 % |
| 25–34,99 $ | 0 | 0 | — |
| 35 $ et plus | 3 | 3 | 100 % |

Le retour est extrêmement élevé quel que soit le panier. Baisser le seuil pour toute la population risquerait de subventionner encore davantage des commandes naturelles.

## 8. Points et promotions

- Solde actuel moyen : 1 920,72 points
- Solde actuel médian : 1 150 points
- Utilisateurs ayant déjà bénéficié d’une promotion identifiable : 74,36 %

Le client médian possède déjà assez de points pour plusieurs récompenses du catalogue. L’enjeu peut être l’utilisation des points existants plutôt que l’accumulation de 150 points supplémentaires.

S7 est aussi la population la plus exposée aux promotions étudiée jusqu’ici. Continuer à ajouter des récompenses transactionnelles peut créer une dépendance et réduire le prix de référence.

## 9. Expositions répétées

| Activations S7 | Non-convertis |
|---|---:|
| 1 | 13 |
| 2 | 9 |
| 3 | 8 |
| 4 | 10 |

67,5 % ont reçu au moins deux activations et 25 % en ont reçu quatre. Pourtant, ils continuent surtout à commander sans utiliser S7.

La répétition d’une offre inutilisée ne semble pas apporter de valeur démontrée. Le cooldown reste configurable, mais une règle de pression VIP doit être définie.

## 10. Canal et joignabilité

| Indicateur | Résultat |
|---|---:|
| Dernière commande via application | 97,44 % |
| Ramassage | 76,92 % |
| Application actuellement installée | 100 % |
| Jeton push actuel | 82,05 % |

S7 possède une excellente joignabilité. C’est une occasion de créer une relation VIP, pas nécessairement d’envoyer davantage de rabais.

## 11. Typologie comportementale

### VIP stable

Il commande tous les deux à quatre jours et possède déjà un solde de récompense important.

**Action :** reconnaissance, statut, nouveauté en avant-première ou rappel de récompense accessible.

### VIP à petit panier

Il commande très souvent, mais avec un panier autour de 15 $.

**Action :** ne pas imposer 25 $ pour obtenir des points. Si l’objectif est le panier, utiliser une stratégie séparée et mesurer la marge.

### VIP sous promotion permanente

Il a déjà utilisé plusieurs avantages et reçoit plusieurs S7.

**Action :** limiter la pression promotionnelle et mesurer la fréquence sans offre.

### VIP en ralentissement

Il dépasse pour la première fois sa cadence habituelle.

**Action :** c’est le meilleur candidat à une intervention S7 réellement utile.

## 12. Recommandations

### Conserver la règle de fréquence

La condition `ordersLast30d >= 8` correspond au statut VIP. Il n’est pas recommandé de la remplacer par un compteur à vie.

### Repositionner S7

S7 devrait devenir un mécanisme de fidélité relationnelle :

- reconnaissance du statut VIP;
- accès anticipé à une nouveauté;
- recommandation basée sur les préférences;
- rappel d’une récompense déjà disponible;
- surprise occasionnelle, non prévisible;
- avantage seulement lors d’un ralentissement inhabituel.

### Ne pas baisser le seuil pour tout le monde

Le seuil de 25 $ est incompatible avec le panier médian, mais sa suppression générale ferait supporter un coût sur des commandes presque certaines.

Deux options à tester :

1. message VIP sans subvention;
2. bonus sans seuil uniquement lorsque le client dépasse sa cadence attendue.

### Expérience recommandée

| Groupe | Traitement |
|---|---|
| Témoin | Aucun message promotionnel |
| A | Message VIP sans points |
| B | Rappel d’une récompense déjà accessible |
| C | 150 points après dépassement de la cadence personnelle |

KPI : marge et fréquence incrémentales, rétention à 30–90 jours, utilisation du catalogue de récompenses et pression promotionnelle.

## Conclusion

S7 cible les bons utilisateurs, mais ils sont déjà presque parfaitement fidèles. La non-conversion de l’offre n’est pas synonyme d’échec client : 97,44 % ont recommandé sans elle.

Le meilleur usage de S7 consiste à **détecter une rupture de cadence et protéger la relation VIP**, plutôt qu’accorder automatiquement des points à chaque période de forte activité.
