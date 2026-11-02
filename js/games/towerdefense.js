/**
 * Cyber Siege - Tower Defense Game
 * Built with Canvas 2D. Features procedural pathways, multiple turret types with upgrades,
 * elemental effects (freeze, chain lightning, splash), wave bosses and multiple levels.
 */

window.TowerDefenseGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.credits = 350;
        this.lives = 20;
        this.wave = 1;
        this.maxWaves = 15;
        this.currentLevel = 1;
        this.difficulty = 'Normal';

        this.waypoints = [];
        this.turrets = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];

        this.selectedTowerType = 'blaster';
        this.selectedTurret = null;
        this.waveInProgress = false;
        this.waveSpawnTimer = 0;
        this.enemiesToSpawn = [];

        this.towerTypes = {
            blaster: { name: 'Gatling', cost: 100, range: 110, rate: 0.18, damage: 18, color: '#3b82f6' },
            plasma: { name: 'Plasma AOE', cost: 180, range: 130, rate: 0.7, damage: 45, splash: 50, color: '#f59e0b' },
            cryo: { name: 'Cryo Frost', cost: 140, range: 95, rate: 0.5, damage: 12, slow: 0.5, color: '#06b6d4' },
            tesla: { name: 'Tesla Coil', cost: 240, range: 125, rate: 0.8, damage: 60, chain: 3, color: '#a855f7' }
        };
    }

    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // Top HUD
        const hud = document.createElement('div');
        hud.className = 'rush-hud';
        hud.innerHTML = `
            <div class="rush-stat">Credits: <span class="rush-stat-val" style="color:#fbbf24;" id="td-credits">$350</span></div>
            <div class="rush-stat">Lives: <span class="rush-stat-val" style="color:#ef4444;" id="td-lives">20</span></div>
            <div class="rush-stat">Wave: <span class="rush-stat-val" id="td-wave">1/15</span></div>
            <button class="btn-game-action" id="btn-td-wave" style="background:#10b981; border-color:#10b981;">▶ Start Wave</button>
        `;
        this.container.appendChild(hud);

        // Tower Shop Bar
        const shop = document.createElement('div');
        shop.className = 'td-shop';
        shop.innerHTML = `
            <div class="td-tower-card selected" data-type="blaster">
                <div class="td-tower-name">Gatling</div>
                <div class="td-tower-cost">$100</div>
            </div>
            <div class="td-tower-card" data-type="plasma">
                <div class="td-tower-name">Plasma</div>
                <div class="td-tower-cost">$180</div>
            </div>
            <div class="td-tower-card" data-type="cryo">
                <div class="td-tower-name">Cryo</div>
                <div class="td-tower-cost">$140</div>
            </div>
            <div class="td-tower-card" data-type="tesla">
                <div class="td-tower-name">Tesla</div>
                <div class="td-tower-cost">$240</div>
            </div>
        `;
        this.container.appendChild(shop);

        // Win Overlay
        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'td-win-screen';
        win.innerHTML = `
            <div class="win-title" id="td-win-title">SECTOR CLEARED! 🛡️</div>
            <div class="win-subtitle" id="td-win-sub">All enemy waves repelled!</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-td-replay">Replay Sector</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-td-next">Next Sector ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Normal');

        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        this.animId = requestAnimationFrame(this.loop);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    startLevel(levelIndex = 1, difficulty = 'Normal') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;
        this.credits = 350 + (levelIndex * 50);
        this.lives = 20;
        this.wave = 1;
        this.turrets = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.waveInProgress = false;

        const winScreen = this.container.querySelector('#td-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.generatePath(levelIndex);
        this.updateHUD();
    }

    generatePath(levelIndex) {
        const w = this.canvas.width || 800;
        const h = this.canvas.height || 600;

        // Waypoints based on level shape
        if (levelIndex === 1) {
            // S-Curve
            this.waypoints = [
                { x: 0, y: h * 0.25 },
                { x: w * 0.75, y: h * 0.25 },
                { x: w * 0.75, y: h * 0.65 },
                { x: w * 0.25, y: h * 0.65 },
                { x: w * 0.25, y: h * 0.85 },
                { x: w + 40, y: h * 0.85 }
            ];
        } else if (levelIndex === 2) {
            // Spiral / Double loop
            this.waypoints = [
                { x: 0, y: h * 0.2 },
                { x: w * 0.85, y: h * 0.2 },
                { x: w * 0.85, y: h * 0.8 },
                { x: w * 0.15, y: h * 0.8 },
                { x: w * 0.15, y: h * 0.5 },
                { x: w + 40, y: h * 0.5 }
            ];
        } else {
            // Zig-Zag Maze
            this.waypoints = [
                { x: 0, y: h * 0.15 },
                { x: w * 0.8, y: h * 0.15 },
                { x: w * 0.2, y: h * 0.4 },
                { x: w * 0.8, y: h * 0.65 },
                { x: w * 0.1, y: h * 0.85 },
                { x: w + 40, y: h * 0.85 }
            ];
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.generatePath(this.currentLevel);
        });

        // Shop Tower selection
        const cards = this.container.querySelectorAll('.td-tower-card');
        cards.forEach(card => {
            card.onclick = () => {
                cards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedTowerType = card.dataset.type;
                if (window.AudioManager) window.AudioManager.playClick();
            };
        });

        // Start wave button
        this.container.querySelector('#btn-td-wave').onclick = () => {
            this.startNextWave();
        };

        // Canvas click = place tower
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleCanvasClick(x, y);
        });

        this.container.querySelector('#btn-td-replay').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-td-next').onclick = () => this.startLevel(this.currentLevel + 1, this.difficulty);
    }

    handleCanvasClick(x, y) {
        // Check if clicked near road
        if (this.isNearPath(x, y, 35)) return;

        // Check if existing turret
        for (const t of this.turrets) {
            if (Math.hypot(t.x - x, t.y - y) < 25) {
                // Upgrade turret if enough credits
                const upgradeCost = Math.floor(t.cost * 0.7);
                if (this.credits >= upgradeCost) {
                    this.credits -= upgradeCost;
                    t.level++;
                    t.damage = Math.floor(t.damage * 1.4);
                    t.range += 15;
                    this.updateHUD();
                    if (window.AudioManager) window.AudioManager.playPowerup();
                }
                return;
            }
        }

        // Place new turret
        const info = this.towerTypes[this.selectedTowerType];
        if (this.credits >= info.cost) {
            this.credits -= info.cost;
            this.turrets.push({
                x, y,
                type: this.selectedTowerType,
                name: info.name,
                cost: info.cost,
                range: info.range,
                rate: info.rate,
                damage: info.damage,
                splash: info.splash || 0,
                slow: info.slow || 0,
                chain: info.chain || 0,
                color: info.color,
                cooldown: 0,
                level: 1
            });
            this.updateHUD();
            if (window.AudioManager) window.AudioManager.playPlaceBlock();
        }
    }

    isNearPath(x, y, threshold) {
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const p1 = this.waypoints[i];
            const p2 = this.waypoints[i + 1];
            const dist = this.distToSegment({ x, y }, p1, p2);
            if (dist < threshold) return true;
        }
        return false;
    }

    distToSegment(p, v, w) {
        const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }

    startNextWave() {
        if (this.waveInProgress) return;
        this.waveInProgress = true;
        this.enemiesToSpawn = [];

        const count = 8 + this.wave * 3;
        const isBossWave = (this.wave % 5 === 0);

        for (let i = 0; i < count; i++) {
            const hp = (30 + this.wave * 18) * (this.difficulty === 'Hard' ? 1.4 : 1.0);
            this.enemiesToSpawn.push({
                hp: hp,
                maxHp: hp,
                speed: 1.1 + (Math.random() * 0.4),
                radius: 12,
                color: '#ef4444',
                reward: 15 + this.wave * 2
            });
        }

        if (isBossWave) {
            const bossHp = 400 + this.wave * 120;
            this.enemiesToSpawn.push({
                hp: bossHp,
                maxHp: bossHp,
                speed: 0.7,
                radius: 22,
                color: '#ec4899',
                reward: 120,
                isBoss: true
            });
        }

        this.waveSpawnTimer = 0;
        if (window.AudioManager) window.AudioManager.playSelect();
    }

    updateHUD() {
        const credEl = this.container.querySelector('#td-credits');
        const livesEl = this.container.querySelector('#td-lives');
        const waveEl = this.container.querySelector('#td-wave');

        if (credEl) credEl.innerText = `$${this.credits}`;
        if (livesEl) livesEl.innerText = `${this.lives}`;
        if (waveEl) waveEl.innerText = `${this.wave}/${this.maxWaves}`;
    }

    loop(time) {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;

        const delta = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(delta);
        this.render();
    }

    update(delta) {
        // Spawn queued enemies
        if (this.enemiesToSpawn.length > 0) {
            this.waveSpawnTimer -= delta;
            if (this.waveSpawnTimer <= 0) {
                const en = this.enemiesToSpawn.shift();
                en.waypointIdx = 0;
                en.x = this.waypoints[0].x;
                en.y = this.waypoints[0].y;
                en.slowTimer = 0;
                this.enemies.push(en);
                this.waveSpawnTimer = 0.65;
            }
        } else if (this.enemies.length === 0 && this.waveInProgress) {
            // Wave ended
            this.waveInProgress = false;
            this.credits += 50 + this.wave * 10;
            this.wave++;
            this.updateHUD();

            if (this.wave > this.maxWaves) {
                this.triggerWin();
            }
        }

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const en = this.enemies[i];
            const target = this.waypoints[en.waypointIdx + 1];

            if (!target) {
                // Reached end
                this.lives--;
                this.enemies.splice(i, 1);
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playHit();
                if (this.lives <= 0) {
                    this.triggerGameOver();
                }
                continue;
            }

            const currentSpeed = en.slowTimer > 0 ? en.speed * 0.5 : en.speed;
            if (en.slowTimer > 0) en.slowTimer -= delta;

            const dx = target.x - en.x;
            const dy = target.y - en.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                en.waypointIdx++;
            } else {
                en.x += (dx / dist) * currentSpeed * 75 * delta;
                en.y += (dy / dist) * currentSpeed * 75 * delta;
            }
        }

        // Update Turrets & Firing
        this.turrets.forEach(t => {
            t.cooldown -= delta;
            if (t.cooldown <= 0) {
                // Find enemy in range
                let target = null;
                let minDist = t.range;

                for (const en of this.enemies) {
                    const d = Math.hypot(en.x - t.x, en.y - t.y);
                    if (d <= minDist) {
                        minDist = d;
                        target = en;
                    }
                }

                if (target) {
                    t.cooldown = t.rate;
                    this.fireProjectile(t, target);
                }
            }
        });

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const dx = p.target.x - p.x;
            const dy = p.target.y - p.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 10 || !this.enemies.includes(p.target)) {
                // Hit
                this.hitEnemy(p);
                this.projectiles.splice(i, 1);
            } else {
                p.x += (dx / dist) * p.speed * delta;
                p.y += (dy / dist) * p.speed * delta;
            }
        }
    }

    fireProjectile(turret, target) {
        this.projectiles.push({
            x: turret.x,
            y: turret.y,
            target: target,
            damage: turret.damage,
            splash: turret.splash,
            slow: turret.slow,
            color: turret.color,
            speed: 400
        });
        if (window.AudioManager) window.AudioManager.playLaser();
    }

    hitEnemy(p) {
        if (p.splash > 0) {
            for (const en of this.enemies) {
                if (Math.hypot(en.x - p.x, en.y - p.y) < p.splash) {
                    en.hp -= p.damage;
                }
            }
        } else {
            p.target.hp -= p.damage;
            if (p.slow > 0) p.target.slowTimer = 2.0;
        }

        // Clean dead enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const en = this.enemies[i];
            if (en.hp <= 0) {
                this.credits += en.reward;
                this.enemies.splice(i, 1);
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playExplosion();
            }
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Road / Path
        ctx.save();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 42;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        this.waypoints.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 36;
        ctx.stroke();
        ctx.restore();

        // Draw Turrets
        for (const t of this.turrets) {
            ctx.save();
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Turret level badge
            if (t.level > 1) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(`+${t.level}`, t.x - 6, t.y - 20);
            }
            ctx.restore();
        }

        // Draw Enemies
        for (const en of this.enemies) {
            ctx.save();
            ctx.fillStyle = en.slowTimer > 0 ? '#38bdf8' : en.color;
            ctx.beginPath();
            ctx.arc(en.x, en.y, en.radius, 0, Math.PI * 2);
            ctx.fill();

            // Health bar
            const barW = en.radius * 2;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(en.x - en.radius, en.y - en.radius - 8, barW, 4);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(en.x - en.radius, en.y - en.radius - 8, barW * (en.hp / en.maxHp), 4);
            ctx.restore();
        }

        // Draw Projectiles
        for (const p of this.projectiles) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    triggerWin() {
        if (window.AudioManager) window.AudioManager.playWin();
        const winScreen = this.container.querySelector('#td-win-screen');
        if (winScreen) winScreen.classList.add('active');
    }

    triggerGameOver() {
        alert('Base overrun! Try again.');
        this.startLevel(this.currentLevel, this.difficulty);
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; this.lastTime = performance.now(); }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};

