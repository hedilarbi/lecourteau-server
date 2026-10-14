# Scénarios Smart Client

Les règles préfixées `[TEST SMART CLIENT]` sont créées par :

```bash
npm run smart-client:seed-test-scenarios
```

La commande est idempotente : elle remplace uniquement les règles portant ce préfixe et conserve les autres règles.

| # | Scénario | Parcours principal | Résultat attendu |
|---|---|---|---|
| 01 | Sauvetage après retrait | Panier ≥ 15 $, afficher le total puis retirer l’article configuré | Offre de sauvetage A/B avec chrono au checkout |
| 02 | Prix fixe taille supérieure | Compte avec commande/favori, ramassage, réduire une taille puis ouvrir le checkout | Proposition de taille supérieure, variante automatique |
| 03 | Cashback fidélité | Compte avec ≥ 3 commandes, terminer une commande | Cashback sur l’écran de confirmation |
| 04 | Rabais contexte livraison | Démarrer une session en livraison sur l’app | Rabais contextuel selon taux/groupe témoin |
| 05 | Suggestion catégorie manquante | Visiter une catégorie sans la catégorie ciblée au panier | Suggestion de catégorie jusqu’à dimanche |
| 06 | Assistance après inactivité | Rester inactif 30 s, osciller, échouer un code ou quitter le checkout | Message d’aide sans rabais |
| 07 | Article gratuit réactivation | Compte âgé d’au moins 30 jours, nouvelle session | Article favori gratuit valable 48 h |
| 08 | Article offert au seuil | Panier ≥ 30 $, ≥ 2 articles et catégorie requise | Article offert pendant 10 min |
| 09 | BOGO après interaction | Cliquer rapidement avec un article au panier | Deuxième article à 50 % |
| 10 | Rabais sur catégorie | Être sur une catégorie ciblée et modifier le panier | Rabais fixe appliqué à la catégorie |

Avant chaque scénario d’offre, refuser, convertir ou laisser expirer toute offre Smart Client déjà active : une seule exposition active est autorisée par utilisateur.
