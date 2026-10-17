+++
title = "Spring Boot : tester le rollback après flush avec PostgreSQL"
date = 2026-10-16
draft = false
summary = "Testcontainers, save, flush, commit et tests d’intégration transactionnels."
tags = ["Java", "Spring Boot", "PostgreSQL", "Testcontainers", "Transactions"]
categories = ["Apprentissage"]
showComments = true
+++

## Sujet du jour

Après la leçon Testcontainers du 15 octobre, approfondir save, flush et commit, puis vérifier le rollback avec PostgreSQL réel. Durée visée : 45 à 60 minutes.

## Concepts clés

- **save()** : rend l’entité persistante; le moment de l’INSERT dépend notamment de la stratégie d’identifiant.
- **flush()** : synchronise les opérations SQL en attente avec la base, **sans commit**.
- **commit()** : valide la transaction; avant cela, les changements peuvent être annulés.
- Spring annule par défaut pour RuntimeException et Error non interceptées; les exceptions vérifiées nécessitent souvent rollbackFor.
- Les tests @Transactional gérés par Spring Test sont annulés par défaut et peuvent masquer la validation réelle du service.

## Pourquoi c’est important

Commandes, paiements et publications de prix exigent une frontière transactionnelle fiable. Exécuter SQL ne prouve pas que les données ont été validées. Vérifier l’exception et l’état final de la base.

## Exemple de code

Prérequis : Spring Boot 3.1+, Java 17+, JUnit 5, AssertJ, Spring Data JPA, JDBC PostgreSQL, Testcontainers et Docker. Définir Deal et DealRepository dans le projet d’exercice.

```java
@Service class DealService {
  private final DealRepository repo;
  DealService(DealRepository repo) { this.repo = repo; }
  @Transactional public void createThenFail() {
    repo.saveAndFlush(new Deal("Milk"));
    throw new IllegalStateException("failed");
  }
}
@SpringBootTest @Testcontainers
class DealRollbackIT {
  @Container @ServiceConnection
  static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16-alpine");
  @Autowired DealService service;
  @Autowired DealRepository repo;
  // No @Transactional on test: observe service transaction after rollback.
  @Test void rollbackAfterFlush() {
    long before = repo.count();
    assertThatThrownBy(() -> service.createThenFail())
        .isInstanceOf(IllegalStateException.class);
    assertThat(repo.count()).isEqualTo(before);
  }
}
```

Le test **n’utilise pas @Transactional** : on interroge la base après la fin du rollback du service. Isoler les données lors de tests parallèles.

## Pièges fréquents

1. Confondre flush et commit.
2. Vérifier seulement l’exception sans examiner la base.
3. Confondre le rollback automatique du test et celui du service.
4. Oublier l’auto-invocation qui contourne le proxy Spring AOP.
5. Croire qu’un rollback annule un courriel déjà envoyé.

## Question d’entrevue

Un service intercepté par le proxy transactionnel lance RuntimeException après saveAndFlush. La ligne reste-t-elle ? A. Oui, SQL a été exécuté; B. Non, rollback; C. Cela dépend de H2.

**Réponse B.** Flush n’est pas commit.

## Senior-level answer

Flush synchronise le contexte de persistance avec la base sans valider la transaction physique. Quand RuntimeException remonte à l’intercepteur transactionnel, Spring annule normalement la transaction, y compris l’INSERT. Avec une stratégie d’identifiant IDENTITY, save() peut lancer l’INSERT plus tôt; cela ne constitue pas un commit. REQUIRES_NEW, l’absence de proxy ou des règles personnalisées peuvent changer le résultat.

**Relance :** Pourquoi éviter @Transactional sur la méthode de test ? Pour observer l’état réel après la transaction du service plutôt que le rollback du cadre de test.

## Réflexion d’architecture

La transaction de base n’annule pas les effets externes comme un courriel. Pour les événements intersystèmes, envisager Transactional Outbox, nouvelles tentatives et idempotence.

## Exercice pratique

① Exécuter rollbackAfterFlush; ② ajouter un test de validation réussie; ③ essayer une exception vérifiée et rollbackFor. Critères : mvn test réussit, l’état final est vérifié, flush et commit sont distingués. Commencer par 20 à 30 minutes.

## Auto-évaluation

1. Flush est-il commit ? **Non.**
2. save() attend-il toujours le flush ? **Non.**
3. Exceptions annulées par défaut ? **RuntimeException et Error.**
4. Pourquoi éviter @Transactional sur ce test ? **Pour observer la transaction du service.**
5. Un rollback annule-t-il un courriel ? **Non.**

## Résumé

**SQL exécuté ≠ données validées.** Avant de dormir, revoir un concept, répondre à une question d’entrevue ou avancer 15 minutes sur le projet.
