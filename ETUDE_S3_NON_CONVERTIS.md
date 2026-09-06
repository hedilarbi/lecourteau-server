# Étude comportementale S3 — Utilisateurs non convertis

**Périmètre :** historique S3 du 5 août au 6 septembre 2026  
**Population :** utilisateurs ayant eu au moins une S3 activée, à l’exclusion de tous ceux ayant converti S3  
**Unité d’analyse :** utilisateur unique

## 1. Résumé de direction

S3 est conçue pour provoquer une troisième commande après deux achats. Dans les faits, elle mélange une consolidation d’habitude récente et une réactivation parfois très tardive.

Les non-convertis ont un panier médian de deuxième commande de **23,88 $**, alors que l’offre actuelle exige **35 $**. Le client médian doit donc augmenter son panier d’environ **47 %** pour obtenir 7 $. Cette friction s’ajoute à une récence mal contrôlée et à des expositions répétées.

### Conclusions principales

1. **1 515 non-convertis** ont été analysés après exclusion de 22 convertis S3.
2. La récence médiane au premier déclenchement est de **60 jours**; la moyenne atteint 125 jours.
3. **50,2 %** avaient déjà au moins 60 jours d’inactivité; **41,6 %** avaient au moins 90 jours.
4. **69,7 %** ont eu quatre activations S3.
5. Le panier moyen passe de 30,06 $ au premier achat à 27,96 $ au deuxième, soit une baisse moyenne de 2,22 $.
6. Le panier du deuxième achat diminue pour 743 utilisateurs, contre une hausse pour 615.
7. Parmi les non-convertis suffisamment observés, **9,38 %** repassent une commande sous 14 jours sans convertir S3.
8. Les clients ayant effectué leur première puis leur deuxième commande en 7–13 jours présentent le meilleur retour ultérieur à 14 jours : **20 %**.

## 2. Population et historique de S3

| Indicateur | Volume |
|---|---:|
| Offres S3 générées | 5 121 |
| Offres activées | 5 074 |
| Utilisateurs uniques avec offre générée | 1 557 |
| Utilisateurs uniques avec offre activée | 1 537 |
| Convertis exclus | 22 |
| **Non-convertis analysés** | **1 515** |

L’exclusion combine les offres au statut `applied` et les commandes non annulées liées à S3.

### Versions historiques

| Variante | Période | Offres | Utilisateurs exposés | Applications | Taux brut par offre |
|---|---|---:|---:|---:|---:|
| 5 $ dès 35 $ | 5–12 août | 1 262 | 1 262 | 2 | 0,16 % |
| 7 $ dès 35 $ | 12 août–6 septembre | 3 859 | 1 491 | 20 | 0,52 % |

Le passage de 5 $ à 7 $ coïncide avec une amélioration du taux brut, mais ce n’est pas une preuve causale : les périodes et le nombre d’expositions sont différents. Le seuil est resté identique.

## 3. Adéquation réelle à la logique S3

### Commandes antérieures visibles

| Nombre de commandes avant la première S3 | Utilisateurs |
|---|---:|
| 1 | 35 |
| 2 | 1 480 |

Les 35 utilisateurs avec une seule commande visible sont des anomalies de données ou d’historique à investiguer. La majorité correspond bien au jalon de deux commandes.

### Récence de la deuxième commande

| Délai depuis la dernière commande | Non-convertis | Part | Retour sans S3 sous 14 jours* |
|---|---:|---:|---:|
| 7–13 jours | 427 | 28,2 % | 17,25 % |
| 14–29 jours | 132 | 8,7 % | 18,18 % |
| 30–59 jours | 195 | 12,9 % | 12,82 % |
| 60–89 jours | 131 | 8,6 % | 7,63 % |
| 90–179 jours | 235 | 15,5 % | 5,11 % |
| 180–364 jours | 250 | 16,5 % | 3,60 % |
| 365 jours et plus | 145 | 9,6 % | 1,38 % |

\* Parmi les utilisateurs disposant d’au moins 14 jours d’observation.

S3 n’a actuellement qu’une borne minimale :

```js
orderCount === 2 && recencyDays >= 7
```

Elle reste donc candidate indéfiniment. Avec une priorité de 96, elle peut prendre la place de S9, S10 ou S11. S12 la dépasse à partir de 90 jours avec une priorité de 97, sauf indisponibilité ou cooldown de S12.

