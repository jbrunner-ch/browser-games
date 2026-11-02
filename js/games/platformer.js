/**
 * Gravity Runner - 2D Precision Platformer
 * Levels 1 - 100+ with procedural gauntlet generation, double-jump,
 * wall-slide, wall-jump, dash, collectibles and scaling obstacle density.
 */

window.PlatformerGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.isPaused = false;

        this.player = {
            x: 50, y: 300,
            vx: 0, vy: 0,
            w: 20, h: 26,
            speed: 5.5,
            jumpForce: 11.2,
            gravity: 28.0,
            isGrounded: false,
            canDoubleJump: true,
            isWallSliding: false,
            wallDir: 0,
            canDash: true,
            isDashing: false,
            dashTimer: 0
        };

        this.platforms = [];
        this.spikes = [];
        this.gems = [];
        this.goal = { x: 700, y: 100, w: 28, h: 42 };

        this.deaths = 0;
        this.gemsCollected = 0;
        this.totalGems = 0;
        this.currentLevel = 1;
        this.keys = {};
        this.ghosts = [];
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
            <div class="rush-stat">Level: <span class="rush-stat-val" id="plat-lvl">1</span></div>
            <div class="rush-stat">Gems: <span class="rush-stat-val" style="color:#38bdf8;" id="plat-gems">0/3</span></div>
            <div class="rush-stat">Tode: <span class="rush-stat-val" style="color:#ef4444;" id="plat-deaths">0</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'plat-win-screen';
        win.innerHTML = `
            <div class="win-title">LEVEL GESCHAFFT!</div>
            <div class="win-subtitle" id="plat-win-sub">Alle Kristalle gesichert.</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-game-action" id="btn-plat-replay">Wiederholen</button>
                <button class="btn-game-action" style="background:#2563eb; color:#fff;" id="btn-plat-next">Nächstes Level ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        this.bindEvents();
        this.resize();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl);

        requestAnimationFrame(() => this.resize());

        this.lastTime = performance.now();
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
    }

    startLevel(levelIndex = 1) {
        this.currentLevel = levelIndex;
        this.gemsCollected = 0;

        const winScreen = this.container.querySelector('#plat-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.buildLevel(levelIndex);
        this.respawnPlayer();
        this.updateHUD();
    }

    buildLevel(level) {
        this.platforms = [];
        this.spikes = [];
        this.gems = [];

        const w = this.canvas.width || 800;
        const h = this.canvas.height || 600;

        // Boundaries
        this.platforms.push({ x: 0, y: h - 30, w: w, h: 30 }); // Floor
        this.platforms.push({ x: 0, y: 0, w: w, h: 20 });       // Ceiling
        this.platforms.push({ x: 0, y: 0, w: 20, h: h });       // Left wall
        this.platforms.push({ x: w - 20, y: 0, w: 20, h: h }); // Right wall

        // Procedural challenge generation scaling with level
        const numPlatforms = 4 + Math.min(10, Math.floor(level / 5));
        const spacing = (w - 180) / numPlatforms;
        const seed = level * 71.39 + 17;

        let lastY = h - 120;
        for (let i = 0; i < numPlatforms; i++) {
            const px = 100 + i * spacing;
            // Height wobble
            const targetY = h - 100 - Math.abs(Math.sin(i * 1.5 + seed)) * (h - 260);
            const platW = Math.max(65, 120 - Math.min(50, level * 2));
            const platH = 16;

            this.platforms.push({ x: px, y: targetY, w: platW, h: platH });

            // Add spikes on floor or on platform
            if (i > 0 && Math.sin(i * 3 + seed) > 0.1) {
                const spW = Math.min(platW - 20, 30 + Math.min(25, level));
                this.spikes.push({
                    x: px + (platW - spW) / 2,
                    y: targetY - 12,
                    w: spW,
                    h: 12
                });
            }

            // Gems
            this.gems.push({
                x: px + platW / 2,
                y: targetY - 35,
                collected: false
            });

            lastY = targetY;
        }

        // Floor hazard spikes based on difficulty
        const hazardCount = Math.min(8, 2 + Math.floor(level / 8));
        for (let k = 0; k < hazardCount; k++) {
            this.spikes.push({
                x: 140 + k * (w / (hazardCount + 1)),
                y: h - 42,
                w: 40,
                h: 14
            });
        }

        this.goal = { x: w - 70, y: Math.max(70, lastY - 40), w: 28, h: 42 };
        this.totalGems = this.gems.length;
    }

    respawnPlayer() {
        const h = this.canvas.height || 600;
        this.player.x = 40;
        this.player.y = h - 80;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.isGrounded = false;
        this.player.canDoubleJump = true;
        this.player.canDash = true;
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.buildLevel(this.currentLevel);
        });

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
                this.jump();
            }
            if (e.code === 'KeyJ' || e.code === 'ShiftLeft' || e.code === 'KeyX') {
                this.dash();
            }
        });

        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        this.container.querySelector('#btn-plat-replay').onclick = () => this.startLevel(this.currentLevel);
        this.container.querySelector('#btn-plat-next').onclick = () => {
            if (window.portal) window.portal.launchGame('platformer', this.currentLevel + 1);
            else this.startLevel(this.currentLevel + 1);
        };
    }

    jump() {
        const p = this.player;
        if (p.isGrounded) {
            p.vy = -p.jumpForce;
            p.isGrounded = false;
            p.canDoubleJump = true;
            if (window.AudioManager) window.AudioManager.playJump();
        } else if (p.isWallSliding) {
            p.vy = -p.jumpForce * 0.95;
            p.vx = -p.wallDir * p.speed * 1.3;
            p.isWallSliding = false;
            if (window.AudioManager) window.AudioManager.playJump();
        } else if (p.canDoubleJump) {
            p.vy = -p.jumpForce * 0.9;
            p.canDoubleJump = false;
            if (window.AudioManager) window.AudioManager.playJump();
        }
    }

    dash() {
        const p = this.player;
        if (!p.canDash || p.isDashing) return;

        p.isDashing = true;
        p.canDash = false;
        p.dashTimer = 0.16;

        let dir = 0;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dir -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dir += 1;
        if (dir === 0) dir = 1;

        p.vx = dir * 18.0;
        p.vy = 0;
        if (window.AudioManager) window.AudioManager.playLaser();
    }

    loop(time) {
        this.animId = requestAnimationFrame(this.loop);
        if (this.isPaused || !this.ctx) return;

        const delta = Math.min((time - this.lastTime) / 1000, 0.05);
        this.lastTime = time;

        this.update(delta);
        this.render();
    }

    update(delta) {
        const p = this.player;

        if (p.isDashing) {
            p.dashTimer -= delta;
            p.x += p.vx * 60 * delta;
            if (p.dashTimer <= 0) {
                p.isDashing = false;
                p.vx *= 0.3;
            }
        } else {
            let moveDir = 0;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir -= 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir += 1;

            p.vx = moveDir * p.speed;
            p.vy += p.gravity * delta;

            if (p.isWallSliding && p.vy > 2) p.vy = 2;

            p.x += p.vx * 60 * delta;
            this.checkCollisionX();

            p.y += p.vy * 60 * delta;
            this.checkCollisionY();
        }

        // Spikes
        for (const sp of this.spikes) {
            if (this.rectIntersect(p, sp)) {
                this.onDeath();
                return;
            }
        }

        // Gems
        for (const gem of this.gems) {
            if (!gem.collected && Math.hypot((p.x + p.w / 2) - gem.x, (p.y + p.h / 2) - gem.y) < 18) {
                gem.collected = true;
                this.gemsCollected++;
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playPowerup();
            }
        }

        // Goal
        if (this.rectIntersect(p, this.goal)) {
            this.triggerWin();
        }
    }

    checkCollisionX() {
        const p = this.player;
        p.isWallSliding = false;

        for (const plat of this.platforms) {
            if (this.rectIntersect(p, plat)) {
                if (p.vx > 0) {
                    p.x = plat.x - p.w;
                    p.isWallSliding = !p.isGrounded;
                    p.wallDir = 1;
                } else if (p.vx < 0) {
                    p.x = plat.x + plat.w;
                    p.isWallSliding = !p.isGrounded;
                    p.wallDir = -1;
                }
                p.vx = 0;
            }
        }
    }

    checkCollisionY() {
        const p = this.player;
        p.isGrounded = false;

        for (const plat of this.platforms) {
            if (this.rectIntersect(p, plat)) {
                if (p.vy > 0) {
                    p.y = plat.y - p.h;
                    p.isGrounded = true;
                    p.canDoubleJump = true;
                    p.canDash = true;
                    p.vy = 0;
                } else {
                    p.y = plat.y + plat.h;
                    p.vy = 0;
                }
            }
        }
    }

    rectIntersect(r1, r2) {
        return r1.x < r2.x + r2.w &&
               r1.x + r1.w > r2.x &&
               r1.y < r2.y + r2.h &&
               r1.y + r1.h > r2.y;
    }

    onDeath() {
        this.deaths++;
        this.updateHUD();
        if (window.AudioManager) window.AudioManager.playHit();
        this.respawnPlayer();
    }

    triggerWin() {
        if (window.AudioManager) window.AudioManager.playWin();
        const winScreen = this.container.querySelector('#plat-win-screen');
        if (winScreen) winScreen.classList.add('active');
    }

    updateHUD() {
        const lvlEl = this.container.querySelector('#plat-lvl');
        const gemEl = this.container.querySelector('#plat-gems');
        const deathEl = this.container.querySelector('#plat-deaths');

        if (lvlEl) lvlEl.innerText = `${this.currentLevel}`;
        if (gemEl) gemEl.innerText = `${this.gemsCollected}/${this.totalGems}`;
        if (deathEl) deathEl.innerText = `${this.deaths}`;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Platforms
        ctx.fillStyle = '#27272a';
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1;
        for (const plat of this.platforms) {
            ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
            ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        }

        // Spikes
        ctx.fillStyle = '#ef4444';
        for (const sp of this.spikes) {
            ctx.beginPath();
            ctx.moveTo(sp.x, sp.y + sp.h);
            ctx.lineTo(sp.x + sp.w / 2, sp.y);
            ctx.lineTo(sp.x + sp.w, sp.y + sp.h);
            ctx.fill();
        }

        // Gems
        for (const gem of this.gems) {
            if (!gem.collected) {
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(gem.x, gem.y, 7, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Goal
        ctx.fillStyle = '#10b981';
        ctx.fillRect(this.goal.x, this.goal.y, this.goal.w, this.goal.h);

        // Player
        const p = this.player;
        ctx.fillStyle = p.isDashing ? '#93c5fd' : '#2563eb';
        ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; this.lastTime = performance.now(); }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};
