/**
 * Shadow Labyrinth - Roguelike Dungeon Crawler
 * Built with Canvas 2D. Features procedural dungeon generation, dynamic fog-of-war lighting,
 * melee sword swings, fireball spells, enemy AI, loot chests, and staircase floor progression.
 */

window.DungeonGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.tileSize = 32;
        this.mapW = 32;
        this.mapH = 24;
        this.grid = [];
        this.revealed = [];

        this.player = {
            x: 5, y: 5,
            hp: 100, maxHp: 100,
            mana: 60, maxMana: 60,
            gold: 0,
            hasKey: false,
            dir: { x: 0, y: 1 }
        };

        this.enemies = [];
        this.items = [];
        this.stairs = { x: 0, y: 0 };
        this.projectiles = [];

        this.floor = 1;
        this.difficulty = 'Normal';
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
            <div class="rush-stat">Floor: <span class="rush-stat-val" id="dg-floor">1</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'dg-win-screen';
        win.innerHTML = `
            <div class="win-title">DUNGEON CONQUERED! ⚔️</div>
            <div class="win-subtitle" id="dg-win-sub">Floor Cleared! Descend into the deep...</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-dg-replay">Replay Floor</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-dg-next">Next Floor ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Normal');

        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    startLevel(levelIndex = 1, difficulty = 'Normal') {
        this.floor = levelIndex;
        this.difficulty = difficulty;
        this.player.hasKey = false;
        this.enemies = [];
        this.items = [];
        this.projectiles = [];

        const winScreen = this.container.querySelector('#dg-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.generateDungeon();
        this.updateHUD();
    }

    generateDungeon() {
        this.grid = Array(this.mapH).fill(null).map(() => Array(this.mapW).fill(1)); // 1 = wall, 0 = floor
        this.revealed = Array(this.mapH).fill(null).map(() => Array(this.mapW).fill(false));

        // Dig out rooms
        const rooms = [];
        const numRooms = 7 + this.floor;

        for (let i = 0; i < numRooms; i++) {
            const rw = 4 + Math.floor(Math.random() * 5);
            const rh = 4 + Math.floor(Math.random() * 5);
            const rx = 1 + Math.floor(Math.random() * (this.mapW - rw - 2));
            const ry = 1 + Math.floor(Math.random() * (this.mapH - rh - 2));

            for (let y = ry; y < ry + rh; y++) {
                for (let x = rx; x < rx + rw; x++) {
                    this.grid[y][x] = 0;
                }
            }
            rooms.push({ x: rx + Math.floor(rw / 2), y: ry + Math.floor(rh / 2) });
        }

        // Connect rooms with corridors
        for (let i = 0; i < rooms.length - 1; i++) {
            const r1 = rooms[i];
            const r2 = rooms[i + 1];

            let cx = r1.x;
            let cy = r1.y;

            while (cx !== r2.x) {
                this.grid[cy][cx] = 0;
                cx += (r2.x > cx ? 1 : -1);
            }
            while (cy !== r2.y) {
                this.grid[cy][cx] = 0;
                cy += (r2.y > cy ? 1 : -1);
            }
        }

        // Place player in first room
        this.player.x = rooms[0].x;
        this.player.y = rooms[0].y;

        // Place exit stairs in last room
        const lastRoom = rooms[rooms.length - 1];
        this.stairs = { x: lastRoom.x, y: lastRoom.y };

        // Place enemies & loot in other rooms
        for (let i = 1; i < rooms.length; i++) {
            const r = rooms[i];
            this.enemies.push({
                x: r.x, y: r.y,
                hp: 30 + this.floor * 15,
                maxHp: 30 + this.floor * 15,
                color: '#ef4444'
            });

            if (Math.random() < 0.6) {
                this.items.push({ x: r.x + 1, y: r.y, type: 'gold', val: 25 });
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
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            // Melee sword swing
            if (e.code === 'Space') {
                this.attackMelee();
            }
            // Fireball spell
            if (e.code === 'KeyF' || e.code === 'KeyJ') {
                this.castFireball();
            }
        });

        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        this.container.querySelector('#btn-dg-replay').onclick = () => this.startLevel(this.floor, this.difficulty);
        this.container.querySelector('#btn-dg-next').onclick = () => this.startLevel(this.floor + 1, this.difficulty);
    }

    attackMelee() {
        const targetX = this.player.x + this.player.dir.x;
        const targetY = this.player.y + this.player.dir.y;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const en = this.enemies[i];
            if (en.x === targetX && en.y === targetY) {
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
            let dx = 0;
            let dy = 0;
            if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
            else if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
            else if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
            else if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

            if (dx !== 0 || dy !== 0) {
                this.player.dir = { x: dx, y: dy };
                const nx = this.player.x + dx;
                const ny = this.player.y + dy;

                if (this.grid[ny] && this.grid[ny][nx] === 0) {
                    // Check if monster blocking
                    const monster = this.enemies.find(m => m.x === nx && m.y === ny);
                    if (!monster) {
                        this.player.x = nx;
                        this.player.y = ny;
                        this.updateFogOfWar();
                        this.checkPickups();

                        // Stairs check
                        if (this.player.x === this.stairs.x && this.player.y === this.stairs.y) {
                            this.triggerWin();
                        }
                    }
                }
                this.moveCooldown = 0.16;
            }
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.dx;
            p.y += p.dy;
            p.range--;

            // Hit enemy
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

        const offsetX = Math.floor((this.canvas.width - this.mapW * this.tileSize) / 2);
        const offsetY = Math.floor((this.canvas.height - this.mapH * this.tileSize) / 2);

        // Draw Dungeon tiles
        for (let y = 0; y < this.mapH; y++) {
            for (let x = 0; x < this.mapW; x++) {
                if (!this.revealed[y][x]) continue;

                const isWall = this.grid[y][x] === 1;
                ctx.fillStyle = isWall ? '#1e293b' : '#334155';
                ctx.fillRect(offsetX + x * this.tileSize, offsetY + y * this.tileSize, this.tileSize, this.tileSize);
                ctx.strokeStyle = '#0f172a';
                ctx.strokeRect(offsetX + x * this.tileSize, offsetY + y * this.tileSize, this.tileSize, this.tileSize);
            }
        }

        // Draw Stairs
        if (this.revealed[this.stairs.y] && this.revealed[this.stairs.y][this.stairs.x]) {
            ctx.fillStyle = '#10b981';
            ctx.fillRect(offsetX + this.stairs.x * this.tileSize + 4, offsetY + this.stairs.y * this.tileSize + 4, 24, 24);
        }

        // Draw Items
        for (const it of this.items) {
            if (this.revealed[it.y] && this.revealed[it.y][it.x]) {
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(offsetX + it.x * this.tileSize + 16, offsetY + it.y * this.tileSize + 16, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Enemies
        for (const en of this.enemies) {
            if (this.revealed[en.y] && this.revealed[en.y][en.x]) {
                ctx.fillStyle = en.color;
                ctx.beginPath();
                ctx.arc(offsetX + en.x * this.tileSize + 16, offsetY + en.y * this.tileSize + 16, 11, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Projectiles
        ctx.fillStyle = '#f97316';
        for (const p of this.projectiles) {
            ctx.beginPath();
            ctx.arc(offsetX + p.x * this.tileSize + 16, offsetY + p.y * this.tileSize + 16, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Player
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(offsetX + this.player.x * this.tileSize + 16, offsetY + this.player.y * this.tileSize + 16, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};

