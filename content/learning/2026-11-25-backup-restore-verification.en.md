+++
title = "Backup integrity and restore acceptance"
date = 2026-11-25
draft = false
summary = "Distinguish backup checks from successful recovery and migration."
tags = ["Backup", "Recovery", "Software Architecture"]
categories = ["Learning"]
showComments = true
+++

## Real context
On November 25, saveTogether migration preparation included SHA-256, gzip and Git bundle checks. Restoration on the MacBook still needed clarification; migration completion was not established.

## Core concepts
Backup integrity checks stored bytes; recoverability requires an actual isolated restore. Recovery time objective (RTO) and recovery point objective (RPO) describe acceptable recovery duration and data-loss window. A Git bundle excludes uncommitted changes, untracked files and database contents. Databases require a separate consistent backup. Dependencies, configuration and application behavior also need verification.

## Python example
Simulate restoration and tamper detection in a temporary directory only.

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

## Common pitfalls
Confusing gzip integrity with database consistency; treating bundle verification as proof of application startup; forgetting untracked files, secrets and dependencies; overwriting the target working tree.

## Senior interview question
The Git bundle and archive checks pass, but the restored application on the MacBook cannot connect to its database. How would you design restore acceptance and rollback? Answer first.

## 15-minute exercise
Restore a sample into a temporary directory and list separate acceptance checks for source, data, configuration, dependencies and startup.

## Summary
Readable backups do not guarantee service recovery. The copy and tamper assertions passed in isolation; actual project restoration was not validated.
