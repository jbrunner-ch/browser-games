/**
 * Neon Snake 3D - Cyber Arena
 * Built with Three.js. Levels 1 - 100+ with 3D grid arena,
 * scaling speed, procedural obstacle blocks, and energy apples.
 */

window.Snake3DGame = class {
    constructor() {
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animId = null;
        this.isPaused = false;

        this.gridSize = 20;
        this.snake = [];
        this.dir = { x: 1, z: 0 };
        this.nextDir = { x: 1, z: 0 };
        this.apple = { x: 5, z: 5 };
        this.obstacles = [];

        this.score = 0;
        this.speed = 0.12;
        this.moveTimer = 0;
        this.currentLevel = 1;
        this.clock = null;

        this.snakeMeshes = [];
        this.appleMesh = null;
        this.obstacleMeshes = [];
    }

    init(container, options = {}) {
        this.container = container;
        this.container.innerHTML = '';

        if (typeof THREE === 'undefined') {
            this.container.innerHTML = `
                <div style="color:var(--text-secondary); text-align:center; padding:40px; font-family:sans-serif;">
                    <h3>Three.js 3D Engine wird geladen...</h3>
                    <p style="margin-top:8px; font-size:13px;">Bitte stelle sicher, dass eine Internetverbindung für CDN besteht.</p>
                </div>
            `;
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'game-canvas';
        this.container.appendChild(canvas);

        const hud = document.createElement('div');
        hud.className = 'rush-hud';
        hud.innerHTML = `
            <div class="rush-stat">Punkte: <span class="rush-stat-val" style="color:#10b981;" id="snk-score">0</span></div>
            <div class="rush-stat">Länge: <span class="rush-stat-val" style="color:#38bdf8;" id="snk-len">3</span></div>
            <div class="rush-stat">Arena: <span class="rush-stat-val" id="snk-lvl">1</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'snk-win-screen';
        win.innerHTML = `
            <div class="win-title">ARENA GEMEISTERT!</div>
            <div class="win-subtitle" id="snk-win-sub">Punkteziel erreicht.</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-game-action" id="btn-snk-replay">Wiederholen</button>
                <button class="btn-game-action" style="background:#2563eb; color:#fff;" id="btn-snk-next">Nächste Arena ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        const w = Math.max(300, this.container.clientWidth || window.innerWidth);
        const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x09090b);

        this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 1000);
        this.camera.position.set(0, 24, 18);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.clock = new THREE.Clock();

        const amb = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(amb);

        const light = new THREE.DirectionalLight(0x38bdf8, 0.85);
        light.position.set(10, 20, 10);
        this.scene.add(light);

        const gridHelper = new THREE.GridHelper(this.gridSize * 1.5, this.gridSize, 0x3f3f46, 0x18181b);
        gridHelper.position.y = -0.5;
        this.scene.add(gridHelper);

        this.bindEvents();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl);

        requestAnimationFrame(() => this.resize());

        this.animate = this.animate.bind(this);
        this.animId = requestAnimationFrame(this.animate);
    }

    resize() {
        if (!this.renderer || !this.container) return;
        const w = Math.max(300, this.container.clientWidth || window.innerWidth);
        const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    startLevel(levelIndex = 1) {
        this.currentLevel = levelIndex;
        this.score = 0;
        this.dir = { x: 1, z: 0 };
        this.nextDir = { x: 1, z: 0 };
        this.speed = Math.max(0.06, 0.13 - Math.min(0.06, levelIndex * 0.002));

        const winScreen = this.container.querySelector('#snk-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        this.snake = [
            { x: 0, z: 0 },
            { x: -1, z: 0 },
            { x: -2, z: 0 }
        ];

        this.snakeMeshes.forEach(m => this.scene.remove(m));
        this.snakeMeshes = [];

        this.obstacleMeshes.forEach(m => this.scene.remove(m));
        this.obstacleMeshes = [];

        // Procedural obstacles based on level
        this.obstacles = [];
        const numObs = Math.min(16, 2 + Math.floor(levelIndex / 3));
        const seed = levelIndex * 41.27;

        for (let i = 0; i < numObs; i++) {
            const ox = Math.floor(Math.sin(i * 2 + seed) * 6);
            const oz = Math.floor(Math.cos(i * 2 + seed) * 6);
            if (Math.abs(ox) > 2 || Math.abs(oz) > 2) {
                this.obstacles.push({ x: ox, z: oz });
            }
        }

        const obsGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
        const obsMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
        this.obstacles.forEach(o => {
            const mesh = new THREE.Mesh(obsGeo, obsMat);
            mesh.position.set(o.x * 1.5, 0.2, o.z * 1.5);
            this.scene.add(mesh);
            this.obstacleMeshes.push(mesh);
        });

        if (!this.appleMesh) {
            const appleGeo = new THREE.SphereGeometry(0.7, 16, 16);
            const appleMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.2 });
            this.appleMesh = new THREE.Mesh(appleGeo, appleMat);
            this.scene.add(this.appleMesh);
        }
        this.spawnApple();
        this.updateHUD();
    }

    spawnApple() {
        const half = Math.floor(this.gridSize / 2) - 2;
        let valid = false;

        while (!valid) {
            const ax = Math.floor((Math.random() * 2 - 1) * half);
            const az = Math.floor((Math.random() * 2 - 1) * half);

            const onSnake = this.snake.some(s => s.x === ax && s.z === az);
            const onObs = this.obstacles.some(o => o.x === ax && o.z === az);

            if (!onSnake && !onObs) {
                this.apple = { x: ax, z: az };
                this.appleMesh.position.set(ax * 1.5, 0.2, az * 1.5);
                valid = true;
            }
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') {
                if (this.dir.z === 0) this.nextDir = { x: 0, z: -1 };
            } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
                if (this.dir.z === 0) this.nextDir = { x: 0, z: 1 };
            } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
                if (this.dir.x === 0) this.nextDir = { x: -1, z: 0 };
            } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
                if (this.dir.x === 0) this.nextDir = { x: 1, z: 0 };
            }
        });

        this.container.querySelector('#btn-snk-replay').onclick = () => this.startLevel(this.currentLevel);
        this.container.querySelector('#btn-snk-next').onclick = () => {
            if (window.portal) window.portal.launchGame('snake3d', this.currentLevel + 1);
            else this.startLevel(this.currentLevel + 1);
        };
    }

    updateSnake() {
        this.dir = { ...this.nextDir };
        const head = this.snake[0];
        const newHead = { x: head.x + this.dir.x, z: head.z + this.dir.z };
        const half = Math.floor(this.gridSize / 2);

        if (Math.abs(newHead.x) > half || Math.abs(newHead.z) > half) {
            this.onGameOver();
            return;
        }

        if (this.obstacles.some(o => o.x === newHead.x && o.z === newHead.z)) {
            this.onGameOver();
            return;
        }

        if (this.snake.some(s => s.x === newHead.x && s.z === newHead.z)) {
            this.onGameOver();
            return;
        }

        this.snake.unshift(newHead);

        if (newHead.x === this.apple.x && newHead.z === this.apple.z) {
            this.score += 50;
            this.updateHUD();
            if (window.AudioManager) window.AudioManager.playPowerup();
            this.spawnApple();

            const targetScore = 200 + Math.min(300, this.currentLevel * 25);
            if (this.score >= targetScore) {
                this.triggerWin();
            }
        } else {
            this.snake.pop();
        }

        this.syncSnakeMeshes();
    }

    syncSnakeMeshes() {
        while (this.snakeMeshes.length < this.snake.length) {
            const isHead = this.snakeMeshes.length === 0;
            const geo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
            const mat = new THREE.MeshStandardMaterial({
                color: isHead ? 0x2563eb : 0x3b82f6,
                roughness: 0.3
            });
            const mesh = new THREE.Mesh(geo, mat);
            this.scene.add(mesh);
            this.snakeMeshes.push(mesh);
        }

        this.snake.forEach((s, idx) => {
            this.snakeMeshes[idx].position.set(s.x * 1.5, 0.2, s.z * 1.5);
        });
    }

    onGameOver() {
        if (window.AudioManager) window.AudioManager.playExplosion();
        alert('Kollision! Arena wird neu gestartet.');
        this.startLevel(this.currentLevel);
    }

    triggerWin() {
        if (window.AudioManager) window.AudioManager.playWin();
        const winScreen = this.container.querySelector('#snk-win-screen');
        if (winScreen) winScreen.classList.add('active');
    }

    updateHUD() {
        const sEl = this.container.querySelector('#snk-score');
        const lEl = this.container.querySelector('#snk-len');
        const lvlEl = this.container.querySelector('#snk-lvl');

        if (sEl) sEl.innerText = `${this.score}`;
        if (lEl) lEl.innerText = `${this.snake.length}`;
        if (lvlEl) lvlEl.innerText = `${this.currentLevel}`;
    }

    animate() {
        this.animId = requestAnimationFrame(this.animate);
        if (this.isPaused || !this.renderer) return;

        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.moveTimer += delta;

        if (this.moveTimer >= this.speed) {
            this.updateSnake();
            this.moveTimer = 0;
        }

        if (this.appleMesh) this.appleMesh.rotation.y += delta * 2;
        this.renderer.render(this.scene, this.camera);
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; if (this.clock) this.clock.getDelta(); }
    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        if (this.container) this.container.innerHTML = '';
    }
};
