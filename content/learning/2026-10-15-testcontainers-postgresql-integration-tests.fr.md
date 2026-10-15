+++
title = "De H2 à Testcontainers : tester Spring Boot avec un vrai PostgreSQL"
date = 2026-10-15
draft = false
summary = "Tests d’intégration avec Spring Boot 3, JUnit 5 et PostgreSQL réel, et limites des transactions de test."
tags = ["Java", "Spring Boot", "PostgreSQL", "Testcontainers", "Testing"]
categories = ["Apprentissage"]
showComments = true
+++

## Sujet du jour
**Objectif (45 à 60 minutes) :** partir de H2 pour exécuter un vrai PostgreSQL avec Testcontainers et tester Spring Data JPA. Prérequis : JUnit 5, Spring Boot et Repository.

## Concepts clés
H2 est une vraie base de données qui exécute réellement du SQL, mais son moteur **n’est pas PostgreSQL**. Testcontainers gère des conteneurs de test; ce n’est pas une base de données. Un test d’intégration vérifie la collaboration entre Spring, Hibernate, JDBC et la base, plutôt qu’une réponse simulée avec Mockito.

## Pourquoi c’est important
Les fonctionnalités PostgreSQL telles que `JSONB`, `ON CONFLICT`, les verrous, l’isolation et les dialectes SQL ne sont pas toujours fidèlement reproduites par H2. Des tests verts ne garantissent pas le bon fonctionnement en production.

## Exemple de code
Hypothèses : **Spring Boot 3.1+, Java 17+, JUnit 5 et Docker disponible**. Ajouter également `spring-boot-starter-data-jpa`, le pilote PostgreSQL JDBC et `spring-boot-starter-test`; choisir des versions Testcontainers compatibles avec le BOM Spring Boot.

```xml
<!-- Spring Boot 3.x + JUnit 5: choose compatible current versions via your BOM -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-testcontainers</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>postgresql</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>junit-jupiter</artifactId>
  <scope>test</scope>
</dependency>
```

```java
@SpringBootTest
@Testcontainers
class DealRepositoryIT {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired DealRepository deals;

    @Test
    void persistsAndReadsDeal() {
        Deal saved = deals.saveAndFlush(new Deal("Milk"));
        assertThat(deals.findById(saved.getId())).isPresent();
    }
}
```

`Deal(String name)` et `DealRepository` sont des classes métier à définir dans le projet d’exercice. Sans `@ServiceConnection`, on peut utiliser `@DynamicPropertySource` pour fournir les paramètres JDBC.

## Pièges fréquents
1. Dire que H2 simule le SQL : H2 exécute réellement les requêtes.
2. Croire que Testcontainers vérifie automatiquement les règles métier : les assertions restent essentielles.
3. Tester un commit réel avec un test `@Transactional` qui sera annulé par défaut.
4. Ne pas appliquer les migrations Flyway/Liquibase utilisées en production.
5. Confondre démarrage du conteneur et réussite des tests CI.

## Question d’entrevue
**Question :** Pourquoi des tests Repository réussis sur H2 ne prouvent-ils pas que PostgreSQL fonctionnera en production? Comment améliorer la stratégie?

## Senior-level answer
Les deux moteurs diffèrent sur les types, contraintes, verrous, transactions et dialectes SQL. Garder les tests unitaires rapides, mais exécuter les tests sensibles à la base avec Testcontainers + PostgreSQL, appliquer les vraies migrations et vérifier les contraintes, rollback et accès concurrents. Prévoir Docker en CI, l’isolation des données et le coût de démarrage.

**Relance 1 :** `saveAndFlush()` signifie-t-il commit? **Non**, flush envoie les instructions SQL sans garantir le commit.

**Relance 2 :** Comment tester deux demandes concurrentes sur la même tâche? **Utiliser des transactions/connexions distinctes avec un UPDATE conditionnel et vérifier qu’une seule ligne est modifiée une fois.**

## Réflexion d’architecture
A : H2 seulement, rapide mais moins fidèle aux particularités PostgreSQL. B : PostgreSQL pour chaque test, plus fidèle mais plus coûteux. Préférer une approche graduée : JUnit/Mockito pour la logique pure, Testcontainers pour Repository et transactions, quelques tests API complets. Pour la concurrence, utiliser des transactions indépendantes et des assertions explicites.

## Exercice pratique
Dans un **projet d’exercice Spring Boot + PostgreSQL** (sans présumer que PromoLocal utilise Java) :
1. Ajouter les dépendances de test et vérifier Docker.
2. Créer une entité `Deal` minimale et son Repository.
3. Tester la sauvegarde, la lecture et une violation de contrainte unique avec Testcontainers.
4. Comparer la durée, les requêtes SQL et les erreurs observées avec H2.

**Critères d’acceptation :** `mvn test` réussit; savoir identifier le test utilisant PostgreSQL réel et expliquer `flush` versus `commit`. Prévoir au moins 20 à 30 minutes.

## Auto-évaluation
1. H2 exécute-t-il du vrai SQL? **Oui.**
2. Testcontainers est-il une base? **Non, un outil de conteneurs.**
3. À quoi sert `@ServiceConnection`? **À fournir les informations de connexion à Spring Boot.**
4. `saveAndFlush()` équivaut-il à commit? **Non.**
5. Pourquoi utiliser des transactions distinctes pour la concurrence? **Pour reproduire la compétition entre connexions.**

## Résumé
**Le test d’intégration valide la collaboration des composants, pas l’utilisation d’un outil précis.** Révision minimale : expliquer H2 contre Testcontainers et `flush ≠ commit`.