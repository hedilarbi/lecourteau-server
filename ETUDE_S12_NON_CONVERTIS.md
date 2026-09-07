# Étude comportementale S12 — Utilisateurs non convertis

**Période :** 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu S12 activée, à l’exclusion des utilisateurs ayant converti S12  
**Ancienne règle :** au moins une commande et récence d’au moins 90 jours

## Résumé

S12 respectait parfaitement sa règle technique : les 4 438 non-convertis avaient tous au moins 90 jours d’inactivité. Cependant, 77,4 % avaient seulement une ou deux commandes et n’avaient jamais construit d’habitude durable.

S12 ne doit donc pas être interprétée comme une stratégie universelle de « très ancien client ». Pour la majorité, il s’agit plutôt d’un dernier essai de récupération après une première expérience ancienne.

## Population

| Indicateur | Volume |
|---|---:|
| Offres générées | 9 768 |
| Offres activées | 9 411 |
| Utilisateurs uniques activés | 4 481 |
| Utilisateurs convertis | 43 |
| **Non-convertis analysés** | **4 438** |
| Correctement placés à 90 jours ou plus | **4 438 — 100 %** |

- Récence médiane : **184,83 jours**
- Cadence personnelle médiane : **38,02 jours**
- Dernier panier médian : **27,50 $**
- Activations moyennes par non-converti : **2,09**

## Profils comportementaux

| Profil | Non-convertis | Part | Conversion historique du profil |
|---|---:|---:|---:|
| Abandon précoce — 1 ou 2 commandes | 3 437 | **77,44 %** | **0,52 %** |
| Arrêt soudain | 462 | 10,41 % | 2,53 % |
| Faible fréquence réellement en retard | 415 | 9,35 % | 2,12 % |
| Faible fréquence pas encore en retard | 124 | 2,79 % | 3,13 % |

Les arrêts soudains avaient une cadence médiane de 15,92 jours et une récence médiane de 133,77 jours. Ils doivent rester dans S19, qui décrit mieux la rupture de leur comportement.

Les faibles fréquences réellement en retard avaient une cadence médiane de 49,99 jours et une récence médiane de 145,89 jours. Ils relèvent de S20.

Les 124 faibles fréquences pas encore en retard avaient une cadence médiane très longue de 129,49 jours et recevaient S12 autour de 92,79 jours. Même le seuil de 90 jours était donc trop précoce pour eux.

## Variantes historiques

| Première offre reçue | Utilisateurs | Convertis | Taux brut |
|---|---:|---:|---:|
| 25 % | 3 813 | 34 | 0,89 % |
| 35 % dès 25 $ | 281 | 4 | 1,42 % |
| 35 % sans seuil | 214 | 5 | **2,34 %** |
| Article offert | 173 | 0 | **0 %** |

Les volumes des variantes à 35 % et de l’article offert sont faibles et correspondent à des périodes différentes. Ils ne permettent pas de conclure que 35 % est causalement supérieur.

Le constat robuste est économique : même des remises de 25 à 35 % convertissent très peu cette population. Chez les abandons précoces, le taux global ne dépasse que 0,52 %.

L’article offert actuellement configuré n’a enregistré aucune conversion parmi 173 utilisateurs historiques.

## Retour sans utilisation S12

| Fenêtre | Population mature | Retours sans S12 | Taux |
|---|---:|---:|---:|
| 7 jours | 4 254 | 44 | 1,03 % |
| 14 jours | 4 070 | 116 | 2,85 % |
| 30 jours | 2 036 | 126 | **6,19 %** |

## Recommandation

1. Limiter S12 aux utilisateurs ayant une ou deux commandes et sans cadence personnelle fiable.
2. Conserver les clients établis en S19 ou S20, quelle que soit la durée absolue de leur absence.
3. Exclure les clients à faible fréquence qui n’ont pas encore dépassé leur cadence.
4. Faire de S12 la **dernière tentative de reconquête**, et non une offre répétée indéfiniment.
5. Utiliser un cooldown à vie après cette tentative, configuré en base, sauf si l’utilisateur revient naturellement.
6. Retirer l’article offert actuel, qui présente zéro conversion historique.
7. Tester d’abord une communication de reconquête ou un sondage de cause avec groupe témoin. Une remise de 25–35 % ne doit pas être conservée sans preuve de marge incrémentale.
8. Si une offre monétaire est nécessaire, privilégier une valeur plafonnée et mesurable plutôt qu’un fort pourcentage sans plafond.

## Conclusion

S12 est la stratégie la moins convaincante économiquement : 9 768 offres générées, seulement 43 utilisateurs convertis, et une majorité d’utilisateurs n’ayant jamais dépassé une ou deux commandes. Augmenter encore la générosité n’est pas la solution principale.

S12 doit devenir une dernière tentative unique pour les abandons précoces très anciens. Les vrais clients historiques interrompus restent mieux décrits et mieux priorisés par S19/S20.
