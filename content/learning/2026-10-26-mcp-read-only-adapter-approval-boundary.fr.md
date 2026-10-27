+++
title = "Senior Java / IA : MCP en lecture seule et approbation humaine fiable"
date = 2026-10-26
draft = false
summary = "L'audit PromoLocal Photo Deal montre pourquoi l'enregistrement des outils, la prévisualisation et l'approbation côté serveur sont distincts."
tags = ["Java", "AI Agents", "MCP", "Security", "API Contracts", "Architecture", "Testing"]
categories = ["Apprentissage"]
showComments = true
+++

## Le problème concret

Dans PromoLocal Photo Deal TEST 3.0.0, le GET FastAPI des catégories dynamiques peut servir à un adaptateur MCP. En revanche, exposer le POST de création reste **NO-GO**. L'audit a identifié quatre obstacles : l'absence d'une approbation fiable de la requête complète, l'écart entre les métadonnées facultatives des fichiers MCP et les champs obligatoires du backend, le nettoyage lors d'une annulation et l'incertitude du résultat après un délai d'attente. Il s'agit ici d'un modèle pédagogique, pas d'un service déployé.

## 1. Une frontière de sécurité à comprendre

**Dire « ne pas appeler » dans un prompt ne désactive pas un outil.** Si `create_photo_deal` reste enregistré, l'agent peut toujours tenter de l'appeler. La première phase n'expose donc que `list_photo_deal_categories`. Le produit, le prix, le magasin, la catégorie, l'acteur et les trois rôles des photos sont préparés et prévisualisés localement, **sans écriture**.

## 2. Prévisualiser n'est pas approuver

Un résumé produit par l'IA peut omettre des champs. Une future approbation doit être vérifiée **côté serveur** et liée à la requête complète normalisée, à l'identité de la personne qui approuve, à une échéance et à un identifiant à usage unique. Le modèle ne peut pas s'accorder lui-même une permission. Les identifiants et l'accès réseau de l'adaptateur doivent également empêcher tout contournement direct vers l'API d'écriture.

## 3. Exemple minimal exécutable en Java 17

La Map immuable représente un registre d'outils en lecture seule. `preview` est une méthode Java locale, **pas un outil MCP**. Les références `f1`, `f2` et `f3` sont fictives. Aucun accès réseau ni écriture en base de données.

~~~java
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

public class SafeMcpDemo {
    static final Map<String, Supplier<List<String>>> TOOLS =
        Map.of("list_photo_deal_categories", () -> List.of("grocery", "seafood"));

    record Draft(String product, BigDecimal price, String store,
                 String category, String actor, Map<String,String> photos) {}

    // Local preview only: not exported as an MCP tool.
    static String preview(Draft d) {
        if (d.product() == null || d.product().isBlank()
            || d.price() == null || d.price().signum() <= 0
            || d.store() == null || d.store().isBlank()
            || d.category() == null || d.category().isBlank()
            || d.actor() == null || d.actor().isBlank()
            || d.photos() == null
            || !d.photos().keySet().containsAll(
                 List.of("product", "price_tag", "store_context")))
            throw new IllegalArgumentException("incomplete draft");
        return d.product() + " | " + d.price() + " | " + d.store();
    }

    public static void main(String[] args) {
        if (TOOLS.containsKey("create_photo_deal"))
            throw new AssertionError("create tool exposed");
        if (!TOOLS.get("list_photo_deal_categories").get().contains("seafood"))
            throw new AssertionError("read-only lookup failed");
        Draft draft = new Draft("Salmon", new BigDecimal("9.99"),
            "Example Store", "seafood", "reviewer-1",
            Map.of("product","f1","price_tag","f2","store_context","f3"));
        if (!preview(draft).contains("Salmon"))
            throw new AssertionError("preview failed");
        System.out.println("PASS");
    }
}
~~~

Ce test pédagogique vérifie l'absence de l'outil de création, la lecture des catégories et la prévisualisation. Il ne remplace pas les tests d'intégration MCP, la validation des métadonnées de fichiers ou les contrôles d'autorisation du backend.

## 4. Pièges fréquents pour un développeur senior

- **Confondre instruction et permission** : le POST reste appelable s'il est enregistré.
- **Confondre prévisualisation et approbation** : l'autorisation doit couvrir la requête complète, y compris les références des photos.
- **Inventer des métadonnées manquantes** pour satisfaire les champs obligatoires du backend.
- **Oublier les pièces jointes orphelines** lors des annulations et des reprises.
- **Relancer aveuglément un POST après un timeout** : la création a peut-être réussi; prévoir l'idempotence et la réconciliation.
- **Cacher un bouton sans protéger le serveur** : authentification, autorisation et portée des identifiants restent essentielles.

## 5. Question d'entrevue senior (répondre d'abord)

Un développeur enregistre `create_photo_deal` comme outil MCP, puis écrit « ne jamais appeler sans approbation » dans les Instructions. **Pourquoi cette protection est-elle insuffisante ? Comment prouver qu'aucune écriture n'est accessible en phase 1 ? Comment concevoir plus tard l'approbation fiable et la reprise après un résultat incertain ?** La réponse est volontairement omise.

## 6. Exercice de 15 minutes

1. Enregistrer le code dans `SafeMcpDemo.java`, puis exécuter `javac --release 17 SafeMcpDemo.java && java SafeMcpDemo`.
2. Vérifier que `create_photo_deal` n'est pas dans le registre.
3. Retirer `price_tag` du brouillon et vérifier que la prévisualisation est refusée.
4. Dessiner le futur parcours : requête complète → approbation humaine → vérification serveur → écriture idempotente → confirmation. **Ne pas appeler le vrai POST.**

## Résumé

**Limiter les capacités appelables avant de guider le comportement de l'agent.** La lecture des catégories et la prévisualisation peuvent être livrées séparément. La création reste NO-GO tant que l'approbation, les fichiers et les résultats incertains ne sont pas maîtrisés.
