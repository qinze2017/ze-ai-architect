+++
title = "Java senior : MVCC, NOWAIT et SKIP LOCKED"
date = 2026-10-19
draft = false
summary = "Comprendre les verrous de ligne PostgreSQL et les lectures concurrentes sous READ COMMITTED."
tags = ["Java", "PostgreSQL", "MVCC", "Transactions", "Locking"]
categories = ["Apprentissage"]
showComments = true
+++

## Notion essentielle

**MVCC** (*Multi-Version Concurrency Control*, contrôle de concurrence multiversion) gère la **visibilité** des données; les verrous de ligne gèrent les **conflits** entre opérations. Sous `READ COMMITTED`, un `SELECT` ordinaire lit les versions visibles selon l'instantané de l'instruction et n'attend généralement pas une modification non validée. En revanche, `SELECT ... FOR UPDATE` doit obtenir un verrou de ligne et peut attendre une transaction concurrente.

| Verrou | Effet sur `UPDATE status` (colonne non clé) |
| --- | --- |
| `FOR KEY SHARE` | Généralement compatible; protège surtout la clé et l'existence de la ligne |
| `FOR SHARE` | Bloque les mises à jour concurrentes de cette ligne |
| `FOR NO KEY UPDATE` | Habituellement utilisé pour une mise à jour sans changement de clé |
| `FOR UPDATE` | Le plus restrictif; incompatible avec les quatre modes |

Avec Hibernate et PostgreSQL, `PESSIMISTIC_READ` correspond généralement à `FOR SHARE`, **pas** à `FOR KEY SHARE`. Vérifiez le SQL produit par votre fournisseur JPA et votre dialecte.

## Exemple SQL : deux sessions (base de test seulement)

```sql
CREATE TABLE orders (id bigint PRIMARY KEY, status text NOT NULL);
INSERT INTO orders VALUES (2001, 'PENDING'), (2002, 'PENDING');
```

Session A :

```sql
BEGIN;
UPDATE orders SET status = 'PAID' WHERE id = 2001;
-- Laisser la transaction ouverte.
```

Session B :

```sql
SELECT status FROM orders WHERE id = 2001;
-- Sous READ COMMITTED : généralement PENDING.

BEGIN;
SELECT id FROM orders WHERE id = 2001 FOR UPDATE NOWAIT;
-- Verrou incompatible : erreur immédiate, normalement SQLSTATE 55P03.
ROLLBACK;

BEGIN;
SELECT id FROM orders
WHERE id IN (2001, 2002)
ORDER BY id
FOR UPDATE SKIP LOCKED;
-- Dans cet exemple : 2001 est ignorée et 2002 est verrouillée.
ROLLBACK;
```

Terminez la session A par `COMMIT;`. `NOWAIT` signale une erreur si le verrou de **ligne** n'est pas disponible immédiatement. `SKIP LOCKED` ignore les lignes verrouillées; cela ne signifie pas qu'elles n'existent pas. Cette option convient aux files de tâches à plusieurs consommateurs, mais pas à une pagination générale. Les verrous de table sont toujours acquis selon les règles habituelles.

## Exemple Spring Boot

`@Transactional` définit la portée de la transaction; une lecture ordinaire ne devient pas automatiquement une lecture verrouillante. `PESSIMISTIC_WRITE` correspond habituellement à `FOR UPDATE` sous PostgreSQL. Pour exiger `NOWAIT`, on peut utiliser du SQL natif vérifié pour le SGBD. Fragment Spring JDBC (champ `jdbcTemplate` déjà injecté) :

```java
@Transactional
public String lockOrderNowait(long orderId) {
    return jdbcTemplate.queryForObject(
        "SELECT status FROM orders WHERE id = ? FOR UPDATE NOWAIT",
        String.class, orderId);
}
```

Traitez l'erreur de verrouillage à l'extérieur de la transaction en échec; PostgreSQL exige normalement un `ROLLBACK` après une erreur dans une transaction explicite.

## Pièges fréquents

1. Confondre lecture MVCC et lecture avec verrou.
2. Croire que `NOWAIT` retourne l'ancienne version plutôt qu'une erreur.
3. Interpréter une réponse vide de `SKIP LOCKED` comme une file vide.
4. Oublier que `READ COMMITTED` peut réévaluer la condition `WHERE` après une attente.
5. Supposer que `PESSIMISTIC_READ` est toujours traduit de la même façon.
6. Oublier `ROLLBACK` après une erreur dans une transaction explicite.

## Question d'entrevue senior (sans réponse)

La commande 2001 est initialement `PENDING`. T1 exécute `BEGIN; UPDATE orders SET status = 'PAID' WHERE id = 2001;` sans valider. T2, sous `READ COMMITTED`, lance :

```sql
SELECT status FROM orders
WHERE id = 2001 AND status = 'PENDING'
FOR UPDATE;
```

T2 attend-elle? Si T1 valide ensuite, T2 retourne-t-elle `PAID`, `PENDING` ou **aucune ligne**? Expliquez le rôle de l'instantané, du verrou et de la condition `WHERE`.

## Exercice pratique : 15 minutes

Reproduisez les deux sessions dans une base de test et comparez `SELECT`, `FOR UPDATE NOWAIT` et `FOR UPDATE SKIP LOCKED`. Puis expliquez pourquoi, dans une file de tâches, la prise en charge et le changement d'état doivent faire partie d'une même transaction.

## Résumé

**MVCC détermine la visibilité; les verrous de ligne gèrent les conflits.** `NOWAIT` échoue rapidement et `SKIP LOCKED` contourne les lignes occupées. Le bon choix dépend du besoin métier.

Références : [SELECT PostgreSQL](https://www.postgresql.org/docs/current/sql-select.html) · [Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) · [Verrous explicites](https://www.postgresql.org/docs/current/explicit-locking.html).
