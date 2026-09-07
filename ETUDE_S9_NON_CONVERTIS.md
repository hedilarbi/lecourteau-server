# Étude comportementale S9 — Utilisateurs non convertis

**Période :** 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu une S9 activée, à l’exclusion de tous ceux ayant converti S9  
**Règle contrôlée :** au moins une commande historique et dernière commande datant de 18 à 29 jours

## 1. Résumé de direction

S9 est correctement placée pour 2 576 des 2 619 non-convertis, soit 98,4 %. Sa fenêtre de 18–29 jours est beaucoup plus proche de la cadence naturelle des utilisateurs que S8 : récence médiane de 18,97 jours contre intervalle médian habituel de 24,76 jours.

La population reste très hétérogène. Un tiers n’a commandé qu’une seule fois, tandis que d’autres possèdent plusieurs dizaines de commandes. La même offre de 8 $ dès 25 $ ne répond donc pas nécessairement au même enjeu économique.

Le panier médian de 22,99 $ est proche du seuil de 25 $. La friction est raisonnable, mais 8 $ représente une réduction effective de 32 % au seuil. Or la variante à 8 $ ne présente pas de meilleur taux brut par offre que celle à 6 $ dans l’historique disponible.

### Conclusions principales

1. 2 619 non-convertis analysés après exclusion de 100 convertis.
2. 2 576 respectaient correctement la fenêtre S9.
3. 34,5 % n’avaient qu’une seule commande historique.
4. La récence médiane était de 18,97 jours.
5. Leur intervalle médian habituel était de 24,76 jours.
6. Le dernier panier médian était de 22,99 $.
7. 17,26 % recommandaient sous 14 jours sans utiliser S9.
8. 48,73 % recommandaient sous 30 jours sans S9 parmi la cohorte suffisamment observée.
9. 33,62 % avaient déjà bénéficié d’une promotion identifiable.
10. La répétition est importante : 59 % des non-convertis ont eu deux activations S9.

## 2. Population

| Indicateur | Volume |
|---|---:|
| Offres S9 générées | 4 471 |
| Offres activées | 4 359 |
| Utilisateurs uniques avec offre générée | 2 759 |
| Utilisateurs uniques avec offre activée | 2 719 |
| Convertis exclus | 100 |
| **Non-convertis analysés** | **2 619** |
| Correctement placés | **2 576** |
| Placements historiques non conformes | 43 |

La différence entre les 99 utilisateurs au statut `applied` et les 100 convertis exclus provient d’une commande liée à S9 identifiée comme appliquée dans l’historique transactionnel.

## 3. Profondeur de relation

| Commandes à vie avant S9 | Utilisateurs | Part |
|---|---:|---:|
| 1 | 888 | **34,5 %** |
| 2 | 313 | 12,2 % |
| 3–4 | 423 | 16,4 % |
| 5–10 | 535 | 20,8 % |
| 11–20 | 290 | 11,3 % |
| 21 et plus | 127 | 4,9 % |

S9 assume désormais un rôle particulièrement important : après la correction de S2, elle doit récupérer les clients à achat unique qui atteignent 18 jours sans deuxième commande.

Il convient de distinguer au minimum dans les analyses :

- achat unique à réactiver;
- client en début d’habitude avec deux à quatre commandes;
- client historique momentanément inactif.

Il n’est pas obligatoire de créer trois offres différentes immédiatement. Il faut toutefois suivre leurs performances séparément, car leur propension naturelle à revenir et leur valeur économique diffèrent.

## 4. Récence et cadence personnelle

- Récence moyenne au déclenchement : 20,36 jours
- Récence médiane : 18,97 jours
- Intervalle habituel moyen : 47,51 jours
- Intervalle habituel médian : **24,76 jours**

S9 intervient autour de 77 % de la cadence médiane. Elle est donc mieux synchronisée que S8, mais reste légèrement anticipée pour le client typique.

### Retour sans S9 selon la récence

| Récence | Population mature à 14 jours | Retours | Taux |
|---|---:|---:|---:|
| 18–20 jours | 1 346 | 233 | 17,31 % |
| 21–23 jours | 166 | 38 | **22,89 %** |
| 24–26 jours | 194 | 27 | 13,92 % |
| 27–29 jours | 90 | 12 | 13,33 % |

Le meilleur retour sans utilisation apparaît vers J+21–23, proche de la cadence naturelle. Cela renforce le risque qu’une offre envoyée à ce moment puisse payer une commande déjà probable.

## 5. Historique des variantes

| Variante | Offres | Applications | Taux brut par offre |
|---|---:|---:|---:|
| 15 % sans seuil | 1 121 | 20 | 1,78 % |
| 6 $ dès 25 $ | 1 446 | 35 | **2,42 %** |
| 8 $ dès 25 $ | 1 904 | 44 | 2,31 % |

La hausse de 6 $ à 8 $ n’a pas amélioré le taux brut par offre. Les périodes ne sont pas randomisées, mais rien ne justifie actuellement le coût supplémentaire de 2 $.

Le rabais fixe présente deux avantages par rapport au pourcentage : coût maximal connu et proposition très lisible. Le seuil de 25 $ reste proche du panier médian.

