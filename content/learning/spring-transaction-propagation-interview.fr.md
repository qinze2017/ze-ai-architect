+++
title = "Transactions Spring Boot : REQUIRES_NEW, rollback et UnexpectedRollbackException"
date = 2026-10-13
draft = false
summary = "Révision des tests d’intégration, de REQUIRED, REQUIRES_NEW, rollback-only et des pièges des proxies Spring."
tags = ["Java", "Spring Boot", "Transactions", "Testing"]
categories = ["Apprentissage"]
showComments = true
+++

## Sujet du jour
Propagation, validation et annulation des transactions déclaratives Spring. **Complément thématique** aux articles Outbox déjà publiés aujourd’hui.

## Concepts clés
- **Test unitaire** : isole généralement une classe avec Mockito.
- **Test d’intégration** : vérifie Repository, Hibernate, JDBC et base de données ensemble. H2 exécute réellement du SQL, mais ne reproduit pas exactement PostgreSQL; Testcontainers peut démarrer un vrai PostgreSQL.
- **Transaction de test** : une transaction gérée par Spring Test avec `@Transactional` est annulée par défaut, même si les assertions réussissent.
- **REQUIRED** : rejoint la transaction existante, ou en crée une.
- **REQUIRES_NEW** : suspend la transaction externe et ouvre une transaction physique indépendante.
- **rollback-only** : une transaction partagée marquée pour annulation reste marquée même après un `catch`.

## Pourquoi c’est important
Les flux de commande, paiement, audit et Outbox exigent une compréhension précise des frontières transactionnelles. Une transaction d’audit indépendante peut aussi nécessiter une connexion supplémentaire.

## Exemple de code

```java
@Service
class OrderService {
  private final AuditService auditService;
  private final OrderRepository orders;
  OrderService(AuditService auditService, OrderRepository orders) {
    this.auditService = auditService; this.orders = orders;
  }
  @Transactional
  public void create() {
    orders.save(new Order());
    auditService.record();
    throw new IllegalStateException("Order failed");
  }
}
@Service
class AuditService {
  private final AuditRepository audits;
  AuditService(AuditRepository audits) { this.audits = audits; }
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void record() { audits.save(new AuditLog()); }
}
```

Si `record()` se termine normalement, puis que la transaction externe échoue avec une exception non interceptée, **Order est annulé tandis qu’AuditLog reste validé**. Cela suppose que l’audit ne dépend pas d’une commande non validée et que les proxies et gestionnaires de transactions sont correctement configurés.

## Pièges fréquents
1. L’appel interne `this.record()` contourne le proxy Spring AOP par défaut : `REQUIRES_NEW` n’est pas appliqué.
2. Voir une donnée pendant un test `@Transactional` ne prouve pas qu’elle a été validée.
3. Une transaction indépendante qui référence une commande non validée peut rencontrer une contrainte de clé étrangère ou un verrou.
4. Intercepter une exception ne supprime pas le marqueur rollback-only.

## Question d’entrevue
**Question :** Une méthode `@Transactional` appelle une méthode `@Transactional(REQUIRED)` d’un autre bean. Cette dernière lance une `RuntimeException`; la méthode externe l’intercepte puis enregistre un paiement. Le commit réussit-il?

## Senior-level answer
**Habituellement non.** L’intercepteur transactionnel interne marque la transaction physique partagée rollback-only. Au commit externe, Spring annule la transaction et lève normalement `UnexpectedRollbackException`. Cela suppose un appel passant par le proxy, le même gestionnaire transactionnel et les règles de rollback par défaut. Il faut revoir la frontière métier, plutôt que simplement masquer l’exception.

**Relance 1 :** Pourquoi `REQUIRES_NEW` peut-il saturer le pool? La transaction externe peut conserver sa connexion pendant que l’interne en demande une autre.

**Relance 2 :** Une requête HTTP avec `@SpringBootTest(RANDOM_PORT)` est-elle annulée par la transaction du test? Habituellement non : le serveur exécute ses propres transactions.

## Réflexion d’architecture
Pour conserver un audit même si la commande échoue : A. même transaction (cohérence forte, mais audit annulé); B. transaction indépendante (audit conservé, mais attention aux données non validées). Pour la livraison fiable d’événements externes, envisager Transactional Outbox, avec livraison au moins une fois et idempotence.

## Exercice pratique
Dans un **projet d’exercice Spring Boot + PostgreSQL** (sans supposer que le backend PromoLocal est en Java), créer avec Testcontainers deux tests : ① échec externe et conservation d’AuditLog; ② exception interne REQUIRED interceptée, puis `UnexpectedRollbackException` au commit. Vérifier les lignes en base et les exceptions, puis nettoyer les données. Durée : 20 à 30 minutes.

## Auto-évaluation
1. H2 exécute-t-il réellement du SQL? **Oui.**
2. Testcontainers est-il une base de données? **Non, il gère des conteneurs.**
3. REQUIRED contre REQUIRES_NEW? **Transaction partagée contre indépendante.**
4. Un `catch` efface-t-il rollback-only? **Non.**
5. Pourquoi l’auto-invocation est-elle risquée? **Elle contourne le proxy par défaut.**

## Résumé
**Exception interceptée ≠ transaction validable; retour normal ≠ données persistées.** Révision minimale : expliquer `UnexpectedRollbackException` avec ses propres mots.