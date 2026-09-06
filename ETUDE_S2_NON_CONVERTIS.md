# Étude comportementale S2 — Utilisateurs non convertis

**Périmètre :** historique S2 du 5 août au 6 septembre 2026  
**Population étudiée :** utilisateurs ayant eu au moins une S2 activée, à l’exclusion de tous ceux ayant converti S2  
**Unité d’analyse :** utilisateur unique, et non nombre d’offres

## 1. Résumé décisionnel

S2 ne souffre pas d’abord d’un mauvais cadeau. Elle souffre surtout d’un **ciblage temporel trop large**, d’une **surpression promotionnelle** et d’une **traçabilité de notification insuffisante**.

La règle métier sélectionne un utilisateur ayant exactement une commande dès que celle-ci date d’au moins quatre jours, sans limite maximale de récence. Par conséquent, la même stratégie regroupe :

- un nouveau client encore chaud, quatre à treize jours après son premier achat;
- un client en décrochage depuis plusieurs semaines;
- un ancien client n’ayant commandé qu’une fois il y a parfois plus d’un an.

Ces comportements ne relèvent pas de la même stratégie marketing.

### Conclusions principales

1. **4 552 non-convertis** ont été analysés après exclusion de 17 convertis S2.
2. La médiane entre la première commande et la première S2 est de **90 jours**; la moyenne est de 162 jours.
3. **59,4 %** des non-convertis étaient déjà absents depuis au moins 60 jours au moment de la première S2.
4. **49,7 %** étaient absents depuis au moins 90 jours : S2 agit donc souvent comme une réactivation longue, et non comme une incitation à la deuxième commande.
5. Les utilisateurs encore chauds reviennent beaucoup plus : retour naturel à 14 jours de **13,5 %** pour une S2 déclenchée à J+4–6, contre **0,9 %** après un an.
6. **82,5 %** ont eu au moins quatre activations S2. La répétition ne compense pas la faible intention et peut banaliser l’offre.
7. Seuls **25,6 %** disposent actuellement d’un jeton push. L’événement `notified` n’existe que pour 1 599 utilisateurs S2 au total : « activée » ne signifie donc pas nécessairement « effectivement reçue ».

## 2. Construction de la population

### Volumes historiques

| Indicateur | Volume |
|---|---:|
| Offres S2 générées | 19 575 |
| Utilisateurs uniques avec une S2 générée | 4 585 |
| Utilisateurs uniques avec une S2 activée | 4 569 |
| Utilisateurs convertis exclus | 17 |
| **Population non convertie analysée** | **4 552** |

Un utilisateur est considéré comme converti s’il possède une S2 au statut `applied` ou une commande non annulée liée à une S2. Tous ces utilisateurs ont été retirés de l’étude, même s’ils avaient auparavant ignoré d’autres offres S2.

### Limite sur la notion de réception

L’étude utilise `validFrom != null` comme preuve d’activation. Cela ne garantit pas que la notification a été livrée ou vue.

Sur tout l’historique S2, le journal contient :

| Événement | Utilisateurs uniques | Offres uniques |
|---|---:|---:|
| Notification enregistrée | 1 599 | 4 363 |
| Vue enregistrée | 151 | 168 |
| Clic notification | 20 | 21 |
| Clic dans l’offre | 48 | 50 |
| Application | 17 | 17 |

Les événements ne couvrent pas tout l’historique de génération. Il serait donc incorrect d’affirmer que les autres utilisateurs ont réellement reçu une notification sans erreur; ils ont eu une offre activée par le système.

## 3. Historique des propositions S2

S2 a changé deux fois pendant la période :

| Variante | Période | Offres générées | Utilisateurs exposés | Applications enregistrées | Taux brut par offre |
|---|---|---:|---:|---:|---:|
| 20 % dès 20 $ | 5–12 août | 4 029 | 4 029 | 7 | 0,17 % |
| Churros dès 35 $ | 12–24 août | 8 012 | 4 212 | 2 | 0,02 % |
| Churros dès 20 $ | 24 août–6 septembre | 7 534 | 4 314 | 8 | 0,11 % |

Cette comparaison n’est pas un A/B test : les périodes, la maturité et les répétitions diffèrent. Elle fournit néanmoins deux indications :

- le seuil de 35 $ a créé une friction très importante;
- le retour à 20 $ a amélioré le signal, sans résoudre le problème général de S2;
- le type « cadeau » ne peut pas être déclaré mauvais, car S4 utilise également un cadeau avec de meilleurs résultats.

