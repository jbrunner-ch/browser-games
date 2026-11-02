/**
 * Master Game Portal Manager
 * Manages game registry, switching between games, level selectors,
 * fullscreen toggling, and the Stealth 'Boss Key' (Google Docs Decoy + Tab Closer).
 */

class GamePortal {
    constructor() {
        this.currentGame = null;
        this.currentGameId = null;
        this.isBossActive = false;
        this.currentDifficulty = 'Normal';
        this.currentLevel = 1;

        // Boss Key config (Uniform across portal)
        this.bossKey = 'KeyB'; // 'B' key
        this.panicCloseKey = 'KeyN'; // 'N' key

        // Registry of 10 Games
        this.games = [
            {
                id: 'minecraft',
                title: 'VoxelCraft 3D',
                category: '3d',
                badge: '3D Voxel World',
                featured: true,
                desc: 'Minecraft-inspiriertes 3D Sandbox-Spiel mit prozeduraler Welt, Physik, Tag/Nacht-Zyklus, Hotbar und Block-Mining/Building.',
                class: 'VoxelCraftGame',
                controls: [
                    { keys: ['W', 'A', 'S', 'D'], desc: 'Bewegen' },
                    { keys: ['Space'], desc: 'Springen' },
                    { keys: ['Shift'], desc: 'Sneaken / Sprinten' },
                    { keys: ['Mouse'], desc: 'Umsehen (Pointer Lock)' },
                    { keys: ['L-Click'], desc: 'Block abbauen' },
                    { keys: ['R-Click'], desc: 'Block platzieren' },
                    { keys: ['1-9'], desc: 'Block auswählen' }
                ],
                levels: [
                    { num: 1, name: 'Grüne Hügel (Plains)', diff: 'Normal' },
                    { num: 2, name: 'Alpine Berge (Cliffs)', diff: 'Normal' },
                    { num: 3, name: 'Wüsten-Oase (Desert)', diff: 'Hard' },
                    { num: 4, name: 'Schwebende Inseln (Void)', diff: 'Hard' },
                    { num: 5, name: 'Nether Caverns (Lava)', diff: 'Expert' }
                ]
            },
            {
                id: 'rushhour',
                title: 'Traffic Escape (Rush Hour)',
                category: 'puzzle',
                badge: '2D Top-Down',
                featured: true,
                desc: 'Befreie das rote Sportauto in einer 2D-Draufsicht aus dem verstopften Parkplatz durch horizontales und vertikales Verschieben.',
                class: 'RushHourGame',
                controls: [
                    { keys: ['Mausklick / Drag'], desc: 'Fahrzeuge entlang ihrer Spur verschieben' },
                    { keys: ['Undo'], desc: 'Letzten Zug rückgängig machen' },
                    { keys: ['Reset'], desc: 'Parkplatz neu aufbauen' }
                ],
                levels: [
                    { num: 1, name: 'Parkplatz A1 (Sehr Leicht)', diff: 'Easy' },
                    { num: 2, name: 'Parkplatz B2 (Leicht)', diff: 'Easy' },
                    { num: 3, name: 'Parkplatz C3 (Mittel)', diff: 'Normal' },
                    { num: 4, name: 'Rush Hour D4 (Schwer)', diff: 'Hard' },
                    { num: 5, name: 'Mega Grid E5 (Experte)', diff: 'Expert' },
                    { num: 6, name: 'Prozedural Level 6', diff: 'Expert' },
                    { num: 7, name: 'Prozedural Level 7', diff: 'Expert' }
                ]
            },
            {
                id: 'racing3d',
                title: 'Velocity Rush 3D',
                category: '3d',
                badge: '3D Rennspiel',
                featured: true,
                desc: 'Schnelles 3D-Rennspiel mit echter Fahrphysik, Drifting, Reifenspuren, dynamischen Rennstrecken, KI-Gegnern und Tacho-HUD.',
                class: 'Racing3DGame',
                controls: [
                    { keys: ['W / ↑'], desc: 'Gas geben' },
                    { keys: ['S / ↓'], desc: 'Bremse / Rückwärts' },
                    { keys: ['A / D / ← / →'], desc: 'Lenken' },
                    { keys: ['Space'], desc: 'Handbremse / Drift' }
                ],
                levels: [
                    { num: 1, name: 'Sunburst Coastal Ring', diff: 'Easy' },
                    { num: 2, name: 'Tokyo Neon Cyberway', diff: 'Normal' },
                    { num: 3, name: 'Grand Canyon Pass', diff: 'Hard' },
                    { num: 4, name: 'Alpine Snow Drift', diff: 'Hard' },
                    { num: 5, name: 'Formula Championship', diff: 'Expert' }
                ]
            },
            {
                id: 'towerdefense',
                title: 'Cyber Siege: Tower Defense',
                category: 'strategy',
                badge: 'Strategie',
                desc: 'Verteidige deine Energiebasis gegen Wellen von Cyber-Mechs. Baue Gatlings, Plasma-Kanonen, Cryo-Türme und Tesla-Spulen mit Upgrades.',
                class: 'TowerDefenseGame',
                controls: [
                    { keys: ['Mausklick'], desc: 'Turm platzieren / Upgraden' },
                    { keys: ['Shop'], desc: 'Turmart auswählen' },
                    { keys: ['Start Wave'], desc: 'Nächste Angriffswelle rufen' }
                ],
                levels: [
                    { num: 1, name: 'Sektor 1: Winding Pass', diff: 'Normal' },
                    { num: 2, name: 'Sektor 2: Spiral Outpost', diff: 'Hard' },
                    { num: 3, name: 'Sektor 3: Zig-Zag Core', diff: 'Expert' }
                ]
            },
            {
                id: 'platformer',
                title: 'Gravity Runner',
                category: 'action',
                badge: '2D Platformer',
                desc: 'Präziser Plattformer mit Doppel-Sprung, Wall-Sliding, Wall-Jumps, Mid-Air Dash und Kristallsammlung in tödlichen Hindernis-Arealen.',
                class: 'PlatformerGame',
                controls: [
                    { keys: ['A / D / ← / →'], desc: 'Laufen' },
                    { keys: ['W / Space / ↑'], desc: 'Springen / Wall Jump' },
                    { keys: ['J / K / Shift'], desc: 'Dash (Geister-Trail)' }
                ],
                levels: [
                    { num: 1, name: 'Zone 1: Erste Hürden', diff: 'Easy' },
                    { num: 2, name: 'Zone 2: Vertikaler Schacht', diff: 'Normal' },
                    { num: 3, name: 'Zone 3: Spikes & Abgründe', diff: 'Hard' },
                    { num: 4, name: 'Zone 4: Präzisions-Sprint', diff: 'Expert' }
                ]
            },
            {
                id: 'breakout',
                title: 'Neo-Breakout Deluxe',
                category: 'arcade',
                badge: 'Arcade',
                desc: 'High-Speed Brick Breaker mit Power-Ups (Multiball, Laserkanone, Feuerball, Breites Paddel), Explosiv-Steinen und dynamischem Abprallwinkel.',
                class: 'BreakoutGame',
                controls: [
                    { keys: ['Maus / A, D'], desc: 'Paddel bewegen' },
                    { keys: ['Space'], desc: 'Laser abfeuern (bei Power-Up)' }
                ],
                levels: [
                    { num: 1, name: 'Stage 1: Neon Grid', diff: 'Easy' },
                    { num: 2, name: 'Stage 2: Checkerboard', diff: 'Normal' },
                    { num: 3, name: 'Stage 3: Armored Core', diff: 'Hard' }
                ]
            },
            {
                id: 'spaceshooter',
                title: 'Cosmic Strike: Bullet Hell',
                category: 'arcade',
                badge: 'Space Shooter',
                desc: 'Rasantes vertikales Weltraum-Shooter Game mit Sternenfeld, Wellen von Kampfschiffen, Waffen-Upgrades und gigantischen Endbossen.',
                class: 'SpaceShooterGame',
                controls: [
                    { keys: ['Maus / WASD'], desc: 'Raumschiff steuern' },
                    { keys: ['Auto-Fire'], desc: 'Dauerfeuer aktiviert' }
                ],
                levels: [
                    { num: 1, name: 'Sektor Alpha (Aufklärer)', diff: 'Normal' },
                    { num: 2, name: 'Sektor Beta (Geschwader)', diff: 'Hard' },
                    { num: 3, name: 'Sektor Gamma (Dreadnought)', diff: 'Expert' }
                ]
            },
            {
                id: 'dungeon',
                title: 'Shadow Labyrinth',
                category: 'rpg',
                badge: 'Roguelike',
                desc: 'Prozedural generierter Dungeon-Crawler mit Raycasting Fog-of-War, Schwertkämpfen, Feuerball-Magie, Monstern und Treppen-Abstiegen.',
                class: 'DungeonGame',
                controls: [
                    { keys: ['W / A / S / D'], desc: 'Gehen' },
                    { keys: ['Space'], desc: 'Schwert-Angriff' },
                    { keys: ['F / J'], desc: 'Feuerball zaubern' }
                ],
                levels: [
                    { num: 1, name: 'Kerker Ebene 1', diff: 'Normal' },
                    { num: 2, name: 'Kerker Ebene 2', diff: 'Normal' },
                    { num: 3, name: 'Kerker Ebene 3 (Katakomben)', diff: 'Hard' },
                    { num: 4, name: 'Kerker Ebene 4 (Drachenhöhle)', diff: 'Expert' }
                ]
            },
            {
                id: 'minesweeper',
                title: 'Hexa & Classic Minesweeper',
                category: 'puzzle',
                badge: 'Klassiker / Hexagon',
                desc: 'Modernes Minesweeper mit 100% fairem Erstklick-Schutz, wahlweise im klassischen Quadrat- oder innovativen 6-Nachbar Hexagon-Gitter.',
                class: 'MinesweeperGame',
                controls: [
                    { keys: ['L-Klick'], desc: 'Feld aufdecken / Chorden' },
                    { keys: ['R-Klick'], desc: 'Flagge setzen / entfernen' }
                ],
                levels: [
                    { num: 1, name: 'Anfänger 9x9 (10 Minen)', diff: 'Easy' },
                    { num: 2, name: 'Fortgeschritten 12x12 (20 Minen)', diff: 'Normal' },
                    { num: 3, name: 'Experte 16x16 (40 Minen)', diff: 'Hard' },
                    { num: 4, name: 'Hexagonal Feld 10x10', diff: 'Hard' },
                    { num: 5, name: 'Hexagonal Master 14x14', diff: 'Expert' }
                ]
            },
            {
                id: 'snake3d',
                title: 'Neon Snake 3D',
                category: '3d',
                badge: '3D Neon Arena',
                desc: 'Futuristische 3D Cyber-Schlange auf leuchtenden Gitternetzen mit Energiebällen, Hindernissen und geschmeidiger Perspektive.',
                class: 'Snake3DGame',
                controls: [
                    { keys: ['W / A / S / D'], desc: 'Richtung wechseln' },
                    { keys: ['Pfeiltasten'], desc: 'Alternative Steuerung' }
                ],
                levels: [
                    { num: 1, name: 'Arena 1: Freies Feld', diff: 'Easy' },
                    { num: 2, name: 'Arena 2: Säulen-Labyrinth', diff: 'Normal' },
                    { num: 3, name: 'Arena 3: Todes-Wände', diff: 'Hard' }
                ]
            }
        ];
    }

