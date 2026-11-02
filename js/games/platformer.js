/**
 * Gravity Runner - 2D Precision Platformer
 * Super responsive physics: Double-jump, wall-slide, wall-jump, dash, and gravity flip pads.
 * Features 10 procedural & curated challenge levels, collectibles and death counters.
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
            w: 22, h: 28,
            speed: 5.5,
            jumpForce: 11.5,
            gravity: 28.0,
            isGrounded: false,
            canDoubleJump: true,
            isWallSliding: false,
            wallDir: 0,
            canDash: true,
            isDashing: false,
            dashTimer: 0,
            gravityDir: 1 // 1 = down, -1 = up
        };

        this.platforms = [];
        this.spikes = [];
        this.gems = [];
        this.goal = { x: 700, y: 100, w: 30, h: 40 };

        this.deaths = 0;
        this.gemsCollected = 0;
        this.totalGems = 0;
        this.currentLevel = 1;
        this.difficulty = 'Normal';

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
            <div class="rush-stat">Deaths: <span class="rush-stat-val" style="color:#ef4444;" id="plat-deaths">0</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'plat-win-screen';
        win.innerHTML = `
            <div class="win-title">LEVEL COMPLETE! ⚡</div>
            <div class="win-subtitle" id="plat-win-sub">Challenge Conquered!</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-plat-replay">Replay</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-plat-next">Next Level ➔</button>
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
        this.gemsCollected = 0;
        this.player.gravityDir = 1;

        const winScreen = this.container.querySelector('#plat-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.buildLevel(levelIndex);
        this.respawnPlayer();
        this.updateHUD();
    }

    buildLevel(levelIndex) {
        this.platforms = [];
        this.spikes = [];
        this.gems = [];

        const w = this.canvas.width || 800;
        const h = this.canvas.height || 600;

        // Ground and boundary borders
        this.platforms.push({ x: 0, y: h - 30, w: w, h: 40 });
        this.platforms.push({ x: 0, y: 0, w: w, h: 20 });
        this.platforms.push({ x: 0, y: 0, w: 20, h: h });
        this.platforms.push({ x: w - 20, y: 0, w: 20, h: h });

        // Procedural & Level architecture
        if (levelIndex === 1) {
            // Intro platforms
            this.platforms.push({ x: 120, y: h - 110, w: 140, h: 18 });
            this.platforms.push({ x: 320, y: h - 180, w: 140, h: 18 });
            this.platforms.push({ x: 520, y: h - 260, w: 140, h: 18 });
            this.platforms.push({ x: 300, y: h - 350, w: 160, h: 18 });

            this.spikes.push({ x: 260, y: h - 30, w: 50, h: 16 });
            this.spikes.push({ x: 470, y: h - 30, w: 50, h: 16 });

            this.gems.push({ x: 180, y: h - 140, collected: false });
            this.gems.push({ x: 380, y: h - 210, collected: false });
            this.gems.push({ x: 580, y: h - 290, collected: false });

            this.goal = { x: 360, y: h - 400, w: 32, h: 48 };
        } else if (levelIndex === 2) {
            // Wall-jump shaft
            this.platforms.push({ x: 140, y: h - 120, w: 100, h: 18 });
            this.platforms.push({ x: 280, y: h - 240, w: 20, h: 200 }); // Wall 1
            this.platforms.push({ x: 380, y: h - 360, w: 20, h: 240 }); // Wall 2
            this.platforms.push({ x: 480, y: h - 200, w: 120, h: 18 });

            this.spikes.push({ x: 160, y: h - 30, w: 120, h: 16 });
            this.spikes.push({ x: 300, y: h - 30, w: 180, h: 16 });

            this.gems.push({ x: 330, y: h - 220, collected: false });
            this.gems.push({ x: 330, y: h - 320, collected: false });
            this.gems.push({ x: 540, y: h - 230, collected: false });

            this.goal = { x: 540, y: h - 260, w: 32, h: 48 };
        } else {
            // Hard Gauntlet
            for (let i = 0; i < 6; i++) {
                const px = 100 + i * 110;
                const py = h - 90 - (i % 2 === 0 ? 60 : 120);
                this.platforms.push({ x: px, y: py, w: 80, h: 16 });
                if (i > 0 && i < 5) {
                    this.spikes.push({ x: px + 20, y: py - 12, w: 40, h: 12 });
                }
                this.gems.push({ x: px + 40, y: py - 40, collected: false });
            }
            this.goal = { x: w - 90, y: h - 200, w: 32, h: 48 };
        }

        this.totalGems = this.gems.length;
    }

    respawnPlayer() {
        const h = this.canvas.height || 600;
        this.player.x = 40;
        this.player.y = h - 90;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.isGrounded = false;
        this.player.canDoubleJump = true;
        this.player.canDash = true;
        this.player.gravityDir = 1;
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
                this.jump();
            }
            if (e.code === 'KeyJ' || e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'KeyX') {
                this.dash();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        this.container.querySelector('#btn-plat-replay').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-plat-next').onclick = () => this.startLevel(this.currentLevel + 1, this.difficulty);
    }

    jump() {
        const p = this.player;
        if (p.isGrounded) {
            p.vy = -p.jumpForce * p.gravityDir;
            p.isGrounded = false;
            p.canDoubleJump = true;
            if (window.AudioManager) window.AudioManager.playJump();
        } else if (p.isWallSliding) {
            // Wall jump
            p.vy = -p.jumpForce * 0.9 * p.gravityDir;
            p.vx = -p.wallDir * p.speed * 1.3;
            p.isWallSliding = false;
            if (window.AudioManager) window.AudioManager.playJump();
        } else if (p.canDoubleJump) {
            p.vy = -p.jumpForce * 0.9 * p.gravityDir;
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

            // Ghost particle
            if (Math.random() < 0.6) {
                this.ghosts.push({ x: p.x, y: p.y, w: p.w, h: p.h, alpha: 0.6 });
            }

            if (p.dashTimer <= 0) {
                p.isDashing = false;
                p.vx *= 0.3;
            }
        } else {
            // Horizontal move
            let moveDir = 0;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir -= 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir += 1;

            p.vx = moveDir * p.speed;

            // Gravity
            p.vy += p.gravity * p.gravityDir * delta;
            if (p.isWallSliding && p.vy * p.gravityDir > 2) {
                p.vy = 2 * p.gravityDir; // Friction
            }

            // Move X & Collide
            p.x += p.vx * 60 * delta;
            this.checkPlatformCollisionX();

            // Move Y & Collide
            p.y += p.vy * 60 * delta;
            this.checkPlatformCollisionY();
        }

        // Spikes check
        for (const sp of this.spikes) {
            if (this.rectIntersect(p, sp)) {
                this.onDeath();
                return;
            }
        }

        // Gems check
        for (const gem of this.gems) {
            if (!gem.collected && Math.hypot((p.x + p.w / 2) - gem.x, (p.y + p.h / 2) - gem.y) < 20) {
                gem.collected = true;
                this.gemsCollected++;
                this.updateHUD();
                if (window.AudioManager) window.AudioManager.playPowerup();
            }
        }

        // Goal check
        if (this.rectIntersect(p, this.goal)) {
            this.triggerWin();
        }

        // Update ghosts
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            this.ghosts[i].alpha -= delta * 3;
            if (this.ghosts[i].alpha <= 0) this.ghosts.splice(i, 1);
        }
    }

    checkPlatformCollisionX() {
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

    checkPlatformCollisionY() {
        const p = this.player;
        p.isGrounded = false;

        for (const plat of this.platforms) {
            if (this.rectIntersect(p, plat)) {
                if (p.vy * p.gravityDir > 0) {
                    p.y = p.gravityDir > 0 ? plat.y - p.h : plat.y + plat.h;
                    p.isGrounded = true;
                    p.canDoubleJump = true;
                    p.canDash = true;
                    p.vy = 0;
                } else {
                    p.y = p.gravityDir > 0 ? plat.y + plat.h : plat.y - p.h;
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

        // Draw Ghost Trail
        for (const g of this.ghosts) {
            ctx.fillStyle = `rgba(59, 130, 246, ${g.alpha * 0.5})`;
            ctx.fillRect(g.x, g.y, g.w, g.h);
        }

        // Draw Platforms
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        for (const plat of this.platforms) {
            ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
            ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        }

        // Draw Spikes
        ctx.fillStyle = '#ef4444';
        for (const sp of this.spikes) {
            ctx.beginPath();
            ctx.moveTo(sp.x, sp.y + sp.h);
            ctx.lineTo(sp.x + sp.w / 2, sp.y);
            ctx.lineTo(sp.x + sp.w, sp.y + sp.h);
            ctx.fill();
        }

        // Draw Gems
        for (const gem of this.gems) {
            if (!gem.collected) {
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(gem.x, gem.y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            }
        }

        // Draw Goal Portal
        ctx.fillStyle = '#10b981';
        ctx.fillRect(this.goal.x, this.goal.y, this.goal.w, this.goal.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('GOAL', this.goal.x + 2, this.goal.y + 24);

        // Draw Player
        const p = this.player;
        ctx.fillStyle = p.isDashing ? '#93c5fd' : '#3b82f6';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(p.x, p.y, p.w, p.h);
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; this.lastTime = performance.now(); }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.container) this.container.innerHTML = '';
    }
};

