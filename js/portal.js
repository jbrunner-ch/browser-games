/**
 * Master Game Portal Manager
 * Handles game registration, dynamic level selection (1 - 100+),
 * reliable container resizing, clean theme, and secret stealth keys.
 */

class GamePortal {
    constructor() {
        this.currentGame = null;
        this.currentGameId = null;
        this.isBossActive = false;
        this.currentLevel = 1;
        this.levelPage = 1; // 1-10, 11-20, etc.

        // Secret keys (hidden from UI)
        this.bossKey = 'KeyB';
        this.panicCloseKey = 'KeyN';

        // 10 Games Registry
        this.games = [
            {
                id: 'minecraft',
                title: 'VoxelCraft 3D',
                category: '3d',
                badge: '3D Voxel Engine',
                desc: '3D Voxel Sandbox mit prozeduraler Terrain-Generierung, Beleuchtung, Block-Mining und Blockbau.',
                class: 'VoxelCraftGame',
                controls: [
                    { keys: ['W, A, S, D'], desc: 'Bewegen' },
                    { keys: ['Leertaste'], desc: 'Springen' },
                    { keys: ['Maus'], desc: 'Kamera steuern' },
                    { keys: ['L-Klick'], desc: 'Block abbauen' },
                    { keys: ['R-Klick'], desc: 'Block platzieren' },
                    { keys: ['1 - 9'], desc: 'Block auswählen' }
                ]
            },
            {
                id: 'rushhour',
                title: 'Traffic Escape (Rush Hour)',
                category: 'puzzle',
                badge: '2D Puzzle',
                desc: 'Befreie das rote Auto aus dem Parkplatz durch horizontales und vertikales Verschieben der Fahrzeuge.',
                class: 'RushHourGame',
                controls: [
                    { keys: ['Mausklick + Ziehen'], desc: 'Fahrzeuge entlang der Spur verschieben' },
                    { keys: ['Undo'], desc: 'Letzten Schritt zurücknehmen' },
                    { keys: ['Reset'], desc: 'Level zurücksetzen' }
                ]
            },
            {
                id: 'racing3d',
                title: 'Velocity Rush 3D',
                category: '3d',
                badge: '3D Racing',
                desc: 'Rennspiel mit echter Fahrphysik, Drift-Dynamik, dynamischen Rennstrecken und KI-Gegnern.',
                class: 'Racing3DGame',
                controls: [
                    { keys: ['W / ↑'], desc: 'Gas geben' },
                    { keys: ['S / ↓'], desc: 'Bremse / Rückwärts' },
                    { keys: ['A, D / ←, →'], desc: 'Lenken' },
                    { keys: ['Leertaste'], desc: 'Handbremse / Drift' }
                ]
            },
            {
                id: 'towerdefense',
                title: 'Cyber Siege',
                category: 'strategy',
                badge: 'Tower Defense',
                desc: 'Strategische Verteidigung mit Gatling-, Plasma-, Cryo- und Tesla-Türmen gegen skalierende Mech-Wellen.',
                class: 'TowerDefenseGame',
                controls: [
                    { keys: ['Mausklick'], desc: 'Turm platzieren / Upgraden' },
                    { keys: ['Shop'], desc: 'Turmart wählen' },
                    { keys: ['Start Wave'], desc: 'Welle starten' }
                ]
            },
            {
                id: 'platformer',
                title: 'Gravity Runner',
                category: 'action',
                badge: '2D Plattformer',
                desc: 'Präzisions-Plattformer mit Doppelsprung, Wall-Slide, Wall-Jumps, Mid-Air Dash und Kristallsammlung.',
                class: 'PlatformerGame',
                controls: [
                    { keys: ['A, D / Pfeile'], desc: 'Laufen' },
                    { keys: ['W / Leertaste'], desc: 'Springen / Wandsprung' },
                    { keys: ['J / Shift'], desc: 'Dash' }
                ]
            },
            {
                id: 'breakout',
                title: 'Neo-Breakout',
                category: 'arcade',
                badge: 'Arcade',
                desc: 'Brick Breaker mit Ball-Abprallwinkeln, Multiball, Laser-Paddel, TNT-Steinen und Powerups.',
                class: 'BreakoutGame',
                controls: [
                    { keys: ['Maus / A, D'], desc: 'Paddel bewegen' },
                    { keys: ['Leertaste'], desc: 'Laser abfeuern' }
                ]
            },
            {
                id: 'spaceshooter',
                title: 'Cosmic Strike',
                category: 'arcade',
                badge: 'Space Shooter',
                desc: 'Bullet-Hell Weltraum-Shooter mit dynamischen Formationen, Schild-Mechanik und Flaggschiff-Bossen.',
                class: 'SpaceShooterGame',
                controls: [
                    { keys: ['Maus / WASD'], desc: 'Schiff steuern' },
                    { keys: ['Auto-Fire'], desc: 'Automatisches Feuer' }
                ]
            },
            {
                id: 'dungeon',
                title: 'Shadow Labyrinth',
                category: 'rpg',
                badge: 'Roguelike',
                desc: 'Prozeduraler Dungeon-Crawler mit dynamischem Sichtfeld (Fog of War), Monstern und Magie.',
                class: 'DungeonGame',
                controls: [
                    { keys: ['W, A, S, D'], desc: 'Gehen' },
                    { keys: ['Leertaste'], desc: 'Schwertangriff' },
                    { keys: ['F'], desc: 'Feuerballzauber' }
                ]
            },
            {
                id: 'minesweeper',
                title: 'Hexa & Classic Minesweeper',
                category: 'puzzle',
                badge: 'Puzzle Klassiker',
                desc: 'Modernes Minesweeper mit fairem Erstklick, Quadrat- und 6-Nachbar Hexagon-Gitter.',
                class: 'MinesweeperGame',
                controls: [
                    { keys: ['L-Klick'], desc: 'Aufdecken' },
                    { keys: ['R-Klick'], desc: 'Flagge setzen' }
                ]
            },
            {
                id: 'snake3d',
                title: 'Neon Snake 3D',
                category: '3d',
                badge: '3D Arcade',
                desc: '3D Cyber-Schlange auf einem leuchtenden Gitter mit Energie-Orbs und Hindernissen.',
                class: 'Snake3DGame',
                controls: [
                    { keys: ['W, A, S, D'], desc: 'Richtung wechseln' },
                    { keys: ['Pfeiltasten'], desc: 'Alternative Steuerung' }
                ]
            }
        ];
    }