**Diagnostic :** à partir de 18 ou 30 jours, la question marketing n’est plus seulement « comment obtenir une troisième commande ? », mais « comment réactiver le client ? ».

## 4. Formation de l’habitude avant S3

Le délai entre la première et la deuxième commande est un meilleur indicateur d’habitude que le simple compteur égal à deux.

- Délai moyen : **91 jours**
- Délai médian : **42 jours**

| Délai entre commande 1 et commande 2 | Population mature à 14 jours | Retours ultérieurs sous 14 jours | Taux |
|---|---:|---:|---:|
| Moins de 7 jours | 191 | 20 | 10,47 % |
| 7–13 jours | 130 | 26 | **20,00 %** |
| 14–29 jours | 223 | 28 | 12,56 % |
| 30–59 jours | 223 | 22 | 9,87 % |
| 60 jours et plus | 543 | 29 | 5,34 % |

Les utilisateurs qui ont attendu plus de 60 jours entre leurs deux premiers achats ne montrent pas une habitude solide. Les traiter comme des clients en phase de consolidation surestime leur intention.

Le groupe ayant commandé deux fois en moins de sept jours ne revient pas autant que celui à 7–13 jours. Une explication possible est un achat circonstanciel rapproché plutôt qu’une routine; cette hypothèse doit être testée avec davantage d’historique.

## 5. Comportement de panier

| Mesure | Première commande | Deuxième commande |
|---|---:|---:|
| Panier moyen | 30,06 $ | 27,96 $ |
| Panier médian | 25,15 $ | 23,88 $ |

Évolution individuelle du panier :

- hausse : 615 utilisateurs;
- baisse : 743 utilisateurs;
- stable : 122 utilisateurs;
- variation moyenne : **−2,22 $**.

### Relation entre deuxième panier et retour

| Deuxième panier | Population mature à 14 jours | Retours sans S3 | Taux |
|---|---:|---:|---:|
| Moins de 25 $ | 702 | 71 | 10,11 % |
| 25–34,99 $ | 276 | 28 | 10,14 % |
| 35–44,99 $ | 184 | 9 | 4,89 % |
| 45 $ et plus | 181 | 18 | 9,94 % |

Le seuil fixe de 35 $ ne correspond pas au panier naturel de la majorité. Pour le client médian, atteindre 35 $ exige environ 11,12 $ supplémentaires. Même si l’avantage final est de 7 $, l’effort perçu reste important.

Une offre « 5 $ dès 28–30 $ » ou un seuil individualisé peut être plus atteignable et plus rentable qu’un avantage supérieur placé à 35 $.

## 6. Comportement après activation

Ces retours concernent des non-convertis S3. Ils peuvent avoir utilisé une autre promotion; ils ne prouvent aucun effet de S3.

| Fenêtre | Population suffisamment observée | Retours | Taux |
|---|---:|---:|---:|
| 3 jours | 1 466 | 39 | 2,66 % |
| 7 jours | 1 426 | 76 | 5,33 % |
| 14 jours | 1 343 | 126 | **9,38 %** |
| 30 jours | 1 168 | 141 | **12,07 %** |

Au total, 209 utilisateurs, soit 13,8 %, ont fini par repasser une commande après leur première S3 sans la convertir.

- délai moyen de retour : 11,13 jours;
- délai médian : 9,99 jours.

Ce taux de retour naturel ou assisté par d’autres leviers crée un risque de cannibalisation : une partie de ces utilisateurs aurait potentiellement commandé sans les 7 $.

## 7. Expositions répétées

| Nombre de S3 activées | Non-convertis | Part |
|---|---:|---:|
| 1 | 211 | 13,9 % |
| 2 | 155 | 10,2 % |
| 3 | 93 | 6,1 % |
| 4 | 1 056 | **69,7 %** |

La répétition augmente le dénominateur « offres générées » sans démontrer une hausse proportionnelle des commandes. Elle risque également d’apprendre au client que l’offre reviendra après expiration.

Le cooldown doit rester piloté par la configuration, mais l’équipe doit définir un objectif explicite : nombre maximum d’expositions S3 par utilisateur et règle de sortie vers la réactivation.

## 8. Sensibilité promotionnelle antérieure

Avant S3 :

- 264 utilisateurs, soit 17,43 %, avaient utilisé un code promotionnel;
- 31, soit 2,05 %, avaient déjà utilisé une Smart Offer;
- 7, soit 0,46 %, avaient bénéficié d’un abonnement;
- 302, soit **19,93 %**, avaient au moins un avantage promotionnel explicitement identifiable.

