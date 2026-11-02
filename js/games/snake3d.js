/**
 * Neon Snake 3D - Cyber Arena
 * Built with Three.js. Features 3D snake movement across glowing cyber grids,
 * dynamic camera, energy apples, obstacles, speed boosts and multiple level designs.
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
        this.speed = 0.12; // seconds per move
        this.moveTimer = 0;
        this.currentLevel = 1;
        this.difficulty = 'Normal';
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
                <div style="color:#fff; text-align:center; padding:50px; font-family:sans-serif;">
                    <h2>Three.js 3D Engine wird geladen...</h2>
                    <p style="color:#94a3b8; margin-top:10px;">Bitte überprüfe deine Internetverbindung für Three.js CDN.</p>
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
            <div class="rush-stat">Score: <span class="rush-stat-val" style="color:#10b981;" id="snk-score">0</span></div>
            <div class="rush-stat">Length: <span class="rush-stat-val" style="color:#38bdf8;" id="snk-len">3</span></div>
            <div class="rush-stat">Arena: <span class="rush-stat-val" id="snk-lvl">1</span></div>
        `;
        this.container.appendChild(hud);

        const win = document.createElement('div');
        win.className = 'game-win-overlay';
        win.id = 'snk-win-screen';
        win.innerHTML = `
            <div class="win-title">ARENA MASTER! 🐍</div>
            <div class="win-subtitle" id="snk-win-sub">High Score Reached!</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-snk-replay">Replay</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-snk-next">Next Arena ➔</button>
            </div>
        `;
        this.container.appendChild(win);

        // Three.js setup
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0f1d);

        this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
        this.camera.position.set(0, 24, 18);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.clock = new THREE.Clock();

        // Lighting
        const amb = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(amb);

        const light = new THREE.DirectionalLight(0x38bdf8, 0.8);
        light.position.set(10, 20, 10);
        this.scene.add(light);

        // Grid floor
        const gridHelper = new THREE.GridHelper(this.gridSize * 1.5, this.gridSize, 0x3b82f6, 0x1e293b);
        gridHelper.position.y = -0.5;
        this.scene.add(gridHelper);

        this.bindEvents();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Normal');

        this.animate = this.animate.bind(this);
        this.animId = requestAnimationFrame(this.animate);
    }

    startLevel(levelIndex = 1, difficulty = 'Normal') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;
        this.score = 0;
        this.dir = { x: 1, z: 0 };
        this.nextDir = { x: 1, z: 0 };

        const winScreen = this.container.querySelector('#snk-win-screen');
        if (winScreen) winScreen.classList.remove('active');

        // Reset snake
        this.snake = [
            { x: 0, z: 0 },
            { x: -1, z: 0 },
            { x: -2, z: 0 }
        ];

        // Clear existing meshes
        this.snakeMeshes.forEach(m => this.scene.remove(m));
        this.snakeMeshes = [];

        this.obstacleMeshes.forEach(m => this.scene.remove(m));
        this.obstacleMeshes = [];

        // Build obstacles based on level
        this.obstacles = [];
        if (levelIndex === 2) {
            // Pillars
            this.obstacles.push({ x: 4, z: 4 }, { x: -4, z: 4 }, { x: 4, z: -4 }, { x: -4, z: -4 });
        } else if (levelIndex >= 3) {
            // Walls
            for (let i = -4; i <= 4; i++) {
                if (i !== 0) this.obstacles.push({ x: i, z: 5 }, { x: i, z: -5 });
            }
        }

        // Create obstacle meshes
        const obsGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
        const obsMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
        this.obstacles.forEach(o => {
            const mesh = new THREE.Mesh(obsGeo, obsMat);
            mesh.position.set(o.x * 1.5, 0.2, o.z * 1.5);
            this.scene.add(mesh);
            this.obstacleMeshes.push(mesh);
        });

        // Create Apple
        if (!this.appleMesh) {
            const appleGeo = new THREE.SphereGeometry(0.7, 16, 16);
            const appleMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669 });
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

        this.container.querySelector('#btn-snk-replay').onclick = () => this.startLevel(this.currentLevel, this.difficulty);
        this.container.querySelector('#btn-snk-next').onclick = () => this.startLevel(this.currentLevel + 1, this.difficulty);
    }

    updateSnake() {
        this.dir = { ...this.nextDir };
        const head = this.snake[0];
        const newHead = { x: head.x + this.dir.x, z: head.z + this.dir.z };

        const half = Math.floor(this.gridSize / 2);

        // Boundary collision
        if (Math.abs(newHead.x) > half || Math.abs(newHead.z) > half) {
            this.onGameOver();
            return;
        }

        // Obstacle collision
        if (this.obstacles.some(o => o.x === newHead.x && o.z === newHead.z)) {
            this.onGameOver();
            return;
        }

        // Self collision
        if (this.snake.some(s => s.x === newHead.x && s.z === newHead.z)) {
            this.onGameOver();
            return;
        }

        this.snake.unshift(newHead);

        // Check Apple
        if (newHead.x === this.apple.x && newHead.z === this.apple.z) {
            this.score += 50;
            this.updateHUD();
            if (window.AudioManager) window.AudioManager.playPowerup();
            this.spawnApple();

            if (this.score >= 500) {
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
                color: isHead ? 0x60a5fa : 0x3b82f6,
                roughness: 0.2
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
        alert('Crashed! Restarting arena.');
        this.startLevel(this.currentLevel, this.difficulty);
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

        if (this.appleMesh) {
            this.appleMesh.rotation.y += delta * 2;
        }

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
