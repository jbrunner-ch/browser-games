/**
 * VoxelCraft 3D - Procedural Minecraft-style 3D Voxel Sandbox
 * Built with Three.js. Levels 1 - 100+ with procedural world generation,
 * block mining and building, raycasting, physics, and day/night cycle.
 */

window.VoxelCraftGame = class {
    constructor() {
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.animId = null;
        this.isPaused = false;

        this.player = {
            pos: { x: 0, y: 15, z: 0 },
            vel: { x: 0, y: 0, z: 0 },
            yaw: 0,
            pitch: 0,
            height: 1.7,
            radius: 0.35,
            onGround: false,
            speed: 7.0,
            jumpStrength: 8.5
        };

        this.keys = {};
        this.isLocked = false;

        this.worldSize = 34;
        this.worldHeight = 24;
        this.blocks = new Map();
        this.chunkMesh = null;
        this.highlightMesh = null;

        this.blockTypes = [
            { id: 1, name: 'Gras', color: 0x4f8f3f },
            { id: 2, name: 'Erde', color: 0x6e4a2c },
            { id: 3, name: 'Stein', color: 0x737373 },
            { id: 4, name: 'Kopfstein', color: 0x525252 },
            { id: 5, name: 'Holz', color: 0x784826 },
            { id: 6, name: 'Laub', color: 0x2e7d32, transparent: true, opacity: 0.9 },
            { id: 7, name: 'Ziegel', color: 0x993d2e },
            { id: 8, name: 'Sand', color: 0xd4b870 },
            { id: 9, name: 'Glas', color: 0x93c5fd, transparent: true, opacity: 0.6 },
            { id: 10, name: 'Gold', color: 0xf59e0b }
        ];

        this.selectedBlockId = 1;
        this.dayTime = 0.25;
        this.currentLevel = 1;
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
        hud.className = 'mc-hud';
        hud.innerHTML = `
            <div class="mc-debug-info">
                <div><strong>VoxelCraft</strong> · Level <span id="mc-lvl">1</span></div>
                <div style="font-size:11px; color:#a1a1aa; margin-top:2px;">Klick ins Bild für Mausblick · WASD + Leertaste</div>
            </div>
            <div class="mc-crosshair"></div>
            <div class="mc-hotbar-container" id="mc-hotbar"></div>
        `;
        this.container.appendChild(hud);

        this.setupHotbar();

        const w = Math.max(300, this.container.clientWidth || window.innerWidth);
        const h = Math.max(300, this.container.clientHeight || (window.innerHeight - 48));

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.025);

        this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.clock = new THREE.Clock();

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xfffaed, 0.85);
        this.sunLight.position.set(50, 80, 40);
        this.scene.add(this.sunLight);

        const hlGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const hlMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
        this.highlightMesh = new THREE.Mesh(hlGeo, hlMat);
        this.highlightMesh.visible = false;
        this.scene.add(this.highlightMesh);

        this.raycaster = new THREE.Raycaster();
        this.mousePos = new THREE.Vector2(0, 0);

        this.bindEvents(canvas);

        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Einfach');

        // Layout reflow resize
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

    setupHotbar() {
        const bar = this.container.querySelector('#mc-hotbar');
        if (!bar) return;
        bar.innerHTML = '';
        this.blockTypes.forEach((b, idx) => {
            const slot = document.createElement('div');
            slot.className = `mc-hotbar-slot ${b.id === this.selectedBlockId ? 'active' : ''}`;
            slot.dataset.id = b.id;
            slot.innerHTML = `
                <div class="mc-block-icon" style="background-color: #${b.color.toString(16).padStart(6, '0')}"></div>
                <span class="mc-slot-num">${idx + 1}</span>
            `;
            slot.onclick = (e) => {
                e.stopPropagation();
                this.selectBlock(b.id);
            };
            bar.appendChild(slot);
        });
    }

    selectBlock(id) {
        this.selectedBlockId = id;
        this.container.querySelectorAll('.mc-hotbar-slot').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.id, 10) === id);
        });
        if (window.AudioManager) window.AudioManager.playClick();
    }

    startLevel(levelIndex = 1, difficulty = 'Einfach') {
        this.currentLevel = levelIndex;
        this.blocks.clear();

        const lvlEl = this.container.querySelector('#mc-lvl');
        if (lvlEl) lvlEl.innerText = `${levelIndex}`;

        const half = Math.floor(this.worldSize / 2);
        const seed = levelIndex * 89.17 + 10;

        // Biome types scale based on level number
        const isDesert = (levelIndex % 4 === 3);
        const isMountain = (levelIndex % 4 === 2);
        const isNether = (levelIndex % 5 === 0);

        for (let x = -half; x <= half; x++) {
            for (let z = -half; z <= half; z++) {
                // Procedural height noise
                let h = 0;
                if (isMountain) {
                    h = Math.floor(8 + Math.sin(x * 0.28 + seed) * 5 + Math.cos(z * 0.28 + seed) * 5);
                } else if (isDesert) {
                    h = Math.floor(4 + Math.sin(x * 0.15 + seed) * 2 + Math.cos(z * 0.15 + seed) * 2);
                } else {
                    h = Math.floor(5 + Math.sin(x * 0.2 + seed) * 2.5 + Math.cos(z * 0.2 + seed) * 2.5);
                }

                h = Math.max(2, Math.min(this.worldHeight - 4, h));

                for (let y = 0; y <= h; y++) {
                    let type = 3;
                    if (isDesert) {
                        type = 8;
                    } else if (isNether) {
                        type = (y === h) ? 7 : (Math.random() < 0.1 ? 10 : 4);
                    } else {
                        if (y === h) type = 1;
                        else if (y >= h - 2) type = 2;
                        else type = (Math.random() < 0.05) ? 10 : 3;
                    }
                    this.setBlock(x, y, z, type);
                }

                // Trees / Cacti
                if (!isNether && !isDesert && Math.random() < 0.035 && Math.abs(x) < half - 2 && Math.abs(z) < half - 2) {
                    this.generateTree(x, h + 1, z);
                } else if (isDesert && Math.random() < 0.025 && Math.abs(x) < half - 2 && Math.abs(z) < half - 2) {
                    this.setBlock(x, h + 1, z, 6);
                    this.setBlock(x, h + 2, z, 6);
                }
            }
        }

        // Spawn player above surface
        let spawnY = 12;
        for (let y = this.worldHeight; y >= 0; y--) {
            if (this.getBlock(0, y, 0)) { spawnY = y + 2; break; }
        }
        this.player.pos = { x: 0.5, y: spawnY, z: 0.5 };
        this.player.vel = { x: 0, y: 0, z: 0 };

        this.buildWorldMesh();
    }

    generateTree(x, baseY, z) {
        for (let y = 0; y < 4; y++) {
            this.setBlock(x, baseY + y, z, 5);
        }
        const leafY = baseY + 3;
        for (let ox = -2; ox <= 2; ox++) {
            for (let oz = -2; oz <= 2; oz++) {
                for (let oy = 0; oy <= 2; oy++) {
                    if (Math.abs(ox) === 2 && Math.abs(oz) === 2 && oy === 2) continue;
                    if (!this.getBlock(x + ox, leafY + oy, z + oz)) {
                        this.setBlock(x + ox, leafY + oy, z + oz, 6);
                    }
                }
            }
        }
    }

    setBlock(x, y, z, id) {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        if (id === 0) this.blocks.delete(key);
        else this.blocks.set(key, id);
    }

    getBlock(x, y, z) {
        return this.blocks.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) || 0;
    }

    buildWorldMesh() {
        if (this.chunkMesh) this.scene.remove(this.chunkMesh);

        const blockCounts = {};
        this.blocks.forEach((id) => {
            blockCounts[id] = (blockCounts[id] || 0) + 1;
        });

        const group = new THREE.Group();
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);

        for (const bType of this.blockTypes) {
            const count = blockCounts[bType.id];
            if (!count) continue;

            const mat = new THREE.MeshLambertMaterial({
                color: bType.color,
                transparent: !!bType.transparent,
                opacity: bType.opacity || 1.0
            });

            const iMesh = new THREE.InstancedMesh(boxGeo, mat, count);
            const dummy = new THREE.Object3D();
            let idx = 0;

            this.blocks.forEach((id, key) => {
                if (id === bType.id) {
                    const [bx, by, bz] = key.split(',').map(Number);
                    dummy.position.set(bx + 0.5, by + 0.5, bz + 0.5);
                    dummy.updateMatrix();
                    iMesh.setMatrixAt(idx++, dummy.matrix);
                }
            });

            iMesh.instanceMatrix.needsUpdate = true;
            group.add(iMesh);
        }

        this.chunkMesh = group;
        this.scene.add(this.chunkMesh);
    }

    bindEvents(canvas) {
        this.onKeyDown = (e) => {
            this.keys[e.code] = true;
            if (e.code >= 'Digit1' && e.code <= 'Digit9') {
                const idx = parseInt(e.code.replace('Digit', ''), 10);
                if (idx >= 1 && idx <= this.blockTypes.length) {
                    this.selectBlock(idx);
                }
            }
        };

        this.onKeyUp = (e) => { this.keys[e.code] = false; };

        this.onMouseDown = (e) => {
            if (!this.isLocked) {
                try {
                    canvas.requestPointerLock();
                } catch (err) {}
                return;
            }
            if (e.button === 0) this.mineTargetBlock();
            else if (e.button === 2) this.placeTargetBlock();
        };

        this.onMouseMove = (e) => {
            if (!this.isLocked) return;
            const sens = 0.0022;
            this.player.yaw -= e.movementX * sens;
            this.player.pitch -= e.movementY * sens;
            const maxP = Math.PI / 2 - 0.05;
            this.player.pitch = Math.max(-maxP, Math.min(maxP, this.player.pitch));
        };

        this.onLockChange = () => {
            this.isLocked = document.pointerLockElement === canvas;
        };

        this.onContextMenu = (e) => e.preventDefault();
        window.addEventListener('resize', () => this.resize());

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        canvas.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockchange', this.onLockChange);
        canvas.addEventListener('contextmenu', this.onContextMenu);
    }

    getTargetBlock() {
        if (!this.raycaster || !this.camera) return { hit: false };
        this.raycaster.setFromCamera(this.mousePos, this.camera);
        const origin = this.camera.position.clone();
        const dir = this.raycaster.ray.direction.clone().normalize();

        const step = 0.08;
        const maxDist = 6.0;
        let curr = origin.clone();
        let prev = null;

        for (let dist = 0; dist <= maxDist; dist += step) {
            curr.addScaledVector(dir, step);
            const bx = Math.floor(curr.x);
            const by = Math.floor(curr.y);
            const bz = Math.floor(curr.z);

            const bId = this.getBlock(bx, by, bz);
            if (bId !== 0) {
                return {
                    hit: true,
                    block: { x: bx, y: by, z: bz, id: bId },
                    adjacent: prev || { x: bx, y: by + 1, z: bz }
                };
            }
            prev = { x: bx, y: by, z: bz };
        }
        return { hit: false };
    }

    mineTargetBlock() {
        const target = this.getTargetBlock();
        if (target.hit) {
            this.setBlock(target.block.x, target.block.y, target.block.z, 0);
            this.buildWorldMesh();
            if (window.AudioManager) window.AudioManager.playDigBlock();
        }
    }

    placeTargetBlock() {
        const target = this.getTargetBlock();
        if (target.hit && target.adjacent) {
            const adj = target.adjacent;
            const px = Math.floor(this.player.pos.x);
            const py1 = Math.floor(this.player.pos.y);
            const py2 = Math.floor(this.player.pos.y - 1);
            const pz = Math.floor(this.player.pos.z);

            if (adj.x === px && (adj.y === py1 || adj.y === py2) && adj.z === pz) return;

            this.setBlock(adj.x, adj.y, adj.z, this.selectedBlockId);
            this.buildWorldMesh();
            if (window.AudioManager) window.AudioManager.playPlaceBlock();
        }
    }

    updatePhysics(delta) {
        const p = this.player;
        const speed = p.speed;

        let mx = 0, mz = 0;
        if (this.keys['KeyW']) mz -= 1;
        if (this.keys['KeyS']) mz += 1;
        if (this.keys['KeyA']) mx -= 1;
        if (this.keys['KeyD']) mx += 1;

        const len = Math.hypot(mx, mz);
        if (len > 0) {
            mx /= len; mz /= len;
            const sin = Math.sin(p.yaw);
            const cos = Math.cos(p.yaw);
            p.vel.x = (mx * cos + mz * sin) * speed;
            p.vel.z = (-mx * sin + mz * cos) * speed;
        } else {
            p.vel.x *= 0.7;
            p.vel.z *= 0.7;
        }

        // Gravity
        p.vel.y -= 22.0 * delta;
        if (p.onGround && this.keys['Space']) {
            p.vel.y = p.jumpStrength;
            p.onGround = false;
            if (window.AudioManager) window.AudioManager.playJump();
        }

        p.pos.x += p.vel.x * delta;
        if (this.checkCollision(p.pos.x, p.pos.y, p.pos.z)) {
            p.pos.x -= p.vel.x * delta; p.vel.x = 0;
        }

        p.pos.z += p.vel.z * delta;
        if (this.checkCollision(p.pos.x, p.pos.y, p.pos.z)) {
            p.pos.z -= p.vel.z * delta; p.vel.z = 0;
        }

        p.pos.y += p.vel.y * delta;
        p.onGround = false;
        if (this.checkCollision(p.pos.x, p.pos.y, p.pos.z)) {
            if (p.vel.y < 0) {
                p.onGround = true;
                p.pos.y = Math.floor(p.pos.y) + 0.999 + p.height;
            } else {
                p.pos.y = Math.floor(p.pos.y) - 0.001;
            }
            p.vel.y = 0;
        }

        if (p.pos.y < -15) {
            p.pos.x = 0.5; p.pos.y = 20; p.pos.z = 0.5;
            p.vel = { x: 0, y: 0, z: 0 };
        }

        this.camera.position.set(p.pos.x, p.pos.y, p.pos.z);
        this.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');

        const target = this.getTargetBlock();
        if (target.hit) {
            this.highlightMesh.visible = true;
            this.highlightMesh.position.set(target.block.x + 0.5, target.block.y + 0.5, target.block.z + 0.5);
        } else {
            this.highlightMesh.visible = false;
        }
    }

    checkCollision(px, py, pz) {
        const r = this.player.radius;
        const h = this.player.height;
        for (let x = Math.floor(px - r); x <= Math.floor(px + r); x++) {
            for (let y = Math.floor(py - h); y <= Math.floor(py); y++) {
                for (let z = Math.floor(pz - r); z <= Math.floor(pz + r); z++) {
                    if (this.getBlock(x, y, z) !== 0) return true;
                }
            }
        }
        return false;
    }

    animate() {
        this.animId = requestAnimationFrame(this.animate);
        if (this.isPaused || !this.renderer) return;

        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.updatePhysics(delta);

        this.renderer.render(this.scene, this.camera);
    }

    pause() { this.isPaused = true; }
    resume() {
        this.isPaused = false;
        if (this.clock) this.clock.getDelta();
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('pointerlockchange', this.onLockChange);
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        if (this.container) this.container.innerHTML = '';
    }
};
