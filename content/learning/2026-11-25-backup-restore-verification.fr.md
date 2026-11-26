+++
title = "Intégrité des sauvegardes et validation de la restauration"
date = 2026-11-25
draft = false
summary = "Distinguer la vérification d'une sauvegarde de la validation d'une migration."
tags = ["Backup", "Recovery", "Software Architecture"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Le 25 novembre, la préparation de la migration de saveTogether comprenait des vérifications SHA-256, gzip et Git bundle. La restauration sur le MacBook restait à clarifier; la migration n'est donc pas confirmée.

## Concepts essentiels
L'intégrité vérifie les octets sauvegardés; la capacité de restauration exige un essai dans un environnement isolé. Le RTO désigne le délai de rétablissement acceptable et le RPO la perte de données temporelle acceptable. Un Git bundle ne contient ni les modifications non validées, ni les fichiers non suivis, ni la base de données. Celle-ci exige une sauvegarde cohérente distincte. Il faut aussi vérifier les dépendances, la configuration et le comportement applicatif.

## Exemple Python
Simulation dans un dossier temporaire, sans toucher aux sauvegardes réelles.

~~~python
import tempfile, pathlib, hashlib, shutil
with tempfile.TemporaryDirectory() as d:
    p = pathlib.Path(d)
    a, b = p / 'backup', p / 'restore'
    a.mkdir()
    (a / 'data.txt').write_text('sample')
    expected = hashlib.sha256((a / 'data.txt').read_bytes()).hexdigest()
    shutil.copytree(a, b)
    assert hashlib.sha256((b / 'data.txt').read_bytes()).hexdigest() == expected
    (b / 'data.txt').write_text('changed')
    assert hashlib.sha256((b / 'data.txt').read_bytes()).hexdigest() != expected
~~~

## Pièges fréquents
Confondre intégrité gzip et cohérence de la base de données; assimiler la vérification du bundle au démarrage réussi; oublier les fichiers non suivis, les secrets et les dépendances; écraser le dossier cible.

## Question d'entrevue senior
Les vérifications du bundle et des archives réussissent, mais l'application restaurée sur le MacBook ne peut pas joindre la base de données. Comment concevoir les critères d'acceptation et le retour arrière? Répondre d'abord.

## Exercice de 15 minutes
Restaurer un échantillon dans un dossier temporaire et dresser une liste de vérifications distinctes pour le code, les données, la configuration, les dépendances et le démarrage.

## Bilan
Une sauvegarde lisible ne garantit pas la reprise du service. Les assertions de copie et de modification ont réussi en isolation; aucune restauration réelle du projet n'a été validée.