## 6. Panier

- Panier moyen récent : 26,94 $
- Dernier panier moyen : 27,22 $
- Dernier panier médian : **22,99 $**

Pour le client médian, atteindre 25 $ demande seulement 2,01 $ supplémentaires, soit environ 8,7 %. Le seuil est donc nettement plus réaliste que ceux observés sur S3, S5, S6 ou S7.

À 25 $, une remise de 8 $ équivaut cependant à 32 % du panier. Une remise de 6 $ représente encore 24 %.

### Retour sans S9 selon le dernier panier

| Dernier panier | Population mature à 14 jours | Retours | Taux |
|---|---:|---:|---:|
| Moins de 20 $ | 633 | 126 | **19,91 %** |
| 20–24,99 $ | 345 | 60 | 17,39 % |
| 25–34,99 $ | 350 | 64 | 18,29 % |
| 35 $ et plus | 468 | 60 | 12,82 % |

Les petits paniers reviennent davantage sans S9. Ils sont aussi ceux pour lesquels 8 $ représente le plus grand coût proportionnel une fois le seuil atteint.

## 7. Retour sans conversion

| Fenêtre | Population suffisamment observée | Retours sans S9 | Taux |
|---|---:|---:|---:|
| 3 jours | 2 402 | 91 | 3,79 % |
| 7 jours | 2 192 | 208 | 9,49 % |
| 14 jours | 1 796 | 310 | **17,26 %** |
| 30 jours | 314 | 153 | **48,73 %** |

Au total, 571 utilisateurs correctement placés, soit 22,17 %, ont fini par recommander sans convertir S9.

- délai moyen après S9 : 10,34 jours;
- délai médian : 8,22 jours.

Le retour médian intervient donc environ 27 jours après la commande précédente, ce qui reste cohérent avec la cadence historique de 24,76 jours.

## 8. Expositions répétées

| Activations S9 | Non-convertis |
|---|---:|
| 1 | 1 048 |
| 2 | 1 546 |
| 3 | 25 |

59 % des non-convertis ont eu deux activations dans la même logique. Cette répétition vient notamment de la durée de la fenêtre et du cooldown configuré.

Le cooldown reste une configuration métier. Il serait pertinent de comparer une activation unique à deux activations afin de vérifier si la relance apporte réellement des conversions supplémentaires.

## 9. Promotion et canal

- 33,62 % avaient déjà bénéficié d’une promotion identifiable.
- 77,3 % avaient réalisé leur dernière commande via l’application.
- 84,4 % utilisaient le ramassage.

S9 est moins concentrée en utilisateurs déjà promotionnés que les stratégies de fidélité S6/S7. Elle présente donc moins de risque de dépendance promotionnelle, sans l’éliminer.

## 10. Typologie comportementale

### Client à achat unique

Il représente plus du tiers de S9 et n’a pas créé de deuxième habitude avant J+18.

**Action :** proposition simple et rassurante, éventuellement fondée sur son premier achat. Mesurer la deuxième commande incrémentale.

### Client en début de relation

Deux à quatre commandes, cadence encore instable.

**Action :** utiliser la cadence disponible avec prudence et éviter de surpersonnaliser sur trop peu d’observations.

### Client régulier réellement en retard

Son intervalle habituel est inférieur à sa récence actuelle.

**Action :** bon candidat à S9; tester une réduction inférieure à 8 $.

### Client à cadence mensuelle normale

Il commande tous les 25–30 jours et reçoit S9 avant son retour attendu.

**Action :** attendre davantage ou utiliser un rappel sans avantage.

## 11. Recommandations

### Conserver la fenêtre 18–29 jours

Elle complète correctement la nouvelle limite de S2/S3 et précède S10. Aucun défaut majeur de placement n’impose une modification immédiate.

### Revenir à 6 $ comme challenger principal

Les données historiques ne montrent aucun gain du passage de 6 $ à 8 $. Tester officiellement :

| Groupe | Offre |
|---|---|
| Témoin | Aucun rabais |
| A | 8 $ dès 25 $, offre actuelle |
| B | 6 $ dès 25 $ |
| C | 15 % avec plafond de 6 $ |

### Ajouter progressivement la cadence personnelle

Pour les utilisateurs ayant assez d’historique, différer S9 jusqu’à l’approche de leur intervalle habituel. Pour un achat unique, conserver la fenêtre standard, faute de cadence fiable.

### KPI

- retour incrémental à 7 et 14 jours;
- marge incrémentale;
- coût du rabais par commande réellement ajoutée;
- deuxième commande pour les achats uniques;
- retour naturel comparé au témoin;
- effet marginal de la deuxième activation.

## Conclusion

S9 est bien placée et son seuil de 25 $ correspond relativement bien au panier observé. La principale opportunité est économique : **8 $ ne convertit pas mieux que 6 $ dans l’historique brut**, alors qu’il coûte 33 % de plus par utilisation.

La stratégie doit conserver son rôle de réactivation intermédiaire, mais tester une réduction moins généreuse et mieux synchronisée avec la cadence personnelle lorsque celle-ci est connue.
