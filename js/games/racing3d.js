/**
 * Velocity Rush 3D - High-Performance 3D Car Racing Game
 * Built with Three.js. Features physics-driven sports car with drifting, tire smoke,
 * procedural and curated circuits, AI opponents, speedometer HUD and multiple levels.
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

        // Player Car
        this.car = {
            mesh: null,
            wheels: [],
            pos: null,
            vel: null,
            rot: 0,
            speed: 0,
            steering: 0,
            maxSpeed: 42.0, // ~150 km/h
            accel: 24.0,
            brake: 35.0,
            friction: 0.985,
            turnSpeed: 2.2,
            driftFactor: 0.92,
            isDrifting: false
        };

        // Track & Race State
        this.trackPoints = [];
        this.trackSpline = null;
        this.checkpoints = [];
        this.currentCheckpoint = 0;
        this.currentLap = 1;
        this.totalLaps = 3;
        this.lapStartTime = 0;
        this.bestLapTime = null;
        this.currentLevel = 1;
        this.difficulty = 'Normal';
        this.racePosition = 1;

        // AI Competitors
        this.aiCars = [];

        // Particles & VFX
        this.particles = [];
        this.keys = {};
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

        this.car.pos = new THREE.Vector3(0, 0.4, 0);
        this.car.vel = new THREE.Vector3(0, 0, 0);

        const canvas = document.createElement('canvas');
        canvas.className = 'game-canvas';
        this.container.appendChild(canvas);

        // HUD
        const hud = document.createElement('div');
        hud.className = 'racing-hud';
        hud.innerHTML = `
            <div class="racing-top-info">
                <div class="racing-pos-lap">
                    <div class="racing-badge">
                        <div class="label">Position</div>
                        <div class="value" id="race-pos">1<span style="font-size:14px;">/4</span></div>
                    </div>
                    <div class="racing-badge">
                        <div class="label">Lap</div>
                        <div class="value" id="race-lap">1<span style="font-size:14px;">/3</span></div>
                    </div>
                </div>
                <div class="racing-badge">
                    <div class="label">Lap Time</div>
                    <div class="value" id="race-time" style="font-family:monospace; font-size:20px;">00:00.0</div>
                </div>
            </div>
            <div class="racing-speedometer">
                <div class="speed-digital" id="race-speed">0</div>
                <div class="speed-unit">KM/H</div>
                <div class="gear-indicator" id="race-gear">D</div>
            </div>
        `;
        this.container.appendChild(hud);

        // Win / Finish Overlay
        const finish = document.createElement('div');
        finish.className = 'game-win-overlay';
        finish.id = 'race-finish-screen';
        finish.innerHTML = `
            <div class="win-title" id="race-result-title">VICTORY! 🏆</div>
            <div class="win-subtitle" id="race-result-sub">Finished in 1st Place!</div>
            <div style="display:flex; gap:12px;">
                <button class="btn-game-action" id="btn-race-replay">Restart Race</button>
                <button class="btn-game-action" style="background:#10b981; border-color:#10b981;" id="btn-race-next">Next Track ➔</button>
            </div>
        `;
        this.container.appendChild(finish);

        // Three.js Scene Setup
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x60a5fa);
        this.scene.fog = new THREE.FogExp2(0x60a5fa, 0.007);

        this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1500);
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        this.clock = new THREE.Clock();

        // Lighting
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 0.6);
        this.scene.add(hemi);

        const dirLight = new THREE.DirectionalLight(0xfffaed, 0.9);
        dirLight.position.set(100, 150, 80);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Environment ground
        const groundGeo = new THREE.PlaneGeometry(1200, 1200);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x306830 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.bindEvents();

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Normal');

        if (window.AudioManager) window.AudioManager.startCarEngine();

        this.animate = this.animate.bind(this);
        this.animId = requestAnimationFrame(this.animate);
    }

    startLevel(levelIndex = 1, difficulty = 'Normal') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;
        this.currentLap = 1;
        this.currentCheckpoint = 0;
        this.lapStartTime = performance.now();
        this.hasFinished = false;

        const finishScreen = this.container.querySelector('#race-finish-screen');
        if (finishScreen) finishScreen.classList.remove('active');

        // Theme per level
        if (levelIndex === 2) {
            // Tokyo Night
            this.scene.background.setHex(0x090a12);
            this.scene.fog.color.setHex(0x090a12);
        } else if (levelIndex === 3) {
            // Canyon
            this.scene.background.setHex(0xfda4af);
            this.scene.fog.color.setHex(0xfda4af);
        } else {
            // Sunny
            this.scene.background.setHex(0x60a5fa);
            this.scene.fog.color.setHex(0x60a5fa);
        }

        // Build Track Waypoints
        this.buildTrack(levelIndex);

        // Create Player Car
        this.createPlayerCar();

        // Create AI Opponents
        this.createAIOpponents(difficulty);
    }

    buildTrack(levelIndex) {
        // Clear existing track mesh if any
        if (this.trackMesh) this.scene.remove(this.trackMesh);

        // Generate points for circuit
        const points = [];
        const radiusX = 140 + (levelIndex * 15);
        const radiusZ = 100 + (levelIndex * 10);
        const numPoints = 16;

        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            let wobble = Math.sin(angle * 3) * 25 + Math.cos(angle * 2) * 20;
            if (levelIndex === 2) wobble += Math.sin(angle * 5) * 35; // sharper chicanes

            const x = Math.cos(angle) * (radiusX + wobble);
            const z = Math.sin(angle) * (radiusZ + wobble);
            const y = 0.05 + Math.sin(angle * 2) * 2; // subtle elevation
            points.push(new THREE.Vector3(x, y, z));
        }

        this.trackSpline = new THREE.CatmullRomCurve3(points, true);
        this.trackPoints = this.trackSpline.getPoints(200);

        // Checkpoints along the curve
        this.checkpoints = [];
        for (let i = 0; i < 8; i++) {
            const pt = this.trackSpline.getPointAt(i / 8);
            this.checkpoints.push(pt);
        }

        // Build road geometry along spline
        const roadWidth = 14;
        const trackGeo = new THREE.BufferGeometry();
        const vertices = [];
        const uvs = [];

        const divisions = 250;
        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions;
            const pt = this.trackSpline.getPointAt(t);
            const tangent = this.trackSpline.getTangentAt(t).normalize();
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            const left = pt.clone().addScaledVector(normal, roadWidth / 2);
            const right = pt.clone().addScaledVector(normal, -roadWidth / 2);

            vertices.push(left.x, left.y, left.z);
            vertices.push(right.x, right.y, right.z);

            uvs.push(0, i * 2);
            uvs.push(1, i * 2);
        }

        const indices = [];
        for (let i = 0; i < divisions; i++) {
            const i2 = i * 2;
            indices.push(i2, i2 + 1, i2 + 2);
            indices.push(i2 + 1, i2 + 3, i2 + 2);
        }

        trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        trackGeo.setIndex(indices);
        trackGeo.computeVertexNormals();

        const trackMat = new THREE.MeshLambertMaterial({
            color: 0x222226,
            side: THREE.DoubleSide
        });

        this.trackMesh = new THREE.Mesh(trackGeo, trackMat);
        this.trackMesh.receiveShadow = true;
        this.scene.add(this.trackMesh);

        // Decorate track with curbs & trees
        this.decorateTrack();
    }

    decorateTrack() {
        if (this.decorGroup) this.scene.remove(this.decorGroup);
        this.decorGroup = new THREE.Group();

        const treeGeo = new THREE.ConeGeometry(3, 8, 5);
        const treeMat = new THREE.MeshLambertMaterial({ color: 0x1e3a1e });
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 2, 5);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3d28 });

        for (let i = 0; i < 40; i++) {
            const t = Math.random();
            const pt = this.trackSpline.getPointAt(t);
            const tangent = this.trackSpline.getTangentAt(t).normalize();
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            const dist = (Math.random() > 0.5 ? 1 : -1) * (14 + Math.random() * 25);

            const treePos = pt.clone().addScaledVector(normal, dist);

            const treeMesh = new THREE.Mesh(treeGeo, treeMat);
            treeMesh.position.set(treePos.x, 5, treePos.z);
            const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
            trunkMesh.position.set(treePos.x, 1, treePos.z);

            this.decorGroup.add(treeMesh);
            this.decorGroup.add(trunkMesh);
        }

        this.scene.add(this.decorGroup);
    }

    createPlayerCar() {
        if (this.car.mesh) this.scene.remove(this.car.mesh);

        const carGroup = new THREE.Group();

        // Sleek aerodynamic chassis
        const bodyGeo = new THREE.BoxGeometry(2.1, 0.7, 4.4);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xef4444,
            metalness: 0.6,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        body.castShadow = true;
        carGroup.add(body);

        // Cockpit / Windshield
        const roofGeo = new THREE.BoxGeometry(1.6, 0.55, 2.2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 1.0, -0.2);
        carGroup.add(roof);

        // Spoiler
        const spoilerGeo = new THREE.BoxGeometry(2.0, 0.1, 0.6);
        const spoiler = new THREE.Mesh(spoilerGeo, bodyMat);
        spoiler.position.set(0, 1.1, -1.9);
        carGroup.add(spoiler);

        // Wheels
        this.car.wheels = [];
        const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });

        const wheelOffsets = [
            { x: -1.05, z: 1.3 },
            { x: 1.05, z: 1.3 },
            { x: -1.05, z: -1.3 },
            { x: 1.05, z: -1.3 }
        ];

        wheelOffsets.forEach((pos, idx) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, 0.42, pos.z);
            wheel.castShadow = true;
            carGroup.add(wheel);
            this.car.wheels.push(wheel);
        });

        // Start position on track
        const startPt = this.trackSpline.getPointAt(0);
        const startTangent = this.trackSpline.getTangentAt(0);
        this.car.rot = Math.atan2(startTangent.x, startTangent.z);

        carGroup.position.copy(startPt);
        carGroup.rotation.y = this.car.rot;

        this.car.mesh = carGroup;
        this.car.pos.copy(startPt);
        this.car.speed = 0;
        this.scene.add(carGroup);
    }

    createAIOpponents(difficulty) {
        this.aiCars.forEach(ai => this.scene.remove(ai.mesh));
        this.aiCars = [];

        const aiColors = [0x3b82f6, 0x10b981, 0xf59e0b];
        const numAi = 3;

        for (let i = 0; i < numAi; i++) {
            const aiGroup = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(2.0, 0.7, 4.2),
                new THREE.MeshStandardMaterial({ color: aiColors[i], metalness: 0.5 })
            );
            body.position.y = 0.5;
            aiGroup.add(body);

            const offsetDist = (i + 1) * -8;
            const progress = (0.01 + (i * 0.015)) % 1;
            const pt = this.trackSpline.getPointAt(progress);
            aiGroup.position.copy(pt);

            const speed = 25.0 + (difficulty === 'Pro' ? 12 : 5) + (i * 1.5);

            this.scene.add(aiGroup);
            this.aiCars.push({
                mesh: aiGroup,
                progress: progress,
                speed: speed,
                color: aiColors[i]
            });
        }
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        this.container.querySelector('#btn-race-replay').onclick = () => {
            this.startLevel(this.currentLevel, this.difficulty);
        };

        this.container.querySelector('#btn-race-next').onclick = () => {
            this.startLevel(this.currentLevel + 1, this.difficulty);
        };
    }

    updatePhysics(delta) {
        const c = this.car;

        // Acceleration & Braking
        const isUp = this.keys['KeyW'] || this.keys['ArrowUp'];
        const isDown = this.keys['KeyS'] || this.keys['ArrowDown'];
        const isLeft = this.keys['KeyA'] || this.keys['ArrowLeft'];
        const isRight = this.keys['KeyD'] || this.keys['ArrowRight'];
        const isHandbrake = this.keys['Space'];

        if (isUp) {
            c.speed = Math.min(c.maxSpeed, c.speed + c.accel * delta);
        } else if (isDown) {
            if (c.speed > 1) {
                c.speed = Math.max(0, c.speed - c.brake * delta);
            } else {
                c.speed = Math.max(-12, c.speed - c.accel * 0.5 * delta); // Reverse
            }
        } else {
            c.speed *= c.friction;
        }

        // Steering & Drift
        if (Math.abs(c.speed) > 0.5) {
            const steerDir = isLeft ? 1 : isRight ? -1 : 0;
            const turnRate = c.turnSpeed * (isHandbrake ? 1.6 : 1.0) * (c.speed > 0 ? 1 : -1);
            c.rot += steerDir * turnRate * delta;

            // Animate front wheels steering
            if (c.wheels.length >= 2) {
                c.wheels[0].rotation.y = steerDir * 0.45;
                c.wheels[1].rotation.y = steerDir * 0.45;
            }

            if (isHandbrake && Math.abs(c.speed) > 15) {
                c.isDrifting = true;
                c.speed *= c.driftFactor;
            } else {
                c.isDrifting = false;
            }
        } else {
            c.isDrifting = false;
            if (c.wheels.length >= 2) {
                c.wheels[0].rotation.y = 0;
                c.wheels[1].rotation.y = 0;
            }
        }

        // Wheel spin rotation
        const wheelSpin = (c.speed / 0.42) * delta;
        c.wheels.forEach(w => {
            w.rotation.x += wheelSpin;
        });

        // Move car
        const forward = new THREE.Vector3(Math.sin(c.rot), 0, Math.cos(c.rot));
        c.pos.addScaledVector(forward, c.speed * delta);

        c.mesh.position.copy(c.pos);
        c.mesh.rotation.y = c.rot;

        // Sound Engine Pitch
        if (window.AudioManager) {
            const rpm = Math.min(1.0, Math.abs(c.speed) / c.maxSpeed);
            window.AudioManager.updateCarEnginePitch(rpm);
        }

        // Camera Follow
        const camDistance = 8.5;
        const camHeight = 3.6;
        const targetCamPos = c.pos.clone()
            .sub(forward.clone().multiplyScalar(camDistance))
            .add(new THREE.Vector3(0, camHeight, 0));

        this.camera.position.lerp(targetCamPos, 0.12);
        this.camera.lookAt(c.pos.x, c.pos.y + 1.2, c.pos.z);

        // Checkpoints & Laps
        this.updateRaceProgress();

        // Update AI
        this.updateAI(delta);

        // Update HUD
        this.updateHUD();
    }

    updateRaceProgress() {
        if (this.hasFinished) return;

        const nextCp = this.checkpoints[this.currentCheckpoint];
        if (this.car.pos.distanceTo(nextCp) < 22) {
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
        this.aiCars.forEach((ai, idx) => {
            ai.progress = (ai.progress + (ai.speed * 0.00015 * delta)) % 1;
            const pt = this.trackSpline.getPointAt(ai.progress);
            const tangent = this.trackSpline.getTangentAt(ai.progress);

            ai.mesh.position.copy(pt);
            ai.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
        });

        // Calculate player position relative to AI
        let aheadCount = 0;
        const playerPt = this.trackSpline.getPointAt(0); // Approximate
        this.aiCars.forEach(ai => {
            if (ai.mesh.position.distanceTo(this.car.pos) > 0) {
                // If AI is further along spline
                if (ai.progress > (this.currentCheckpoint / this.checkpoints.length)) {
                    aheadCount++;
                }
            }
        });
        this.racePosition = Math.min(4, Math.max(1, aheadCount + 1));
    }

    updateHUD() {
        const kmh = Math.round(Math.abs(this.car.speed) * 3.6);
        const speedEl = this.container.querySelector('#race-speed');
        const lapEl = this.container.querySelector('#race-lap');
        const posEl = this.container.querySelector('#race-pos');
        const timeEl = this.container.querySelector('#race-time');
        const gearEl = this.container.querySelector('#race-gear');

        if (speedEl) speedEl.innerText = `${kmh}`;
        if (lapEl) lapEl.innerHTML = `${Math.min(this.currentLap, this.totalLaps)}<span style="font-size:14px;">/${this.totalLaps}</span>`;
        if (posEl) posEl.innerHTML = `${this.racePosition}<span style="font-size:14px;">/4</span>`;

        if (gearEl) {
            gearEl.innerText = this.car.speed < -0.5 ? 'R' : kmh > 100 ? '4' : kmh > 60 ? '3' : kmh > 20 ? '2' : '1';
        }

        if (timeEl && !this.hasFinished) {
            const elapsed = (performance.now() - this.lapStartTime) / 1000;
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const secs = (elapsed % 60).toFixed(1).padStart(4, '0');
            timeEl.innerText = `${mins}:${secs}`;
        }
    }

    triggerFinish() {
        this.hasFinished = true;
        if (window.AudioManager) window.AudioManager.playWin();

        const finishScreen = this.container.querySelector('#race-finish-screen');
        const resTitle = this.container.querySelector('#race-result-title');
        const resSub = this.container.querySelector('#race-result-sub');

        if (resTitle) {
            resTitle.innerText = this.racePosition === 1 ? 'VICTORY! 🏆' : 'RACE FINISHED!';
        }
        if (resSub) {
            resSub.innerText = `You finished in ${this.racePosition}${this.racePosition === 1 ? 'st' : this.racePosition === 2 ? 'nd' : 'rd'} Place!`;
        }
        if (finishScreen) {
            setTimeout(() => finishScreen.classList.add('active'), 500);
        }
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
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
};
