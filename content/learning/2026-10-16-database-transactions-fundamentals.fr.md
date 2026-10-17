+++
title = "Comprendre les transactions : ACID, commit, rollback et propagation Spring"
date = 2026-10-16
draft = false
summary = "Les bases des transactions PostgreSQL et la différence entre REQUIRED et REQUIRES_NEW dans Spring Boot."
tags = ["Java", "Spring Boot", "Transactions", "PostgreSQL", "ACID"]
categories = ["Apprentissage"]
showComments = true
+++

## Sujet du jour

**Objectif (20 à 30 minutes)** : comprendre une transaction de base de données, `COMMIT`, `ROLLBACK`, ACID et les propagations Spring `REQUIRED` et `REQUIRES_NEW`. Complément aux tests de rollback étudiés aujourd'hui.

## Concepts clés

Une transaction est une unité logique de travail gérée par la base de données : ce n'est ni une méthode Java ni nécessairement une seule requête SQL. `BEGIN` démarre une transaction; `COMMIT` valide ses modifications; `ROLLBACK` annule les modifications non validées de cette transaction.

Avec `@Transactional`, Spring gère les limites transactionnelles via son proxy. Par défaut, une `RuntimeException` ou une `Error` non interceptée provoque le rollback; une exception vérifiée ne le provoque pas automatiquement, sauf configuration comme `rollbackFor`.

## Pourquoi c’est important

Un virement de 100 $ comprend deux opérations : débiter A et créditer B. Si la deuxième échoue, il faut annuler la première. La transaction assure cette atomicité au sein de la même base, mais la validation des soldes, la concurrence et l'idempotence demandent aussi une conception métier.

## ACID

| Propriété | Explication |
|---|---|
| Atomicité | Validation ou annulation des modifications de la transaction |
| Cohérence | Préservation des contraintes et invariants |
| Isolation | Contrôle de la visibilité entre transactions concurrentes |
| Durabilité | Conservation des modifications validées après reprise sur incident |

## Exemple de code

```java
@Service
@RequiredArgsConstructor
class TransferService {
    private final AccountRepository accounts;

    @Transactional
    public void transfer(long from, long to, BigDecimal amount) {
        accounts.debit(from, amount);
        accounts.credit(to, amount);
    }
}
```

```java
@Transactional(propagation = Propagation.REQUIRED)
public void reserveStock() { /* joins an existing transaction */ }

@Transactional(propagation = Propagation.REQUIRES_NEW)
public void recordAudit() { /* starts an independent transaction */ }
```

Exemple conceptuel : prévoir les repositories, validations et une base transactionnelle. L'auto-invocation au sein du même bean peut contourner le proxy AOP de Spring.

## REQUIRED et REQUIRES_NEW

| Situation | REQUIRED | REQUIRES_NEW |
|---|---|---|
| Pas de transaction externe | Crée une transaction | Crée une transaction |
| Transaction externe active | Participe à la transaction existante | Suspend l'externe et crée une transaction physique indépendante |
| Validation indépendante | Non, si la transaction est partagée | Oui |
| Erreur interne | Peut marquer la transaction partagée rollback-only | N'annule pas automatiquement l'externe |
| Connexions | Généralement la connexion existante | Généralement une connexion supplémentaire |

Une exception issue de `REQUIRES_NEW` peut néanmoins provoquer l'annulation de l'externe si elle s'y propage. Après un échec `REQUIRED` ayant marqué la transaction partagée rollback-only, intercepter l'exception ne suffit pas : un `UnexpectedRollbackException` peut survenir au commit externe.

## PostgreSQL et isolation

PostgreSQL utilise `READ COMMITTED` par défaut. Un SELECT ordinaire ne voit pas les INSERT non validés des autres transactions. `saveAndFlush()` peut envoyer du SQL sans faire de `COMMIT`. Une transaction `REQUIRES_NEW` ne peut donc pas lire normalement la commande non validée par l'externe.

## Pièges fréquents

1. Confondre flush et commit.
2. Croire qu'un catch efface rollback-only.
3. Ajouter une clé étrangère vers une ligne externe non validée sans considérer les attentes.
4. Ignorer la consommation de connexions de `REQUIRES_NEW`.
5. Oublier le proxy AOP et l'auto-invocation.

## Question d’entrevue

Une transaction A enregistre une commande. Une transaction B en `REQUIRES_NEW` enregistre un audit et valide. Ensuite A lance une `RuntimeException` non interceptée. Sans autre erreur :

**A.** Les deux annulent; **B.** A annule et B reste validée; **C.** Les deux valident.

**Réponse : B.** Les transactions physiques sont indépendantes.

## Senior-level answer

`REQUIRED` réutilise la transaction existante; `REQUIRES_NEW` en ouvre une autre après suspension de l'externe. La conception doit considérer les règles métier, les clés étrangères, la propagation des exceptions, les connexions disponibles et l'idempotence.

## Réflexion d’architecture

La commande et le stock ont généralement besoin d'une transaction commune. L'audit d'une tentative échouée peut être indépendant, mais il ne devrait pas exiger une clé étrangère vers une commande non validée. Les appels externes et messages exigent d'autres stratégies, comme Transactional Outbox.

## Exercice pratique

1. Créer deux comptes PostgreSQL et un service de virement `@Transactional`.
2. Lancer une `RuntimeException` après le débit et vérifier le rollback des soldes.
3. Ajouter un audit `REQUIRES_NEW` dans un autre bean et vérifier sa persistance après l'annulation externe.

**Validation :** expliquer transaction, commit, rollback et propagation en une phrase.

## Auto-évaluation

1. Une transaction est-elle une seule requête SQL ? **Non.**
2. Que fait COMMIT ? **Il valide.**
3. REQUIRED rejoint-il une transaction existante ? **Oui.**
4. REQUIRES_NEW crée-t-il une transaction indépendante ? **Oui.**
5. READ COMMITTED voit-il les lignes non validées d'autrui ? **Non, pas via un SELECT ordinaire.**

## Résumé

**Une transaction définit une limite de validation et d'annulation.** Révision minimale : expliquer `BEGIN → COMMIT / ROLLBACK` et la différence entre les deux propagations.
