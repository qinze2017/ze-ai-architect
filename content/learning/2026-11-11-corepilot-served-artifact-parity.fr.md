+++
title = "Senior Java / IA : vérifier les octets réellement servis par CorePilot"
date = 2026-11-11
draft = false
summary = "Comparer les artefacts statiques et les réponses HTTP avec SHA-256, sans confondre validation et déploiement."
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Le 11 novembre, tu as préparé des vérifications en lecture seule : état de l’API CorePilot, accès HTTPS sur iPhone, SHA-256 du fichier `web/out/create/index.html` et empreinte du contenu renvoyé par `/create/`. Sans les sorties complètes, on ne peut pas affirmer que les empreintes correspondent.

## Concepts essentiels
L’**artefact de compilation** est le fichier local; l’**artefact servi** correspond aux octets réellement reçus par le client HTTP. Un proxy inverse, une ancienne instance, un cache, une redirection ou une page d’erreur peuvent créer un écart. Un code HTTP 200 ne prouve pas que la bonne page a été servie. Une empreinte identique démontre seulement l’égalité des octets comparés, pas la sécurité du site entier.

## Exemple Java 17
Ce programme compare le SHA-256 d’un fichier local à celui du corps d’une réponse HTTP 200. `BodyHandlers.ofByteArray()` évite une conversion de caractères. Compilation vérifiée avec `javac --release 17`; aucun test d’intégration CorePilot n’a été effectué.

~~~java
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.security.*;
import java.util.HexFormat;
public class ArtifactParity {
  static String sha(byte[] bytes) throws Exception {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
  }
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("local file and HTTP URL required");
    byte[] local = Files.readAllBytes(Path.of(args[0]));
    HttpClient client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    HttpResponse<byte[]> response = client.send(
        HttpRequest.newBuilder(URI.create(args[1])).GET().build(),
        HttpResponse.BodyHandlers.ofByteArray());
    if (response.statusCode() != 200)
      throw new IllegalStateException("HTTP " + response.statusCode());
    String a = sha(local), b = sha(response.body());
    System.out.println("local=" + a + "\nserved=" + b);
    if (!a.equals(b)) { System.err.println("MISMATCH"); System.exit(1); }
    System.out.println("MATCH");
  }
}
~~~

Exécution : `javac --release 17 ArtifactParity.java`, puis `java ArtifactParity /chemin/index.html https://example.test/create/`. Remplace l’URL d’exemple par une adresse de test fiable.

## Pièges fréquents
- Assimiler HTTP 200 à une preuve de la bonne version.
- Comparer deux fichiers locaux sans vérifier la réponse réseau.
- Oublier le cache, les redirections et les pages de connexion.
- Mélanger les octets compressés du transport et le corps décodé.
- Généraliser la réussite d’une seule page à tous les parcours et appareils.

## Question d’entrevue Senior
Le SHA-256 local diffère de celui du corps HTTP, mais la réponse est 200. Comment isoler la cause et quelles preuves exiger avant d’autoriser la mise en production? Réponds d’abord sans consulter de corrigé.

## Exercice pratique de 15 minutes
En lecture seule, calcule l’empreinte du fichier local, télécharge la réponse de la page dans un fichier temporaire, puis compare les empreintes. Note l’URL, le statut, les en-têtes et l’heure. Ne considère pas l’option TLS `-k` comme une validation de l’identité du serveur. Aucun redémarrage ni déploiement.

## Résumé
Un fichier compilé, une réponse HTTP 200, une correspondance des octets et une autorisation de déploiement constituent quatre preuves distinctes.