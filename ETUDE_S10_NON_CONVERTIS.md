# Étude comportementale S10 — Utilisateurs non convertis

**Période :** 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu une offre S10 activée, à l’exclusion de ceux ayant converti S10  
**Ancienne règle contrôlée :** au moins une commande et dernière commande datant de 30 à 59 jours

## Résumé de direction

S10 appliquait correctement sa règle calendaire : 2 791 des 2 797 non-convertis, soit 99,8 %, avaient bien une récence de 30 à 59 jours. Le problème n’est donc pas un défaut d’exécution, mais une règle métier trop large.

La récence médiane était de 32,78 jours, alors que la cadence personnelle médiane était de 28,02 jours. Cette moyenne cache toutefois plusieurs comportements incompatibles avec une offre unique : 54,4 % étaient des abandons précoces, 19,6 % des arrêts soudains, et 24,5 % des clients établis qui n’avaient pas encore réellement dépassé leur cadence.

L’offre actuelle de 30 % dès 20 $ est la variante historique la moins performante : 1,91 % de conversion, contre 3,93 % pour 15 % et 4,14 % pour 30 % dès 30 $. Les variantes n’ayant pas été randomisées, cette comparaison constitue un signal directionnel et non une preuve causale.

## Population

| Indicateur | Volume |
|---|---:|
| Offres S10 générées | 6 000 |
| Offres activées | 5 836 |
| Utilisateurs uniques activés | 2 894 |
| Utilisateurs ayant converti S10 | 97 |
| **Non-convertis analysés** | **2 797** |
| Correctement placés dans la fenêtre 30–59 jours | **2 791 — 99,8 %** |

La conversion a été rapprochée avec les commandes portant réellement l’offre S10, en complément du statut de l’offre.

## Décomposition comportementale des non-convertis

| Comportement au moment de S10 | Utilisateurs | Part | Cadence médiane | Récence médiane |
|---|---:|---:|---:|---:|
| Abandon précoce — 1 ou 2 commandes | 1 522 | **54,42 %** | historique insuffisant | 32,80 j |
| Arrêt soudain | 549 | **19,63 %** | 13,50 j | 32,76 j |
| Faible fréquence, pas encore en retard | 520 | **18,59 %** | 58,56 j | 31,75 j |
| Faible fréquence, réellement en retard | 41 | 1,47 % | 34,50 j | 51,94 j |
| Client établi, pas encore en retard | 165 | 5,90 % | 25,91 j | 31,04 j |

### Lecture

- **54,4 %** avaient seulement essayé le service une ou deux fois. Leur problème est la construction d’habitude, pas la rupture d’une habitude établie.
- **19,6 %** avaient réellement interrompu une cadence auparavant soutenue. Ils appartiennent désormais à S19.
- Seulement **1,5 %** étaient des clients à faible fréquence réellement en retard. Ils appartiennent désormais à S20.
- **24,5 %** des clients établis n’étaient pas encore en retard : 520 à faible fréquence et 165 à cadence courte ou moyenne.

La règle fixe à J+30 envoyait donc une offre trop tôt à près d’un quart des clients établis non convertis.

## Profondeur de relation

| Commandes avant S10 | Non-convertis |
|---|---:|
| 1 | 1 118 |
| 2 | 404 |
| 3–4 | 455 |
| 5–10 | 524 |
| 11 et plus | 296 |

Le client médian avait un dernier panier de **23,88 $**. Le seuil de 20 $ de l’offre actuelle n’impose donc presque aucune progression de panier, tout en accordant 30 % de réduction.

## Performance historique des offres

| Première variante reçue | Utilisateurs | Convertis | Taux brut |
|---|---:|---:|---:|
| 15 % sans seuil | 1 450 | 57 | **3,93 %** |
| 30 % dès 30 $ | 556 | 23 | **4,14 %** |
| 30 % dès 20 $ | 888 | 17 | **1,91 %** |

La baisse du seuil de 30 $ à 20 $ n’a pas amélioré la conversion observée. Elle augmente en revanche la probabilité de subventionner un panier que le client aurait déjà atteint.

### Résultats selon le comportement

| Profil | 15 % | 30 % dès 30 $ | 30 % dès 20 $ |
|---|---:|---:|---:|
| Abandon précoce | **2,24 %** | 1,08 % | 1,28 % |
| Arrêt soudain | 6,36 % | **11,48 %** | 3,83 % |
| Faible fréquence, pas encore en retard | 3,44 % | 5,36 % | 0,62 % |
| Client établi, pas encore en retard | **14,29 %** | 0 % | 3,95 % |

Le taux élevé de 15 % chez les clients pas encore en retard peut justement représenter une commande naturellement imminente. Sans groupe témoin, il ne faut pas interpréter cette conversion comme un effet incrémental de la remise.

Le groupe « faible fréquence réellement en retard » ne compte que 45 utilisateurs en incluant les convertis. Tous avaient reçu la variante 15 %, avec 4 conversions; cet échantillon est trop faible pour conclure.

## Répétition et retour sans S10

- Activations moyennes par non-converti : **2,03**.
- Retour sous 7 jours sans utilisation S10 : **5,30 %**.
- Retour sous 14 jours sans utilisation S10 : **10,57 %**.
- Retour sous 30 jours sans utilisation S10 : **20,88 %** parmi les cohortes suffisamment observées.

S10 pouvait suivre directement S9 puisque les cooldowns étaient propres à chaque stratégie. Un utilisateur pouvait donc recevoir une offre S9 à la fin de sa fenêtre, puis une nouvelle offre S10 dès J+30 sans véritable pause entre les deux.

## Recommandation

### 1. Retirer de S10 les clients à cadence fiable

Les clients établis doivent d’abord être évalués par S19 ou S20 :

- S19 si l’arrêt dépasse de 50 % une cadence habituelle de 30 jours ou moins;
- S20 si la cadence habituelle dépasse 30 jours et que le retard atteint 20 %;
- aucune offre si la cadence personnelle n’est pas encore dépassée.

### 2. Recentrer S10 sur l’abandon prolongé

S10 peut devenir la deuxième étape de récupération des utilisateurs ayant seulement une ou deux commandes et qui sont toujours absents après 30 jours. Il faut toutefois ajouter une pause entre S9 et S10 afin d’éviter deux offres consécutives.

### 3. Ne pas conserver 30 % dès 20 $

Cette variante est coûteuse et historiquement la moins performante. Pour les abandons précoces, 15 % a mieux performé que les deux variantes à 30 %. Le prochain test recommandé est :

| Groupe | Traitement |
|---|---|
| Témoin | Aucun rabais |
| A | 15 % avec plafond économique |
| B | 6 $ dès 25 $ |

Le moteur actuel ne gère pas encore de plafond monétaire sur une réduction en pourcentage. Sans ajout de cette capacité, **6 $ dès 25 $** offre un coût maximal plus contrôlable.

## Conclusion

S10 n’était pas techniquement défectueuse, mais elle confondait quatre situations. Sa fenêtre fixe de 30–59 jours envoyait une remise prématurée à environ un quart des clients établis. Les nouvelles stratégies S19 et S20 permettent de retirer ces clients de S10 au moment approprié.

La priorité suivante est de transformer S10 en stratégie d’**abandon prolongé après une ou deux commandes**, d’empêcher l’enchaînement immédiat S9 → S10 et de remplacer le 30 % dès 20 $ par un test moins coûteux avec groupe témoin.