    init() {
        this.renderGameCards();
        this.bindEvents();
        this.bindModals();
        this.bindStealthKeys();
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
            card.onclick = () => this.launchGame(game.id, 1);

            card.innerHTML = `
                <div class="game-thumbnail">
                    <span class="game-tag-badge">${game.badge}</span>
                    <div style="font-size: 38px; color: var(--text-primary);">${this.getGameIcon(game.id)}</div>
                </div>
                <div class="game-card-body">
                    <div class="game-card-header">
                        <h3 class="game-title">${game.title}</h3>
                    </div>
                    <p class="game-desc">${game.desc}</p>
                    <div class="game-card-footer">
                        <div class="game-meta">Level 1 - 100+</div>
                        <button class="game-play-btn" onclick="event.stopPropagation(); window.portal.launchGame('${game.id}', 1)">
                            Starten
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    getGameIcon(id) {
        switch (id) {
            case 'minecraft': return '▣';
            case 'rushhour': return '▤';
            case 'racing3d': return '◈';
            case 'towerdefense': return '▲';
            case 'platformer': return '◆';
            case 'breakout': return '▦';
            case 'spaceshooter': return '▲';
            case 'dungeon': return '❖';
            case 'minesweeper': return '⬡';
            case 'snake3d': return '◯';
            default: return '▶';
        }
    }

    bindEvents() {
        // Category Pills
        const pills = document.querySelectorAll('.category-pill');
        pills.forEach(p => {
            p.onclick = () => {
                pills.forEach(item => item.classList.remove('active'));
                p.classList.add('active');
                const cat = p.dataset.category;
                const search = document.getElementById('search-games')?.value || '';
                this.renderGameCards(cat, search);
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

        // Fullscreen
        const fsBtn = document.getElementById('btn-fullscreen');
        if (fsBtn) {
            fsBtn.onclick = () => this.toggleFullscreen();
        }

        // Sound Mute
        const muteBtn = document.getElementById('btn-mute');
        if (muteBtn) {
            muteBtn.onclick = () => {
                const isMuted = window.AudioManager.toggleMute();
                muteBtn.innerText = isMuted ? 'Stumm' : 'Sound';
            };
        }

        // Back to Hub
        const backBtn = document.getElementById('btn-back-hub');
        if (backBtn) {
            backBtn.onclick = () => this.closeActiveGame();
        }

        // Level Select button on top bar
        const lvlBtn = document.getElementById('btn-show-levels');
        const lvlIndicator = document.getElementById('active-level-indicator');
        if (lvlBtn) lvlBtn.onclick = () => this.openLevelSelectModal();
        if (lvlIndicator) lvlIndicator.onclick = () => this.openLevelSelectModal();

        // Controls button
        const controlsBtn = document.getElementById('btn-show-controls');
        if (controlsBtn) controlsBtn.onclick = () => this.openControlsModal();
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

        // Level Jump Input
        const jumpBtn = document.getElementById('btn-level-jump');
        const jumpInput = document.getElementById('level-jump-val');
        if (jumpBtn && jumpInput) {
            jumpBtn.onclick = () => {
                const val = parseInt(jumpInput.value, 10);
                if (val >= 1 && val <= 1000) {
                    document.getElementById('level-modal')?.classList.remove('active');
                    this.launchGame(this.currentGameId, val);
                }
            };
        }
    }

    bindStealthKeys() {
        // Global listener: 'B' toggles Google Docs, 'N' closes tab
        window.addEventListener('keydown', (e) => {
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
    }

    toggleBossScreen() {
        this.isBossActive = !this.isBossActive;
        const screen = document.getElementById('boss-screen-decoy');

        if (this.isBossActive) {
            if (this.currentGame && this.currentGame.pause) {
                this.currentGame.pause();
            }
            if (window.AudioManager) window.AudioManager.setMuted(true);

            document.title = 'RFC-4092: Lock-Free Distributed Ring Cache Architecture - Google Docs';
            screen?.classList.add('active');
        } else {
            screen?.classList.remove('active');
            document.title = 'Arcade Realm - Browser Games Portal';

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
        window.location.replace('https://www.google.com');
    }

    getDifficultyName(level) {
        if (level <= 5) return 'Einfach';
        if (level <= 15) return 'Mittel';
        if (level <= 30) return 'Schwer';
        if (level <= 60) return 'Experte';
        return 'Master';
    }

    launchGame(gameId, levelIndex = 1) {
        const meta = this.games.find(g => g.id === gameId);
        if (!meta) return;

        // Destroy old game if running
        if (this.currentGame && this.currentGame.destroy) {
            this.currentGame.destroy();
            this.currentGame = null;
        }

        this.currentGameId = gameId;
        this.currentLevel = levelIndex;

        // Show Game Viewport
        const viewport = document.getElementById('game-viewport');
        const titleEl = document.getElementById('active-game-title');
        const lvlPill = document.getElementById('active-level-indicator');

        if (viewport) viewport.classList.add('active');
        if (titleEl) titleEl.innerText = `${meta.title}`;
        if (lvlPill) lvlPill.innerText = `Level ${levelIndex} (${this.getDifficultyName(levelIndex)}) ▾`;

        const container = document.getElementById('game-container');
        container.innerHTML = '';

        // Allow DOM reflow so clientWidth and clientHeight are strictly valid
        requestAnimationFrame(() => {
            const GameClass = window[meta.class];
            if (GameClass) {
                this.currentGame = new GameClass();
                this.currentGame.init(container, {
                    levelIndex: levelIndex,
                    difficulty: this.getDifficultyName(levelIndex)
                });
            }
        });
    }

    closeActiveGame() {
        if (this.currentGame && this.currentGame.destroy) {
            this.currentGame.destroy();
            this.currentGame = null;
        }
        this.currentGameId = null;

        const viewport = document.getElementById('game-viewport');
        if (viewport) viewport.classList.remove('active');
    }

    openLevelSelectModal() {
        if (!this.currentGameId) return;

        if (this.currentGame && this.currentGame.pause) {
            this.currentGame.pause();
        }

        const modal = document.getElementById('level-modal');
        const tabsContainer = document.getElementById('level-page-tabs');
        const grid = document.getElementById('level-modal-grid');
        const jumpInput = document.getElementById('level-jump-val');

        if (jumpInput) jumpInput.value = this.currentLevel;

        // Build 10 page tabs (1-10, 11-20, ... 91-100)
        tabsContainer.innerHTML = '';
        const currentPage = Math.ceil(this.currentLevel / 10);

        for (let p = 1; p <= 10; p++) {
            const start = (p - 1) * 10 + 1;
            const end = p * 10;
            const tab = document.createElement('div');
            tab.className = `level-page-tab ${p === currentPage ? 'active' : ''}`;
            tab.innerText = `${start}-${end}`;
            tab.onclick = () => {
                tabsContainer.querySelectorAll('.level-page-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderLevelPage(p);
            };
            tabsContainer.appendChild(tab);
        }

        this.renderLevelPage(currentPage);
        modal.classList.add('active');
    }

    renderLevelPage(page) {
        const grid = document.getElementById('level-modal-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const start = (page - 1) * 10 + 1;
        const end = page * 10;

        for (let lvl = start; lvl <= end; lvl++) {
            const diff = this.getDifficultyName(lvl);
            const btn = document.createElement('div');
            btn.className = `level-item-btn ${lvl === this.currentLevel ? 'selected' : ''}`;
            btn.innerHTML = `
                <div class="level-num">${lvl}</div>
                <div class="level-difficulty-tag">${diff}</div>
            `;
            btn.onclick = () => {
                document.getElementById('level-modal')?.classList.remove('active');
                this.launchGame(this.currentGameId, lvl);
            };
            grid.appendChild(btn);
        }
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

        modal.classList.add('active');
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
}

window.addEventListener('DOMContentLoaded', () => {
    window.portal = new GamePortal();
    window.portal.init();
});
