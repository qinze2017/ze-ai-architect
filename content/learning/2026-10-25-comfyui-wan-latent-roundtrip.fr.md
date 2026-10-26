+++
title = "ComfyUI / Wan : comprendre l'aller-retour des latents"
date = 2026-10-25
draft = false
summary = "Comprendre process_in/process_out, la normalisation des latents et les tests de compatibilité des modèles Wan."
tags = ["AI", "ComfyUI", "Wan", "Python", "Latent", "Testing", "Architecture"]
categories = ["Apprentissage"]
showComments = true
+++

## Le problème concret

Lors d'un récent dépannage d'un flux vidéo Wan dans ComfyUI, nous avons inspecté `Wan21` et `Wan22` avec `inspect.getsource`. Une définition `def process_in(...)` a ensuite été collée directement dans zsh, causant `zsh: no matches found`. **C'est une confusion entre le shell et Python, pas une preuve de défaillance du modèle.** Nous expliquons ici la forme mathématique discutée, sans prétendre avoir mesuré tous les paramètres réels des deux versions.

## 1. Une seule idée à comprendre

Un latent est une représentation numérique avec des conventions de forme et d'échelle. Considérons la transformation simplifiée :

`z = (x - mean) × scale / std`

et son inverse :

`x = z × std / scale + mean`

Les deux opérations s'annulent mathématiquement **si les mêmes paramètres sont utilisés et si std et scale sont non nuls**. En calcul flottant, une petite erreur est normale. Ces fonctions ne constituent **ni un encodeur/décodeur VAE complet ni une preuve de rendu vidéo réussi**.

## 2. Pourquoi la compatibilité est importante

Si un flux normalise avec les paramètres A et dénormalise avec les paramètres B, le programme peut s'exécuter sans exception tout en produisant des données incorrectes. Il faut vérifier ensemble le checkpoint, le VAE, le format latent, les dimensions et les canaux. **Le nom Wan21 ou Wan22 ne suffit pas à déduire les valeurs exactes** : inspectez le code installé et la documentation du modèle.

## 3. Test Python minimal et exécutable

~~~python
import numpy as np

def process_in(x, mean, std, scale):
    if np.any(std <= 0) or scale == 0:
        raise ValueError("invalid latent parameters")
    return (x - mean) * scale / std

def process_out(z, mean, std, scale):
    if np.any(std <= 0) or scale == 0:
        raise ValueError("invalid latent parameters")
    return z * std / scale + mean

x = np.array([[-1, 0, 1], [2, 3, 4]], dtype=np.float32)
mean = np.array([0.1, 0.2, 0.3], dtype=np.float32)
std = np.array([1.0, 1.5, 2.0], dtype=np.float32)
scale = np.float32(0.8)

z = process_in(x, mean, std, scale)
restored = process_out(z, mean, std, scale)
assert np.allclose(x, restored, atol=1e-6)

wrong_std = np.array([1.0, 1.2, 2.0], dtype=np.float32)
wrong = process_out(z, mean, wrong_std, scale)
assert not np.allclose(x, wrong, atol=1e-6)
print("PASS: round-trip; mismatched spec detected")
~~~

Le test vérifie un aller-retour avec les mêmes paramètres, puis démontre l'échec avec un `std` différent. Le tableau 2D simplifie la diffusion des dimensions (broadcasting); un latent vidéo réel possède souvent davantage d'axes. **Ce test NumPy a été exécuté indépendamment, pas dans un véritable graphe d'inférence Wan.**

## 4. Exécuter le code dans le bon environnement

~~~bash
cd ~/AI-Tools/ComfyUI
source .venv/bin/activate
python - <<'PY'
import inspect
from comfy.latent_formats import Wan21, Wan22
for cls in (Wan21, Wan22):
    print(cls.__name__)
    print(inspect.getsource(cls.process_in))
    print(inspect.getsource(cls.process_out))
PY
~~~

Les instructions `def` et `import` doivent être interprétées par Python, dans un fichier `.py` ou dans ce heredoc, jamais directement par zsh.

## 5. Pièges fréquents pour un développeur senior

- **Réversibilité numérique ≠ compatibilité du modèle** : vérifier aussi le VAE, le checkpoint, les canaux et la forme.
- **Mauvais axe de broadcasting** : dimensions apparemment compatibles, mais mauvais calcul.
- **Précision flottante** : utiliser une tolérance, pas `==`.
- **Mauvais diagnostic** : une erreur zsh ne révèle rien sur MPS ou sur le modèle.
- **Reproductibilité insuffisante** : consigner versions, paramètres, entrées et journaux.
- **Validation exagérée** : sans inférence réelle, ne pas annoncer que la qualité vidéo est vérifiée.

## 6. Question d'entrevue senior (sans réponse)

Après une mise à jour du modèle Wan, un flux ComfyUI fonctionne, mais la vidéo est visiblement dégradée, sans exception. **Comment isoler méthodiquement une erreur de normalisation, de dimensions, de VAE ou d'échantillonnage? Quel contrôle faites-vous en premier, et pourquoi?**

## 7. Exercice de 15 minutes

1. Exécuter le test NumPy et obtenir `PASS`.
2. Modifier `wrong_std` et observer l'écart.
3. Inspecter localement les méthodes de Wan21/Wan22 avec Python.
4. Noter les versions de ComfyUI, du checkpoint et du VAE, ainsi que la forme des latents, sans modifier le flux de production.

## Résumé

**Vérifier d'abord l'aller-retour numérique, ensuite le contrat des tenseurs, puis le résultat du vrai modèle.** Un test Python réussi ne prouve pas qu'un rendu vidéo complet fonctionne.
