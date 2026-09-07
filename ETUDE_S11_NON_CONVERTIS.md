# Étude comportementale S11 — Utilisateurs non convertis

**Période :** 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu S11 activée, à l’exclusion des utilisateurs ayant converti S11  
**Ancienne règle :** au moins une commande et récence de 60 à 89 jours

## Résumé

S11 respectait sa condition technique : 1 863 des 1 869 non-convertis étaient bien dans la fenêtre de 60 à 89 jours, soit 99,7 %. Comme pour S10, le défaut vient de la définition métier fondée uniquement sur le calendrier.

La majorité de la population, soit 60,6 %, avait seulement une ou deux commandes. Les clients établis se répartissaient entre arrêts soudains, faibles fréquences réellement en retard et faibles fréquences qui n’avaient pas encore atteint leur retour attendu.

## Population

| Indicateur | Volume |
|---|---:|
| Offres générées | 4 239 |
| Offres activées | 4 134 |
| Utilisateurs uniques activés | 1 903 |
| Utilisateurs convertis | 34 |
| **Non-convertis analysés** | **1 869** |
| Correctement placés dans 60–89 jours | **1 863** |

- Récence médiane : **62,78 jours**
- Cadence personnelle médiane : **33,34 jours**
- Dernier panier médian : **24,75 $**
- Activations moyennes par non-converti : **2,17**

## Profils comportementaux

| Profil | Non-convertis | Part | Conversion historique du profil |
|---|---:|---:|---:|
| Abandon précoce — 1 ou 2 commandes | 1 132 | **60,57 %** | 0,70 % |
| Arrêt soudain | 355 | 18,99 % | **3,79 %** |
| Faible fréquence réellement en retard | 174 | 9,31 % | 2,79 % |
| Faible fréquence pas encore en retard | 208 | **11,13 %** | 3,26 % |

Les 208 clients à faible fréquence non encore en retard avaient une cadence médiane de 91,09 jours, mais recevaient S11 après seulement 61,34 jours. S11 était donc prématurée pour eux.

Les arrêts soudains et faibles fréquences réellement en retard doivent désormais être orientés vers S19 et S20. S11 doit rester une étape d’abandon prolongé pour les utilisateurs sans habitude fiable.

## Variantes historiques

| Première offre reçue | Utilisateurs | Convertis | Taux brut |
|---|---:|---:|---:|
| 20 % | 1 014 | 24 | **2,37 %** |
| 8 $ dès 30 $ | 679 | 10 | 1,47 % |
| Article offert dès 20 $ | 210 | 0 | **0 %** |

L’offre actuellement configurée — article offert dès 20 $ — n’a produit aucune conversion parmi 210 utilisateurs historiques.

Chez les abandons précoces, les résultats étaient également faibles :

- 20 % : 1,14 %;
- 8 $ dès 30 $ : 0,25 %;
- article offert : 0 %.

Une remise plus forte ne résout donc pas le manque d’attachement des utilisateurs ayant essayé le service une ou deux fois.

## Retour sans utilisation S11

| Fenêtre | Population mature | Retours sans S11 | Taux |
|---|---:|---:|---:|
| 7 jours | 1 653 | 66 | 3,99 % |
| 14 jours | 1 393 | 99 | 7,11 % |
| 30 jours | 538 | 92 | **17,10 %** |

## Recommandation

1. Limiter S11 aux utilisateurs ayant seulement une ou deux commandes.
2. Laisser S19 gérer les arrêts soudains, même après 60 jours.
3. Laisser S20 gérer les faibles fréquences uniquement après dépassement réel de leur cadence.
4. Ne rien envoyer aux clients dont la cadence personnelle n’est pas encore dépassée.
5. Abandonner l’article offert actuel, qui affiche zéro conversion historique.
6. Tester un groupe témoin contre une offre de **20 % avec contrôle de coût**. En l’absence de plafond monétaire dans le moteur, une remise fixe proche de 5–6 $ dès 25 $ est économiquement plus prévisible.
7. Éviter que S11 suive immédiatement S10 : la transition doit respecter le cooldown configuré de S10.

## Conclusion

S11 présente le même défaut structurel que S10 : une condition calendaire correcte mais insuffisamment comportementale. Elle doit devenir une étape de récupération des utilisateurs à faible profondeur relationnelle, tandis que les clients possédant une cadence exploitable passent dans S19 ou S20.

