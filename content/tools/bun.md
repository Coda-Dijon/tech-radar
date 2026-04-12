---
title: Bun
ring: can-use
quadrant: tools
tags: [runtime, javascript, bundler, performance]
date: 2024-03-20
description: Runtime JavaScript tout-en-un ultra-rapide (runtime + bundler + package manager)
---

## Pourquoi Bun ?

Bun est écrit en Zig et est significativement plus rapide que Node.js pour les opérations I/O et les temps de démarrage. Il intègre bundler, test runner et package manager.

## Expérimentation

Nous l'utilisons pour des scripts internes et des outils CLI. Compatible avec la majorité des packages npm. Quelques incompatibilités sur les packages natifs Node.js.

## Recommandation

**En évaluation** pour les services backend simples. Trop tôt pour remplacer Node.js en production.
