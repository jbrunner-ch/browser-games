/**
 * Velocity Rush 3D - High-Performance 3D Car Racing Game
 * Built with Three.js. Levels 1 - 100+ with procedural circuit generator,
 * physics-driven sports car, drifting, AI opponents, and lap timers.
 */

window.Racing3DGame = class {
    constructor() {
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.animId = null;
        this.isPaused = false;

        this.car = {
            mesh: null,
            wheels: [],
            pos: null,
            vel: null,
            rot: 0,
            speed: 0,
            steering: 0,
            maxSpeed: 44.0,
            accel: 25.0,
            brake: 36.0,
            friction: 0.985,
            turnSpeed: 2.2,
            driftFactor: 0.92,
            isDrifting: false
        };

        this.trackPoints = [];
        this.trackSpline = null;
        this.checkpoints = [];
        this.currentCheckpoint = 0;
        this.currentLap = 1;
        this.totalLaps = 3;
        this.lapStartTime = 0;
        this.currentLevel = 1;
        this.racePosition = 1;
        this.hasFinished = false;

        this.aiCars = [];
        this.keys = {};
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

        this.car.pos = new THREE.Vector3(0, 0.4, 0);
        this.car.vel = new THREE.Vector3(0, 0, 0);

        const canvas = document.createElement('canvas');
        canvas.className = 'game-canvas';
        this.container.appendChild(canvas);

        const hud = document.createElement('div');
        hud.className = 'racing-hud';
        hud.innerHTML = `
            <div class="racing-top-info">
                <div class="racing-pos-lap">
                    <div class="racing-badge">
                        <div class="label">Position</div>
                        <div class="value" id="race-pos">1/4</div>
                    </div>
                    <div class="racing-badge">
                        <div class="label">Runde</div>
                        <div class="value" id="race-lap">1/3</div>
                    </div>
                </div>
                <div class="racing-badge">
                    <div class="label">Zeit</div>
                    <div class="value" id="race-time" style="font-family:monospace; font-size:18px;">00:00.0</div>
                </div>
            </div>
            <div class="racing-speedometer">
                <div class="speed-digital" id="race-speed">0</div>
                <div class="speed-unit">KM/H</div>
                <div class="gear-indicator" id="race-gear">D</div>
            </div>
        `;
        this.container.appendChild(hud);

        const finish = document.createElement('div');
        finish.className = 'game-win-overlay';
        finish.id = 'race-finish-screen';
        finish.innerHTML = `
            <div class="win-title" id="race-result-title">RENNEN BEENDET!</div>
            <div class="win-subtitle" id="race-result-sub">Platz 1 erreicht.</div>
            <div style="display:flex; gap:8px;">
                <button class="btn-game-action" id="btn-race-replay">Neustart</button>
                <button class="btn-game-action" style="background:#2563eb; color:#fff;" id="btn-race-next">Nächste Strecke ➔</button>
            </div>
        `;
        this.container.appendChild(finish);

        const w = Math.max(300, this.container.clientWidth || window.innerWidth);
        const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x18181b);
        this.scene.fog = new THREE.FogExp2(0x18181b, 0.007);

        this.camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 1500);
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.clock = new THREE.Clock();

        const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.7);
        this.scene.add(hemi);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 150, 80);
        this.scene.add(dirLight);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(1500, 1500),
            new THREE.MeshLambertMaterial({ color: 0x121215 })
        );
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        this.bindEvents();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Einfach');

        requestAnimationFrame(() => this.resize());
        if (window.AudioManager) window.AudioManager.startCarEngine();

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

    startLevel(levelIndex = 1, difficulty = 'Einfach') {
        this.currentLevel = levelIndex;
        this.currentLap = 1;
        this.totalLaps = 2 + Math.min(3, Math.floor(levelIndex / 15));
        this.currentCheckpoint = 0;
        this.lapStartTime = performance.now();
        this.hasFinished = false;

        const finishScreen = this.container.querySelector('#race-finish-screen');
        if (finishScreen) finishScreen.classList.remove('active');

        this.buildTrack(levelIndex);
        this.createPlayerCar();
        this.createAIOpponents(levelIndex);
    }

    buildTrack(levelIndex) {
        if (this.trackMesh) this.scene.remove(this.trackMesh);

        // Procedural circuit points based on level
        const points = [];
        const rx = 130 + (levelIndex * 4);
        const rz = 90 + (levelIndex * 3);
        const numPts = 16 + Math.min(12, Math.floor(levelIndex / 5));
        const seed = levelIndex * 47.19;

        for (let i = 0; i < numPts; i++) {
            const angle = (i / numPts) * Math.PI * 2;
            const wobble = Math.sin(angle * 3 + seed) * (20 + Math.min(25, levelIndex)) +
                          Math.cos(angle * 2 + seed) * (15 + Math.min(20, levelIndex));
            const x = Math.cos(angle) * (rx + wobble);
            const z = Math.sin(angle) * (rz + wobble);
            const y = 0.05;
            points.push(new THREE.Vector3(x, y, z));
        }

        this.trackSpline = new THREE.CatmullRomCurve3(points, true);
        this.trackPoints = this.trackSpline.getPoints(200);

        this.checkpoints = [];
        for (let i = 0; i < 8; i++) {
            this.checkpoints.push(this.trackSpline.getPointAt(i / 8));
        }

        const roadW = Math.max(10, 15 - Math.min(5, levelIndex * 0.1));
        const trackGeo = new THREE.BufferGeometry();
        const verts = [];
        const divisions = 250;

        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions;
            const pt = this.trackSpline.getPointAt(t);
            const tangent = this.trackSpline.getTangentAt(t).normalize();
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            const left = pt.clone().addScaledVector(normal, roadW / 2);
            const right = pt.clone().addScaledVector(normal, -roadW / 2);

            verts.push(left.x, left.y, left.z);
            verts.push(right.x, right.y, right.z);
        }

        const indices = [];
        for (let i = 0; i < divisions; i++) {
            const i2 = i * 2;
            indices.push(i2, i2 + 1, i2 + 2);
            indices.push(i2 + 1, i2 + 3, i2 + 2);
        }

        trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        trackGeo.setIndex(indices);
        trackGeo.computeVertexNormals();

        this.trackMesh = new THREE.Mesh(trackGeo, new THREE.MeshLambertMaterial({
            color: 0x27272a,
            side: THREE.DoubleSide
        }));
        this.scene.add(this.trackMesh);
    }

    createPlayerCar() {
        if (this.car.mesh) this.scene.remove(this.car.mesh);

        const carGroup = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2.1, 0.7, 4.4),
            new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
        );
        body.position.y = 0.5;
        carGroup.add(body);

        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.55, 2.2),
            new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.1 })
        );
        roof.position.set(0, 1.0, -0.2);
        carGroup.add(roof);

        this.car.wheels = [];
        const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x09090b });
        const offsets = [{ x: -1.05, z: 1.3 }, { x: 1.05, z: 1.3 }, { x: -1.05, z: -1.3 }, { x: 1.05, z: -1.3 }];

        offsets.forEach(pos => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(pos.x, 0.42, pos.z);
            carGroup.add(w);
            this.car.wheels.push(w);
        });

        const startPt = this.trackSpline.getPointAt(0);
        const startTan = this.trackSpline.getTangentAt(0);
        this.car.rot = Math.atan2(startTan.x, startTan.z);

        carGroup.position.copy(startPt);
        carGroup.rotation.y = this.car.rot;

        this.car.mesh = carGroup;
        this.car.pos.copy(startPt);
        this.car.speed = 0;
        this.scene.add(carGroup);
    }

    createAIOpponents(levelIndex) {
        this.aiCars.forEach(ai => this.scene.remove(ai.mesh));
        this.aiCars = [];

        const colors = [0x3b82f6, 0x10b981, 0x8b5cf6];
        const baseSpeed = 24.0 + Math.min(30, levelIndex * 0.9);

        for (let i = 0; i < 3; i++) {
            const group = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(2.0, 0.7, 4.2),
                new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.3 })
            );
            body.position.y = 0.5;
            group.add(body);

            const progress = (0.01 + (i * 0.02)) % 1;
            const pt = this.trackSpline.getPointAt(progress);
            group.position.copy(pt);

            this.scene.add(group);
            this.aiCars.push({
                mesh: group,
                progress: progress,
                speed: baseSpeed + (i * 1.5)
            });
        }
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('resize', () => this.resize());

        this.container.querySelector('#btn-race-replay').onclick = () => {
            this.startLevel(this.currentLevel);
        };
        this.container.querySelector('#btn-race-next').onclick = () => {
            if (window.portal) window.portal.launchGame('racing3d', this.currentLevel + 1);
            else this.startLevel(this.currentLevel + 1);
        };
    }

    updatePhysics(delta) {
        const c = this.car;
        if (!c.mesh || !c.pos) return;

        const isUp = this.keys['KeyW'] || this.keys['ArrowUp'];
        const isDown = this.keys['KeyS'] || this.keys['ArrowDown'];
        const isLeft = this.keys['KeyA'] || this.keys['ArrowLeft'];
        const isRight = this.keys['KeyD'] || this.keys['ArrowRight'];
        const isBrake = this.keys['Space'];

        if (isUp) c.speed = Math.min(c.maxSpeed, c.speed + c.accel * delta);
        else if (isDown) {
            if (c.speed > 1) c.speed = Math.max(0, c.speed - c.brake * delta);
            else c.speed = Math.max(-10, c.speed - c.accel * 0.5 * delta);
        } else {
            c.speed *= c.friction;
        }

        if (Math.abs(c.speed) > 0.5) {
            const steerDir = isLeft ? 1 : isRight ? -1 : 0;
            const turnRate = c.turnSpeed * (isBrake ? 1.5 : 1.0) * (c.speed > 0 ? 1 : -1);
            c.rot += steerDir * turnRate * delta;

            if (isBrake && Math.abs(c.speed) > 12) {
                c.isDrifting = true;
                c.speed *= c.driftFactor;
            } else {
                c.isDrifting = false;
            }
        }

        const forward = new THREE.Vector3(Math.sin(c.rot), 0, Math.cos(c.rot));
        c.pos.addScaledVector(forward, c.speed * delta);
        c.mesh.position.copy(c.pos);
        c.mesh.rotation.y = c.rot;

        if (window.AudioManager) {
            const rpm = Math.min(1.0, Math.abs(c.speed) / c.maxSpeed);
            window.AudioManager.updateCarEnginePitch(rpm);
        }

        const camOffset = c.pos.clone().sub(forward.clone().multiplyScalar(8.5)).add(new THREE.Vector3(0, 3.6, 0));
        this.camera.position.lerp(camOffset, 0.12);
        this.camera.lookAt(c.pos.x, c.pos.y + 1.2, c.pos.z);

        this.updateRaceProgress();
        this.updateAI(delta);
        this.updateHUD();
    }

    updateRaceProgress() {
        if (this.hasFinished) return;
        const nextCp = this.checkpoints[this.currentCheckpoint];
        if (nextCp && this.car.pos.distanceTo(nextCp) < 24) {
            this.currentCheckpoint++;
            if (this.currentCheckpoint >= this.checkpoints.length) {
                this.currentCheckpoint = 0;
                this.currentLap++;
                if (window.AudioManager) window.AudioManager.playPowerup();

                if (this.currentLap > this.totalLaps) {
                    this.triggerFinish();
                }
            }
        }
    }

    updateAI(delta) {
        this.aiCars.forEach(ai => {
            ai.progress = (ai.progress + (ai.speed * 0.00015 * delta)) % 1;
            const pt = this.trackSpline.getPointAt(ai.progress);
            const tan = this.trackSpline.getTangentAt(ai.progress);
            ai.mesh.position.copy(pt);
            ai.mesh.rotation.y = Math.atan2(tan.x, tan.z);
        });

        let ahead = 0;
        this.aiCars.forEach(ai => {
            if (ai.progress > (this.currentCheckpoint / this.checkpoints.length)) ahead++;
        });
        this.racePosition = Math.min(4, Math.max(1, ahead + 1));
    }

    updateHUD() {
        const kmh = Math.round(Math.abs(this.car.speed) * 3.6);
        const speedEl = this.container.querySelector('#race-speed');
        const lapEl = this.container.querySelector('#race-lap');
        const posEl = this.container.querySelector('#race-pos');
        const timeEl = this.container.querySelector('#race-time');

        if (speedEl) speedEl.innerText = `${kmh}`;
        if (lapEl) lapEl.innerText = `${Math.min(this.currentLap, this.totalLaps)}/${this.totalLaps}`;
        if (posEl) posEl.innerText = `${this.racePosition}/4`;

        if (timeEl && !this.hasFinished) {
            const elapsed = (performance.now() - this.lapStartTime) / 1000;
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toFixed(1).padStart(4, '0');
            timeEl.innerText = `${m}:${s}`;
        }
    }

    triggerFinish() {
        this.hasFinished = true;
        if (window.AudioManager) window.AudioManager.playWin();

        const finishScreen = this.container.querySelector('#race-finish-screen');
        const title = this.container.querySelector('#race-result-title');
        const sub = this.container.querySelector('#race-result-sub');

        if (title) title.innerText = this.racePosition === 1 ? 'SIEG! 🏆' : 'ZIEL ERREICHT!';
        if (sub) sub.innerText = `Platz ${this.racePosition} von 4 belegt.`;
        if (finishScreen) setTimeout(() => finishScreen.classList.add('active'), 400);
    }

    animate() {
        this.animId = requestAnimationFrame(this.animate);
        if (this.isPaused || !this.renderer) return;

        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.updatePhysics(delta);
        this.renderer.render(this.scene, this.camera);
    }

    pause() {
        this.isPaused = true;
        if (window.AudioManager) window.AudioManager.stopCarEngine();
    }

    resume() {
        this.isPaused = false;
        if (this.clock) this.clock.getDelta();
        if (window.AudioManager) window.AudioManager.startCarEngine();
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (window.AudioManager) window.AudioManager.stopCarEngine();
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        if (this.container) this.container.innerHTML = '';
    }
};