    init() {
        this.renderGameCards();
        this.bindGlobalEvents();
        this.bindModals();
        this.bindBossScreen();
    }

    renderGameCards(filter = 'all', searchQuery = '') {
        const grid = document.getElementById('games-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const filtered = this.games.filter(g => {
            const matchesCat = (filter === 'all' || g.category === filter);
            const matchesSearch = (!searchQuery || g.title.toLowerCase().includes(searchQuery.toLowerCase()) || g.desc.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCat && matchesSearch;
        });

        filtered.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.onclick = () => this.launchGame(game.id);

            // Thumbnail visual gradient based on category
            const grad = game.category === '3d'
                ? 'linear-gradient(135deg, #1e3a8a, #3b82f6)'
                : game.category === 'puzzle'
                ? 'linear-gradient(135deg, #991b1b, #ef4444)'
                : game.category === 'strategy'
                ? 'linear-gradient(135deg, #065f46, #10b981)'
                : 'linear-gradient(135deg, #581c87, #8b5cf6)';

            card.innerHTML = `
                <div class="game-thumbnail" style="background: ${grad}">
                    <span class="game-tag-badge">${game.badge}</span>
                    ${game.featured ? '<span class="game-featured-badge">Featured</span>' : ''}
                    <div style="font-size: 52px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));">
                        ${this.getGameIcon(game.id)}
                    </div>
                </div>
                <div class="game-card-body">
                    <div class="game-card-header">
                        <h3 class="game-title">${game.title}</h3>
                    </div>
                    <p class="game-desc">${game.desc}</p>
                    <div class="game-card-footer">
                        <div class="game-meta">
                            <span>🎮 ${game.levels.length} Level</span>
                        </div>
                        <button class="game-play-btn" onclick="event.stopPropagation(); window.portal.launchGame('${game.id}')">
                            Spielen ▶
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    getGameIcon(id) {
        switch (id) {
            case 'minecraft': return '⛏️';
            case 'rushhour': return '🚗';
            case 'racing3d': return '🏎️';
            case 'towerdefense': return '🛡️';
            case 'platformer': return '⚡';
            case 'breakout': return '🧱';
            case 'spaceshooter': return '🚀';
            case 'dungeon': return '🗡️';
            case 'minesweeper': return '💣';
            case 'snake3d': return '🐍';
            default: return '🕹️';
        }
    }

    bindGlobalEvents() {
        // Category Pills
        const pills = document.querySelectorAll('.category-pill');
        pills.forEach(p => {
            p.onclick = () => {
                pills.forEach(item => item.classList.remove('active'));
                p.classList.add('active');
                const cat = p.dataset.category;
                const search = document.getElementById('search-games')?.value || '';
                this.renderGameCards(cat, search);
                if (window.AudioManager) window.AudioManager.playClick();
            };
        });

        // Search Input
        const searchInput = document.getElementById('search-games');
        if (searchInput) {
            searchInput.oninput = (e) => {
                const activeCat = document.querySelector('.category-pill.active')?.dataset.category || 'all';
                this.renderGameCards(activeCat, e.target.value);
            };
        }

        // Fullscreen Toggle Button
        const fsBtn = document.getElementById('btn-fullscreen');
        if (fsBtn) {
            fsBtn.onclick = () => this.toggleFullscreen();
        }

        // Sound Mute Toggle Button
        const muteBtn = document.getElementById('btn-mute');
        if (muteBtn) {
            muteBtn.onclick = () => {
                const isMuted = window.AudioManager.toggleMute();
                muteBtn.innerHTML = isMuted ? '🔇 Muted' : '🔊 Sound';
                this.showToast(isMuted ? 'Ton stummgeschaltet' : 'Ton aktiviert');
            };
        }

        // Back to Portal Button
        const backBtn = document.getElementById('btn-back-hub');
        if (backBtn) {
            backBtn.onclick = () => this.closeActiveGame();
        }

        // Controls Modal button
        const controlsBtn = document.getElementById('btn-show-controls');
        if (controlsBtn) {
            controlsBtn.onclick = () => this.openControlsModal();
        }

        // Level Select button on top bar
        const lvlBtn = document.getElementById('btn-show-levels');
        if (lvlBtn) {
            lvlBtn.onclick = () => this.openLevelSelectModal();
        }

        // Global Boss Key Listener ('B') & Quick Close ('N')
        window.addEventListener('keydown', (e) => {
            // Check if typing inside Google docs page or search input
            const activeEl = document.activeElement;
            const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.isContentEditable);

            if (e.code === this.bossKey && !isTyping) {
                e.preventDefault();
                this.toggleBossScreen();
            } else if (e.code === this.panicCloseKey && (this.isBossActive || !isTyping)) {
                e.preventDefault();
                this.emergencyCloseTab();
            }
        });

        // Stealth button in header
        const bossBtn = document.getElementById('btn-stealth-boss');
        if (bossBtn) {
            bossBtn.onclick = () => this.toggleBossScreen();
        }
    }

    bindModals() {
        const closeModals = () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            if (this.currentGame && this.currentGame.resume) {
                this.currentGame.resume();
            }
        };

        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.onclick = closeModals;
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.onclick = (e) => {
                if (e.target === overlay) closeModals();
            };
        });
    }

    launchGame(gameId, levelIndex = 1, difficulty = 'Normal') {
        const meta = this.games.find(g => g.id === gameId);
        if (!meta) return;

        // Destroy old game if running
        if (this.currentGame && this.currentGame.destroy) {
            this.currentGame.destroy();
        }

        this.currentGameId = gameId;
        this.currentLevel = levelIndex;
        this.currentDifficulty = difficulty;

        // Show Game Viewport
        const viewport = document.getElementById('game-viewport');
        const titleEl = document.getElementById('active-game-title');
        const lvlPill = document.getElementById('active-level-indicator');

        if (viewport) viewport.classList.add('active');
        if (titleEl) titleEl.innerText = `${meta.title}`;
        if (lvlPill) lvlPill.innerText = `Level ${levelIndex} (${difficulty}) ▾`;

        const container = document.getElementById('game-container');
        container.innerHTML = '';

        // Instantiate Game
        const GameClass = window[meta.class];
        if (GameClass) {
            this.currentGame = new GameClass();
            this.currentGame.init(container, {
                levelIndex: levelIndex,
                difficulty: difficulty
            });
        }

        if (window.AudioManager) window.AudioManager.playSelect();
        this.showToast(`${meta.title} gestartet! [Taste B = Google Docs Tarnmodus]`);
    }

    closeActiveGame() {
        if (this.currentGame && this.currentGame.destroy) {
            this.currentGame.destroy();
            this.currentGame = null;
        }
        this.currentGameId = null;

        const viewport = document.getElementById('game-viewport');
        if (viewport) viewport.classList.remove('active');

        if (window.AudioManager) window.AudioManager.playClick();
    }

    openLevelSelectModal() {
        if (!this.currentGameId) return;
        const meta = this.games.find(g => g.id === this.currentGameId);
        if (!meta) return;

        if (this.currentGame && this.currentGame.pause) {
            this.currentGame.pause();
        }

        const modal = document.getElementById('level-modal');
        const grid = document.getElementById('level-modal-grid');
        grid.innerHTML = '';

        meta.levels.forEach(lvl => {
            const btn = document.createElement('div');
            btn.className = `level-item-btn ${lvl.num === this.currentLevel ? 'selected' : ''}`;
            btn.innerHTML = `
                <div class="level-num">${lvl.num}</div>
                <div class="level-difficulty-tag">${lvl.diff}</div>
            `;
            btn.onclick = () => {
                this.currentLevel = lvl.num;
                this.currentDifficulty = lvl.diff;
                modal.classList.remove('active');
                this.launchGame(this.currentGameId, lvl.num, lvl.diff);
            };
            grid.appendChild(btn);
        });

        modal.classList.add('active');
    }

    openControlsModal() {
        if (!this.currentGameId) return;
        const meta = this.games.find(g => g.id === this.currentGameId);
        if (!meta) return;

        if (this.currentGame && this.currentGame.pause) {
            this.currentGame.pause();
        }

        const modal = document.getElementById('controls-modal');
        const list = document.getElementById('controls-modal-list');
        list.innerHTML = '';

        meta.controls.forEach(ctrl => {
            const row = document.createElement('div');
            row.className = 'control-row';
            row.innerHTML = `
                <div class="control-desc">${ctrl.desc}</div>
                <div class="control-keys">
                    ${ctrl.keys.map(k => `<span class="key-badge">${k}</span>`).join('')}
                </div>
            `;
            list.appendChild(row);
        });

        // Add standard universal keys info
        const universal = [
            { keys: ['B'], desc: 'Google Docs Stealth Screen (Tarnung)' },
            { keys: ['N'], desc: 'Notfall: Tab sofort schliessen' },
            { keys: ['F11 / Button'], desc: 'Vollbildmodus umschalten' }
        ];

        const divider = document.createElement('div');
        divider.style.cssText = 'height:1px; background:#334155; margin:12px 0;';
        list.appendChild(divider);

        universal.forEach(u => {
            const row = document.createElement('div');
            row.className = 'control-row';
            row.innerHTML = `
                <div class="control-desc" style="color:#93c5fd;">${u.desc}</div>
                <div class="control-keys">
                    ${u.keys.map(k => `<span class="key-badge" style="border-color:#3b82f6;">${k}</span>`).join('')}
                </div>
            `;
            list.appendChild(row);
        });

        modal.classList.add('active');
    }

    /* Stealth Boss Key Feature (Google Docs Decoy Screen) */
    bindBossScreen() {
        const decoy = document.getElementById('boss-screen-decoy');
        if (!decoy) return;

        // Clicking the back button inside decoy screen returns to game
        const backBtn = document.getElementById('btn-boss-return');
        if (backBtn) {
            backBtn.onclick = () => this.toggleBossScreen();
        }
    }

    toggleBossScreen() {
        this.isBossActive = !this.isBossActive;
        const screen = document.getElementById('boss-screen-decoy');

        if (this.isBossActive) {
            // Pause current game and mute sound
            if (this.currentGame && this.currentGame.pause) {
                this.currentGame.pause();
            }
            if (window.AudioManager) window.AudioManager.setMuted(true);

            // Change page title & favicon to disguise in browser tabs
            document.title = 'Q4 Strategic Operations & Budget Allocation - Google Docs';
            const icon = document.querySelector("link[rel*='icon']");
            if (icon) icon.href = 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico';

            screen.classList.add('active');
        } else {
            // Restore game
            screen.classList.remove('active');
            document.title = 'Arcade Realm - High Quality Browser Games';

            if (window.AudioManager) window.AudioManager.setMuted(false);
            if (this.currentGame && this.currentGame.resume) {
                this.currentGame.resume();
            }
        }
    }

    emergencyCloseTab() {
        try {
            window.close();
        } catch (e) {}

        // If programmatic window.close is blocked by browser policies:
        // Redirect immediately to clean Google search page
        window.location.replace('https://www.google.com');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }

    showToast(message) {
        let toast = document.getElementById('portal-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'portal-toast';
            toast.className = 'toast-msg';
            document.body.appendChild(toast);
        }
        toast.innerText = message;
        toast.classList.add('show');
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3200);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.portal = new GamePortal();
    window.portal.init();
});

