+++
title = "Transitions d’état atomiques et mises à jour conditionnelles avec Spring"
date = 2026-10-11
draft = false
summary = "Utiliser une mise à jour conditionnelle en base de données pour sécuriser les transitions d’état concurrentes et comprendre les limites de @Transactional, du verrouillage optimiste et de l’idempotency."
tags = ["Java", "Spring Boot", "SQL", "Transactions", "Concurrency", "Idempotency"]
categories = ["Apprentissage"]
showComments = true
+++

## Sujet du jour

Dans un backend Spring Boot, `@Transactional` garantit une frontière transactionnelle pour un ensemble d’opérations de base de données, mais il n’empêche pas automatiquement deux processus, deux Pods ou deux requêtes concurrentes de lire la même ligne en état `PENDING` puis de poursuivre tous les deux le traitement.

Aujourd’hui, nous étudions un pattern très utile de contrôle de concurrence : **mise à jour conditionnelle (conditional update) + transition d’état atomique (atomic state transition)**.

L’objectif est de laisser la base de données décider qui obtient réellement la tâche, au lieu de dépendre d’un verrou en mémoire dans la JVM.

## Concepts clés

Supposons que `product_scan` utilise les états suivants :

`PENDING -> FETCHING -> COMPLETED / FAILED`

Il faut éviter de faire d’abord un `SELECT`, puis un `UPDATE` sans condition :

```text
SELECT status FROM product_scan WHERE id = ?;
// status == PENDING
UPDATE product_scan SET status = 'FETCHING' WHERE id = ?;
```

Deux requêtes peuvent lire `PENDING` au même moment.

Une approche plus robuste consiste à intégrer la précondition directement dans le SQL :

```sql
UPDATE product_scan
SET status = 'FETCHING',
    updated_at = CURRENT_TIMESTAMP
WHERE id = :id
  AND status = 'PENDING';
```

La base de données effectue atomiquement « vérifier l’ancien état + écrire le nouvel état ». L’application inspecte ensuite le nombre de lignes modifiées :

- `1` : la transition a réussi; le traitement peut continuer.
- `0` : l’état a déjà changé ou la ligne n’existe pas; la requête courante ne doit pas agir comme si elle avait obtenu la tâche.

## Pourquoi c’est important

Ce pattern convient aux états de commandes, paiements, jobs en arrière-plan, réservations de stock, traitements de fichiers, crawlers et consommateurs de messages.

Le point essentiel est le suivant : **la transition d’état fait partie des invariants métier (business invariants)**.

Par exemple, seul `PENDING` peut passer à `FETCHING`. Cette règle doit être garantie par du logiciel déterministe et par la base de données, et non par des logs, un bouton frontend, un LLM, un verrou local en mémoire ou l’hypothèse que « deux requêtes n’arriveront probablement pas en même temps ».

Dans un déploiement multi-instance, `synchronized` ou `ReentrantLock` ne protège qu’une seule JVM. Une mise à jour conditionnelle en base de données coordonne toutes les instances utilisant la même base.

## Exemple de code

Avec Spring Data JPA :

```java
public interface ProductScanRepository extends JpaRepository<ProductScan, Long> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update ProductScan s
           set s.status = :nextStatus,
               s.updatedAt = CURRENT_TIMESTAMP
         where s.id = :id
           and s.status = :expectedStatus
        """)
    int transitionStatus(
        @Param("id") Long id,
        @Param("expectedStatus") ScanStatus expectedStatus,
        @Param("nextStatus") ScanStatus nextStatus
    );
}
```

Service :

```java
@Transactional
public void startFetching(Long id) {
    int updated = repository.transitionStatus(
        id,
        ScanStatus.PENDING,
        ScanStatus.FETCHING
    );

    if (updated == 0) {
        throw new ScanStateConflictException(id);
    }
}
```

La couche REST peut convertir ce conflit métier en `409 Conflict` :

```java
@ExceptionHandler(ScanStateConflictException.class)
ResponseEntity<ApiError> handleConflict(ScanStateConflictException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(new ApiError("SCAN_STATE_CONFLICT", ex.getMessage()));
}
```

Attention : si un appel API externe doit être exécuté après la transition, il vaut mieux éviter de garder une transaction de base de données ouverte pendant un long appel HTTP. Une approche courante consiste à claim la tâche dans une transaction courte, exécuter l’appel distant hors transaction, puis enregistrer `COMPLETED` ou `FAILED` avec une nouvelle transition contrôlée.

## Pièges fréquents

