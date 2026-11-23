+++
title = "Pagination MCP et limite en octets : une seule réponse peut dépasser 32 Kio"
summary = "Étude d’un dépassement de 65 614 octets dans OpenCode Bridge et conception d’une pagination récupérable."
date = 2026-11-22
draft = false
tags = ["Java", "AI Architecture", "MCP", "OpenCode", "Pagination"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
OpenCode Bridge a retourné inputCount=1, returned=1, bytes=65614, truncated=true, hasMore=true et nextCursor=null, puis une assertion de 32768 octets a échoué. Une seule réponse peut contenir une sortie d’outil volumineuse.

## Concepts essentiels
**Budget en octets (byte budget)** : mesurer la réponse JSON complète en UTF-8, y compris les métadonnées. **Pagination** : si hasMore vaut true, le client doit disposer d’un moyen fiable de poursuivre. **Troncature** : signaler clairement les données incomplètes; ne jamais présenter un extrait comme un message intégral.

## Exemple JavaScript pédagogique
~~~javascript
function pageWithinBudget(items, maxBytes = 32768) {
  const bytes = value => Buffer.byteLength(JSON.stringify(value), "utf8");
  const out = [];
  for (const item of items) {
    const candidate = { messages: [...out, item], hasMore: true };
    if (bytes(candidate) > maxBytes) break;
    out.push(item);
  }
  const hasMore = out.length < items.length;
  return { messages: out, hasMore, nextCursor: hasMore ? String(out.length) : null };
}
// Demonstration only: production cursors must encode a stable server-side position.
~~~

Cet exemple illustre le calcul de la taille, mais ne résout pas le cas d’un seul élément trop volumineux. En production, prévoir des fragments internes, une erreur explicite ou un résumé avec récupération, ainsi qu’un curseur stable. Recalculer la taille après la construction des métadonnées finales.

## Pièges fréquents
- Confondre nombre d’éléments et taille en octets.
- Employer string.length plutôt que Buffer.byteLength pour l’UTF-8.
- Oublier le coût de l’enveloppe JSON.
- Retourner hasMore=true avec nextCursor=null.
- Utiliser un décalage instable lorsque les données changent.
- Couper arbitrairement un flux d’octets JSON.

## Question d’entrevue Senior
Une seule entrée dépasse 32 Kio. Comment concevoir le découpage, le curseur, les métadonnées et les tests pour éviter toute perte et toute boucle infinie? Répondez avant de consulter une solution.

## Exercice pratique de 15 minutes
Tester en environnement isolé des messages ASCII, français accentué, chinois et une entrée surdimensionnée. Vérifier la taille JSON finale, la progression du curseur et les reprises sans doublons.

## Résumé
Une pagination fiable impose simultanément une limite réelle en octets, une sémantique explicite et une reprise possible.
