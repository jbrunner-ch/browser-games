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
        this.bindCloudModal();
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

            // Fetch progress & highscore from CloudStorage
            const prog = (window.CloudStorage && window.CloudStorage.getGameProgress(game.id)) || { unlockedLevel: 1, highScore: 0 };
            const hsBadge = prog.highScore > 0 ? `<span class="game-score-badge">🏆 ${prog.highScore.toLocaleString()}</span>` : '';
            const artworkContent = game.image ? `<img src="${game.image}" alt="${game.title}">` : this.getGameArtwork(game.id, game.badge);

            card.innerHTML = `
                <div class="game-thumbnail">
                    <span class="game-tag-badge">${game.badge}</span>
                    ${hsBadge}
                    ${artworkContent}
                </div>
                <div class="game-card-body">
                    <div class="game-card-header">
                        <h3 class="game-title">${game.title}</h3>
                    </div>
                    <p class="game-desc">${game.desc}</p>
                    <div class="game-card-footer">
                        <div class="game-meta">Level ${prog.unlockedLevel || 1} / 100+</div>
                        <button class="game-play-btn" onclick="event.stopPropagation(); window.portal.launchGame('${game.id}', ${prog.unlockedLevel || 1})">
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

    getGameArtwork(id, badge) {
        switch (id) {
            case 'minecraft':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="mc-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#064e3b"/>
                            <stop offset="60%" stop-color="#022c22"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                        <linearGradient id="mc-grass" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#4ade80"/>
                            <stop offset="100%" stop-color="#16a34a"/>
                        </linearGradient>
                        <linearGradient id="mc-dirt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#854d0e"/>
                            <stop offset="100%" stop-color="#451a03"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#mc-bg)"/>
                    <g opacity="0.15">
                        <line x1="0" y1="20" x2="320" y2="20" stroke="#4ade80" stroke-width="1"/>
                        <line x1="0" y1="60" x2="320" y2="60" stroke="#4ade80" stroke-width="1"/>
                        <line x1="0" y1="100" x2="320" y2="100" stroke="#4ade80" stroke-width="1"/>
                        <line x1="0" y1="140" x2="320" y2="140" stroke="#4ade80" stroke-width="1"/>
                    </g>
                    <!-- 3D Voxel Cube -->
                    <g transform="translate(160, 80)">
                        <polygon points="0,-45 42,-21 0,3 -42,-21" fill="url(#mc-grass)"/>
                        <polygon points="-42,-21 0,3 0,55 -42,31" fill="url(#mc-dirt)"/>
                        <polygon points="0,3 42,-21 42,31 0,55" fill="#582405"/>
                        <path d="M-20,-10 L-40,-30 L-30,-40 L-10,-20 Z" fill="#38bdf8" opacity="0.9"/>
                        <line x1="-35" y1="-35" x2="10" y2="10" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>
                    </g>
                    <rect x="30" y="30" width="36" height="12" fill="#e2e8f0" opacity="0.4" rx="2"/>
                    <rect x="250" y="45" width="44" height="14" fill="#e2e8f0" opacity="0.3" rx="2"/>
                    <circle cx="270" cy="90" r="2" fill="#38bdf8"/>
                    <circle cx="60" cy="110" r="3" fill="#4ade80"/>
                    <circle cx="210" cy="35" r="2.5" fill="#facc15"/>
                </svg>`;

            case 'rushhour':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="rh-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#18181b"/>
                            <stop offset="60%" stop-color="#09090b"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                        <linearGradient id="rh-car" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#ef4444"/>
                            <stop offset="100%" stop-color="#b91c1c"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#rh-bg)"/>
                    <g transform="translate(60, 20)" opacity="0.85">
                        <rect x="0" y="0" width="200" height="120" rx="8" fill="#18181b" stroke="#3f3f46" stroke-width="2"/>
                        <line x1="50" y1="0" x2="50" y2="120" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <line x1="100" y1="0" x2="100" y2="120" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <line x1="150" y1="0" x2="150" y2="120" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <line x1="0" y1="40" x2="200" y2="40" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <line x1="0" y1="80" x2="200" y2="80" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <path d="M205,60 L230,60 M222,52 L230,60 L222,68" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="8" y="10" width="34" height="60" rx="4" fill="#3b82f6"/>
                        <rect x="58" y="5" width="34" height="70" rx="4" fill="#eab308"/>
                        <rect x="158" y="25" width="34" height="85" rx="4" fill="#8b5cf6"/>
                        <rect x="18" y="46" width="75" height="28" rx="5" fill="url(#rh-car)" stroke="#fca5a5" stroke-width="1"/>
                        <rect x="35" y="50" width="28" height="20" rx="3" fill="#0f172a" opacity="0.8"/>
                        <circle cx="85" cy="52" r="3" fill="#fef08a"/>
                        <circle cx="85" cy="68" r="3" fill="#fef08a"/>
                    </g>
                </svg>`;

            case 'racing3d':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="rc-sky" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#1e1b4b"/>
                            <stop offset="50%" stop-color="#4c1d95"/>
                            <stop offset="85%" stop-color="#c2410c"/>
                            <stop offset="100%" stop-color="#fb923c"/>
                        </linearGradient>
                        <linearGradient id="rc-grid" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#020617"/>
                            <stop offset="100%" stop-color="#0f172a"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="90" fill="url(#rc-sky)"/>
                    <rect y="90" width="320" height="70" fill="url(#rc-grid)"/>
                    <polygon points="160,90 160,90 290,160 30,160" fill="#090d16" stroke="#06b6d4" stroke-width="0.8"/>
                    <line x1="160" y1="90" x2="160" y2="160" stroke="#facc15" stroke-width="2" stroke-dasharray="8 6"/>
                    <line x1="140" y1="90" x2="80" y2="160" stroke="#38bdf8" stroke-width="1" opacity="0.6"/>
                    <line x1="180" y1="90" x2="240" y2="160" stroke="#38bdf8" stroke-width="1" opacity="0.6"/>
                    <g transform="translate(160, 126)">
                        <ellipse cx="0" cy="18" rx="42" ry="6" fill="#06b6d4" opacity="0.75"/>
                        <path d="M-36,12 L-28,-2 L-16,-12 L16,-12 L28,-2 L36,12 Z" fill="#ef4444"/>
                        <polygon points="-14,-10 14,-10 10,-20 -10,-20" fill="#020617"/>
                        <rect x="-38" y="-22" width="76" height="4" rx="2" fill="#0f172a"/>
                        <line x1="-22" y1="-22" x2="-22" y2="-12" stroke="#0f172a" stroke-width="2.5"/>
                        <line x1="22" y1="-22" x2="22" y2="-12" stroke="#0f172a" stroke-width="2.5"/>
                        <rect x="-30" y="2" width="60" height="3" rx="1.5" fill="#ff0044"/>
                        <circle cx="-12" cy="12" r="3" fill="#ff7700"/>
                        <circle cx="12" cy="12" r="3" fill="#ff7700"/>
                    </g>
                </svg>`;

            case 'towerdefense':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="td-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#082f49"/>
                            <stop offset="60%" stop-color="#0c0a09"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#td-bg)"/>
                    <g opacity="0.2">
                        <polygon points="40,20 60,30 60,50 40,60 20,50 20,30" stroke="#38bdf8" fill="none" stroke-width="1"/>
                        <polygon points="100,20 120,30 120,50 100,60 80,50 80,30" stroke="#38bdf8" fill="none" stroke-width="1"/>
                        <polygon points="260,100 280,110 280,130 260,140 240,130 240,110" stroke="#38bdf8" fill="none" stroke-width="1"/>
                    </g>
                    <g transform="translate(100, 95)">
                        <rect x="-24" y="-8" width="48" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
                        <circle cx="0" cy="-16" r="18" fill="#0f172a" stroke="#06b6d4" stroke-width="2"/>
                        <circle cx="0" cy="-16" r="8" fill="#38bdf8" opacity="0.9"/>
                        <line x1="8" y1="-20" x2="55" y2="-45" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
                        <line x1="12" y1="-14" x2="59" y2="-39" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
                        <line x1="57" y1="-42" x2="220" y2="-75" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/>
                        <line x1="57" y1="-42" x2="220" y2="-75" stroke="#ffffff" stroke-width="0.8"/>
                    </g>
                    <g transform="translate(235, 45)">
                        <polygon points="0,-12 14,0 0,12 -14,0" fill="#dc2626" stroke="#fca5a5" stroke-width="1.5"/>
                        <circle cx="0" cy="0" r="4" fill="#fef08a"/>
                    </g>
                </svg>`;

            case 'platformer':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="pl-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#1e1b4b"/>
                            <stop offset="60%" stop-color="#0f172a"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#pl-bg)"/>
                    <rect x="20" y="125" width="90" height="12" rx="4" fill="#334155" stroke="#6366f1" stroke-width="1.5"/>
                    <rect x="130" y="90" width="75" height="12" rx="4" fill="#334155" stroke="#22d3ee" stroke-width="1.5"/>
                    <rect x="230" y="60" width="70" height="12" rx="4" fill="#334155" stroke="#a855f7" stroke-width="1.5"/>
                    <g transform="translate(165, 55)">
                        <circle cx="0" cy="-14" r="6" fill="#38bdf8"/>
                        <path d="M-4,-8 L4,-4 L-2,10 L6,14" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" fill="none"/>
                        <path d="M-2,-2 L-10,4 M2,-4 L10,-8" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
                        <path d="M-30,30 Q-15,5 0,-8" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3" fill="none" opacity="0.6"/>
                    </g>
                    <polygon points="265,35 271,43 265,51 259,43" fill="#facc15" stroke="#fef08a" stroke-width="1"/>
                    <polygon points="165,70 170,76 165,82 160,76" fill="#38bdf8" stroke="#bae6fd" stroke-width="1"/>
                </svg>`;

            case 'breakout':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bo-bg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#18181b"/>
                            <stop offset="100%" stop-color="#09090b"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#bo-bg)"/>
                    <g transform="translate(20, 20)">
                        <rect x="0" y="0" width="40" height="14" rx="3" fill="#ef4444"/>
                        <rect x="46" y="0" width="40" height="14" rx="3" fill="#ef4444"/>
                        <rect x="92" y="0" width="40" height="14" rx="3" fill="#f97316"/>
                        <rect x="138" y="0" width="40" height="14" rx="3" fill="#f97316"/>
                        <rect x="184" y="0" width="40" height="14" rx="3" fill="#facc15"/>
                        <rect x="230" y="0" width="40" height="14" rx="3" fill="#facc15"/>

                        <rect x="23" y="20" width="40" height="14" rx="3" fill="#22c55e"/>
                        <rect x="69" y="20" width="40" height="14" rx="3" fill="#22c55e"/>
                        <rect x="115" y="20" width="40" height="14" rx="3" fill="#06b6d4"/>
                        <rect x="161" y="20" width="40" height="14" rx="3" fill="#06b6d4"/>
                        <rect x="207" y="20" width="40" height="14" rx="3" fill="#a855f7"/>
                    </g>
                    <path d="M140,135 Q190,95 210,48" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4" fill="none" opacity="0.6"/>
                    <circle cx="210" cy="48" r="6" fill="#ffffff"/>
                    <rect x="105" y="136" width="70" height="10" rx="5" fill="#38bdf8" stroke="#bae6fd" stroke-width="1"/>
                </svg>`;

            case 'spaceshooter':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="ss-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#020617"/>
                            <stop offset="50%" stop-color="#1e1b4b"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#ss-bg)"/>
                    <circle cx="35" cy="25" r="1" fill="#fff" opacity="0.8"/>
                    <circle cx="95" cy="70" r="1.5" fill="#38bdf8" opacity="0.6"/>
                    <circle cx="280" cy="30" r="1" fill="#fff" opacity="0.9"/>
                    <circle cx="220" cy="130" r="1.5" fill="#facc15" opacity="0.7"/>
                    <g transform="translate(160, 115)">
                        <polygon points="-6,16 6,16 0,30" fill="#06b6d4" opacity="0.85"/>
                        <polygon points="0,-24 18,14 6,10 0,14 -6,10 -18,14" fill="#38bdf8" stroke="#bae6fd" stroke-width="1"/>
                        <polygon points="0,-16 6,4 0,8 -6,4" fill="#0f172a"/>
                        <line x1="-12" y1="-8" x2="-12" y2="-75" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
                        <line x1="12" y1="-8" x2="12" y2="-75" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
                    </g>
                    <g transform="translate(160, 35)">
                        <polygon points="0,-8 35,8 20,22 -20,22 -35,8" fill="#7c3aed" stroke="#c084fc" stroke-width="1.5"/>
                        <circle cx="0" cy="10" r="5" fill="#f43f5e"/>
                    </g>
                </svg>`;

            case 'dungeon':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <radialGradient id="torch" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stop-color="#f97316" stop-opacity="0.8"/>
                            <stop offset="40%" stop-color="#ea580c" stop-opacity="0.4"/>
                            <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
                        </radialGradient>
                    </defs>
                    <rect width="320" height="160" fill="#090d16"/>
                    <path d="M70,160 L70,70 Q160,20 250,70 L250,160 Z" fill="#0f172a" stroke="#334155" stroke-width="2"/>
                    <circle cx="150" cy="85" r="75" fill="url(#torch)"/>
                    <g transform="translate(150, 95)">
                        <circle cx="0" cy="-22" r="7" fill="#cbd5e1"/>
                        <path d="M-8,-14 L8,-14 L12,18 L-12,18 Z" fill="#475569"/>
                        <line x1="-10" y1="-4" x2="-18" y2="-16" stroke="#78350f" stroke-width="3"/>
                        <circle cx="-19" cy="-19" r="6" fill="#facc15"/>
                        <circle cx="-19" cy="-19" r="3" fill="#ef4444"/>
                        <line x1="12" y1="-2" x2="26" y2="-18" stroke="#38bdf8" stroke-width="2.5"/>
                        <line x1="8" y1="-4" x2="16" y2="2" stroke="#cbd5e1" stroke-width="2"/>
                    </g>
                </svg>`;

            case 'minesweeper':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="ms-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#0f172a"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#ms-bg)"/>
                    <g stroke="#334155" stroke-width="1.5" fill="#1e293b">
                        <polygon points="100,50 120,60 120,80 100,90 80,80 80,60"/>
                        <polygon points="145,50 165,60 165,80 145,90 125,80 125,60" fill="#0f172a" stroke="#38bdf8"/>
                        <polygon points="190,50 210,60 210,80 190,90 170,80 170,60"/>
                        <polygon points="122,85 142,95 142,115 122,125 102,115 102,95"/>
                        <polygon points="167,85 187,95 187,115 167,125 147,115 147,95" fill="#0f172a" stroke="#ef4444"/>
                    </g>
                    <text x="96" y="74" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">1</text>
                    <text x="186" y="74" fill="#22c55e" font-family="monospace" font-size="14" font-weight="bold">2</text>
                    <g transform="translate(145, 70)">
                        <circle cx="0" cy="0" r="10" fill="#0f172a" stroke="#ef4444" stroke-width="2"/>
                        <circle cx="0" cy="0" r="3" fill="#f43f5e"/>
                        <line x1="-14" y1="0" x2="14" y2="0" stroke="#ef4444" stroke-width="1.5"/>
                        <line x1="0" y1="-14" x2="0" y2="14" stroke="#ef4444" stroke-width="1.5"/>
                    </g>
                    <g transform="translate(167, 105)">
                        <polygon points="0,-8 10,-4 0,0" fill="#ef4444"/>
                        <line x1="0" y1="-8" x2="0" y2="6" stroke="#94a3b8" stroke-width="1.5"/>
                    </g>
                </svg>`;

            case 'snake3d':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="sn-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#022c22"/>
                            <stop offset="60%" stop-color="#064e3b"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#sn-bg)"/>
                    <g opacity="0.25" stroke="#22c55e" stroke-width="1">
                        <line x1="0" y1="40" x2="320" y2="40"/>
                        <line x1="0" y1="80" x2="320" y2="80"/>
                        <line x1="0" y1="120" x2="320" y2="120"/>
                        <line x1="60" y1="0" x2="60" y2="160"/>
                        <line x1="120" y1="0" x2="120" y2="160"/>
                        <line x1="180" y1="0" x2="180" y2="160"/>
                        <line x1="240" y1="0" x2="240" y2="160"/>
                    </g>
                    <g transform="translate(60, 85)">
                        <rect x="0" y="-8" width="20" height="16" rx="4" fill="#047857"/>
                        <rect x="26" y="-8" width="20" height="16" rx="4" fill="#059669"/>
                        <rect x="52" y="-8" width="20" height="16" rx="4" fill="#10b981"/>
                        <rect x="78" y="-14" width="20" height="22" rx="4" fill="#34d399"/>
                        <rect x="104" y="-20" width="22" height="24" rx="5" fill="#22d3ee" stroke="#67e8f9" stroke-width="1.5"/>
                        <circle cx="118" cy="-14" r="2.5" fill="#020617"/>
                        <circle cx="118" cy="-14" r="1.2" fill="#facc15"/>
                        <circle cx="118" cy="-6" r="2.5" fill="#020617"/>
                        <circle cx="118" cy="-6" r="1.2" fill="#facc15"/>
                    </g>
                    <g transform="translate(230, 65)">
                        <circle cx="0" cy="0" r="14" fill="#f43f5e" opacity="0.3"/>
                        <circle cx="0" cy="0" r="8" fill="#fb7185"/>
                        <ellipse cx="0" cy="0" rx="16" ry="6" fill="none" stroke="#38bdf8" stroke-width="1.5" transform="rotate(-25)"/>
                    </g>
                </svg>`;

            default:
                return `<div style="font-size: 38px; color: var(--text-primary);">▶</div>`;
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


    /* ------------------------------------------------------------------ */
    /* Cloud, Profile, Groups & Leaderboards                              */
    /* ------------------------------------------------------------------ */

    bindCloudModal() {
        const btnProfile = document.getElementById('btn-cloud-profile');
        const btnLeaderboard = document.getElementById('btn-cloud-leaderboard');
        const modal = document.getElementById('cloud-modal');
        const closeBtn = document.getElementById('cloud-modal-close');

        if (btnProfile) btnProfile.onclick = () => this.openCloudModal('tab-profile');
        if (btnLeaderboard) btnLeaderboard.onclick = () => this.openCloudModal('tab-leaderboard');
        if (closeBtn) closeBtn.onclick = () => modal?.classList.remove('active');

        // Cloud modal tabs
        const tabs = document.querySelectorAll('.cloud-tab');
        tabs.forEach(t => {
            t.onclick = () => {
                const targetTab = t.getAttribute('data-tab');
                this.switchCloudTab(targetTab);
            };
        });

        // Profile Name Save
        const btnSave = document.getElementById('btn-auth-save');
        const usernameInput = document.getElementById('auth-username-input');
        if (btnSave && usernameInput) {
            btnSave.onclick = async () => {
                const name = usernameInput.value.trim();
                if (name.length < 2) {
                    alert('Der Spielername muss mindestens 2 Zeichen lang sein.');
                    return;
                }
                if (window.CloudStorage) {
                    await window.CloudStorage.login(name);
                    this.updateUserProfileUI();
                    this.renderGameCards();
                    this.showToast(`Angemeldet als ${name}`);
                }
            };
        }

        // Leaderboard Controls
        const gameSelect = document.getElementById('lb-game-select');
        if (gameSelect) {
            this.games.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.title;
                gameSelect.appendChild(opt);
            });
            gameSelect.onchange = () => this.renderLeaderboard();
        }

        const scopeGlobal = document.getElementById('btn-scope-global');
        const scopeGroup = document.getElementById('btn-scope-group');
        if (scopeGlobal && scopeGroup) {
            scopeGlobal.onclick = () => {
                scopeGlobal.classList.add('active');
                scopeGroup.classList.remove('active');
                this.renderLeaderboard('global');
            };
            scopeGroup.onclick = () => {
                scopeGroup.classList.add('active');
                scopeGlobal.classList.remove('active');
                this.renderLeaderboard('group');
            };
        }

        // Group Actions
        const btnCreateGroup = document.getElementById('btn-create-group');
        const groupNameInput = document.getElementById('group-name-input');
        if (btnCreateGroup && groupNameInput) {
            btnCreateGroup.onclick = async () => {
                const name = groupNameInput.value.trim();
                if (name.length < 3) {
                    alert('Gruppenname muss mind. 3 Zeichen haben.');
                    return;
                }
                try {
                    const g = await window.CloudStorage.createGroup(name);
                    groupNameInput.value = '';
                    this.renderGroupsList();
                    this.showToast(`Gruppe "${g.name}" gegründet! Code: ${g.code}`);
                } catch (e) {
                    alert(e.message);
                }
            };
        }

        const btnJoinGroup = document.getElementById('btn-join-group');
        const groupCodeInput = document.getElementById('group-code-input');
        if (btnJoinGroup && groupCodeInput) {
            btnJoinGroup.onclick = async () => {
                const code = groupCodeInput.value.trim();
                if (!code) return;
                try {
                    const g = await window.CloudStorage.joinGroupByCode(code);
                    groupCodeInput.value = '';
                    this.renderGroupsList();
                    this.showToast(`Gruppe "${g.name}" beigetreten!`);
                } catch (e) {
                    alert(e.message);
                }
            };
        }

        // Listen for user changes
        if (window.CloudStorage) {
            window.CloudStorage.onAuthChange(() => this.updateUserProfileUI());
        }
    }

    openCloudModal(tab = 'tab-profile') {
        if (this.currentGame && this.currentGame.pause) {
            this.currentGame.pause();
        }
        const modal = document.getElementById('cloud-modal');
        if (modal) modal.classList.add('active');
        this.switchCloudTab(tab);
    }

    switchCloudTab(tabId) {
        document.querySelectorAll('.cloud-tab').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
        });
        document.querySelectorAll('.cloud-tab-content').forEach(c => {
            c.classList.toggle('active', c.id === tabId);
        });

        if (tabId === 'tab-profile') this.updateUserProfileUI();
        if (tabId === 'tab-leaderboard') this.renderLeaderboard();
        if (tabId === 'tab-groups') this.renderGroupsList();
        if (tabId === 'tab-progress') this.renderProgressGrid();
    }

    updateUserProfileUI() {
        const u = window.CloudStorage ? window.CloudStorage.currentUser : null;
        const name = (u && u.username) || 'Gast-Spieler';
        const isGuest = u ? u.isGuest : true;

        const headerName = document.getElementById('header-username');
        const profileDisplayName = document.getElementById('profile-display-name');
        const profileBadge = document.getElementById('profile-status-badge');
        const authInput = document.getElementById('auth-username-input');

        if (headerName) headerName.textContent = isGuest ? 'Gast' : name;
        if (profileDisplayName) profileDisplayName.textContent = name;
        if (profileBadge) profileBadge.textContent = isGuest ? 'Gast (Lokal)' : 'Angemeldet (Cloud-Ready)';
        if (authInput && !authInput.value) authInput.value = isGuest ? '' : name;
    }

    renderLeaderboard(forceScope = null) {
        const gameSelect = document.getElementById('lb-game-select');
        const gameId = gameSelect ? gameSelect.value : 'racing3d';
        const tbody = document.getElementById('leaderboard-tbody');
        if (!tbody) return;

        const isGroup = forceScope === 'group' || (!forceScope && document.getElementById('btn-scope-group')?.classList.contains('active'));
        const u = window.CloudStorage ? window.CloudStorage.currentUser : null;
        const groupId = (u && u.joinedGroups && u.joinedGroups[0]) || null;

        const list = window.CloudStorage ? window.CloudStorage.getLeaderboard(gameId, isGroup ? 'group' : 'global', groupId) : [];
        tbody.innerHTML = '';

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">Noch keine Einträge vorhanden. Sei der Erste!</td></tr>';
            return;
        }

        list.slice(0, 15).forEach((entry, idx) => {
            const tr = document.createElement('tr');
            let rankClass = '';
            let rankSymbol = String(idx + 1);
            if (idx === 0) { rankClass = 'rank-top1'; rankSymbol = '🥇 1'; }
            else if (idx === 1) { rankClass = 'rank-top2'; rankSymbol = '🥈 2'; }
            else if (idx === 2) { rankClass = 'rank-top3'; rankSymbol = '🥉 3'; }

            tr.innerHTML = `
                <td class="${rankClass}">${rankSymbol}</td>
                <td style="font-weight:600;">${entry.user}</td>
                <td>Level ${entry.level || 1}</td>
                <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">${entry.score.toLocaleString()}</td>
                <td style="color:var(--text-muted); font-size:11px;">${entry.date || 'Heute'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderGroupsList() {
        const listEl = document.getElementById('groups-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const groups = window.CloudStorage ? window.CloudStorage.getGroups() : [];
        const u = window.CloudStorage ? window.CloudStorage.currentUser : null;
        const userGroups = (u && u.joinedGroups) || [];

        if (!groups.length) {
            listEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">Keine Gruppen vorhanden.</div>';
            return;
        }

        groups.forEach(g => {
            const isMember = userGroups.includes(g.id);
            const card = document.createElement('div');
            card.className = 'group-card';
            card.innerHTML = `
                <div class="group-card-info">
                    <h5>${g.name}</h5>
                    <div class="group-card-desc">${g.desc} · ${g.members ? g.members.length : 1} Mitglieder</div>
                </div>
                <div class="group-card-right">
                    <span class="group-code-pill" title="Einladungscode">Code: ${g.code}</span>
                    <span class="badge ${isMember ? 'badge-accent' : ''}">${isMember ? 'Beigetreten' : 'Offen'}</span>
                </div>
            `;
            listEl.appendChild(card);
        });
    }

    renderProgressGrid() {
        const grid = document.getElementById('progress-grid');
        if (!grid) return;
        grid.innerHTML = '';

        this.games.forEach(g => {
            const prog = (window.CloudStorage && window.CloudStorage.getGameProgress(g.id)) || { unlockedLevel: 1, highScore: 0 };
            const card = document.createElement('div');
            card.className = 'progress-card';
            const pct = Math.min(100, Math.round((prog.unlockedLevel / 50) * 100));

            card.innerHTML = `
                <div class="progress-card-title">
                    <span>${g.title}</span>
                    <span style="color:#38bdf8;">Lvl ${prog.unlockedLevel}</span>
                </div>
                <div class="progress-card-meta">
                    <span>Highscore: ${prog.highScore ? prog.highScore.toLocaleString() : '0'}</span>
                    <span>Ziel: Lvl 100+</span>
                </div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" style="width: ${Math.max(5, pct)}%;"></div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    showToast(msg) {
        const toast = document.getElementById('portal-toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('active');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.remove('active'), 2800);
    }

window.addEventListener('DOMContentLoaded', () => {
    window.portal = new GamePortal();
    window.portal.init();
});
