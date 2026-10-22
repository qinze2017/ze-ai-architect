+++
title = "Java senior : asynchronisme JavaScript, Fetch/AJAX et WebSocket"
date = 2026-10-22
draft = false
summary = "Comprendre l'Event Loop, les requêtes HTTP asynchrones et la synchronisation Web/mobile avec WebSocket."
tags = ["JavaScript", "WebSocket", "AJAX", "Fetch API", "Full-Stack", "Architecture"]
categories = ["Apprentissage"]
showComments = true
+++

## Objectifs

Après cette leçon, vous pourrez expliquer la différence entre exécution synchrone et asynchrone en JavaScript, distinguer **Fetch/AJAX** de **WebSocket**, et concevoir une synchronisation fiable des données entre un navigateur et une application mobile.

**Exemple pédagogique** : une plateforme de gestion d'élevages avicoles automatisés traite des factures, calcule des frais et affiche des mesures. Le scénario illustre des possibilités d'architecture; il ne prétend pas décrire exactement l'implémentation d'un projet passé.

## 1. Synchrone, asynchrone et Event Loop

Le code synchrone s'exécute dans l'ordre. Une opération asynchrone (réseau, minuterie) permet de reprendre d'autres tâches pendant l'attente; le résultat est traité ensuite par une continuation ou un rappel.

~~~javascript
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
// A → D → C → B
~~~

Le code synchrone s'exécute d'abord. Ensuite, le rappel de Promise (une **microtâche**) passe avant la tâche de la minuterie. L'**Event Loop** coordonne l'exécution. La syntaxe **async/await** simplifie l'utilisation des Promise : elle ne crée pas automatiquement un nouveau thread. Un await suspend la suite de la fonction async, pas toute la page.

## 2. Fetch et AJAX : requêtes HTTP asynchrones

Le front-end doit lire GET /api/measurements sans recharger toute la page.

~~~javascript
async function loadMeasurements() {
  const response = await fetch("/api/measurements");
  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }
  const data = await response.json();
  document.querySelector("#temperature").textContent =
    String(data.temperature);
}

loadMeasurements().catch(console.error);
~~~

L'API jQuery AJAX offre une autre écriture :

~~~javascript
$.ajax({
  url: "/api/measurements",
  method: "GET",
  success: function (data) {
    updateDashboard(data);
  },
  error: function (xhr) {
    console.error("Échec HTTP :", xhr.status);
  }
});
~~~

Dans les deux cas, **le client lance la requête HTTP**. Ces API ne surveillent pas automatiquement les changements du serveur. Pour actualiser régulièrement les mesures, on peut effectuer des requêtes périodiques (**polling**).

**Piège Fetch** : les réponses HTTP 404 ou 500 ne rejettent généralement pas la Promise; il faut examiner response.ok. Un échec réseau peut, lui, provoquer un rejet.

## 3. WebSocket : une connexion bidirectionnelle durable

Après une négociation initiale (généralement via HTTP Upgrade), WebSocket permet à un serveur d'envoyer un message à ses clients connectés sans attendre une nouvelle requête HTTP. En production, on utilise normalement une connexion chiffrée **wss://**.

~~~javascript
const socket = new WebSocket("wss://your-domain.test/ws/measurements");

socket.addEventListener("message", (event) => {
  try {
    const message = JSON.parse(event.data);
    if (message.type === "measurement.updated") {
      refreshMeasurements(); // Relire l'état de référence via l'API
    }
  } catch (error) {
    console.error("Message invalide", error);
  }
});

socket.addEventListener("close", () => {
  console.warn("Déconnexion : reconnexion et resynchronisation requises");
});
~~~

Il s'agit d'un **extrait pédagogique**; une implémentation en production nécessite notamment authentification, autorisation, reconnexion progressive, supervision et gestion des messages erronés.

| Technique | Mode de communication | Usage |
| --- | --- | --- |
| Fetch / AJAX | Requête HTTP à l'initiative du client | Lire ou modifier une facture |
| Polling | Requêtes HTTP périodiques | Tableau de bord simple |
| WebSocket | Connexion persistante et bidirectionnelle | Notifications, mesures mises à jour |
| SSE | Événements envoyés du serveur vers le client via HTTP | Flux d'actualisations unidirectionnel |

**Important** : l'asynchronisme JavaScript est un modèle d'exécution, tandis que WebSocket est un protocole de communication. Le partage des mêmes données entre Web et mobile ne prouve pas, à lui seul, l'utilisation de WebSocket.

## 4. Cas d'architecture : données partagées Web / mobile

Une approche robuste peut suivre ces étapes :

1. Le navigateur ou l'application mobile charge les frais et mesures via une API REST.
2. Une modification est validée par le back-end et persistée en base.
3. **Après la validation de la transaction**, le serveur émet un événement « données modifiées ».
4. Les clients abonnés reçoivent l'événement et demandent l'état courant par API.
5. Après une déconnexion, le client relit l'état de référence. **Un message WebSocket n'est pas la source de vérité.**

Deux clients peuvent modifier simultanément les mêmes frais : la synchronisation des messages ne règle pas le conflit. Il faut aussi définir une stratégie de concurrence, par exemple un champ de **version (verrouillage optimiste)** avec réponse HTTP 409 en cas de conflit.

### Modes de défaillance à anticiper

- **Messages manqués pendant une coupure** : resynchroniser avec un instantané ou un curseur d'événements.
- **Doublons et désordre** : utiliser identifiants, versions et traitements idempotents.
- **Fuite de données** : authentifier les clients et autoriser chaque abonnement.
- **Crash entre COMMIT et notification** : pour des événements critiques, considérer Transactional Outbox et un worker.

## 5. Pratique de 15 minutes

1. Interroger un endpoint JSON /api/measurements avec fetch(); gérer les erreurs HTTP.
2. Ajouter une actualisation toutes les cinq secondes et éviter les requêtes qui se chevauchent.
3. Simuler la réception de measurement.updated via le gestionnaire WebSocket et déclencher une nouvelle lecture par API.
4. Couper le réseau pendant 30 secondes : comment retrouver la dernière version des données ?

**Critère de réussite** : expliquer clairement Promise/Event Loop, HTTP asynchrone, serveur qui pousse un événement, et état réellement validé en base.

## 6. Questions d'entrevue senior

**Q1. await bloque-t-il toute l'interface ?** Non : il suspend la continuation de la fonction async. Un calcul JavaScript lourd et synchrone peut malgré tout bloquer le thread principal.

**Q2. Fetch est-il équivalent à WebSocket ?** Non. Fetch gère des requêtes/réponses HTTP; WebSocket maintient une connexion bidirectionnelle.

**Q3. Comment se remettre d'une coupure WebSocket ?** Reconnexion avec temporisation, puis récupération de l'état courant par API (éventuellement avec version ou curseur d'événements).

**Q4. Deux clients modifient simultanément la même valeur : que faire ?** Vérifier les conflits côté serveur, par exemple par verrouillage optimiste et stratégie explicite de résolution.

## À retenir

**Asynchronisme : ne pas bloquer pendant l'attente. Fetch/AJAX : effectuer des requêtes HTTP. WebSocket : échanger des messages en continu. Transactions et contrôle de concurrence : préserver la cohérence métier.** Le choix dépend de la latence attendue, du coût opérationnel et des garanties nécessaires.

Références : [Modèle d'exécution JavaScript — MDN](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Execution_model) · [Fetch — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) · [WebSocket — MDN](https://developer.mozilla.org/fr/docs/Web/API/WebSockets_API)