## 4. Profil comportemental avant S2

### Nombre de commandes antérieures

| Commandes avant la première S2 | Utilisateurs |
|---|---:|
| 0 | 36 |
| 1 | 4 516 |

Les 36 cas sans commande antérieure visible sont des anomalies à contrôler : commande supprimée, statut filtré, date incohérente ou génération historique avant une modification de données.

### Ancienneté de la première commande au déclenchement

| Délai depuis la première commande | Non-convertis | Part | Retour sans S2 sous 14 jours* |
|---|---:|---:|---:|
| 4–6 jours | 772 | 17,0 % | **13,5 %** |
| 7–13 jours | 212 | 4,7 % | **11,8 %** |
| 14–29 jours | 332 | 7,3 % | 6,0 % |
| 30–59 jours | 497 | 10,9 % | 4,2 % |
| 60–89 jours | 442 | 9,7 % | 3,2 % |
| 90–179 jours | 750 | 16,5 % | 1,9 % |
| 180–364 jours | 753 | 16,5 % | 1,9 % |
| 365 jours et plus | 758 | 16,7 % | **0,9 %** |

\* Retour par une commande ultérieure sans conversion S2, parmi les utilisateurs disposant d’au moins 14 jours d’observation.

Le potentiel de retour diminue presque continuellement avec l’ancienneté. C’est la conclusion la plus forte de l’étude : **la récence explique davantage le comportement que le changement de type d’offre**.

### Panier de la première commande

- Panier moyen initial : **31,50 $**
- Panier médian initial : **27,14 $**

| Panier initial | Population mature à 14 jours | Retours sans S2 sous 14 jours | Taux |
|---|---:|---:|---:|
| Moins de 20 $ | 1 205 | 66 | **5,48 %** |
| 20–29,99 $ | 1 145 | 48 | 4,19 % |
| 30–39,99 $ | 788 | 29 | 3,68 % |
| 40 $ et plus | 1 072 | 35 | 3,26 % |

Les petits paniers reviennent davantage naturellement dans cette population. Cela ne prouve pas qu’ils répondraient mieux à l’offre, mais cela suggère qu’un seuil unique n’est pas optimal. Pour un client ayant dépensé moins de 20 $, un seuil de 35 $ était particulièrement irréaliste.

### Mode de commande initial

| Type enregistré | Utilisateurs | Part approximative |
|---|---:|---:|
| Ramassage (`pick up` + `pickup`) | 3 640 | 80,0 % |
| Livraison | 876 | 19,2 % |
| Non renseigné | 36 | 0,8 % |

La normalisation de `pick up` et `pickup` est à corriger dans les données. Le comportement S2 est très majoritairement associé au ramassage; une proposition adaptée à ce parcours peut être plus pertinente qu’un avantage générique.

## 5. Comportement après la première S2

Les retours ci-dessous concernent exclusivement les non-convertis S2. Ils peuvent avoir commandé naturellement, avec une autre promotion ou une autre stratégie.

| Fenêtre d’observation | Utilisateurs suffisamment matures | Retours observés | Taux |
|---|---:|---:|---:|
| 3 jours | 4 493 | 49 | 1,09 % |
| 7 jours | 4 411 | 97 | 2,20 % |
| 14 jours | 4 245 | 178 | 4,19 % |
| 30 jours | 3 883 | 238 | 6,13 % |

Sur l’ensemble de la population, 345 utilisateurs, soit 7,58 %, ont fini par repasser une commande après leur première activation S2 sans convertir S2. Parmi eux :

- délai médian avant retour : **11,4 jours**;
- délai moyen avant retour : **13,2 jours**.

Ces retours ne doivent pas être attribués à S2. Ils démontrent au contraire qu’une partie des clients revient sans utiliser l’avantage. Sans groupe témoin, il est impossible de savoir si S2 a accéléré leur retour, n’a eu aucun effet ou a simplement offert une réduction inutilement.

## 6. Surpression et répétition

| Nombre d’offres S2 activées par non-converti | Utilisateurs | Part |
|---|---:|---:|
| 1 | 262 | 5,8 % |
| 2 | 297 | 6,5 % |
| 3 | 238 | 5,2 % |
| 4 | 3 688 | **81,0 %** |
| 5 | 67 | 1,5 % |

La majorité a traversé plusieurs cycles ou variantes S2. Cette répétition a quatre risques :

1. fatigue notificationnelle;
2. apprentissage à attendre une promotion;
3. dilution de la nouveauté du cadeau;
4. gonflement artificiel du nombre d’offres générées et baisse mécanique du taux par offre.

