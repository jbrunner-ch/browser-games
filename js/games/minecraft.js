/**
 * VoxelCraft 3D - Procedural Minecraft-style 3D Voxel Sandbox
 * Built with Three.js. Supports full voxel mining/building, raycasting,
 * procedural chunk generation, physics, day/night cycle, hotbar and multiple world levels.
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

        // Player physics & controls
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

        // Voxel World
        this.worldSize = 36;
        this.worldHeight = 24;
        this.blocks = new Map(); // "x,y,z" => blockId
        this.chunkMesh = null;
        this.highlightMesh = null;
        this.blockTypes = [
            { id: 1, name: 'Grass', color: 0x55aa44, topColor: 0x55aa44, sideColor: 0x775533, bottomColor: 0x775533 },
            { id: 2, name: 'Dirt', color: 0x775533 },
            { id: 3, name: 'Stone', color: 0x888888 },
            { id: 4, name: 'Cobblestone', color: 0x666666 },
            { id: 5, name: 'Wood Log', color: 0x8b5a2b },
            { id: 6, name: 'Leaves', color: 0x2e8b57, transparent: true, opacity: 0.9 },
            { id: 7, name: 'Bricks', color: 0x9c3f2d },
            { id: 8, name: 'Sand', color: 0xdfc57b },
            { id: 9, name: 'Glass', color: 0xadd8e6, transparent: true, opacity: 0.6 },
            { id: 10, name: 'Gold Ore', color: 0xffd700 }
        ];

        this.selectedBlockId = 1;
        this.dayTime = 0.2; // 0..1
        this.sunLight = null;
        this.ambientLight = null;
        this.raycaster = null;
        this.mousePos = null;

        this.currentLevel = 1;
        this.difficulty = 'Normal';
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

        this.raycaster = new THREE.Raycaster();
        this.mousePos = new THREE.Vector2(0, 0);

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'game-canvas';
        this.container.appendChild(canvas);

        // UI HUD
        const hud = document.createElement('div');
        hud.className = 'mc-hud';
        hud.innerHTML = `
            <div class="mc-debug-info" id="mc-debug">
                <div><strong>VoxelCraft 3D</strong></div>
                <div>WASD: Move | SPACE: Jump | MOUSE: Look</div>
                <div>L-CLICK: Mine Block | R-CLICK: Place Block</div>
                <div>1-9: Select Block | Seed: <span id="mc-seed">Auto</span></div>
                <div>Pos: <span id="mc-coords">0, 0, 0</span></div>
            </div>
            <div class="mc-crosshair"></div>
            <div class="mc-hotbar-container" id="mc-hotbar"></div>
        `;
        this.container.appendChild(hud);

        this.setupHotbar();

        // Three.js setup
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.025);

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        this.clock = new THREE.Clock();

        // Lighting
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xfffaed, 0.9);
        this.sunLight.position.set(50, 80, 40);
        this.sunLight.castShadow = true;
        this.scene.add(this.sunLight);

        // Highlight box
        const hlGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const hlMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
        this.highlightMesh = new THREE.Mesh(hlGeo, hlMat);
        this.highlightMesh.visible = false;
        this.scene.add(this.highlightMesh);

        // Event listeners
        this.bindEvents(canvas);

        // Load level
        const lvl = options.levelIndex || 1;
        this.startLevel(lvl, options.difficulty || 'Normal');

        // Animation loop
        this.animate = this.animate.bind(this);
        this.animId = requestAnimationFrame(this.animate);
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
        const slots = this.container.querySelectorAll('.mc-hotbar-slot');
        slots.forEach(s => s.classList.toggle('active', parseInt(s.dataset.id, 10) === id));
        if (window.AudioManager) window.AudioManager.playClick();
    }

    startLevel(levelIndex = 1, difficulty = 'Normal') {
        this.currentLevel = levelIndex;
        this.difficulty = difficulty;
        this.blocks.clear();

        const seedVal = Math.floor(Math.sin(levelIndex * 43.123) * 100000);
        const seedEl = this.container.querySelector('#mc-seed');
        if (seedEl) seedEl.innerText = `Lvl ${levelIndex} (${difficulty})`;

        // Level styles
        // 1: Grassy Rolling Hills
        // 2: Tall Mountain Cliffs
        // 3: Desert Dunes & Cacti
        // 4: Floating Sky Archipelago
        // 5+: Deep Nether / Alien Crags
        const isDesert = levelIndex === 3;
        const isFloating = levelIndex === 4;
        const isNether = levelIndex >= 5;
        const isMountain = levelIndex === 2;

        const half = Math.floor(this.worldSize / 2);

        for (let x = -half; x <= half; x++) {
            for (let z = -half; z <= half; z++) {
                // Procedural height noise
                const distCenter = Math.sqrt(x * x + z * z);
                let h = 0;

                if (isFloating) {
                    if (distCenter > 14) continue;
                    h = Math.floor(6 + Math.sin(x * 0.4) * 3 + Math.cos(z * 0.4) * 3);
                } else if (isMountain) {
                    h = Math.floor(8 + Math.sin(x * 0.25) * 6 + Math.cos(z * 0.25) * 5 + Math.sin((x+z)*0.5)*2);
                } else if (isDesert) {
                    h = Math.floor(4 + Math.sin(x * 0.15) * 2 + Math.cos(z * 0.15) * 2);
                } else if (isNether) {
                    h = Math.floor(10 + Math.sin(x * 0.3) * 4 + Math.cos(z * 0.3) * 4);
                } else {
                    // Level 1: Plains
                    h = Math.floor(5 + Math.sin(x * 0.2) * 2.5 + Math.cos(z * 0.2) * 2.5);
                }

                h = Math.max(2, Math.min(this.worldHeight - 4, h));

                for (let y = 0; y <= h; y++) {
                    let type = 3; // stone
                    if (isDesert) {
                        type = 8; // sand
                    } else if (isNether) {
                        type = (y === h) ? 7 : (Math.random() < 0.1 ? 10 : 4);
                    } else {
                        if (y === h) type = 1; // grass
                        else if (y >= h - 2) type = 2; // dirt
                        else type = (Math.random() < 0.05) ? 10 : 3; // stone or gold ore
                    }
                    this.setBlock(x, y, z, type);
                }

                // Trees on Grass / Cacti on Sand
                if (!isNether && !isDesert && Math.random() < 0.04 && Math.abs(x) < half - 2 && Math.abs(z) < half - 2) {
                    this.generateTree(x, h + 1, z);
                } else if (isDesert && Math.random() < 0.03 && Math.abs(x) < half - 2 && Math.abs(z) < half - 2) {
                    // Cactus
                    this.setBlock(x, h + 1, z, 6);
                    this.setBlock(x, h + 2, z, 6);
                }
            }
        }

        // Spawn player above highest block at (0, z)
        let spawnY = 10;
        for (let y = this.worldHeight; y >= 0; y--) {
            if (this.getBlock(0, y, 0)) {
                spawnY = y + 2;
                break;
            }
        }
        this.player.pos = { x: 0.5, y: spawnY, z: 0.5 };
        this.player.vel = { x: 0, y: 0, z: 0 };

        this.buildWorldMesh();
    }

    generateTree(x, baseY, z) {
        // Trunk
        const trunkH = 3 + Math.floor(Math.random() * 2);
        for (let y = 0; y < trunkH; y++) {
            this.setBlock(x, baseY + y, z, 5); // wood log
        }
        // Foliage
        const leafY = baseY + trunkH - 1;
        for (let ox = -2; ox <= 2; ox++) {
            for (let oz = -2; oz <= 2; oz++) {
                for (let oy = 0; oy <= 2; oy++) {
                    if (Math.abs(ox) === 2 && Math.abs(oz) === 2 && oy === 2) continue;
                    if (!this.getBlock(x + ox, leafY + oy, z + oz)) {
                        this.setBlock(x + ox, leafY + oy, z + oz, 6); // leaves
                    }
                }
            }
        }
    }

    setBlock(x, y, z, id) {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        if (id === 0) {
            this.blocks.delete(key);
        } else {
            this.blocks.set(key, id);
        }
    }

    getBlock(x, y, z) {
        return this.blocks.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) || 0;
    }

    buildWorldMesh() {
        if (this.chunkMesh) {
            this.scene.remove(this.chunkMesh);
            if (this.chunkMesh.geometry) this.chunkMesh.geometry.dispose();
        }

        // Instanced mesh per block type for high performance
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
            iMesh.castShadow = true;
            iMesh.receiveShadow = true;

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
            iMesh.userData = { blockType: bType.id };
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

        this.onKeyUp = (e) => {
            this.keys[e.code] = false;
        };

        this.onMouseDown = (e) => {
            if (!this.isLocked) {
                canvas.requestPointerLock();
                return;
            }
            if (e.button === 0) {
                // Left click = mine block
                this.mineTargetBlock();
            } else if (e.button === 2) {
                // Right click = place block
                this.placeTargetBlock();
            }
        };

        this.onMouseMove = (e) => {
            if (!this.isLocked) return;
            const sens = 0.0022;
            this.player.yaw -= e.movementX * sens;
            this.player.pitch -= e.movementY * sens;
            const maxPitch = Math.PI / 2 - 0.05;
            this.player.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.player.pitch));
        };

        this.onLockChange = () => {
            this.isLocked = document.pointerLockElement === canvas;
        };

        this.onContextMenu = (e) => e.preventDefault();

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        canvas.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockchange', this.onLockChange);
        canvas.addEventListener('contextmenu', this.onContextMenu);
    }

    getTargetBlock() {
        this.raycaster.setFromCamera(this.mousePos, this.camera);
        // Step forward along ray up to 6 blocks
        const origin = this.camera.position.clone();
        const dir = this.raycaster.ray.direction.clone().normalize();

        const step = 0.08;
        const maxDist = 6.0;
        let curr = origin.clone();
        let prevBlock = null;

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
                    adjacent: prevBlock || { x: bx, y: by + 1, z: bz }
                };
            }
            prevBlock = { x: bx, y: by, z: bz };
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
            // Prevent placing inside player bounding box
            const px = Math.floor(this.player.pos.x);
            const py1 = Math.floor(this.player.pos.y);
            const py2 = Math.floor(this.player.pos.y - 1);
            const pz = Math.floor(this.player.pos.z);

            if (adj.x === px && (adj.y === py1 || adj.y === py2) && adj.z === pz) {
                return; // Can't suffocate self
            }

            this.setBlock(adj.x, adj.y, adj.z, this.selectedBlockId);
            this.buildWorldMesh();
            if (window.AudioManager) window.AudioManager.playPlaceBlock();
        }
    }

    updatePhysics(delta) {
        const p = this.player;
        const speed = p.speed * (this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 1.5 : 1.0);

        // Movement direction relative to camera yaw
        let moveX = 0;
        let moveZ = 0;

        if (this.keys['KeyW']) moveZ -= 1;
        if (this.keys['KeyS']) moveZ += 1;
        if (this.keys['KeyA']) moveX -= 1;
        if (this.keys['KeyD']) moveX += 1;

        const len = Math.hypot(moveX, moveZ);
        if (len > 0) {
            moveX /= len;
            moveZ /= len;
            const sin = Math.sin(p.yaw);
            const cos = Math.cos(p.yaw);
            const worldDirX = moveX * cos + moveZ * sin;
            const worldDirZ = -moveX * sin + moveZ * cos;

            p.vel.x = worldDirX * speed;
            p.vel.z = worldDirZ * speed;
        } else {
            p.vel.x *= 0.7;
            p.vel.z *= 0.7;
        }

        // Gravity & Jump
        p.vel.y -= 22.0 * delta; // Gravity
        if (p.onGround && this.keys['Space']) {
            p.vel.y = p.jumpStrength;
            p.onGround = false;
            if (window.AudioManager) window.AudioManager.playJump();
        }

        // Move X
        p.pos.x += p.vel.x * delta;
        if (this.checkCollision(p.pos.x, p.pos.y, p.pos.z)) {
            p.pos.x -= p.vel.x * delta;
            p.vel.x = 0;
        }

        // Move Z
        p.pos.z += p.vel.z * delta;
        if (this.checkCollision(p.pos.x, p.pos.y, p.pos.z)) {
            p.pos.z -= p.vel.z * delta;
            p.vel.z = 0;
        }

        // Move Y
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

        // Fall into void reset
        if (p.pos.y < -15) {
            p.pos.x = 0.5;
            p.pos.y = 20;
            p.pos.z = 0.5;
            p.vel = { x: 0, y: 0, z: 0 };
        }

        // Update camera position & rotation
        this.camera.position.set(p.pos.x, p.pos.y, p.pos.z);
        this.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');

        // Update target highlight
        const target = this.getTargetBlock();
        if (target.hit) {
            this.highlightMesh.visible = true;
            this.highlightMesh.position.set(target.block.x + 0.5, target.block.y + 0.5, target.block.z + 0.5);
        } else {
            this.highlightMesh.visible = false;
        }

        // Update HUD coordinates
        const coordsEl = this.container.querySelector('#mc-coords');
        if (coordsEl) {
            coordsEl.innerText = `${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(1)}`;
        }
    }

    checkCollision(px, py, pz) {
        const r = this.player.radius;
        const h = this.player.height;

        const minX = Math.floor(px - r);
        const maxX = Math.floor(px + r);
        const minY = Math.floor(py - h);
        const maxY = Math.floor(py);
        const minZ = Math.floor(pz - r);
        const maxZ = Math.floor(pz + r);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.getBlock(x, y, z) !== 0) {
                        return true;
                    }
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

        // Day/Night cycle
        this.dayTime += delta * 0.01;
        if (this.dayTime > 1.0) this.dayTime = 0;
        const sunAngle = this.dayTime * Math.PI * 2;
        const sunX = Math.cos(sunAngle) * 80;
        const sunY = Math.sin(sunAngle) * 80;
        this.sunLight.position.set(sunX, sunY, 40);

        if (sunY > 0) {
            this.scene.background.setHSL(0.58, 0.6, 0.7 * Math.max(0.1, sunY / 80));
            this.ambientLight.intensity = Math.max(0.2, (sunY / 80) * 0.7);
        } else {
            this.scene.background.setHSL(0.65, 0.8, 0.05);
            this.ambientLight.intensity = 0.15;
        }

        this.renderer.render(this.scene, this.camera);
    }

    pause() {
        this.isPaused = true;
    }

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
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
};
