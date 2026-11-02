/**
 * Shadow Labyrinth - Roguelike Dungeon Crawler
 * Levels 1 - 100+ with procedural rooms, dynamic Fog-of-War,
 * melee sword swings, fireball spells, monster AI and stair descent.
 */

window.DungeonGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.tileSize = 28;
        this.mapW = 28;
        this.mapH = 22;
        this.grid = [];
        this.revealed = [];

        this.player = {
            x: 5, y: 5,
            hp: 100, maxHp: 100,
            mana: 60, maxMana: 60,
            gold: 0,
            dir: { x: 0, y: 1 }
        };

        this.enemies = [];
        this.items = [];
        this.stairs = { x: 0, y: 0 };
        this.projectiles = [];

        this.floor = 1;
        this.keys = {};
        this.moveCooldown = 0;
    }

    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        const hud = document.createElement('div');
        hud.className = 'rush-hud';
        hud.innerHTML = `
            <div class="rush-stat">HP: <span class="rush-stat-val" style="color:#ef4444;" id="dg-hp">100/100</span></div>
            <div class="rush-stat">Mana: <span class="rush-stat-val" style="color:#38bdf8;" id="dg-mana">60</span></div>
            <div class="rush-stat">Gold: <span class="rush-stat-val" style="color:#fbbf24;" id="dg-gold">0</span></div>
            <div class="rush-stat">Ebene: <span class="rush-stat-val" id="dg-floor">1</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'dg-win-screen';
        win.innerHTML = `
            <div class="win-title">EBENE BEZWUNGEN!</div>
            <div class="win-subtitle" id="dg-win-sub">Treppe in die Tiefe freigelegt.</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-game-action" id="btn-dg-replay">Wiederholen</button>
                <button class="btn-game-action" style="background:#2563eb; color:#fff;" id="btn-dg-next">Nächste Ebene ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl);

        requestAnimationFrame(() => this.resize());

        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);
    }

    resize() {
        if (!this.container || !this.canvas) return;
        const rect = this.container.getBoundingClientRect();
        const w = rect.width > 50 ? rect.width : (window.innerWidth || 800);
        const h = rect.height > 50 ? rect.height : (window.innerHeight - 48 || 600);

        this.canvas.width = w;
        this.canvas.height = h;

        this.tileSize = Math.max(18, Math.min(32, Math.floor((h - 80) / this.mapH)));
    }

    startLevel(levelIndex = 1) {
        this.floor = levelIndex;
        this.enemies = [];
        this.items = [];
        this.projectiles = [];

        const winScreen = this.container.querySelector('#dg-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.generateDungeon();
        this.updateHUD();
    }

    generateDungeon() {
        this.grid = Array(this.mapH).fill(null).map(() => Array(this.mapW).fill(1));
        this.revealed = Array(this.mapH).fill(null).map(() => Array(this.mapW).fill(false));

        const rooms = [];
        const numRooms = 5 + Math.min(10, Math.floor(this.floor / 3));

        for (let i = 0; i < numRooms; i++) {
            const rw = 4 + Math.floor(Math.random() * 4);
            const rh = 4 + Math.floor(Math.random() * 4);
            const rx = 1 + Math.floor(Math.random() * (this.mapW - rw - 2));
            const ry = 1 + Math.floor(Math.random() * (this.mapH - rh - 2));

            for (let y = ry; y < ry + rh; y++) {
                for (let x = rx; x < rx + rw; x++) {
                    this.grid[y][x] = 0;
                }
            }
            rooms.push({ x: rx + Math.floor(rw / 2), y: ry + Math.floor(rh / 2) });
        }

        for (let i = 0; i < rooms.length - 1; i++) {
            const r1 = rooms[i];
            const r2 = rooms[i + 1];
            let cx = r1.x, cy = r1.y;

            while (cx !== r2.x) {
                this.grid[cy][cx] = 0;
                cx += (r2.x > cx ? 1 : -1);
            }
            while (cy !== r2.y) {
                this.grid[cy][cx] = 0;
                cy += (r2.y > cy ? 1 : -1);
            }
        }

        this.player.x = rooms[0].x;
        this.player.y = rooms[0].y;

        const last = rooms[rooms.length - 1];
        this.stairs = { x: last.x, y: last.y };

        const enemyCount = 3 + Math.min(15, Math.floor(this.floor / 2));
        for (let i = 1; i < rooms.length; i++) {
            const r = rooms[i];
            this.enemies.push({
                x: r.x, y: r.y,
                hp: 25 + this.floor * 12,
                color: '#ef4444'
            });

            if (Math.random() < 0.6) {
                this.items.push({ x: r.x + 1, y: r.y, type: 'gold', val: 20 + this.floor * 5 });
            }
        }

        this.updateFogOfWar();
    }

    updateFogOfWar() {
        const radius = 6;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = this.player.x + dx;
                const ny = this.player.y + dy;
                if (nx >= 0 && nx < this.mapW && ny >= 0 && ny < this.mapH) {
                    if (Math.hypot(dx, dy) <= radius) {
                        this.revealed[ny][nx] = true;
                    }
                }
            }
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') this.attackMelee();
            if (e.code === 'KeyF') this.castFireball();
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        this.container.querySelector('#btn-dg-replay').onclick = () => this.startLevel(this.floor);
        this.container.querySelector('#btn-dg-next').onclick = () => {
            if (window.portal) window.portal.launchGame('dungeon', this.floor + 1);
            else this.startLevel(this.floor + 1);
        };
    }

    attackMelee() {
        const tx = this.player.x + this.player.dir.x;
        const ty = this.player.y + this.player.dir.y;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const en = this.enemies[i];
            if (en.x === tx && en.y === ty) {
                en.hp -= 25;
                if (window.AudioManager) window.AudioManager.playHit();
                if (en.hp <= 0) {
                    this.enemies.splice(i, 1);
                    this.player.gold += 30;
                    this.updateHUD();
                }
                return;
            }
        }
        if (window.AudioManager) window.AudioManager.playClick();
    }

    castFireball() {
        if (this.player.mana < 15) return;
        this.player.mana -= 15;
        this.updateHUD();

        this.projectiles.push({
            x: this.player.x,
            y: this.player.y,
            dx: this.player.dir.x,
            dy: this.player.dir.y,
            range: 5
        });
        if (window.AudioManager) window.AudioManager.playLaser();
    }

    loop() {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;

        this.update();
        this.render();
    }

    update() {
        this.moveCooldown -= 0.05;
        if (this.moveCooldown <= 0) {
            let dx = 0, dy = 0;
            if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
            else if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
            else if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
            else if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

            if (dx !== 0 || dy !== 0) {
                this.player.dir = { x: dx, y: dy };
                const nx = this.player.x + dx;
                const ny = this.player.y + dy;

                if (this.grid[ny] && this.grid[ny][nx] === 0) {
                    const monster = this.enemies.find(m => m.x === nx && m.y === ny);
                    if (!monster) {
                        this.player.x = nx;
                        this.player.y = ny;
                        this.updateFogOfWar();
                        this.checkPickups();

                        if (this.player.x === this.stairs.x && this.player.y === this.stairs.y) {
                            this.triggerWin();
                        }
                    }
                }
                this.moveCooldown = 0.16;
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.dx;
            p.y += p.dy;
            p.range--;

            for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
                const en = this.enemies[eIdx];
                if (en.x === p.x && en.y === p.y) {
                    en.hp -= 40;
                    this.projectiles.splice(i, 1);
                    if (en.hp <= 0) {
                        this.enemies.splice(eIdx, 1);
                        this.player.gold += 35;
                        this.updateHUD();
                    }
                    break;
                }
            }

            if (p.range <= 0 || (this.grid[p.y] && this.grid[p.y][p.x] === 1)) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    checkPickups() {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            if (it.x === this.player.x && it.y === this.player.y) {
                if (it.type === 'gold') this.player.gold += it.val;
                this.items.splice(i, 1);
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playPowerup();
            }
        }
    }

    triggerWin() {
        if (window.AudioManager) window.AudioManager.playWin();
        const winScreen = this.container.querySelector('#dg-win-screen');
        if (winScreen) winScreen.classList.add('active');
    }

    updateHUD() {
        const hpEl = this.container.querySelector('#dg-hp');
        const manaEl = this.container.querySelector('#dg-mana');
        const goldEl = this.container.querySelector('#dg-gold');
        const floorEl = this.container.querySelector('#dg-floor');

        if (hpEl) hpEl.innerText = `${this.player.hp}/${this.player.maxHp}`;
        if (manaEl) manaEl.innerText = `${this.player.mana}`;
        if (goldEl) goldEl.innerText = `${this.player.gold}`;
        if (floorEl) floorEl.innerText = `${this.floor}`;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const ox = Math.floor((this.canvas.width - this.mapW * this.tileSize) / 2);
        const oy = Math.floor((this.canvas.height - this.mapH * this.tileSize) / 2);

        for (let y = 0; y < this.mapH; y++) {
            for (let x = 0; x < this.mapW; x++) {
                if (!this.revealed[y][x]) continue;

                const isWall = this.grid[y][x] === 1;
                ctx.fillStyle = isWall ? '#18181b' : '#27272a';
                ctx.fillRect(ox + x * this.tileSize, oy + y * this.tileSize, this.tileSize, this.tileSize);
                ctx.strokeStyle = '#09090b';
                ctx.strokeRect(ox + x * this.tileSize, oy + y * this.tileSize, this.tileSize, this.tileSize);
            }
        }

        // Stairs
        if (this.revealed[this.stairs.y] && this.revealed[this.stairs.y][this.stairs.x]) {
            ctx.fillStyle = '#10b981';
            ctx.fillRect(ox + this.stairs.x * this.tileSize + 4, oy + this.stairs.y * this.tileSize + 4, this.tileSize - 8, this.tileSize - 8);
        }

        // Items
        for (const it of this.items) {
            if (this.revealed[it.y] && this.revealed[it.y][it.x]) {
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(ox + it.x * this.tileSize + this.tileSize / 2, oy + it.y * this.tileSize + this.tileSize / 2, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Enemies
        for (const en of this.enemies) {
            if (this.revealed[en.y] && this.revealed[en.y][en.x]) {
                ctx.fillStyle = en.color;
                ctx.beginPath();
                ctx.arc(ox + en.x * this.tileSize + this.tileSize / 2, oy + en.y * this.tileSize + this.tileSize / 2, 9, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Projectiles
        ctx.fillStyle = '#f97316';
        for (const p of this.projectiles) {
            ctx.beginPath();
            ctx.arc(ox + p.x * this.tileSize + this.tileSize / 2, oy + p.y * this.tileSize + this.tileSize / 2, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player
        ctx.fillStyle = '#f4f4f5';
        ctx.beginPath();
        ctx.arc(ox + this.player.x * this.tileSize + this.tileSize / 2, oy + this.player.y * this.tileSize + this.tileSize / 2, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};
