# 🪟 Roller Shutter Card

> Carte visuelle interactive pour Home Assistant permettant de contrôler vos volets roulants avec un rendu réaliste et un contrôle par glissement.

![Version](https://img.shields.io/badge/version-1.1.1-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Fonctionnalités

- 🎨 **Rendu visuel réaliste** : fenêtre avec lames de volet, ciel étoilé, croisillons
- 🖱️ **Glisser pour régler** : cliquez/glissez directement sur la fenêtre pour ajuster la position
- 📱 **Tactile** : support complet du drag & drop tactile
- 🔍 **Sélecteur d'entités** : liste automatiquement tous les covers disponibles
- ⚙️ **Config par volet** : dimensions, couleurs et options indépendantes pour chaque volet
- 🎛️ **Éditeur visuel** : configuration complète directement depuis l'interface HA
- 🏠 **Contrôles globaux** : ouvrir/fermer tous les volets d'un coup

## 📦 Installation

### Via HACS (recommandé)

1. Ouvrez HACS → **Frontend**
2. 3 points en haut à droite → **Dépôts personnalisés**
3. URL : `https://github.com/francordi85/roller-shutter-card`
4. Catégorie : **Lovelace** → **Ajouter** → **Installer**
5. Redémarrez Home Assistant

### Installation manuelle

1. Copiez `roller-shutter-card.js` dans `/config/www/roller-shutter-card/`
2. Ajoutez la ressource : `/local/roller-shutter-card/roller-shutter-card.js` (Module JavaScript)

## ⚡ Configuration

```yaml
type: custom:roller-shutter-card
title: Volets Roulants
entities:
  - cover.volet_salon
  - entity: cover.baie_vitree
    name: Baie vitrée
    icon: "🏞️"
    shutter_width: 200
    shutter_height: 240
```

## 📐 Options globales

| Option | Défaut | Description |
|--------|--------|-------------|
| `title` | `Volets Roulants` | Titre de la carte |
| `shutter_width` | `140` | Largeur (px) |
| `shutter_height` | `180` | Hauteur (px) |
| `columns` | `0` (auto) | Nombre de colonnes |
| `gap` | `28` | Espacement (px) |
| `color_open` | `#63b3ed` | Couleur ouvert |
| `color_closed` | `#ed8936` | Couleur fermé |
| `show_buttons` | `true` | Boutons ▲ ◼ ▼ |
| `show_percentage` | `true` | Pourcentage |
| `show_global_controls` | `true` | Tout ouvrir/fermer |
| `show_sky` | `true` | Ciel |
| `show_stars` | `true` | Étoiles |
| `show_window_frame` | `true` | Croisillons |
| `invert_position` | `false` | Inverser position |

## 🎯 Options par volet

Chaque volet peut surcharger les options globales :

```yaml
entities:
  - entity: cover.volet_garage
    name: Garage
    icon: "🚗"
    shutter_width: 120
    shutter_height: 140
    show_sky: false
    color_open: "#48bb78"
```

## 📄 Licence

MIT