Le cooldown S2 actuel de six jours est incompatible avec son rôle de jalon « deuxième commande ». Cette stratégie devrait être une séquence limitée, et non une offre répétitive indéfinie.

## 7. Accessibilité marketing actuelle

Parmi les 4 552 non-convertis :

- 4 047, soit **88,9 %**, sont actuellement marqués comme ayant l’application installée;
- 1 166, soit seulement **25,6 %**, disposent actuellement d’un jeton push;
- aucun n’est marqué comme désabonné des courriels.

`appIsInstalled` et le jeton sont des états actuels, pas nécessairement leur état lors de chaque offre. Le grand écart entre installation déclarée et jeton push suggère néanmoins un problème de joignabilité ou de qualité des données. Une offre non délivrée ne doit pas être comptée comme une impression marketing.

## 8. Typologie comportementale des non-convertis

### A. Nouveaux clients encore chauds — 4 à 13 jours

Ils représentent 21,6 % de la population. Leur taux de retour naturel à 14 jours est compris entre 11,8 % et 13,5 %.

**Lecture :** forte intention résiduelle; risque élevé de cannibalisation. Une offre coûteuse n’est pas forcément nécessaire.

**Traitement recommandé :** rappel de marque ou recommandation personnalisée, puis avantage léger uniquement pour le groupe test.

### B. Clients en décrochage — 14 à 59 jours

Ils représentent 18,2 %. Leur retour à 14 jours passe de 6,0 % à 4,2 %.

**Lecture :** vraie fenêtre d’intervention S2, mais le message doit rappeler la première expérience et réduire la friction.

**Traitement recommandé :** tester Churros dès 20 $ contre 15 % dès 20 $, avec une seule relance.

### C. Clients devenus inactifs — 60 à 179 jours

Ils représentent 26,2 %. Leur retour à 14 jours tombe entre 1,9 % et 3,2 %.

**Lecture :** ils ne sont plus dans une mécanique de création d’habitude.

**Traitement recommandé :** les sortir de S2 et les adresser par une stratégie de réactivation adaptée à la cause probable du départ.

### D. Clients anciens à achat unique — 180 jours et plus

Ils représentent 33,2 %. Leur retour à 14 jours est inférieur à 2 %, et tombe à 0,9 % au-delà d’un an.

**Lecture :** probabilité faible, coût d’opportunité et pression élevés.

**Traitement recommandé :** campagne de reconquête rare, groupe témoin important, puis arrêt après un échec.

## 9. Recommandation pour S2

### Ne pas changer immédiatement le type pour tout le monde

Le cadeau Churros n’est pas encore condamné : S4 montre qu’un cadeau comparable peut fonctionner dans un autre contexte. La priorité est de corriger la population et la fréquence.

### Nouvelle règle proposée

S2 devrait viser uniquement :

- exactement une commande historique;
- entre **4 et 29 jours** depuis cette commande;
- aucune S2 précédente, ou au maximum une relance contrôlée;
- avantage et seuil adaptés au panier initial;
- canal réellement joignable.

Les personnes à 30 jours et plus doivent sortir de S2 et entrer dans une stratégie de réactivation distincte.

### Expérimentation proposée

Sur les nouveaux éligibles, répartir aléatoirement :

| Groupe | Proposition | Objectif |
|---|---|---|
| Témoin | Aucun avantage, simple rappel | Mesurer le retour naturel |
| A | Churros dès 20 $, 48 h | Mesurer l’efficacité du cadeau actuel |
| B | 15 % dès 20 $, 48 h | Comparer cadeau et remise |
| C | Seuil personnalisé, environ panier initial + 10 % | Tester l’augmentation de panier |

Mesurer à 14 et 30 jours : deuxième commande incrémentale, marge incrémentale, panier, coût de l’avantage et troisième commande ultérieure.

## 10. Verdict

Le faible rendement historique de S2 ne permet pas de conclure simplement « les Churros ne fonctionnent pas ». Le portefeuille S2 a principalement envoyé une offre de deuxième commande à des clients qui, comportementalement, n’étaient souvent plus de nouveaux clients : **la moitié avait déjà au moins 90 jours d’inactivité**.

La première décision doit donc être de **séparer création d’habitude et réactivation**, limiter S2 dans le temps et empêcher les quatre expositions répétées. Ensuite seulement, un test contrôlé permettra de décider si le cadeau doit être remplacé par un pourcentage ou un rabais fixe.