Le champ générique `discount` est positif chez presque tous les utilisateurs, mais il ne permet pas d’identifier proprement l’origine de la réduction. Il n’est donc pas utilisé comme preuve de sensibilité promotionnelle.

La majorité ne présente pas de promotion explicite antérieure connue. La non-conversion ne peut donc pas être expliquée uniquement par une fatigue aux coupons.

## 9. Canal et joignabilité

### Dernière commande avant S3

| Canal | Utilisateurs |
|---|---:|
| Application | 764 |
| Web | 264 |
| Non renseigné | 487 |

| Mode | Utilisateurs |
|---|---:|
| Ramassage (`pick up` + `pickup`) | 1 205 |
| Livraison | 310 |

Le ramassage représente environ 79,5 % de la population.

### État utilisateur actuel

- application déclarée installée : 1 354 utilisateurs, soit 89,43 % des comptes retrouvés;
- jeton push présent : 635, soit 41,94 %;
- désabonnement courriel enregistré : aucun.

### Traçabilité des événements S3

Sur l’ensemble de S3, convertis compris :

| Événement | Utilisateurs uniques | Offres uniques |
|---|---:|---:|
| Notification enregistrée | 766 | 2 167 |
| Vue enregistrée | 176 | 194 |
| Clic notification | 24 | 25 |
| Clic dans l’offre | 80 | 80 |
| Application | 22 | 22 |

Une activation n’est donc pas une preuve de livraison. Les taux calculés sur toutes les offres activées sous-estiment probablement la réponse parmi les utilisateurs réellement joints, mais les événements incomplets empêchent une correction fiable.

## 10. Typologie des non-convertis S3

### Habitude récente et retour probable

Deux commandes rapprochées et dernière commande datant de moins de 30 jours.

**Comportement :** retour à court terme élevé; risque de payer une commande qui aurait eu lieu naturellement.

**Action :** groupe témoin indispensable; message relationnel ou recommandation avant rabais.

### Deux achats mais panier incompatible

Deuxième panier inférieur à 25–30 $, alors que le seuil est de 35 $.

**Comportement :** intention possible, mais effort financier trop important.

**Action :** tester un seuil de 28–30 $ ou un seuil personnalisé.

### Habitude fragile

Plus de 60 jours entre les deux premières commandes, ou plus de 30 jours depuis la deuxième.

**Comportement :** achats occasionnels plutôt qu’habitude installée.

**Action :** sortir de S3 et orienter vers la réactivation correspondant à la récence.

### Clients inactifs de longue durée

Au moins 90 jours depuis la deuxième commande.

**Comportement :** faible retour à 14 jours, de 1,38 % à 5,11 % selon l’ancienneté.

**Action :** S12 ou campagne de reconquête; ne plus présenter S3 comme récompense d’un jalon récent.

## 11. Recommandations

### Corriger d’abord l’éligibilité

Une logique cohérente avec la correction S2 serait :

```js
// S03 — consolider rapidement après la deuxième commande
if (orderCount === 2 && recencyDays >= 7 && recencyDays <= 17) {
  // Ajouter S3
}
```

À partir de 18 jours :

- S9 pour 18–29 jours;
- S10 pour 30–59 jours;
- S11 pour 60–89 jours;
- S12 pour 90 jours et plus.

Cette modification n’est pas appliquée dans le cadre de cette étude; elle constitue la recommandation suivante à valider.

### Tester le seuil avant de remplacer le type

| Groupe | Offre | Hypothèse |
|---|---|---|
| Témoin | Aucun rabais | Mesurer la troisième commande naturelle |
| A | 7 $ dès 35 $ | Offre actuelle |
| B | 5 $ dès 30 $ | Réduire la friction et le coût |
| C | 5 $ dès panier moyen individuel + 10 % | Adapter l’effort demandé |

Le KPI prioritaire doit être la **troisième commande incrémentale et sa marge**, puis la quatrième commande à 30–60 jours.

## Verdict

S3 s’adresse à une population plus engagée que S2, ce que confirme un retour sans conversion plus élevé. Pourtant, la stratégie perd sa cohérence lorsque la deuxième commande remonte à plusieurs mois.

La priorité est double : **limiter S3 à une fenêtre récente**, puis **ramener le seuil vers le panier réellement observé**. Les données ne justifient pas encore l’abandon du rabais fixe; elles suggèrent plutôt que 35 $ est trop éloigné du comportement du client médian.
