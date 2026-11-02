+++
title = "Java senior et IA : des patrons de perles nets et vérifiables, du quadrillage au PDF"
date = 2026-11-01
draft = false
summary = "À partir des patrons 40×40 et 52×52 de Xiaodaigua : grille discrète, aperçu sans interpolation, décompte des perles et PDF vectoriel."
tags = ["Java", "IA", "Traitement d'image", "PDF", "Pixel Art", "Tests"]
categories = ["Apprentissage"]
showComments = true
+++

## Problème concret du 1er novembre

Deux PDF candidats de patrons de perles à repasser, en formats **40×40** et **52×52**, ont soulevé une question : pourquoi semblent-ils moins nets que les modèles de référence? Il s'agit d'un problème à examiner, **pas d'un diagnostic confirmé** : aucun audit des objets vectoriels ou des pixels de ces PDF n'a été effectué pour cet article.

Une belle image produite par l'IA ne constitue pas automatiquement un patron reproductible. Chaque case, sa couleur et le nombre de perles doivent être vérifiables.

## Concepts essentiels

**Grille discrète.** Un patron 40×40 possède 1 600 cases; un 52×52, 2 704 cases. Le nombre de cases n'est pas nécessairement le nombre de perles : il faut exclure les cases vides. Chaque case correspond à un code de couleur précis ou à une absence de perle.

**Agrandissement par plus proche voisin (nearest-neighbor).** Pour l'aperçu, chaque pixel agrandi reprend la valeur de sa case source. Une interpolation bilinéaire peut mélanger les couleurs et brouiller les contours. Cette technique préserve les arêtes, mais ne corrige pas un mauvais patron.

**PDF vectoriel.** Le document final devrait tracer les cases, les lignes et les numéros à partir de la même grille, au lieu d'étirer une petite capture d'écran. Avec 190 mm de largeur utilisable sur une page A4, chaque colonne mesure environ 3,65 mm pour 52 colonnes et 4,75 mm pour 40 colonnes. Ce sont des estimations de mise en page, non des mesures de PDF validées.

**Contrôle qualité.** Vérifier les dimensions, les codes de couleur, les cases vides, les quantités par couleur, la légende, la lisibilité des numéros et une impression réelle. Garder le statut « en attente de révision » jusqu'à l'approbation.

Chaîne proposée : **image IA ou référence → grille de couleurs corrigée → numérotation et comptage → aperçu nearest-neighbor + PDF vectoriel → essai d'impression → approbation humaine**.

## Exemple Java 17 : une seule source de vérité

La grille pédagogique 4×4 utilise `-` pour une **case vide**, et `R`/`B` comme codes fictifs (pas des références de couleurs commerciales). Ce programme ne produit pas de PDF. Enregistrer sous `BeadPatternGateDemo.java` :

~~~bash
javac --release 17 BeadPatternGateDemo.java
java BeadPatternGateDemo
~~~

~~~java
public final class BeadPatternGateDemo {
    static final String[] ROWS = {"----", "-RR-", "-RBB", "BBBB"};

    static char[][] enlargeNearest(int factor) {
        int height = ROWS.length;
        int width = ROWS[0].length();
        char[][] preview = new char[height * factor][width * factor];
        for (int y = 0; y < preview.length; y++) {
            for (int x = 0; x < preview[0].length; x++) {
                preview[y][x] = ROWS[y / factor].charAt(x / factor);
            }
        }
        return preview;
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        int width = ROWS[0].length();
        for (String row : ROWS) {
            check(row.length() == width, "all rows must have equal width");
            check(row.matches("[-RB]+"), "unknown color code");
        }
        java.util.Map<Character, Integer> counts = new java.util.TreeMap<>();
        for (String row : ROWS) {
            for (char color : row.toCharArray()) counts.merge(color, 1, Integer::sum);
        }
        check(ROWS.length * width == 16, "grid dimensions");
        check(counts.get('-') == 7 && counts.get('R') == 3 && counts.get('B') == 6,
              "color totals");
        char[][] preview = enlargeNearest(3);
        check(preview.length == 12 && preview[0].length == 12, "preview size");
        for (int y = 0; y < preview.length; y++) {
            for (int x = 0; x < preview[0].length; x++) {
                check(preview[y][x] == ROWS[y / 3].charAt(x / 3),
                      "nearest-neighbor preserves exact cells");
            }
        }
        System.out.println("PASS: 16 cells, empty=7, R=3, B=6, beads=9; 12x12 nearest-neighbor preview");
    }
}
~~~

Résultat attendu :

~~~text
PASS: 16 cells, empty=7, R=3, B=6, beads=9; 12x12 nearest-neighbor preview
~~~

Compilation et exécution vérifiées avec `javac --release 17`. Le test couvre seulement la grille, le comptage et l'agrandissement par plus proche voisin. **Aucun PDF 40×40/52×52 ni résultat d'impression n'a été validé.**

## Pièges fréquents

1. Agrandir une petite image par interpolation bilinéaire : les couleurs se mélangent aux frontières.
2. Confondre fond transparent et perles blanches : le coût estimé devient faux.
3. Générer la légende et les quantités à partir d'une autre version de la grille.
4. Insérer seulement une petite image matricielle dans le PDF : le zoom révèle les défauts.
5. Approuver le patron en regardant seulement une capture d'écran, sans essai d'impression A4.
6. Croire qu'un PDF vectoriel suffit : caractères trop petits et contrastes insuffisants restent illisibles.

## Question d'entrevue senior — répondez d'abord

Votre service transforme un personnage généré par IA en patron de perles **52×52**, avec aperçu, codes de couleur par case et PDF. Une personne signale un PDF flou et un décompte incohérent. **Comment concevoiriez-vous le modèle de données unique, le pipeline et les tests automatiques pour garantir que les trois sorties proviennent exactement de la même grille?** La solution n'est pas fournie ici.

## Exercice pratique de 15 minutes

1. Compiler et exécuter le programme; confirmer 16 cases, 7 cases vides et 9 perles.
2. Raccourcir volontairement une ligne pour déclencher la vérification des dimensions.
3. Remplacer une couleur par `X` pour déclencher la vérification des codes.
4. Préparer une liste de vérification des patrons 40×40/52×52 : dimensions, transparence, couleurs, numéros, quantités et impression A4. Ne pas approuver les fichiers candidats sans examen.

## À retenir

**La qualité d'un patron vendable repose sur une grille discrète contrôlée, et non seulement sur une image IA séduisante.** L'aperçu nearest-neighbor préserve les cases; le PDF vectoriel facilite l'impression. La grille unique doit piloter le dessin, la légende et les quantités. Une validation visuelle et imprimée demeure indispensable.
