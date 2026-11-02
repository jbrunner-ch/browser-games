# 🎮 Arcade Realm - Web Games Portal

Ein minimalistisches, modulares Browsergame-Portal mit 10 Spielen, dynamischer Level-Skalierung (Level 1 - 100+), reiner Client-Side-Architektur (Three.js & Canvas 2D) und geheimem Stealth-Modus.

---

## 🕹️ Enthaltene Spiele (10 Spiele)

| # | Spiel | Genre | Highlights |
|---|---|---|---|
| 1 | **VoxelCraft 3D** | 3D Voxel Engine | Minecraft-Mechaniken, prozedurale Welten (Hügel, Berge, Wüsten), Tag/Nacht-Zyklus, Hotbar 1-9, Mining & Blockbau |
| 2 | **Traffic Escape (Rush Hour)** | 2D Top-Down Puzzle | Rotes Auto befreien, garantierte Lösbarkeit, Zugzähler, Undo-Funktion, Skalierung bis 100+ |
| 3 | **Velocity Rush 3D** | 3D Racing | Echte Fahrphysik, Drifting (`Leertaste`), dynamische Strecken, KI-Gegner, Speedometer & Rundenzeiten |
| 4 | **Cyber Siege** | Tower Defense | Wellen-Verteidigung mit Gatling-, Plasma-, Cryo- und Tesla-Türmen inklusive Upgrade-System |
| 5 | **Gravity Runner** | 2D Plattformer | Präzisions-Runner mit Wandsprüngen, Wall-Slide, Mid-Air Dash und Kristallsammlung |
| 6 | **Neo-Breakout** | Arcade Brick Breaker | Ball-Abprallphysik, Laser-Paddel, Multiball, gepanzerte Steine und Spezial-Powerups |
| 7 | **Cosmic Strike** | Space Bullet-Hell | Sternenfeld-Parallax, Squadrons, Waffen-Upgrades und Dreadnought-Bosse |
| 8 | **Shadow Labyrinth** | Roguelike Dungeon | Prozeduraler Kerker mit dynamischem Fog-of-War (Sichtfeld), Schwert- und Zauberkampf |
| 9 | **Hexa & Classic Minesweeper** | Puzzle Klassiker | 100% fairer Erstklick-Schutz, wahlweise im klassischen Quadrat- oder Hexagonal-Gitter |
| 10 | **Neon Snake 3D** | 3D Arcade | Cyberpunk-Schlange in 3D Arena mit Energie-Orbs und Hindernis-Parcours |

---

## 🎯 Level-System (Level 1 - 100+)

Jedes Spiel verfügt über ein dynamisches Level-System, das über den **"Level wählen"** Button oder den Level-Indikator aufgerufen werden kann:
- **Level 1 - 5**: Einfach (Einstieg & Basismechaniken)
- **Level 6 - 15**: Mittel (Höhere Geschwindigkeit, mehr Hindernisse)
- **Level 16 - 30**: Schwer (Komplexe Layouts, aggressivere Gegner)
- **Level 31 - 60**: Experte (Hohe Anforderungen an Präzision und Timing)
- **Level 61 - 100+**: Master (Mathematisch skalierte Endlos-Herausforderung)

Über die **Tabs (1-10, 11-20, ...)** oder das **Level-Eingabefeld** kann direkt zu jedem beliebigen Level gesprungen werden. Bei Level-Abschluss führt die Schaltfläche **"Nächstes Level ➔"** nahtlos in die nächste Stufe.

---

## 🕵️ Geheime Stealth-Funktionen (Nicht in der UI sichtbar)

- **Taste `B`**: Aktiviert sofort den **Google Docs Tarnmodus**. Das Spiel wird pausiert, der Ton stummgeschaltet und es erscheint ein täuschend echter Google-Docs-Tab mit einem Informatik-Architekturdokument (`RFC-4092: Lock-Free Distributed Ring Cache Architecture`) inklusive echten Rust- und Go-Codebeispielen und Benchmarks. Erneutes Drücken von `B` schaltet nahtlos zurück.
- **Taste `N`**: Notfall-Schliessung. Schliesst sofort den Tab (`window.close()`) bzw. leitet direkt auf die Google-Startseite um.
- **Vollbild**: Über den Button **"Vollbild"** in der Kopfzeile oder Taste `F11`.

---

## 📁 Dateistruktur

```text
browser-games/
├── index.html                 # Hauptportal & Google Docs CS RFC
├── README.md                  # Dokumentation
├── css/
│   ├── main.css               # Minimalistisches Dark-Theme (keine AI-Gradients)
│   ├── games.css              # Canvas Overlays, Speedometer, HUDs
│   └── doc-stealth.css        # Pixel-genaues Google Docs Styling
├── js/
│   ├── audio.js               # Web Audio API Sound Synthesizer
│   ├── portal.js              # Game Controller, Level Manager 1-100+, Stealth Keys
│   └── games/
│       ├── minecraft.js       # 3D Voxel Engine (Three.js)
│       ├── rushhour.js        # 2D Parkplatz-Puzzle
│       ├── racing3d.js        # 3D Rennspiel mit Fahrphysik
│       ├── towerdefense.js    # Cyber Siege Tower Defense
│       ├── platformer.js      # Gravity Runner Plattformer
│       ├── breakout.js        # Neo-Breakout Brick Breaker
│       ├── spaceshooter.js    # Cosmic Strike Bullet Hell
│       ├── dungeon.js         # Roguelike Dungeon Crawler
│       ├── minesweeper.js     # Hexa & Square Minesweeper
│       └── snake3d.js         # Neon Snake 3D
└── tests/
    ├── integration.test.js    # DOM- & Klassen-Validierung
    └── game_instances.test.js # Headless Lifecycle & Level-Progressionstests
```
