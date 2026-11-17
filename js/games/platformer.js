/**
 * Gravity Runner - 2D Precision Platformer
 * Levels 1 - 100+ with procedural gauntlet generation, double-jump,
 * wall-slide, wall-jump, dash, collectibles and 2.5D cyber visuals.
 */

window.PlatformerGame = class {
    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.bgCanvas = null;
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
            dashTimer: 0,
            facing: 1,
            runCycle: 0
        };

        this.platforms = [];
        this.spikes = [];
        this.gems = [];
        this.particles = [];
        this.goal = { x: 700, y: 100, w: 28, h: 42 };

        this.deaths = 0;
        this.gemsCollected = 0;
        this.totalGems = 0;
        this.currentLevel = 1;
        this.keys = {};
        this.ghosts = [];
        this.rings = [];
        this.time = 0;
        this.shake = 0;
        this._handlers = [];
    }

    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.ctx = this.canvas.getContext('2d');
        if (this.ctx) {
            for (const m of ['closePath', 'translate', 'rotate', 'scale', 'ellipse', 'setTransform']) {
                if (!this.ctx[m]) this.ctx[m] = () => {};
            }
        }
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
        this.buildBgCache(w, h);
    }

    buildBgCache(w, h) {
        if (typeof document === 'undefined' || !document.createElement) return;
        const bg = document.createElement('canvas');
        bg.width = w;
        bg.height = h;
        const g = bg.getContext('2d');
        if (!g || !g.createLinearGradient) return;

        // Deep Cyberpunk Night Sky
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#040714');
        sky.addColorStop(0.55, '#0b132b');
        sky.addColorStop(1, '#181436');
        g.fillStyle = sky;
        g.fillRect(0, 0, w, h);

        // Ambient Nebula Glow
        if (g.createRadialGradient) {
            const neb = g.createRadialGradient(w * 0.72, h * 0.25, 20, w * 0.72, h * 0.25, Math.max(w, h) * 0.5);
            neb.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
            neb.addColorStop(0.5, 'rgba(99, 102, 241, 0.08)');
            neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
            g.fillStyle = neb;
            g.fillRect(0, 0, w, h);
        }

        // Deterministic Stars
        for (let i = 0; i < 65; i++) {
            const sx = ((i * 197 + 43) % 997) / 997 * w;
            const sy = ((i * 313 + 89) % 991) / 991 * h * 0.65;
            const sr = (i % 3 === 0) ? 1.5 : 1;
            g.fillStyle = i % 5 === 0 ? 'rgba(56,189,248,0.55)' : 'rgba(226,232,240,0.45)';
            g.fillRect(sx, sy, sr, sr);
        }

        // Far Silhouette Skyline
        let bx = 0;
        let idx = 0;
        while (bx < w) {
            const bw = 36 + ((idx * 37) % 44);
            const bh = 90 + ((idx * 67) % Math.max(120, Math.floor(h * 0.45)));
            const by = h - bh;
            g.fillStyle = idx % 2 === 0 ? '#0d152b' : '#101936';
            g.fillRect(bx, by, bw - 3, bh);
            // Lit cyber windows
            g.fillStyle = idx % 3 === 0 ? 'rgba(34, 211, 238, 0.2)' : 'rgba(168, 85, 247, 0.16)';
            for (let wy = by + 10; wy < h - 45; wy += 14) {
                for (let wx = bx + 6; wx < bx + bw - 10; wx += 10) {
                    if (((wx * 13 + wy * 7) % 11) < 5) g.fillRect(wx, wy, 4, 6);
                }
            }
            bx += bw;
            idx++;
        }

        // Subtle tech grid overlay
        g.fillStyle = 'rgba(99, 102, 241, 0.05)';
        for (let x = 0; x < w; x += 48) g.fillRect(x, 0, 1, h);
        for (let y = 0; y < h; y += 48) g.fillRect(0, y, w, 1);

        this.bgCanvas = bg;
    }

    startLevel(levelIndex = 1) {
        this.currentLevel = levelIndex;
        this.gemsCollected = 0;
        this.particles = [];
        this.ghosts = [];
        this.rings = [];

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
        this.platforms.push({ x: 0, y: h - 30, w: w, h: 30, boundary: true }); // Floor
        this.platforms.push({ x: 0, y: 0, w: w, h: 20, boundary: true });       // Ceiling
        this.platforms.push({ x: 0, y: 0, w: 20, h: h, boundary: true });       // Left wall
        this.platforms.push({ x: w - 20, y: 0, w: 20, h: h, boundary: true }); // Right wall

        // Procedural challenge generation scaling with level
        const numPlatforms = 4 + Math.min(10, Math.floor(level / 5));
        const spacing = (w - 180) / numPlatforms;
        const seed = level * 71.39 + 17;

        let lastY = h - 120;
        for (let i = 0; i < numPlatforms; i++) {
            const px = 100 + i * spacing;
            const targetY = h - 100 - Math.abs(Math.sin(i * 1.5 + seed)) * (h - 260);
            const platW = Math.max(65, 120 - Math.min(50, level * 2));
            const platH = 16;

            this.platforms.push({ x: px, y: targetY, w: platW, h: platH });

            if (i > 0 && Math.sin(i * 3 + seed) > 0.1) {
                const spW = Math.min(platW - 20, 30 + Math.min(25, level));
                this.spikes.push({
                    x: px + (platW - spW) / 2,
                    y: targetY - 12,
                    w: spW,
                    h: 12
                });
            }

            this.gems.push({
                x: px + platW / 2,
                y: targetY - 35,
                collected: false
            });

            lastY = targetY;
        }

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
        this.player.isDashing = false;
        this.player.facing = 1;
    }

    listen(target, type, fn) {
        if (!target || !target.addEventListener) return;
        target.addEventListener(type, fn);
        this._handlers.push([target, type, fn]);
    }

    bindEvents() {
        this.listen(window, 'resize', () => {
            this.resize();
            this.buildLevel(this.currentLevel);
        });

        this.listen(window, 'keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
                this.jump();
            }
            if (e.code === 'KeyJ' || e.code === 'ShiftLeft' || e.code === 'KeyX') {
                this.dash();
            }
        });

        this.listen(window, 'keyup', (e) => { this.keys[e.code] = false; });

        this.container.querySelector('#btn-plat-replay').onclick = () => this.startLevel(this.currentLevel);
        this.container.querySelector('#btn-plat-next').onclick = () => {
            if (window.portal) window.portal.launchGame('platformer', this.currentLevel + 1);
            else this.startLevel(this.currentLevel + 1);
        };
    }

    spawnParticles(x, y, color, count = 8, speed = 120) {
        for (let i = 0; i < count && this.particles.length < 220; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.3 + Math.random() * 0.7);
            this.particles.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 25,
                life: 0.35 + Math.random() * 0.3, max: 0.65,
                size: 2 + Math.random() * 2.5, color
            });
        }
    }

    jump() {
        const p = this.player;
        if (p.isGrounded) {
            p.vy = -p.jumpForce;
            p.isGrounded = false;
            p.canDoubleJump = true;
            this.spawnParticles(p.x + p.w / 2, p.y + p.h, '#94a3b8', 6, 90);
            if (window.AudioManager) window.AudioManager.playJump();
        } else if (p.isWallSliding) {
            p.vy = -p.jumpForce * 0.95;
            p.vx = -p.wallDir * p.speed * 1.3;
            p.facing = -p.wallDir;
            p.isWallSliding = false;
            this.spawnParticles(p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h / 2, '#38bdf8', 8, 120);
            if (window.AudioManager) window.AudioManager.playJump();
        } else if (p.canDoubleJump) {
            p.vy = -p.jumpForce * 0.9;
            p.canDoubleJump = false;
            this.rings.push({ x: p.x + p.w / 2, y: p.y + p.h, r: 6, life: 0.28, max: 0.28, color: '#22d3ee' });
            this.spawnParticles(p.x + p.w / 2, p.y + p.h, '#22d3ee', 8, 110);
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
        if (dir === 0) dir = p.facing || 1;
        p.facing = dir;

        p.vx = dir * 18.0;
        p.vy = 0;
        this.shake = Math.max(this.shake, 3);
        this.spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#38bdf8', 12, 180);
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
        this.time += delta;
        this.shake = Math.max(0, this.shake - delta * 24);

        if (p.isDashing) {
            p.dashTimer -= delta;
            p.x += p.vx * 60 * delta;
            this.checkCollisionX();
            this.ghosts.push({ x: p.x, y: p.y, facing: p.facing, life: 0.22, max: 0.22 });
            if (p.dashTimer <= 0) {
                p.isDashing = false;
                p.vx *= 0.3;
            }
        } else {
            let moveDir = 0;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir -= 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir += 1;

            if (moveDir !== 0) {
                p.facing = moveDir;
                if (p.isGrounded) p.runCycle += delta * 15;
            }

            p.vx = moveDir * p.speed;
            p.vy += p.gravity * delta;

            if (p.isWallSliding && p.vy > 2) {
                p.vy = 2;
                if (Math.random() < 0.35) {
                    this.spawnParticles(p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h * 0.6, '#38bdf8', 1, 50);
                }
            }

            p.x += p.vx * 60 * delta;
            this.checkCollisionX();

            p.y += p.vy * 60 * delta;
            this.checkCollisionY();
        }

        // Update particles, ghosts & rings
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.life -= delta;
            if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
            pt.x += pt.vx * delta;
            pt.y += pt.vy * delta;
            pt.vy += 180 * delta;
        }
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            this.ghosts[i].life -= delta;
            if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            this.rings[i].life -= delta;
            this.rings[i].r += delta * 95;
            if (this.rings[i].life <= 0) this.rings.splice(i, 1);
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
                this.spawnParticles(gem.x, gem.y, '#38bdf8', 14, 160);
                this.rings.push({ x: gem.x, y: gem.y, r: 4, life: 0.3, max: 0.3, color: '#67e8f9' });
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
        this.shake = 9;
        this.spawnParticles(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#f43f5e', 24, 220);
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

    drawRunner(ctx, x, y, w, h, facing, alpha = 1, isDash = false, runCycle = 0, isMoving = false, isWall = false) {
        ctx.save();
        ctx.globalAlpha = alpha;
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.translate(cx, cy);
        if (isDash) ctx.rotate(facing * 0.25);
        else if (isWall) ctx.rotate(-facing * 0.12);
        ctx.scale(facing, 1);

        // Energy Scarf flowing behind runner
        const wave = Math.sin(this.time * 12) * 3;
        ctx.fillStyle = isDash ? '#67e8f9' : '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(-2, -4);
        ctx.lineTo(-15 - (isDash ? 8 : 0), -7 + wave);
        ctx.lineTo(-12 - (isDash ? 6 : 0), -1 + wave * 0.6);
        ctx.lineTo(-2, 0);
        ctx.closePath();
        ctx.fill();

        // Animated legs
        const swing = isMoving ? Math.sin(runCycle) * 5 : 0;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-2, 4); ctx.lineTo(-3 - swing, h / 2 - 1);
        ctx.moveTo(2, 4); ctx.lineTo(3 + swing, h / 2 - 1);
        ctx.stroke();

        // Armored Torso
        ctx.fillStyle = isDash ? '#bae6fd' : '#2563eb';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(-6, -5, 12, 12, 3);
            ctx.fill();
        } else {
            ctx.fillRect(-6, -5, 12, 12);
        }
        // Chest energy core
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(0, -2, 4, 4);

        // Helmet & Neon Visor
        ctx.fillStyle = '#e2e8f0';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(-6, -h / 2, 13, 10, 4);
            ctx.fill();
        } else {
            ctx.fillRect(-6, -h / 2, 13, 10);
        }
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(1, -h / 2 + 3, 6, 3.5);

        ctx.restore();
    }

    render() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.clearRect(0, 0, W, H);

        if (this.bgCanvas && ctx.drawImage) {
            ctx.drawImage(this.bgCanvas, 0, 0);
        } else {
            ctx.fillStyle = '#090d1a';
            ctx.fillRect(0, 0, W, H);
        }

        ctx.save();
        if (this.shake > 0.1 && ctx.translate) {
            ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        }

        // 2.5D Metallic Platforms with Neon Trim
        for (const plat of this.platforms) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
            ctx.fillStyle = plat.boundary ? '#1e293b' : '#1e293b';
            ctx.fillRect(plat.x + 1, plat.y + 1, Math.max(0, plat.w - 2), Math.max(0, plat.h - 4));
            // Top glowing neon edge
            ctx.fillStyle = plat.boundary ? '#475569' : '#38bdf8';
            ctx.fillRect(plat.x, plat.y, plat.w, plat.boundary ? 2 : 3);
            // Rivet details on floating platforms
            if (!plat.boundary && plat.w > 30) {
                ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
                ctx.fillRect(plat.x + 6, plat.y + 7, 3, 3);
                ctx.fillRect(plat.x + plat.w - 9, plat.y + 7, 3, 3);
            }
        }

        // Laser Spikes (metallic teeth + plasma glow)
        for (const sp of this.spikes) {
            const count = Math.max(2, Math.floor(sp.w / 10));
            const toothW = sp.w / count;
            ctx.fillStyle = '#334155';
            ctx.fillRect(sp.x, sp.y + sp.h - 3, sp.w, 3);
            for (let i = 0; i < count; i++) {
                const sx = sp.x + i * toothW;
                ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
                ctx.beginPath();
                ctx.moveTo(sx - 2, sp.y + sp.h);
                ctx.lineTo(sx + toothW / 2, sp.y - 3);
                ctx.lineTo(sx + toothW + 2, sp.y + sp.h);
                ctx.fill();

                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(sx + 1, sp.y + sp.h - 2);
                ctx.lineTo(sx + toothW / 2, sp.y);
                ctx.lineTo(sx + toothW - 1, sp.y + sp.h - 2);
                ctx.fill();

                ctx.fillStyle = '#fecaca';
                ctx.beginPath();
                ctx.moveTo(sx + toothW * 0.35, sp.y + sp.h - 2);
                ctx.lineTo(sx + toothW / 2, sp.y + 3);
                ctx.lineTo(sx + toothW * 0.65, sp.y + sp.h - 2);
                ctx.fill();
            }
        }

        // Faceted Crystal Gems
        for (const gem of this.gems) {
            if (gem.collected) continue;
            const gy = gem.y + Math.sin(this.time * 4 + gem.x * 0.05) * 3;
            ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
            ctx.beginPath();
            ctx.arc(gem.x, gy, 12, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0ea5e9';
            ctx.beginPath();
            ctx.moveTo(gem.x, gy - 9);
            ctx.lineTo(gem.x + 7, gy);
            ctx.lineTo(gem.x, gy + 9);
            ctx.lineTo(gem.x - 7, gy);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.moveTo(gem.x, gy - 9);
            ctx.lineTo(gem.x + 3, gy - 1);
            ctx.lineTo(gem.x, gy + 3);
            ctx.lineTo(gem.x - 3, gy - 1);
            ctx.closePath();
            ctx.fill();
        }

        // Dimensional Portal Goal
        {
            const gx = this.goal.x + this.goal.w / 2;
            const gy = this.goal.y + this.goal.h / 2;
            const pulse = 1 + Math.sin(this.time * 5) * 0.1;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.beginPath();
            ctx.arc(gx, gy, this.goal.h * 0.72 * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (ctx.ellipse) ctx.ellipse(gx, gy, 13 * pulse, 20 * pulse, 0, 0, Math.PI * 2);
            else ctx.arc(gx, gy, 15, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            if (ctx.ellipse) ctx.ellipse(gx, gy, 7, 13, Math.sin(this.time * 3) * 0.2, 0, Math.PI * 2);
            else ctx.arc(gx, gy, 9, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ecfdf5';
            ctx.beginPath();
            ctx.arc(gx, gy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 1;
        }

        // Jump Shockwave Rings
        for (const r of this.rings) {
            ctx.globalAlpha = Math.max(0, r.life / r.max);
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (ctx.ellipse) ctx.ellipse(r.x, r.y, r.r, r.r * 0.35, 0, 0, Math.PI * 2);
            else ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;

        // Dash Ghost Afterimages
        const p = this.player;
        for (const g of this.ghosts) {
            this.drawRunner(ctx, g.x, g.y, p.w, p.h, g.facing, (g.life / g.max) * 0.45, true, 0, false, false);
        }

        // Player Exo-Runner
        this.drawRunner(ctx, p.x, p.y, p.w, p.h, p.facing, 1, p.isDashing, p.runCycle, Math.abs(p.vx) > 0.2 && p.isGrounded, p.isWallSliding);

        // Particles
        for (const pt of this.particles) {
            ctx.globalAlpha = Math.max(0, pt.life / pt.max);
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; this.lastTime = performance.now(); }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        for (const [target, type, fn] of this._handlers) {
            if (target && target.removeEventListener) target.removeEventListener(type, fn);
        }
        this._handlers = [];
        if (this.container) this.container.innerHTML = '';
    }
};
