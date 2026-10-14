# Smart Offers V2 — mécaniques

État du code au 12 octobre 2026 (branche de travail, pas encore déployée en prod).
Ce document décrit ce que le moteur sait faire : comment il profile les clients, les conditions disponibles, les méthodes de distribution, les types d'offres, le cycle de vie d'une offre et les règles appliquées au checkout. La section 10 liste les limites connues.

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Le scan et le profilage](#2-le-scan-et-le-profilage)
3. [Les conditions (ciblage)](#3-les-conditions-ciblage)
4. [Les méthodes de distribution](#4-les-méthodes-de-distribution)
5. [Les types d'offres](#5-les-types-doffres)
6. [Réglages communs à toutes les offres](#6-réglages-communs-à-toutes-les-offres)
7. [Cycle de vie d'une offre](#7-cycle-de-vie-dune-offre)
8. [Cooldown](#8-cooldown)
9. [Au checkout : règles de calcul et de cumul](#9-au-checkout--règles-de-calcul-et-de-cumul)
10. [Limites connues](#10-limites-connues)
11. [Où se trouve le code](#11-où-se-trouve-le-code)

---

## 1. Vue d'ensemble

```
Campagne (active / inactive)
└── Règle (DynamicRule)
    ├── conditions C1, C2, … + expression logique   → QUI est visé
    ├── poids                                        → priorité entre règles
    ├── méthode de distribution                      → QUELLE offre de la règle il reçoit
    └── offres (1 ou plusieurs configurations)       → QUOI, combien, quand, combien de temps
```

- Un client reçoit **une seule offre à la fois**. Tant qu'il a une offre en attente ou active (rabais en plusieurs fois en cours et récompense de cashback compris), il n'en reçoit pas d'autre.
- Si plusieurs règles correspondent à un client, **c'est la règle au poids le plus élevé qui gagne**. Les autres sont ignorées pour ce scan.
- Les règles sont évaluées sur des données **calculées au moment du scan** à partir de ses commandes, et non sur une fiche figée.

## 2. Le scan et le profilage

### 2.1 Quand le scan tourne

| Déclencheur | Qui est scanné | Détail |
|---|---|---|
| Chaque nuit à **00:00 (Toronto)** | Tous les clients non bannis | Par lots de 100, avec une pause de 200 ms entre les lots |
| **Après chaque commande confirmée** | Le client de la commande | Recalcul du cooldown, puis scan du client avec réévaluation de son offre en attente (voir 2.5) |
| **Manuellement** (dashboard, admin seulement) | Tous | Refusé (409) si le système est arrêté |

**Bouton « Smart offers : actives / arrêtées »** (clé `smartOfferCronEnabled`). À l'arrêt, plus aucun profilage ni création d'offre, que le scan soit nocturne, post-commande ou manuel. Les offres déjà créées continuent de vivre : activation, rappels, cashback et rabais en plusieurs fois.

### 2.2 Données lues pour chaque client

- **Commandes :** toutes celles qui ne sont pas annulées (y compris les non confirmées), de la plus récente à la plus ancienne.
- **Offres reçues :** celles des 90 derniers jours.
- **Compte :** points de fidélité, abonnement actif, app installée, date de création du compte, cooldown en cours.

### 2.3 Ce que calcule le profilage

Ces valeurs sont recalculées à chaque scan. Une partie est enregistrée dans `UserSmartProfile`, pour l'analyse.

| Mesure | Calcul |
|---|---|
| Nombre de commandes | Toutes les commandes non annulées |
| Commandes sur 7 / 14 / 30 / 60 / 90 jours | Comptage par fenêtre |
| Récence | Jours depuis la dernière commande (999 si aucune) |
| Cadence | **Médiane** des écarts entre deux commandes, en jours |
| Ratio récence / cadence | Récence ÷ cadence. Vaut 0 si le client a moins de 2 commandes. |
| Panier moyen (tout l'historique, et sur 90 jours) | Moyenne des sous-totaux avant rabais, avec leur écart-type |
| Heure préférée | Heure de commande la plus fréquente (Toronto) |
| Jour préféré | Jour de commande le plus fréquent (0 = dimanche … 6 = samedi) |
| Catégorie favorite (pour les offres) | Catégorie la plus achetée, articles des menus/combos compris, **hors PROMOS** : si PROMOS arrive en tête, c'est la catégorie suivante ; un client qui n'achète que des promos n'en a pas. Sert uniquement aux offres « catégorie favorite » (voir 6). Le critère de règle garde la vraie favorite (3.2). |
| Part de chaque catégorie sur 90 jours | Répartition des articles achetés |
| Âge du compte | Jours depuis l'inscription |
| Segment | Voir le tableau ci-dessous |
| Profil de réactivation | Voir le tableau ci-dessous |

**Segment.** Il est enregistré pour l'analyse, mais **ce n'est pas un critère de règle**.

| Segment | Condition (dans cet ordre) |
|---|---|
| `inactive` | Aucune commande |
| `reactivate` | Dernière commande il y a plus de 60 jours |
| `inactive` | Dernière commande il y a 30 à 60 jours |
| `very_active` | (1 commande ou plus sur 7 jours, ou 2 ou plus sur 14 jours) et dernière commande il y a 7 jours au plus |
| `loyal` | (3 commandes ou plus sur 30 jours, ou 5 ou plus sur 60 jours) et dernière commande il y a 14 jours au plus |
| `normal` | Tous les autres |

**Profil de réactivation.** Il est enregistré pour l'analyse, et ce **n'est pas non plus un critère de règle**.

| Profil | Condition |
|---|---|
| `early_risk` | 2 commandes ou plus, récence entre max(10 j, 0,8 × cadence) et 17 jours |
| `early_abandonment` | 1 ou 2 commandes, récence de 18 jours ou plus |
| `sudden_stop` | 3 commandes ou plus, cadence de 30 jours au plus, récence d'au moins max(18 j, 1,5 × cadence) |
| `low_frequency` | 3 commandes ou plus, cadence de plus de 30 jours, récence d'au moins 1,2 × cadence |
| `not_overdue` | A déjà commandé, aucun des cas ci-dessus |

### 2.4 Déroulé du scan pour un client

1. **Client sauté** s'il a déjà une offre en attente ou active. Exception : la réévaluation après une commande (2.5).
2. **Client sauté** s'il est en cooldown (section 8).
3. **Suite de scénario :** si sa dernière offre vient d'une règle « scénario » active qui a une étape suivante, il reçoit cette étape **sans réévaluer les conditions**. Voir 4.3.
4. **Sinon,** toutes les règles actives (de campagnes actives) sont évaluées. Chaque règle qui correspond propose une offre selon sa méthode de distribution.
5. Les offres « catégorie favorite » sont retirées si le client n'a pas de catégorie favorite.
6. **La règle au poids le plus élevé gagne.**
7. L'offre est créée en statut `prepared`, avec son heure de notification (6.3). Le cooldown du client est posé (section 8).

### 2.5 Après une commande confirmée

1. **Cooldown recalculé** si la commande a utilisé ou ignoré une offre (section 8).
2. **Le client est scanné** avec les mêmes règles que la nuit.
3. **S'il a une offre en attente d'activation** (pas encore vue par le client), elle est réévaluée avec ses nouvelles données :
   - **même règle choisie** → l'offre est gardée telle quelle ;
   - **autre règle** → l'offre passe en `replaced` et une nouvelle offre est créée ;
   - **plus aucune règle** → l'offre passe en `replaced` et le cooldown qu'elle avait posé est retiré.

Ne sont **jamais réévaluées** : une étape suivante de scénario (B, C…) et une récompense de cashback. L'étape de départ d'un scénario, elle, est réévaluée.

## 3. Les conditions (ciblage)

Une règle contient des conditions `C1`, `C2`… et une **expression logique** qui les combine, par exemple `(C1 OR C2) AND C3`.

- Sans condition, la règle vise **tout le monde**.
- Sans expression, toutes les conditions doivent être vraies (ET).
- L'expression accepte **AND, OR et les parenthèses**. **NOT n'existe pas.**

### 3.1 Opérateurs

| Opérateur | Sens | Dans le dashboard |
|---|---|---|
| `==` `!=` | Égal / différent (comparaison souple : « 5 » = 5) | Oui |
| `>` `>=` `<` `<=` | Comparaisons numériques | Oui |
| `in` / `not_in` | Fait partie (ou non) d'une liste de valeurs | **Non** : seulement par l'API ou un script |

### 3.2 Critères

**Période (`periodDays`)** : vide = tout l'historique, sinon les X derniers jours. Elle ne s'applique qu'aux critères marqués ✔.

| Critère | Valeur calculée | Période | Dashboard |
|---|---|---|---|
| `orders_count` | Nombre de commandes | ✔ | Oui |
| `orders_last_X_days` | Identique à `orders_count`, à utiliser avec une période | ✔ | Oui |
| `total_spent` | Somme des sous-totaux **avant rabais** | ✔ | Oui |
| `average_basket` | Sous-total moyen **avant rabais** (0 si aucune commande) | ✔ | Oui |
| `recency_days` | Jours depuis la dernière commande (999 si aucune) | ✔ | Oui |
| `average_days_between_orders` | **Médiane** des écarts entre commandes, en jours (999 si moins de 2 commandes) | — | Oui |
| `recency_to_cadence_ratio` | Récence ÷ cadence. **0 si moins de 2 commandes** | — | Oui |
| `account_age_days` | Jours depuis l'inscription | — | Oui |
| `fidelity_points` | Solde de points | — | Oui |
| `is_subscribed` | Abonnement Club actif (vrai/faux) | — | Non |
| `app_is_installed` / `has_app` | App non marquée comme désinstallée (vrai/faux). **Ne dit pas si le push fonctionne.** | — | Oui (`app_is_installed`) |
| `smart_offers_used` / `rewards_claimed` | Offres utilisées sur les 90 derniers jours | — | Oui |
| `smart_offers_conversion_rate` | % d'offres utilisées parmi les offres terminées (utilisées, expirées ou ignorées) sur 90 jours | — | Oui |
| `favorite_category` | Vraie catégorie la plus commandée (articles hors menus/combos), **PROMOS comprise** : permet de viser les clients promos | ✔ | Oui (une catégorie) |
| `favorite_item` | Article le plus commandé | ✔ | Oui (un article) |
| `preferred_day` | Jour le plus fréquent (0 = dimanche … 6 = samedi) | ✔ | Oui |
| `preferred_hour` | Heure la plus fréquente (0-23, Toronto) | ✔ | Oui |
| `open_rate` | **Toujours 0** (pas encore calculé) | — | Non |

### 3.3 Exemples de ciblages

| Objectif | Conditions |
|---|---|
| Inscrits sans commande depuis 3 jours ou plus | `orders_count == 0` ET `account_age_days >= 3` |
| Une seule commande, il y a 15-60 jours | `orders_count == 1` ET `recency_days >= 15` ET `recency_days <= 60` |
| En retard sur son rythme (1,25 à 2 fois) | `orders_count >= 2` ET `recency_to_cadence_ratio > 1.25` ET `recency_to_cadence_ratio <= 2` |
| Inactif depuis 91-180 jours | `orders_count >= 2` ET `recency_days > 90` ET `recency_days <= 180` |
| Fidèle, panier de 20-30 $ | `orders_count >= 6` ET `recency_to_cadence_ratio <= 1.25` ET `average_basket >= 20` ET `average_basket < 30` |
| Actif récent (2 commandes ou plus en 30 jours) | `orders_last_X_days >= 2` avec une période de 30 |

Pour `recency_to_cadence_ratio`, ajoutez toujours `orders_count >= 2` : sans cadence, le ratio vaut 0 et satisferait une condition « inférieur à ».

## 4. Les méthodes de distribution

La méthode choisit **quelle offre de la règle** le client reçoit. **Si la règle n'a qu'une offre, c'est toujours celle-là**, quelle que soit la méthode.

| Méthode | Dashboard | Fonctionnement |
|---|---|---|
| `priority` (par défaut) | Par défaut | Toujours la 1re offre de la liste |
| `weighted_random` | Oui | Tirage au sort selon le **poids** de chaque offre (ex. 70 / 30). Poids total à 0 → 1re offre. |
| `multi_armed_bandit` | Oui | A/B Testing IA (4.2) |
| `scenario_journey` | Oui | Parcours en étapes (4.3) |
| `waterfall` | Non (API) | Escalade : niveau 1, puis niveau suivant si l'offre n'est pas utilisée après `waterfallDelayDays` jours. Retour au niveau 1 après une utilisation. |
| `success_sequence` | Non (API) | Inverse : le niveau suivant n'est donné **que si** le précédent a été utilisé. Sinon, la même offre est redonnée. |
| `fatigue_control` | Non (API) | Si les 2 dernières offres de la règle sont identiques et non utilisées, une autre offre est donnée. |
| `engagement_split` | Non (API) | Prévu pour donner l'offre « standard » aux clients qui ouvrent leurs notifications et la dernière aux autres. **Comme `open_rate` vaut toujours 0, c'est toujours la dernière offre.** |

### 4.1 Tirage pondéré

Chaque offre de la règle a un poids. Avec des poids 70 / 30, chaque client a 70 % de chances de recevoir la première et 30 % la seconde.

### 4.2 A/B Testing IA (`multi_armed_bandit`)

- **Toutes les 2 semaines** (vérifié chaque soir à 23h30, Toronto), chaque règle A/B active est évaluée.
  - Pour chaque version d'offre : **taux = offres utilisées ÷ offres terminées (utilisées, expirées ou ignorées) sur 90 jours.**
  - Une **gagnante** n'est désignée que si **chaque version a au moins 20 résultats**.
  - Le résultat est enregistré sur la règle (`banditEvaluation` : date, gagnante, statistiques par version).
- **Au scan :**
  - avec une gagnante, elle est donnée **85 %** du temps, et une autre version les **15 %** restants, pour continuer à tester ;
  - sans gagnante (pas assez de données, ou gagnante retirée de la règle), les versions sont données **à parts égales**.

### 4.3 Scénario (`scenario_journey`)

Chaque offre est une **étape** : `stepId`, `isRoot` (étape de départ), `nextStepOnAccept` (étape suivante si l'offre est utilisée) et `nextStepOnIgnore` (étape suivante si elle est ignorée ou expire).

- **Entrée :** le client correspond à la règle et n'a pas d'étape en cours → il reçoit l'**étape de départ**.
- **Suite :** au scan suivant (après le cooldown), si sa **dernière offre** vient de ce scénario :
  - utilisée (`applied`) → `nextStepOnAccept` ;
  - expirée ou ignorée → `nextStepOnIgnore` ;
  - encore en attente ou active → on attend.
- **Le client va au bout de son scénario, même s'il ne correspond plus aux conditions.** Aucune autre règle ne peut le prendre pendant ce temps.
- **Fin du scénario** (pas d'étape suivante) → évaluation normale. S'il correspond encore à la règle, **le scénario recommence** à l'étape de départ. Sinon, il passe à la règle qui lui correspond.
- **Rabais en plusieurs fois dans un scénario :** il ne compte comme « utilisé » que si **toutes ses étapes** sont utilisées. Commencé puis pas terminé, il expire et compte comme **ignoré**. C'est voulu : le scénario prévoit une branche pour chaque cas.
- Une offre `replaced` (annulée avant activation) n'est jamais prise en compte pour savoir où en est le client.

## 5. Les types d'offres

« Dashboard » indique si le type est proposé dans le générateur de règles.

| Type | Dashboard | Ce que reçoit le client | Réglages propres |
|---|---|---|---|
| `discount_order` | Oui | % de rabais sur la commande | `discountValue` (%), `bonusThreshold` (minimum), `excludedCategories` |
| `discount_category` | Oui | % de rabais sur les articles d'une catégorie | `discountValue`, `targetCategory`, ou « catégorie favorite » (6.4) |
| `discount_product` | Oui | % de rabais sur un article (tous ses exemplaires du panier) | `discountValue`, `targetMenuItem` |
| `bonus_basket` | Oui | Rabais fixe en $ dès un minimum | `discountValue` ($), `bonusThreshold`, `excludedCategories` |
| `tiered_discount` | Oui | % selon le palier atteint (le plus haut atteint s'applique) | `tieredDiscounts` [{ seuil, % }], `excludedCategories` |
| `split_discount` | Oui | Rabais en plusieurs fois : un % par commande successive | `discountSteps` (ex. [25, 20, 20]), `bonusThreshold`, `followupValidityDays` (délai max entre deux commandes), `excludedCategories` |
| `deferred_cashback` | Oui | Dépenser X $ aujourd'hui → Y % sur une prochaine commande | `deferredThreshold` (ou `bonusThreshold`), `deferredDiscountValue` (%), `deferredActivationRule`, `deferredValidityDays`, `excludedCategories` (appliquées à la récompense) |
| `free_item` | Oui | Un article offert dès un minimum | `freeItems` [{ article, taille }] ou `freeItem`, `bonusThreshold` |
| `buy_one_get_one` | Oui | 1 acheté = 1 offert | `triggerItem` + `triggerItemSize` (article payant), `freeItem` + `giftItemSize` (cadeau), `bonusThreshold` |
| `loyalty_points` | Oui | Points bonus crédités à la confirmation | `bonusPoints`, `bonusThreshold` |
| `mystery_gift` | Oui | Un cadeau surprise dès un minimum | `mysteryThreshold`, article du menu lié (`freeItem` + `giftItemSize`) ou `mysteryItemName` |
| `free_delivery` | **Non** (retiré) | Livraison offerte | `bonusThreshold` |

### 5.1 Détail par type

**Base remisée des rabais en %** (`discount_order`, `split_discount`, `tiered_discount`, récompense de cashback). Le % s'applique aux **articles du panier seulement**. Sont exclus :
- les **menus/combos** du panier ;
- les **catégories exclues** de l'offre ;
- les articles **verrouillés promo**.

Si rien n'est remisable, l'offre ne donne rien, et l'app comme le site l'indiquent au client.

**`bonus_basket`** : rabais fixe, plafonné à la partie non exclue du panier. Un panier composé à 100 % de catégories exclues donne 0.

**`tiered_discount`** : le palier se choisit sur le sous-total complet. Le % s'applique à la base remisée ci-dessus.

**`split_discount`** :
- À chaque commande, on utilise l'étape en cours, puis on passe à la suivante.
- Délai pour la commande suivante : `followupValidityDays` jours (7 par défaut), jusqu'à 23h59 (Toronto) du dernier jour.
- Notifications : confirmation de chaque étape, et rappel 24 h avant l'expiration de l'étape en cours.
- Une commande annulée **rend l'étape**, sans prolonger le délai.
- Le cooldown part de la commande qui utilise la **dernière** étape.

**`deferred_cashback`** :
- **Étape 1 :** le client atteint le seuil sur sa commande. Le seuil est calculé **après** le -20 % de 1re commande ou le -15 % abonné, qui **restent appliqués**.
- **À la confirmation :** une **récompense** est créée. C'est un `discount_order` du % prévu, avec les catégories exclues de l'offre et sans minimum.
  - **Activation (`deferredActivationRule`) :**
    - `immediate` ;
    - `next_monday`, `next_tuesday`, …, `next_sunday` : le prochain jour visé, à **10h (Toronto)** ;
    - `next_weekend` : samedi 10h, ou tout de suite si on est déjà le week-end.
  - **Validité :** `deferredValidityDays` jours (7 par défaut) à partir de l'activation, jusqu'à 23h59 du dernier jour. Exemple : activation mardi 10h + 2 jours = jusqu'au jeudi 23h59.
  - **Notifications :** une confirmation tout de suite si l'activation est différée (« utilisable du … au … »), puis une notification le jour de l'activation (« Grâce à votre commande du … »).
- **Commande annulée :** la récompense en attente est supprimée, et l'offre de départ redevient active si elle est encore valide.

**`free_item`** :
- Le client ajoute le cadeau depuis l'app ou le site. La ligne est marquée « article offert » et seuls les suppléments sont payés.
- Si `freeItems` est vide, le serveur accepte `freeItem`, ou à défaut un article de `targetCategory`.

**`buy_one_get_one`** : il faut l'article déclencheur **payé** (taille comprise si elle est configurée) **et** le cadeau marqué « article offert ».

**`loyalty_points`** : aucun rabais. Les points sont ajoutés au solde à la confirmation, en plus des 10 points par dollar habituels.

**`mystery_gift`** : à partir du seuil, le nom du cadeau (celui de l'article lié, ou `mysteryItemName`) est enregistré sur la commande, et le restaurant le voit sur le ticket et dans le dashboard.

## 6. Réglages communs à toutes les offres

### 6.1 Validité et cooldown

| Réglage | Défaut | Rôle |
|---|---|---|
| `validityHours` | 48 | Durée de l'offre à partir de son activation, **arrondie à 23h59 (Toronto)** du dernier jour |
| `cooldownDays` | 7 | Délai sans nouvelle offre (section 8) |

### 6.2 Texte de la notification

`notificationTitle` et `notificationBody` acceptent ces variables :

| Variable | Remplacée par |
|---|---|
| `{name}` ou `{{name}}` | Prénom du client (« cher client » si inconnu) |
| `{category}` | Nom de la catégorie visée |
| `{item}` | Nom de l'article |
| `{discount}` | Valeur, avec % ou $ selon le type |
| `{points}` | Points bonus |
| `{threshold}` | Minimum d'achat (**« 30 » si l'offre n'a pas de minimum**, voir section 10) |

À l'envoi, la **date et l'heure exactes d'expiration** sont ajoutées au message (« … jusqu'au jeudi 9 octobre à 23 h 59 »).

### 6.3 Moment de la notification

| Réglage | Effet |
|---|---|
| Par défaut | Heure préférée du client − 1 h. Si le résultat tombe avant 8h ou après 21h → 11h. Client sans commande → 13h. |
| `notifyAtHour` (0-23) | Impose l'heure |
| `notifyOnDays` (0 = dim … 6 = sam) | Impose le ou les jours : prochain jour de la liste, à l'heure retenue |

Si l'heure est déjà passée au moment du scan, l'offre part **tout de suite**.

### 6.4 Autres réglages

| Réglage | Rôle |
|---|---|
| `excludedCategories` | Catégories non remisées. Pour : `discount_order`, `split_discount`, `bonus_basket`, `tiered_discount`, `deferred_cashback` (sur sa récompense). |
| `useFavoriteCategory` | Pour `discount_category` : vise la catégorie favorite calculée au profilage (jamais PROMOS). Si le client n'en a pas (il n'achète que des promos), l'offre n'est pas proposée. **Pas dans le dashboard.** |
| `weight` | Poids pour le tirage pondéré |
| `stepId`, `isRoot`, `nextStepOnAccept`, `nextStepOnIgnore` | Scénario |
| `waterfallLevel`, `waterfallDelayDays` | Escalade et suite après succès |

## 7. Cycle de vie d'une offre

```
prepared ──(heure de notification)──▶ active ──▶ viewed ──▶ clicked
    │                                   │           │          │
    │                                   └───────────┴──────────┴──▶ applied  (commande confirmée qui l'utilise)
    │                                                          ├──▶ ignored  (commande confirmée SANS l'utiliser, ou client qui l'ignore)
    │                                                          └──▶ expired  (fin de validité)
    └──▶ replaced (annulée ou remplacée avant activation, après une commande)
```

| Étape | Ce qui se passe |
|---|---|
| **Activation** (job chaque minute) | L'offre passe en `active`, avec `validFrom` = maintenant et `validUntil` = maintenant + validité (23h59). **Envoi : push** si le client a un jeton valide et l'app installée, **sinon courriel** s'il en a un et ne s'est pas désabonné. |
| **Rappel** (job toutes les 5 min) | Un push unique aux **2/3 de la validité**, si l'offre n'est ni utilisée ni expirée. Sans push possible, pas de rappel. |
| **Vue / cliquée** | Événements envoyés par l'app et le site |
| **Ignorée** | À la **confirmation d'une commande** qui n'utilise pas une offre déjà envoyée (active, vue ou cliquée). Le scan suivant fait la même vérification, en filet de sécurité. Une offre encore en attente n'est jamais ignorée. |
| **Expirée** | Au-delà de `validUntil` |
| **Reçus push** (job horaire) | Un appareil désinscrit marque l'app comme désinstallée. Les envois suivants passent par courriel. |

**Événements enregistrés :** `created`, `notified`, `reminder_notified`, `notif_clicked`, `viewed`, `clicked`, `applied`, `expired`, `ignored`.

Côté client, l'app et le site affichent l'offre active **la plus récente** dont la date de début est passée.

## 8. Cooldown

Le cooldown est une date par client (`smartOfferCooldownEndsAt`). Avant cette date, aucune nouvelle offre n'est créée pour lui.

| Moment | Fin du cooldown |
|---|---|
| **Attribution d'une offre** | Fin de validité de l'offre (23h59 Toronto) **+ son `cooldownDays`** |
| **Commande confirmée qui utilise ou ignore une offre** | **Date de confirmation + `cooldownDays`** (le plus long si plusieurs offres sont concernées). Remplace le cooldown précédent. |
| **Offre en attente annulée faute de règle** (2.5) | Cooldown retiré |

**Exemple :** offre de 48 h et cooldown de 2 jours.
- **Si elle est ignorée,** le client reçoit une nouvelle offre environ 4 jours après l'attribution.
- **Si elle est utilisée le lendemain,** il reçoit la suivante 2 jours après sa commande.

## 9. Au checkout : règles de calcul et de cumul

### 9.1 Ce qui se cumule

| Avec une smart offer… | Règle |
|---|---|
| Code promo | **Jamais** : une seule réduction de ce type par commande |
| -20 % de 1re commande, -15 % abonné | **Remplacés** par l'offre. **Exception : l'étape 1 du cashback**, qui s'y ajoute. |
| Une autre smart offer | Impossible : une seule offre par commande |
| Livraison gratuite de l'abonné, article mensuel du Club, cadeau d'anniversaire | Indépendants de l'offre |

### 9.2 Quand l'offre s'applique

L'app et le site utilisent **une seule règle** (`isSmartOfferAppliedToOrder`) pour décider à la fois d'envoyer l'offre avec la commande et de retirer, ou non, le -20 % / -15 % du total.

| Type | L'offre s'applique si… |
|---|---|
| Rabais (`discount_*`, `bonus_basket`, `tiered_discount`, `split_discount`) | Minimum atteint **et** au moins un article réellement remisé |
| `free_item` | Cadeau débloqué **et choisi** dans le panier |
| `buy_one_get_one` | Article déclencheur payé présent **et** cadeau choisi |
| `mystery_gift` | `mysteryThreshold` atteint |
| `free_delivery` | En livraison, et la livraison est payante sans l'offre |
| `deferred_cashback` | Seuil atteint après le -20 % / -15 % |
| `loyalty_points` | Minimum atteint |

Le client peut aussi **désactiver l'offre** au checkout pour garder son rabais habituel.

### 9.3 Contrôle du serveur

Le serveur **recalcule** le rabais. La commande est acceptée si le sous-total après rabais envoyé correspond, **à 1 centime près** :
- **soit au montant avec l'offre** → commande avec l'offre ;
- **soit au montant avec les rabais habituels** (-20 % / -15 %), quand l'offre n'apporte rien ou que son seul avantage est un rabais sur le sous-total → commande **sans** l'offre, qui reste au client. À la confirmation, cette offre est considérée comme ignorée.

**La commande est refusée** si le montant ne correspond à aucune des deux, ou si les -20 % / -15 % se **cumulent** avec un avantage hors sous-total (article offert, 1 acheté = 1 offert, livraison, points, cadeau). Un « article offert » sans offre appliquée est aussi refusé.

### 9.4 À la confirmation

- L'offre passe en `applied`. Pour un rabais en plusieurs fois, c'est seulement à la dernière étape.
- Les autres offres envoyées non utilisées passent en `ignored`.
- **Points :**
  - **Base :** articles + menus/combos, réduite du -20 % ou du -15 % s'il y en a un. **Les rabais d'offre et de code promo ne réduisent pas les points.**
  - **Calcul :** 10 points par dollar de cette base, moins les points dépensés en récompenses, plus les points bonus de l'offre.
- **Cashback :** création de la récompense (5.1).
- **Part de Hedi :** 5 % du sous-total après rabais des commandes avec offre utilisée.
- **Ensuite :** recalcul du cooldown, puis scan du client (2.5).

**Commande annulée :** l'étape d'un rabais en plusieurs fois et la récompense de cashback sont rendues ou retirées. Pour les autres types, l'offre reste `applied`.

## 10. Limites connues

| # | Limite | Conséquence |
|---|---|---|
| 1 | **Pas de groupe témoin** | Impossible de prouver le gain réel d'une règle (commandes qui n'auraient pas eu lieu sans elle) |
| 2 | **Pas d'arrêt après N offres ignorées** | À la fin d'un scénario, un client qui ne répond pas recommence indéfiniment |
| 3 | La catégorie favorite est calculée de deux façons : le critère de règle (vraie favorite, PROMOS comprise, articles hors menus/combos) et le ciblage des offres « catégorie favorite » (hors PROMOS, menus/combos compris ; liste dans `utils/favoriteCategory.js`) | Pour un même client, la règle peut le viser comme « favorite PROMOS » tandis que l'offre remise sa catégorie suivante. C'est voulu. |
| 4 | Pas de critère « part des commandes le week-end » ni « part des commandes 100 % promos » | `preferred_day` et `favorite_category` ne sont que des approximations : environ 46 % et 36 % de bons ciblages |
| 5 | **Les profils non complétés sont scannés** | Ils peuvent recevoir des offres « 0 commande » |
| 6 | `app_is_installed` ne garantit pas que le **push** passe | Aucun critère « joignable par push ». La 1re notification passe par courriel si besoin, mais les rappels non. |
| 7 | `open_rate` vaut toujours 0 | Critère inutile, et `engagement_split` donne toujours la dernière offre |
| 8 | `recency_to_cadence_ratio` vaut 0 sous 2 commandes | Toujours ajouter `orders_count >= 2` |
| 9 | Expression logique : pas de NOT. Un identifiant qui contient « AND » ou « OR » (ex. `SCORE`) est cassé. Un critère inconnu vaut « vide », et `!=` devient alors vrai. | Garder des identifiants `C1`, `C2`… |
| 10 | **Dates et priorité des campagnes non utilisées** | Seul « campagne active » compte |
| 11 | `{threshold}` sans minimum affiche « 30 » | Ne pas utiliser `{threshold}` dans une offre sans minimum |
| 12 | Le BI compte **10 points = 1 $** | La vraie valeur est d'environ **100 points = 1 $** (prix des récompenses) : le coût des offres en points y est surévalué d'environ 10 fois |
| 13 | Le dashboard n'expose pas `in` / `not_in`, `is_subscribed`, `useFavoriteCategory`, ni les méthodes `waterfall`, `success_sequence`, `fatigue_control`, `engagement_split` | Uniquement par l'API ou un script |
| 14 | Le dashboard annonce une activation du cashback à **11h**, le serveur active à **10h** | Libellé à corriger |
| 15 | `total_spent` et `average_basket` utilisent le sous-total **avant** rabais, et toutes les commandes non annulées (y compris non confirmées) | À garder en tête pour les seuils |

## 11. Où se trouve le code

| Sujet | Fichier (serveur) |
|---|---|
| Modèle des règles et des offres configurées | `models/DynamicRule.js`, `models/Campaign.js` |
| Offre attribuée à un client | `models/PersonalizedOffer.js`, `models/PersonalizedOfferEvent.js` |
| Profil enregistré | `models/UserSmartProfile.js` |
| Scan et profilage | `services/smartOffersV2/ProfilingService.js` |
| Conditions | `services/smartOffersV2/RuleEvaluatorService.js` |
| Distribution et scénarios | `services/smartOffersV2/OfferDistributionService.js` |
| Évaluation A/B toutes les 2 semaines | `services/smartOffersV2/BanditOptimizationService.js` |
| Cooldown | `services/smartOffersV2/OfferCooldownService.js` |
| Après une commande | `services/smartOffersV2/PostOrderTriggerService.js` |
| Cashback | `services/smartOffersV2/DeferredCashbackService.js` |
| Rabais en plusieurs fois (notifications) | `services/smartOffersV2/SplitDiscountNotificationService.js` |
| Activation, rappels, reçus push | `jobs/personalizedOfferCron.job.js` |
| Horaires du scan et de l'A/B | `jobs/smartOffersV2Cron.job.js` |
| Contrôle au checkout | `services/ordersServices/createOrderService.js`, `utils/personalizedOfferAmountCheck.js`, `utils/discountOrderAmount.js` |
| Confirmation (statuts, points, cashback) | `services/ordersServices/confirmOrderService.js` |
| BI | `services/smartOffersV2/SmartOffersBIService.js` |
| Règle « l'offre s'applique » (app et site) | `src/utils/smartOfferHandlers.js` (fichier identique dans `courteaux-client` et `courteau-web-client`) |
| Générateur de règles | `courteau-dashboard-web/src/components/smart-offers/VisualRuleBuilder.jsx` |
