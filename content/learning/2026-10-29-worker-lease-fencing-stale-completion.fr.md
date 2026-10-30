+++
title = "Java senior : empêcher un ancien Worker d'écraser un résultat"
date = 2026-10-29
draft = false
summary = "Comprendre les baux, les jetons de clôture et la validation conditionnelle des tâches."
tags = ["Java", "PostgreSQL", "Workers", "Lease", "Fencing Token", "Concurrency", "Architecture"]
categories = ["Apprentissage"]
showComments = true
+++

## Contexte de l'apprentissage

Nous avons déjà établi qu'un verrou de ligne PostgreSQL est libéré à la fin de la transaction, tandis que l'état PROCESSING reste enregistré. La nouvelle question est plus subtile : **que se passe-t-il si un Worker reprend son travail après l'expiration de son bail et après la réattribution de la tâche ?**

Ce scénario peut toucher le traitement de PDF, les appels à un modèle d'IA et les tâches asynchrones de PromoLocal.

## 1. Notion essentielle : un bail expiré ne tue pas le processus

À 10 h, le Worker A prend la tâche 1001, avec un bail valide jusqu'à 10 h 01. Son appel à l'IA se bloque. À 10 h 01 min 01 s, le Worker B reprend la tâche. À 10 h 01 min 02 s, A revient et veut enregistrer son résultat.

L'expiration autorise une nouvelle attribution; elle ne prouve **pas** que l'ancien processus est arrêté. Le statut PROCESSING ne suffit donc pas pour départager A et B.

À chaque prise en charge, la base incrémente un **fencing token** (par exemple lease_version). A détient la version 7; B obtient la version 8. Pour terminer la tâche, il faut vérifier l'identifiant, le propriétaire, la version courante, le statut PROCESSING et la validité du bail. Une ancienne version ne doit jamais écraser le résultat courant.

## 2. Frontières transactionnelles

La prise en charge doit se faire dans une **transaction courte** : sélectionner et verrouiller une tâche admissible, enregistrer PROCESSING, le propriétaire, la date d'expiration et la nouvelle version, puis valider. L'appel à l'IA se déroule **hors transaction**.

La fin du traitement doit utiliser une **mise à jour atomique conditionnelle**. Si aucune ligne n'est modifiée, le Worker a potentiellement perdu son droit d'écriture : il ne faut pas réessayer aveuglément avec l'ancien résultat.

Attention au piège « SELECT pour vérifier, puis UPDATE sans condition » : un autre Worker peut reprendre la tâche entre les deux requêtes.

## 3. Exemple Java 17 vérifié

~~~java
import java.time.Instant;

public class WorkerFencingDemo {
    static final class Job {
        String status = "PENDING";
        String owner = "";
        long version = 0;
        Instant leaseUntil = Instant.EPOCH;

        synchronized long claim(String worker, Instant now) {
            boolean available = status.equals("PENDING")
                || (status.equals("PROCESSING") && !now.isBefore(leaseUntil));
            if (!available) throw new IllegalStateException("not claimable");
            status = "PROCESSING";
            owner = worker;
            version++;
            leaseUntil = now.plusSeconds(60);
            return version;
        }

        synchronized boolean complete(String worker, long token, Instant now) {
            if (!status.equals("PROCESSING") || !owner.equals(worker)
                    || version != token || !now.isBefore(leaseUntil)) return false;
            status = "DONE";
            return true;
        }
    }

    public static void main(String[] args) {
        Job job = new Job();
        Instant t = Instant.parse("2026-10-29T22:00:00Z");
        long tokenA = job.claim("A", t);
        long tokenB = job.claim("B", t.plusSeconds(61));
        if (job.complete("A", tokenA, t.plusSeconds(62)))
            throw new AssertionError("stale worker was accepted");
        if (!job.complete("B", tokenB, t.plusSeconds(63)))
            throw new AssertionError("current worker was rejected");
        if (job.complete("B", tokenB, t.plusSeconds(64)))
            throw new AssertionError("duplicate completion was accepted");
        System.out.println("PASS: stale and duplicate completion rejected");
    }
}
~~~

Enregistrez le fichier sous WorkerFencingDemo.java, puis exécutez :

~~~text
javac --release 17 WorkerFencingDemo.java
java WorkerFencingDemo
~~~

Résultat attendu : PASS: stale and duplicate completion rejected.

Le mot-clé synchronized sert uniquement à simuler une transition atomique **dans un seul processus**. Cet exemple pédagogique ne remplace ni PostgreSQL ni un test de concurrence entre deux connexions. En production, les conditions de version et de propriétaire doivent être vérifiées par l'UPDATE atomique de la base.

## 4. Pièges fréquents

1. Confondre bail expiré et processus définitivement arrêté.
2. Vérifier seulement PROCESSING, sans vérifier la version de prise en charge.
3. Garder une transaction ouverte pendant un appel réseau ou IA.
4. Séparer la vérification de version de la mise à jour finale.
5. Protéger la base, mais laisser un ancien Worker écraser un objet externe ou envoyer deux notifications. Les effets externes nécessitent aussi une clé d'idempotence, des noms d'objets versionnés ou des écritures conditionnelles côté destination.
6. Présenter un fencing token comme une garantie de « exactly once » pour tout le système.

## 5. Question d'entrevue senior — répondez d'abord

A possède lease_version = 7. Son bail expire; B reprend la tâche avec la version 8. Les deux terminent presque en même temps.

**Quelles conditions faut-il vérifier dans l'opération de finalisation en base ? Que faire si la mise à jour de A touche zéro ligne ? Comment éviter qu'A écrase un fichier déjà écrit dans un stockage d'objets ?**

Aucune réponse modèle n'est donnée ici : formulez d'abord votre raisonnement.

## 6. Exercice pratique de 15 minutes

1. Compilez et exécutez la démonstration Java 17.
2. Modifiez l'instant de fin du traitement de A et observez l'effet du bail.
3. Dessinez la chronologie : A prend la tâche, se bloque, le bail expire, B reprend, A revient, B termine.
4. Préparez trois assertions pour un futur test Testcontainers : version croissante, ancien Worker refusé, Worker courant accepté. N'utilisez pas une base de production.

## Résumé

**Le verrou protège la prise en charge transactionnelle; PROCESSING mémorise l'état; le bail permet la reprise; le fencing token protège contre les écritures tardives.** Les effets de bord externes doivent être sécurisés séparément.

Portée de la validation : l'exemple Java 17 a été compilé et exécuté; aucun test PostgreSQL distribué n'a été réalisé durant cette séance.
