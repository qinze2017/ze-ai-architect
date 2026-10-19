+++
title = "Java senior : audit et REQUIRES_NEW"
date = 2026-10-18
draft = false
summary = "Clés étrangères PostgreSQL et audit des transactions annulées."
tags = ["Java", "Spring Boot", "PostgreSQL", "Audit"]
categories = ["Apprentissage"]
showComments = true
+++

## Notion principale

La transaction T1 insère une commande. T2, ouverte avec `REQUIRES_NEW` dans un autre bean Spring, tente d'insérer un audit avec une clé étrangère vers cette commande. T2 ne voit pas la ligne non validée de T1 (`READ COMMITTED`). Le contrôle de clé étrangère peut attendre T1, qui attend déjà le retour de T2. Il faut prévoir un timeout : PostgreSQL ne détecte pas nécessairement ce cycle applicatif. `flush` ne signifie pas `commit`.

## SQL : deux sessions de test

```sql
CREATE TABLE orders(id bigint PRIMARY KEY);
CREATE TABLE audit_log(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES orders(id)
);
```

Session A :

```sql
BEGIN;
INSERT INTO orders VALUES (1001);
-- Laisser la transaction ouverte.
```

Session B :

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
INSERT INTO audit_log(order_id) VALUES (1001);
-- Observer, puis ROLLBACK.
```

Terminer A avec `ROLLBACK;`. Une contrainte `DEFERRABLE` ne rend pas une référence inexistante valide.

## Architecture : audit indépendant

L'audit d'une tentative échouée doit utiliser un `attempt_id` UUID indépendant de l'identifiant de commande.

```sql
CREATE TABLE order_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 attempt_id uuid NOT NULL,
 status text NOT NULL,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now()
);
```

```java
// Autre bean Spring, appelé via son proxy
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void recordFailure(UUID attemptId, String code) {
    auditRepository.save(new OrderAudit(attemptId, "FAILED", code));
}
```

Un orchestrateur non transactionnel appelle le service de commande puis, en cas d'échec, ce service d'audit. Si la base est indisponible, `REQUIRES_NEW` ne garantit pas la persistance : prévoir reprise durable, retries et idempotence.

## Pièges

Ne pas confondre `flush` et `commit`; ne pas supposer que T2 voit T1; éviter l'auto-invocation Spring; dimensionner le pool; vérifier les données finales; ne pas journaliser de secrets.

## Question senior (sans réponse)

La commande 2001 a déjà été validée. T1 modifie son état, T2 écrit un audit avec clé étrangère vers cette commande, puis T1 lève une `RuntimeException`. T2 peut-elle valider? Quel est l'état final et quels verrous peuvent changer le résultat?

## Exercice (15 minutes)

Tester les deux sessions avec un timeout court; remplacer la clé étrangère obligatoire par `attempt_id`; concevoir trois tests : rollback, parent non validé, parent déjà validé.

## Résumé

`REQUIRES_NEW` isole le commit, pas les contraintes. Prévoir une identité autonome pour l'audit d'échec.
