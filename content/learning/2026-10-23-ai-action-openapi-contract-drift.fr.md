+++
title = "Java senior et IA : dérive de contrat OpenAPI et catégories dynamiques"
date = 2026-10-23
draft = false
summary = "Distinguer les catégories en base, l'API réelle et le schéma d'une Action IA; prévenir les écarts par des tests de contrat."
tags = ["Java", "AI Agents", "OpenAPI", "API Contracts", "Integration Testing", "Architecture"]
categories = ["Apprentissage"]
showComments = true
+++

## Le problème concret

Une IA reconnaît des produits sur des photos promotionnelles. L'administration crée la catégorie `seafood`, mais l'Action IA pourrait encore utiliser une ancienne version du schéma OpenAPI. **Une catégorie présente en base n'est pas automatiquement reconnue par l'Action, ni acceptée par l'API en cours d'exécution.**

Le scénario s'inspire des discussions d'intégration de PromoLocal. Les extraits ci-dessous sont **pédagogiques** et ne décrivent pas une implémentation de production vérifiée. La version réellement enregistrée dans l'éditeur de l'Action n'a pas été confirmée.

## 1. Trois sources de vérité

1. **Base de données** : le slug `seafood` existe-t-il et est-il actif?
2. **API réelle** : quels champs accepte le POST, et comment vérifie-t-il les catégories?
3. **Contrat consommateur** : quel schéma OpenAPI l'Action IA a-t-elle chargé? Vérifier `operationId`, `enum`, champs obligatoires et authentification.

La **dérive de contrat** apparaît quand ces niveaux divergent. Un ancien `enum` peut empêcher l'IA de transmettre une valeur pourtant valide en base. À l'inverse, un champ `string` n'oblige pas le serveur à accepter n'importe quelle valeur.

## 2. Diagnostic étape par étape

1. Vérifier **en lecture seule** le slug et l'état actif; le libellé « Poissons et fruits de mer » n'est pas nécessairement le slug.
2. Examiner l'OpenAPI public : `info.version`, `servers`, chemin POST, `operationId`, champs requis, `enum` et sécurité.
3. Examiner le schéma **enregistré dans l'éditeur de l'Action IA** : ne pas présumer une actualisation automatique.
4. Tester dans un **environnement isolé** une catégorie active, inconnue et inactive, puis vérifier réponses et persistance.
5. Comparer les changements incompatibles : champ de requête devenu obligatoire, renommage, suppression, nouvelles valeurs d'énumération pour les clients stricts.

Le numéro de version ne remplace pas la comparaison structurelle ni les tests. Ne pas envoyer de données de test en production pour valider un contrat candidat.

## 3. Exemple OpenAPI (non productif)

~~~yaml
openapi: 3.1.0
info:
  title: Example Photo Deal Integration
  version: 2.1.0
paths:
  /integrations/photo-deals:
    post:
      operationId: create_photo_deal
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [categorySlug]
              properties:
                categorySlug:
                  type: string
                  description: Server validates active slugs
      responses:
        '201':
          description: Created
~~~

Sans `enum` statique, la validation métier reste obligatoire côté serveur. Une API réelle doit aussi documenter les erreurs, l'authentification et l'idempotence.

## 4. Java 17 : validation d'une catégorie dynamique

Le code suivant a été compilé et exécuté localement. Dans Spring Boot, un Repository peut fournir l'implémentation de `CategoryCatalog`.

~~~java
import java.util.Map;
import java.util.Optional;

record Category(String slug, boolean active) {}

interface CategoryCatalog {
    Optional<Category> findBySlug(String slug);
}

final class CategoryValidator {
    private final CategoryCatalog catalog;

    CategoryValidator(CategoryCatalog catalog) {
        this.catalog = catalog;
    }

    void requireActive(String slug) {
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("category is required");
        }
        Category category = catalog.findBySlug(slug)
            .orElseThrow(() -> new IllegalArgumentException("unknown category"));
        if (!category.active()) {
            throw new IllegalStateException("category is inactive");
        }
    }
}

class CategoryValidatorDemo {
    public static void main(String[] args) {
        Map<String, Category> rows = Map.of(
            "seafood", new Category("seafood", true),
            "archived", new Category("archived", false)
        );
        CategoryValidator validator = new CategoryValidator(
            slug -> Optional.ofNullable(rows.get(slug))
        );
        validator.requireActive("seafood");
        try {
            validator.requireActive("archived");
            throw new AssertionError("inactive category accepted");
        } catch (IllegalStateException expected) {
            System.out.println("inactive category rejected");
        }
    }
}
~~~

Le `Map` simule la base pour la démonstration; il ne faut pas figer les catégories de production dans le code. La vérification et l'écriture doivent respecter les frontières transactionnelles appropriées.

## 5. Pièges fréquents en entretien senior

- Une catégorie ajoutée dans l'admin n'est pas forcément connue de l'Action IA.
- Modifier `info.version` ne prouve pas la compatibilité du serveur.
- Supprimer un `enum` ne dispense pas de refuser les catégories inconnues ou inactives.
- Un HTTP réussi ne démontre pas à lui seul la bonne persistance ni l'absence de doublons.
- Un nouveau champ obligatoire brise souvent les anciens clients; une nouvelle valeur d'énumération peut aussi poser problème.

## 6. Question d'entretien senior (répondre avant de consulter une solution)

Le schéma sauvegardé d'une Action IA n'autorise que `grocery | household`. L'administration ajoute `seafood` et le serveur valide les catégories dynamiquement, mais l'Action ne peut toujours pas soumettre `seafood`.

**Quel est votre ordre de diagnostic? Pourquoi modifier seulement la base ou seulement l'OpenAPI ne prouve-t-il pas le fonctionnement de bout en bout?**

## 7. Exercice pratique de 15 minutes

1. Lire, sans modification, la version, l'operationId et la définition du champ de catégorie dans le schéma actuel.
2. Exécuter le Java ci-dessus et ajouter un test de catégorie inconnue.
3. Définir trois tests de contrat isolés : ancien client, nouvelle catégorie active, catégorie inconnue.
4. Noter les preuves, les résultats attendus et les résultats observés; indiquer « non vérifié » si nécessaire.

**Critère de réussite** : distinguer « présent en base », « accepté par l'API » et « connu par l'Action IA ».

## Conclusion

**Ajouter une catégorie modifie les données; modifier OpenAPI change le contrat; recharger une Action change la configuration du consommateur.** Chacune de ces étapes doit être vérifiée indépendamment.