1. Croire que `@Transactional` élimine les courses concurrentes. Une transaction définit une frontière, mais plusieurs transactions peuvent s’exécuter en parallèle.
2. Lire l’état, faire `if (status == PENDING)` dans Java, puis lancer un update inconditionnel. C’est un classique check-then-act race condition.
3. Continuer à appeler un service externe après l’échec de la transition, ce qui peut dupliquer un traitement ou une facturation.
4. Garder une transaction ouverte pendant un long appel distant, ce qui augmente la durée des locks, l’occupation du pool de connexions et la complexité de reprise.
5. Retourner `500` pour tous les échecs. Quand l’état courant de la ressource rend l’opération invalide, `409 Conflict` est souvent plus précis.

## Question d’entrevue

**Question :** Deux instances Spring Boot essaient en même temps de faire passer la même ligne de `PENDING` à `FETCHING`. Les deux méthodes sont annotées `@Transactional`. Pourquoi une concurrence reste-t-elle possible, et comment concevriez-vous la solution ?

## Senior-level answer

`@Transactional` définit une frontière transactionnelle; ce n’est pas un mutex distribué. Deux instances peuvent démarrer deux transactions indépendantes et observer presque simultanément le même état métier.

Je commencerais par encoder la transition autorisée dans une seule instruction SQL atomique :

```sql
UPDATE ... WHERE id = ? AND status = 'PENDING'
```

Le nombre de lignes affectées devient alors la source de vérité pour savoir qui a obtenu le droit d’exécuter la suite. Cette approche ne dépend pas d’un verrou JVM et fonctionne entre plusieurs instances.

Si le domaine se prête mieux aux modifications d’entités, on peut utiliser un optimistic locking avec `@Version`; en cas de conflit, on capture `OptimisticLockException` et on choisit entre retry et retour d’un conflit. Un pessimistic lock avec `SELECT ... FOR UPDATE` peut être approprié lorsqu’il faut lire et verrouiller un état complexe dans une courte transaction, mais il faut évaluer le débit et le risque de deadlocks.

En production, je vérifierais aussi :

- si l’opération est idempotente;
- si un effet externe peut se produire deux fois;
- la stratégie de retry;
- la récupération des tâches bloquées en `FETCHING`;
- les logs, métriques et traces des transitions;
- les index nécessaires pour le modèle d’accès `id + status`;
- la séparation entre conflit métier et panne système dans les codes d’erreur.

## Réflexion d’architecture

Une machine à états fiable doit résoudre non seulement « qui a gagné l’update », mais aussi « que se passe-t-il si le processus meurt après avoir gagné ? ».

Par exemple :

1. A réussit `PENDING -> FETCHING`.
2. A plante avant d’appeler le service distant.
3. La tâche reste bloquée en `FETCHING` pour toujours.

Une conception de production ajoute donc souvent une notion de lease/timeout : `claimed_at`, `claimed_by` ou `lease_until`. Un job de récupération peut remettre en état retryable les tâches `FETCHING` dépassant un seuil.

Il faut aussi séparer clairement les responsabilités : la base de données et le logiciel déterministe gèrent l’état, le temps, les permissions, les idempotency keys et les règles métier critiques. Si un AI/LLM participe au flux, il peut extraire des données non structurées, classifier, expliquer ou proposer du texte, mais il ne doit pas devenir la source de vérité pour un paiement, l’exécution d’un job ou une transition d’état autorisée.

## Exercice pratique

Dans votre projet Spring Boot, implémentez une API de transition pour `ProductScan` :

```text
POST /api/v1/product-scans/{id}/fetch
```

Exigences :

1. Seul `PENDING` peut passer à `FETCHING`.
2. Utiliser une seule mise à jour conditionnelle SQL/JPA.
3. Retourner `409 Conflict` lorsque le nombre de lignes modifiées vaut `0`.
4. Écrire un test concurrent avec deux requêtes simultanées et vérifier qu’une seule réussit.
5. Ajouter des logs structurés : `scanId`, ancien état, état cible, résultat.
6. Concevoir un mécanisme de récupération pour les tâches `FETCHING` expirées.

Bonus : comparer conditional update et `@Version` optimistic locking en termes de complexité du code, sémantique des conflits et cas d’usage.

## Auto-évaluation

1. Pourquoi `@Transactional` n’empêche-t-il pas deux instances distinctes de concurrencer sur la même ligne ?
2. Pourquoi `UPDATE ... WHERE status = 'PENDING'` élimine-t-il le check-then-act race condition ?
3. Pourquoi ne faut-il pas poursuivre le traitement si le nombre de lignes modifiées vaut `0` ?
4. Dans quels cas choisir conditional update, optimistic locking ou pessimistic locking ?
5. Comment récupérer un job si l’application plante après son passage à `FETCHING` ?

## Résumé

**Ne traitez pas `@Transactional` comme un verrou de concurrence.** Pour une machine à états simple, encodez l’ancien état autorisé dans le `WHERE`, laissez la base de données arbitrer la transition et utilisez le nombre de lignes modifiées pour déterminer qui possède réellement le droit d’exécuter la suite. Complétez ensuite avec idempotency, récupération par timeout et observability.