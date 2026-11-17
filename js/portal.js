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
                        <linearGradient id="mc-bg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#0f172a"/>
                            <stop offset="55%" stop-color="#064e3b"/>
                            <stop offset="100%" stop-color="#022c22"/>
                        </linearGradient>
                        <linearGradient id="mc-grass" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#86efac"/>
                            <stop offset="50%" stop-color="#22c55e"/>
                            <stop offset="100%" stop-color="#15803d"/>
                        </linearGradient>
                        <linearGradient id="mc-dirt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#92400e"/>
                            <stop offset="100%" stop-color="#451a03"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#mc-bg)"/>
                    <!-- Sun & Voxel Clouds -->
                    <rect x="248" y="18" width="24" height="24" fill="#fde047" opacity="0.9"/>
                    <rect x="24" y="22" width="46" height="12" fill="#e2e8f0" opacity="0.28"/>
                    <rect x="34" y="16" width="24" height="8" fill="#f8fafc" opacity="0.32"/>
                    <rect x="172" y="28" width="42" height="10" fill="#e2e8f0" opacity="0.22"/>
                    <!-- Voxel Terrain Backdrop -->
                    <g opacity="0.55">
                        <polygon points="56,112 80,100 104,112 80,124" fill="#22c55e"/>
                        <polygon points="56,112 80,124 80,148 56,136" fill="#78350f"/>
                        <polygon points="80,124 104,112 104,136 80,148" fill="#451a03"/>
                        <polygon points="216,104 240,92 264,104 240,116" fill="#34d399"/>
                        <polygon points="216,104 240,116 240,142 216,130" fill="#71717a"/>
                        <polygon points="240,116 264,104 264,130 240,142" fill="#3f3f46"/>
                    </g>
                    <!-- Hero 3D Textured Voxel Cube -->
                    <g transform="translate(158, 84)">
                        <polygon points="0,-46 44,-22 0,2 -44,-22" fill="url(#mc-grass)"/>
                        <polygon points="-14,-29 8,-18 -2,-11 -22,-22" fill="#4ade80" opacity="0.55"/>
                        <polygon points="-44,-22 0,2 0,54 -44,30" fill="url(#mc-dirt)"/>
                        <polygon points="-44,-22 0,2 0,12 -44,-12" fill="#16a34a"/>
                        <polygon points="0,2 44,-22 44,30 0,54" fill="#582405"/>
                        <polygon points="0,2 44,-22 44,-12 0,12" fill="#15803d"/>
                        <!-- Gold Ore Glint -->
                        <rect x="14" y="14" width="6" height="6" fill="#facc15"/>
                        <rect x="26" y="4" width="5" height="5" fill="#fde047"/>
                        <!-- 3D Diamond Pickaxe -->
                        <g transform="translate(36, -6) rotate(-25)">
                            <rect x="-2" y="-12" width="4" height="36" fill="#78350f" stroke="#451a03" stroke-width="0.8"/>
                            <path d="M-16,-14 L0,-20 L16,-14 L12,-8 L0,-13 L-12,-8 Z" fill="#38bdf8" stroke="#bae6fd" stroke-width="1"/>
                        </g>
                    </g>
                    <!-- Block Spark Particles -->
                    <rect x="116" y="42" width="4" height="4" fill="#4ade80"/>
                    <rect x="208" y="54" width="4" height="4" fill="#38bdf8"/>
                    <rect x="96" y="74" width="3" height="3" fill="#facc15"/>
                </svg>`;

            case 'rushhour':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="rh-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#0f172a"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                        <linearGradient id="rh-car" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#f87171"/>
                            <stop offset="50%" stop-color="#ef4444"/>
                            <stop offset="100%" stop-color="#991b1b"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#rh-bg)"/>
                    <g transform="translate(54, 18)">
                        <rect x="0" y="0" width="210" height="124" rx="10" fill="#18181b" stroke="#334155" stroke-width="2.5"/>
                        <line x1="52" y1="4" x2="52" y2="120" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <line x1="105" y1="4" x2="105" y2="120" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <line x1="158" y1="4" x2="158" y2="120" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <line x1="4" y1="42" x2="206" y2="42" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <line x1="4" y1="82" x2="206" y2="82" stroke="#27272a" stroke-width="1.5" stroke-dasharray="4"/>
                        <!-- Exit Gate -->
                        <rect x="206" y="46" width="6" height="32" rx="2" fill="#10b981"/>
                        <path d="M216,62 L240,62 M232,54 L240,62 L232,70" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                        <!-- 2.5D Blue Sedan -->
                        <rect x="10" y="8" width="34" height="62" rx="6" fill="#1e3a8a"/>
                        <rect x="10" y="6" width="34" height="58" rx="6" fill="#3b82f6"/>
                        <rect x="15" y="18" width="24" height="24" rx="4" fill="#0f172a"/>
                        <!-- 2.5D Heavy Cargo Truck -->
                        <rect x="166" y="12" width="34" height="96" rx="5" fill="#4c1d95"/>
                        <rect x="166" y="10" width="34" height="62" rx="4" fill="#7c3aed"/>
                        <rect x="168" y="76" width="30" height="28" rx="5" fill="#a78bfa"/>
                        <rect x="172" y="88" width="22" height="10" rx="2" fill="#0f172a"/>
                        <!-- Hero Red Sports Car + Headlight Cones -->
                        <polygon points="104,50 158,36 158,88 104,74" fill="#fde047" opacity="0.16"/>
                        <rect x="24" y="48" width="80" height="30" rx="7" fill="#7f1d1d"/>
                        <rect x="24" y="45" width="80" height="29" rx="7" fill="url(#rh-car)" stroke="#fca5a5" stroke-width="1"/>
                        <rect x="24" y="57" width="80" height="2" fill="#f8fafc" opacity="0.8"/>
                        <rect x="24" y="60" width="80" height="2" fill="#f8fafc" opacity="0.8"/>
                        <rect x="46" y="49" width="34" height="21" rx="4" fill="#020617" opacity="0.9"/>
                        <rect x="26" y="48" width="4" height="23" rx="1" fill="#18181b"/>
                        <circle cx="101" cy="51" r="2.8" fill="#fef08a"/>
                        <circle cx="101" cy="68" r="2.8" fill="#fef08a"/>
                    </g>
                </svg>`;

            case 'racing3d':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="rc-sky" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#0f0c29"/>
                            <stop offset="50%" stop-color="#302b63"/>
                            <stop offset="85%" stop-color="#c2410c"/>
                            <stop offset="100%" stop-color="#fb923c"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="88" fill="url(#rc-sky)"/>
                    <!-- Cyber Skyline -->
                    <g fill="#090d16" opacity="0.85">
                        <rect x="12" y="46" width="22" height="42"/><rect x="38" y="34" width="18" height="54"/>
                        <rect x="64" y="54" width="26" height="34"/><rect x="230" y="50" width="22" height="38"/>
                        <rect x="256" y="30" width="24" height="58"/><rect x="284" y="44" width="20" height="44"/>
                    </g>
                    <g fill="#22d3ee" opacity="0.6">
                        <rect x="42" y="42" width="3" height="6"/><rect x="48" y="52" width="3" height="6"/>
                        <rect x="262" y="38" width="3" height="6"/><rect x="270" y="48" width="3" height="6"/>
                    </g>
                    <rect y="88" width="320" height="72" fill="#020617"/>
                    <polygon points="132,88 188,88 304,160 16,160" fill="#111827" stroke="#22d3ee" stroke-width="1.2"/>
                    <line x1="160" y1="88" x2="160" y2="160" stroke="#facc15" stroke-width="2" stroke-dasharray="8 6"/>
                    <!-- 3D Start Gantry -->
                    <rect x="92" y="52" width="6" height="42" fill="#1e293b"/>
                    <rect x="222" y="52" width="6" height="42" fill="#1e293b"/>
                    <rect x="90" y="48" width="140" height="8" rx="2" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
                    <circle cx="144" cy="52" r="2" fill="#22c55e"/><circle cx="160" cy="52" r="2" fill="#22c55e"/><circle cx="176" cy="52" r="2" fill="#22c55e"/>
                    <!-- Supercar + Nitro -->
                    <g transform="translate(160, 126)">
                        <ellipse cx="0" cy="18" rx="44" ry="7" fill="#06b6d4" opacity="0.7"/>
                        <path d="M-38,12 L-30,-3 L-18,-13 L18,-13 L30,-3 L38,12 Z" fill="#ef4444"/>
                        <polygon points="-15,-11 15,-11 11,-21 -11,-21" fill="#020617"/>
                        <rect x="-40" y="-23" width="80" height="4" rx="2" fill="#18181b"/>
                        <line x1="-22" y1="-23" x2="-22" y2="-13" stroke="#18181b" stroke-width="2.5"/>
                        <line x1="22" y1="-23" x2="22" y2="-13" stroke="#18181b" stroke-width="2.5"/>
                        <rect x="-32" y="2" width="64" height="3.5" rx="1.5" fill="#ff0044"/>
                        <polygon points="-16,12 -10,12 -13,26" fill="#38bdf8"/>
                        <polygon points="10,12 16,12 13,26" fill="#38bdf8"/>
                    </g>
                </svg>`;

            case 'towerdefense':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="td-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#082f49"/>
                            <stop offset="60%" stop-color="#0b1020"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#td-bg)"/>
                    <!-- Armored Road -->
                    <path d="M0,120 L180,120 L180,45 L320,45" fill="none" stroke="#1e1b4b" stroke-width="28" stroke-linejoin="round"/>
                    <path d="M0,120 L180,120 L180,45 L320,45" fill="none" stroke="#111827" stroke-width="20" stroke-linejoin="round"/>
                    <!-- Plasma & Tesla Turrets -->
                    <g transform="translate(96, 82)">
                        <polygon points="-22,-10 -10,-22 10,-22 22,-10 22,10 10,22 -10,22 -22,10" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
                        <circle cx="0" cy="0" r="13" fill="#0f172a" stroke="#22d3ee" stroke-width="2"/>
                        <line x1="4" y1="-5" x2="46" y2="-32" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
                        <line x1="8" y1="2" x2="50" y2="-25" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
                        <circle cx="0" cy="0" r="5" fill="#38bdf8"/>
                        <polyline points="48,-28 110,-38 145,-34" fill="none" stroke="#22d3ee" stroke-width="2.5"/>
                        <polyline points="48,-28 110,-38 145,-34" fill="none" stroke="#ffffff" stroke-width="1"/>
                    </g>
                    <!-- Enemy Dreadnought Mech -->
                    <g transform="translate(245, 45)">
                        <polygon points="0,-16 18,-6 18,6 0,16 -18,6 -18,-6" fill="#ec4899" stroke="#fbcfe8" stroke-width="1.5"/>
                        <circle cx="0" cy="0" r="6" fill="#fef08a"/>
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
                    <rect x="20" y="124" width="90" height="14" rx="4" fill="#1e293b" stroke="#6366f1" stroke-width="1.5"/>
                    <rect x="130" y="92" width="75" height="14" rx="4" fill="#1e293b" stroke="#22d3ee" stroke-width="1.5"/>
                    <rect x="230" y="64" width="70" height="14" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
                    <!-- Laser Spikes -->
                    <polygon points="48,124 55,112 62,124" fill="#ef4444"/><polygon points="62,124 69,112 76,124" fill="#ef4444"/>
                    <!-- Dash Afterimages -->
                    <g transform="translate(132, 68)" opacity="0.35">
                        <circle cx="0" cy="-12" r="6" fill="#38bdf8"/><rect x="-5" y="-6" width="10" height="16" rx="3" fill="#2563eb"/>
                    </g>
                    <!-- Exo-Runner -->
                    <g transform="translate(166, 56)">
                        <path d="M-6,-6 Q-22,-10 -32,-2 Q-20,0 -6,-2 Z" fill="#22d3ee" opacity="0.85"/>
                        <rect x="-7" y="-16" width="14" height="12" rx="4" fill="#e2e8f0"/>
                        <rect x="0" y="-13" width="7" height="4" rx="1" fill="#22d3ee"/>
                        <rect x="-6" y="-4" width="12" height="16" rx="3" fill="#2563eb"/>
                        <line x1="-2" y1="12" x2="-8" y2="24" stroke="#60a5fa" stroke-width="3" stroke-linecap="round"/>
                        <line x1="3" y1="12" x2="9" y2="22" stroke="#60a5fa" stroke-width="3" stroke-linecap="round"/>
                    </g>
                    <!-- Faceted Crystal & Portal -->
                    <polygon points="165,70 171,78 165,86 159,78" fill="#38bdf8" stroke="#bae6fd" stroke-width="1"/>
                    <ellipse cx="268" cy="40" rx="11" ry="18" fill="none" stroke="#10b981" stroke-width="3"/>
                    <ellipse cx="268" cy="40" rx="6" ry="11" fill="#34d399" opacity="0.5"/>
                </svg>`;

            case 'breakout':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bo-bg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#0f172a"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#bo-bg)"/>
                    <g transform="translate(22, 18)">
                        <rect x="0" y="0" width="42" height="14" rx="3" fill="#ef4444" stroke="#fca5a5" stroke-width="0.8"/>
                        <rect x="46" y="0" width="42" height="14" rx="3" fill="#f97316" stroke="#fdba74" stroke-width="0.8"/>
                        <rect x="92" y="0" width="42" height="14" rx="3" fill="#facc15" stroke="#fef08a" stroke-width="0.8"/>
                        <rect x="138" y="0" width="42" height="14" rx="3" fill="#22c55e" stroke="#86efac" stroke-width="0.8"/>
                        <rect x="184" y="0" width="42" height="14" rx="3" fill="#06b6d4" stroke="#67e8f9" stroke-width="0.8"/>
                        <rect x="230" y="0" width="42" height="14" rx="3" fill="#a855f7" stroke="#d8b4fe" stroke-width="0.8"/>
                        <rect x="22" y="20" width="42" height="14" rx="3" fill="#64748b" stroke="#cbd5e1" stroke-width="1"/>
                        <rect x="114" y="20" width="42" height="14" rx="3" fill="#f97316"/>
                        <rect x="206" y="20" width="42" height="14" rx="3" fill="#38bdf8"/>
                    </g>
                    <path d="M140,132 Q192,92 212,50" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4" fill="none" opacity="0.7"/>
                    <circle cx="212" cy="50" r="6" fill="#ffffff" stroke="#38bdf8" stroke-width="2"/>
                    <!-- 2.5D Laser Paddle -->
                    <rect x="98" y="132" width="84" height="12" rx="6" fill="#0284c7"/>
                    <rect x="98" y="130" width="84" height="10" rx="5" fill="#e0f2fe"/>
                    <rect x="102" y="123" width="4" height="8" fill="#ec4899"/>
                    <rect x="174" y="123" width="4" height="8" fill="#ec4899"/>
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
                    <circle cx="255" cy="40" r="24" fill="#312e81" opacity="0.5"/>
                    <ellipse cx="255" cy="40" rx="38" ry="8" fill="none" stroke="#818cf8" stroke-width="1.5" transform="rotate(-18 255 40)" opacity="0.6"/>
                    <circle cx="35" cy="25" r="1.2" fill="#fff"/><circle cx="95" cy="70" r="1.5" fill="#38bdf8"/>
                    <g transform="translate(160, 114)">
                        <polygon points="-8,14 -3,14 -5.5,28" fill="#38bdf8"/>
                        <polygon points="3,14 8,14 5.5,28" fill="#38bdf8"/>
                        <polygon points="0,-26 22,12 10,8 0,14 -10,8 -22,12" fill="#e2e8f0" stroke="#38bdf8" stroke-width="1.2"/>
                        <polygon points="0,-16 5,2 0,6 -5,2" fill="#06b6d4"/>
                        <line x1="-14" y1="-6" x2="-14" y2="-74" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
                        <line x1="14" y1="-6" x2="14" y2="-74" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
                    </g>
                    <g transform="translate(160, 34)">
                        <polygon points="0,-10 42,6 24,24 -24,24 -42,6" fill="#6d28d9" stroke="#c084fc" stroke-width="1.5"/>
                        <circle cx="0" cy="10" r="6" fill="#f43f5e"/>
                    </g>
                </svg>`;

            case 'dungeon':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <radialGradient id="torch" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stop-color="#f97316" stop-opacity="0.85"/>
                            <stop offset="45%" stop-color="#ea580c" stop-opacity="0.35"/>
                            <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
                        </radialGradient>
                    </defs>
                    <rect width="320" height="160" fill="#060911"/>
                    <path d="M64,160 L64,66 Q160,14 256,66 L256,160 Z" fill="#0f172a" stroke="#334155" stroke-width="2.5"/>
                    <circle cx="150" cy="86" r="80" fill="url(#torch)"/>
                    <g transform="translate(148, 96)">
                        <path d="M-12,-14 L12,-14 L16,20 L-16,20 Z" fill="#1e293b" stroke="#475569" stroke-width="1"/>
                        <circle cx="0" cy="-22" r="8" fill="#6366f1"/>
                        <circle cx="-3" cy="-22" r="1.8" fill="#22d3ee"/><circle cx="3" cy="-22" r="1.8" fill="#22d3ee"/>
                        <line x1="-12" y1="-4" x2="-22" y2="-18" stroke="#78350f" stroke-width="3"/>
                        <circle cx="-23" cy="-21" r="6" fill="#fde047"/>
                        <line x1="12" y1="-2" x2="28" y2="-20" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
                        <line x1="8" y1="-5" x2="17" y2="3" stroke="#e2e8f0" stroke-width="2.5"/>
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
                    <g stroke="#475569" stroke-width="1.5" fill="#1e293b">
                        <polygon points="100,48 122,59 122,81 100,92 78,81 78,59"/>
                        <polygon points="146,48 168,59 168,81 146,92 124,81 124,59" fill="#0b1220" stroke="#38bdf8"/>
                        <polygon points="192,48 214,59 214,81 192,92 170,81 170,59"/>
                        <polygon points="123,86 145,97 145,119 123,130 101,119 101,97"/>
                        <polygon points="169,86 191,97 191,119 169,130 147,119 147,97" fill="#0f172a" stroke="#f43f5e"/>
                    </g>
                    <text x="95" y="75" fill="#60a5fa" font-family="monospace" font-size="14" font-weight="bold">1</text>
                    <text x="187" y="75" fill="#34d399" font-family="monospace" font-size="14" font-weight="bold">2</text>
                    <g transform="translate(146, 70)">
                        <line x1="-13" y1="0" x2="13" y2="0" stroke="#cbd5e1" stroke-width="2"/>
                        <line x1="0" y1="-13" x2="0" y2="13" stroke="#cbd5e1" stroke-width="2"/>
                        <line x1="-9" y1="-9" x2="9" y2="9" stroke="#cbd5e1" stroke-width="1.6"/>
                        <line x1="9" y1="-9" x2="-9" y2="9" stroke="#cbd5e1" stroke-width="1.6"/>
                        <circle cx="0" cy="0" r="8.5" fill="#1e293b" stroke="#64748b" stroke-width="1"/>
                        <circle cx="-2.5" cy="-2.5" r="2.2" fill="#e2e8f0" opacity="0.6"/>
                        <circle cx="0" cy="0" r="2.5" fill="#f43f5e"/>
                    </g>
                    <g transform="translate(169, 108)">
                        <ellipse cx="0" cy="7" rx="6" ry="2.5" fill="#475569"/>
                        <polygon points="-1,-9 10,-4 -1,1" fill="#f43f5e"/>
                        <line x1="-1" y1="-9" x2="-1" y2="7" stroke="#e2e8f0" stroke-width="1.8"/>
                    </g>
                </svg>`;

            case 'snake3d':
                return `<svg viewBox="0 0 320 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="sn-bg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#050816"/>
                            <stop offset="60%" stop-color="#0f172a"/>
                            <stop offset="100%" stop-color="#020617"/>
                        </linearGradient>
                    </defs>
                    <rect width="320" height="160" fill="url(#sn-bg)"/>
                    <g opacity="0.25" stroke="#4f46e5" stroke-width="1">
                        <line x1="0" y1="40" x2="320" y2="40"/><line x1="0" y1="80" x2="320" y2="80"/>
                        <line x1="0" y1="120" x2="320" y2="120"/><line x1="60" y1="0" x2="60" y2="160"/>
                        <line x1="120" y1="0" x2="120" y2="160"/><line x1="180" y1="0" x2="180" y2="160"/>
                        <line x1="240" y1="0" x2="240" y2="160"/>
                    </g>
                    <g transform="translate(56, 86)">
                        <rect x="0" y="-7" width="18" height="14" rx="5" fill="#4f46e5"/>
                        <rect x="24" y="-8" width="20" height="16" rx="5" fill="#6366f1"/>
                        <rect x="50" y="-9" width="20" height="18" rx="5" fill="#0ea5e9"/>
                        <rect x="76" y="-12" width="22" height="20" rx="6" fill="#06b6d4"/>
                        <polygon points="104,-18 134,-12 134,8 104,12" fill="#22d3ee" stroke="#a5f3fc" stroke-width="1.2"/>
                        <circle cx="122" cy="-7" r="2.5" fill="#fde047"/>
                        <circle cx="122" cy="1" r="2.5" fill="#fde047"/>
                    </g>
                    <g transform="translate(236, 70)">
                        <circle cx="0" cy="0" r="14" fill="#34d399" opacity="0.25"/>
                        <polygon points="0,-9 9,0 0,9 -9,0" fill="#34d399"/>
                        <ellipse cx="0" cy="0" rx="18" ry="6" fill="none" stroke="#67e8f9" stroke-width="1.5" transform="rotate(-25)"/>
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
}

window.addEventListener('DOMContentLoaded', () => {
    window.portal = new GamePortal();
    window.portal.init();
});
