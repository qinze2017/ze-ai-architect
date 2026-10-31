+++
title = "Java senior et IA : produits visibles seulement avec une preuve de prix"
date = 2026-10-30
draft = false
summary = "Règles de qualité pour PromoLocal : observations de prix, requête EXISTS, pagination et validation des données extraites par l'IA."
tags = ["Java", "IA", "PostgreSQL", "Qualité des données", "PromoLocal", "Architecture"]
categories = ["Apprentissage"]
showComments = true
+++

## Contexte réel — 30 octobre 2026

PromoLocal se concentre sur **Rabais** (offres avec prix et dates vérifiables), **Produits** (historique des prix) et **Communauté** (photos, partage et validation). La section Comparer reste masquée tant que les données sont insuffisantes. Les produits sans prix ne devraient pas apparaître dans le catalogue public.

Ce n'est pas qu'une question de CSS : c'est une **règle de qualité des données**. Les noms de tables et les règles qui suivent sont pédagogiques, pas une description confirmée du schéma de production.

## Concept essentiel

Une fiche produit peut exister sans preuve de prix en magasin. Une règle prudente : rendre visible un produit seulement si au moins une observation de prix est **approuvée, positive, liée à un magasin et datée**. Le statut d'approbation proposé doit être adapté au vrai processus de modération.

Un prix ancien peut rester dans l'historique, mais **ne prouve pas qu'un rabais est encore actif**. Une offre courante exige des dates de validité et une source. Un prix extrait d'une photo par l'IA demeure une **suggestion à vérifier**, et non un prix public confirmé.

## SQL et exemple Java 17

Le schéma `products` / `price_observations` est fictif. `EXISTS` sélectionne les produits ayant au moins une observation admissible, sans les dédoubler quand ils ont plusieurs prix historiques. Le programme Java est autonome et ne contacte aucun service de production.

~~~sql
SELECT p.id, p.name
FROM products p
WHERE EXISTS (
    SELECT 1
    FROM price_observations e
    WHERE e.product_id = p.id
      AND e.status = 'PUBLISHED'
      AND e.amount > 0
      AND e.store_id IS NOT NULL
      AND e.observed_at <= CURRENT_TIMESTAMP
);
~~~

Enregistrez le code dans `PriceEvidenceGateDemo.java`, puis exécutez `javac --release 17 PriceEvidenceGateDemo.java && java PriceEvidenceGateDemo`. Sortie attendue : `PASS: 5 price-evidence visibility cases`. Les cinq assertions couvrent une preuve approuvée, une observation en attente, un prix nul, une date future et une preuve absente. `BigDecimal` évite les erreurs d'arrondi des montants.

~~~java
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class PriceEvidenceGateDemo {
    record PriceEvidence(long productId, BigDecimal amount, String storeId,
                         Instant observedAt, boolean approved) {}

    static boolean usable(PriceEvidence e, Instant now) {
        return e != null && e.approved() && e.amount() != null
            && e.amount().signum() > 0 && e.storeId() != null
            && !e.storeId().isBlank() && e.observedAt() != null
            && !e.observedAt().isAfter(now);
    }

    static boolean visible(long productId, List<PriceEvidence> evidence, Instant now) {
        return evidence.stream().anyMatch(e -> e != null
            && e.productId() == productId && usable(e, now));
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        Instant now = Instant.parse("2026-10-30T22:00:00Z");
        PriceEvidence approved = new PriceEvidence(101L, new BigDecimal("2.99"),
            "Super C", now.minusSeconds(3600), true);
        PriceEvidence pending = new PriceEvidence(102L, new BigDecimal("3.99"),
            "Maxi", now.minusSeconds(3600), false);
        PriceEvidence zero = new PriceEvidence(103L, BigDecimal.ZERO,
            "IGA", now.minusSeconds(3600), true);
        PriceEvidence future = new PriceEvidence(104L, new BigDecimal("4.99"),
            "IGA", now.plusSeconds(3600), true);
        List<PriceEvidence> records = List.of(approved, pending, zero, future);
        check(visible(101L, records, now), "approved evidence should be visible");
        check(!visible(102L, records, now), "pending evidence must not count");
        check(!visible(103L, records, now), "zero price must not count");
        check(!visible(104L, records, now), "future observation must not count");
        check(!visible(105L, records, now), "missing evidence must not count");
        System.out.println("PASS: 5 price-evidence visibility cases");
    }
}
~~~


## Pièges fréquents

1. Masquer uniquement dans React : API, recherche et total de pagination deviennent incohérents.
2. Filtrer après la pagination : une page de 20 éléments peut n'en afficher que deux.
3. Faire un JOIN sans gérer les doublons : plusieurs prix pour un seul produit.
4. Publier directement une valeur extraite par l'IA : erreurs possibles de prix, d'unité, de date ou de magasin.
5. Confondre prix historique et rabais en vigueur.
6. Cacher seulement le lien Comparer sans gérer les routes et API correspondantes.

## Question d'entrevue senior — répondez d'abord

Sur 2 000 produits, seuls 100 ont une preuve de prix admissible. L'API pagine les 2 000 produits par groupes de 20, puis React retire ceux sans prix : certaines pages n'affichent qu'un ou deux produits, mais le total reste 2 000. **Comment corriger la requête, le décompte et l'invalidation du cache, sans introduire de requêtes N+1 ?** La réponse n'est pas fournie ici.

## Exercice de 15 minutes

1. Compiler et exécuter l'exemple Java; confirmer les cinq tests.
2. Ajouter une deuxième observation valide au produit 101; expliquer pourquoi il ne devrait apparaître qu'une fois.
3. Comparer `EXISTS` et `JOIN` avec des données fictives en développement.
4. Définir les statuts visibles dans Produits, Rabais et Communauté, puis vérifier les points d'entrée de Comparer. Ne rien déployer en production.

## Résumé

**Une fiche produit n'est pas une preuve de prix; un prix historique n'est pas un rabais actif; une extraction de l'IA n'est pas une donnée validée.** La règle de visibilité appartient à la logique métier et aux requêtes backend.

Limites : exemple Java compilé et exécuté avec la cible Java 17; requête `EXISTS` testée sur cinq produits dans SQLite en mémoire; aucun test sur le véritable schéma PostgreSQL, Spring Boot ou le site en ligne.
