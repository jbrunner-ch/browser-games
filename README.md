# 🎮 Arcade Realm - High Quality Browser Games

Eine moderne, qualitativ hochwertige Sammlung von 10 Browsergames mit 3D- und 2D-Engines, prozeduraler Levelgenerierung, Sound-Synthese und integriertem Stealth-Modus. Alles läuft 100% lokal im Browser oder direkt über **GitHub Pages** ohne jegliche Backend-Abhängigkeiten.

---

## 🕹️ Enthaltene Spiele (10 Spiele)

| # | Spiel | Genre | Highlights |
|---|---|---|---|
| 1 | **VoxelCraft 3D** | 3D Voxel Sandbox | Minecraft-Mechaniken, prozedurale Welten (Hügel, Berge, Wüsten, schwebende Inseln), Tag/Nacht-Zyklus, Hotbar 1-9, Mining & Blockbau |
| 2 | **Traffic Escape (Rush Hour)** | 2D Top-Down Puzzle | Rotes Sportauto aus dem Parkplatz befreien, Schiebemechanik, Zugzähler, Undo-Funktion, prozedurale & kuratierte Parkplätze |
| 3 | **Velocity Rush 3D** | 3D Racing | Echte Fahrphysik, Drifting mit Reifenspuren, dynamische Rennstrecken, KI-Gegner, Speedometer & HUD |
| 4 | **Cyber Siege** | Tower Defense | Wellen-Verteidigung, Gatling, Plasma-AOE, Cryo-Frost & Tesla-Chain Türme mit Upgrade-System |
| 5 | **Gravity Runner** | 2D Platformer | Präzisions-Plattformer mit Wandsprüngen, Wall-Slide, Mid-Air Dash und Kristallsammlung |
| 6 | **Neo-Breakout Deluxe** | Arcade Brick Breaker | Ball-Abprallphysik, Laser-Paddel, Multiball, Explosiv-Bricks und Spezial-Powerups |
| 7 | **Cosmic Strike** | Space Bullet-Hell | Sternenfeld-Parallax, Squadrons, Waffen-Upgrades und riesige Endbosse |
| 8 | **Shadow Labyrinth** | Roguelike Dungeon | Prozeduraler Dungeon-Generator mit dynamischem Fog-of-War (Sichtfeld), Schwert- und Zauberkampf |
| 9 | **Hexa & Classic Minesweeper** | Puzzle Klassiker | 100% fairer Erstklick-Schutz, wahlweise im klassischen Quadrat- oder Hexagonal-Gitter |
| 10 | **Neon Snake 3D** | 3D Arcade | Cyberpunk-Schlange in 3D Arena mit Energie-Orbs und Hindernis-Parcours |

---

## 🚀 Steuerung & Tastenkürzel

### Einheitliche Globale Tasten
- **`B`**: **Stealth Boss Key** 🕵️ – Pausiert sofort jedes Spiel, schaltet den Ton stumm und wechselt in Millisekunden auf einen täuschend echten **Google Docs Tarnbildschirm** (vollständig editierbar). Erneutes Drücken von `B` oder Klick auf "Zurück" setzt das Spiel fort.
- **`N`**: **Notfall-Schnellschliessung** 🚨 – Schliesst sofort den Tab (`window.close()` bzw. leitet sofort auf Google um, falls Pop-up-Blocker greifen).
- **`F11` / Button**: **Vollbildmodus** (Fullscreen ein-/ausschalten).

### Spiel-Steuerungen
- **VoxelCraft 3D**: `W, A, S, D` zum Gehen, `Leertaste` zum Springen, `Maus` zum Umsehen (Klick aktiviert Pointer-Lock), `L-Klick` zum Abbauen, `R-Klick` zum Platzieren, `1-9` Block wählen.
- **Traffic Escape**: `Mausklick + Ziehen` auf Autos, um sie horizontal oder vertikal zu verschieben.
- **Velocity Rush 3D**: `W` / `↑` Gas, `S` / `↓` Bremse / Rückwärts, `A` / `D` Lenken, `Leertaste` Handbremse / Drift.
- **Weitere**: Im Spiel jeweils über den Button **"Steuerung"** in der oberen Leiste einsehbar.

---

## 📁 Projektstruktur

```
browser-games/
├── index.html                 # Hauptseite & Google Docs Stealth Screen
├── README.md                  # Dokumentation
├── css/
│   ├── main.css               # Portal-Styles, Navigationsleiste, Grid, Modale
│   ├── games.css              # HUDs, Speedometer, Minecraft-Hotbar, Overlays
│   └── doc-stealth.css        # Pixel-genauer Google Docs Tarnbildschirm
├── js/
│   ├── audio.js               # Web Audio API Synthesizer (Zero-Dependency Sounds)
│   ├── portal.js              # Master Controller, Game Switching, Level Manager
│   └── games/
│       ├── minecraft.js       # 3D Voxel Engine (Three.js)
│       ├── rushhour.js        # 2D Parkplatz-Puzzle
│       ├── racing3d.js        # 3D Rennspiel mit Physik
│       ├── towerdefense.js    # Tower Defense
│       ├── platformer.js      # 2D Precision Runner
│       ├── breakout.js        # Neo-Breakout Brick Breaker
│       ├── spaceshooter.js    # Space Bullet Hell
│       ├── dungeon.js         # Roguelike Dungeon Crawler
│       ├── minesweeper.js     # Hexa & Classic Minesweeper
│       └── snake3d.js         # 3D Cyber Snake
```

---

## 🌐 Lokale Ausführung & GitHub Pages

### Lokal im Browser öffnen
Einfach `index.html` per Doppelklick in einem beliebigen modernen Browser (Chrome, Firefox, Edge, Safari) öffnen. Es ist kein Build-Step erforderlich.

### Auf GitHub Pages veröffentlichen
1. Repository zu GitHub pushen:
   ```bash
   git add .
   git commit -m "Add Arcade Realm multi-game portal"
   git push origin main
   ```
2. Auf GitHub im Repository unter **Settings -> Pages** den Branch `main` und Ordner `/ (root)` auswählen und speichern.
3. Die Webapplikation ist sofort weltweit unter `https://<dein-username>.github.io/<repo-name>/` erreichbar!

