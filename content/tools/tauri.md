---
title: Tauri
ring: assess
quadrant: tools
tags: [desktop, rust, webview, cross-platform]
date: 2024-04-10
description: Framework pour construire des applications desktop légères avec un frontend web et un backend Rust
---

## Contexte

Tauri est une alternative à Electron qui utilise le WebView natif du système plutôt qu'un Chromium embarqué. Les binaires sont 10-20x plus petits.

## À évaluer

L'API Rust backend est puissante mais nécessite des compétences Rust. Le support multiplateforme est bon mais moins mature qu'Electron.

## Recommandation

**À évaluer** si vous développez des outils desktop internes et souhaitez éviter la lourdeur d'Electron.
