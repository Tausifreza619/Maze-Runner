/**
 * MAZE RUNNER PRO // Neural Labyrinth Engine
 * Clean, structured ES6 implementation with high-fidelity systems:
 * - Web Audio API Synthesizer (AudioSystem)
 * - Safe Storage Interface (SafeStorage)
 * - Vector Linear Interpolation for Smooth Slides (Lerp)
 * - High-DPI Resolution Canvas Scaling (DPR)
 * - Frame-Rate Independent Delta-Time Game Loop
 */

'use strict';

/* ══════════════════════════════════════════
   1. STATIC GAME CONFIGURATIONS
   ══════════════════════════════════════════ */
const CANVAS_SIZE = 600;
const CONFIGS = {
  easy:   { cols: 15, rows: 15, time: 120, enemyMs: 460, fog: false, nCoins: 18 },
  medium: { cols: 25, rows: 25, time: 90,  enemyMs: 290, fog: true,  nCoins: 32 },
  hard:   { cols: 35, rows: 35, time: 60,  enemyMs: 180, fog: true,  nCoins: 55 },
};

/* ══════════════════════════════════════════
   2. ROBUST LOCAL STORAGE CONTROLLER
   ══════════════════════════════════════════ */
class SafeStorage {
  constructor() {
    this._memoryCache = {};
  }

  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('Storage read blocked, using memory cache.', e);
      return this._memoryCache[key] || null;
    }
  }

  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage write blocked, caching in memory.', e);
      this._memoryCache[key] = String(value);
    }
  }
}

const storage = new SafeStorage();

/* ══════════════════════════════════════════
   3. WEB AUDIO RETRO SYNTHESIZER
   ══════════════════════════════════════════ */
class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = parseFloat(storage.getItem('mrp_vol') ?? '0.5');
  }

  ensureAudio() {
    if (!this.ctx) {
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        } else {
          console.warn('Web Audio API is not supported in this browser.');
        }
      } catch (err) {
        console.error('Failed to initialize Web Audio context:', err);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (err) {
        console.error('Failed to resume AudioContext:', err);
      }
    }
  }

  setVolume(volPercent) {
    this.volume = volPercent / 100;
    storage.setItem('mrp_vol', this.volume);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.05);
    }
  }

  playTone(freq, duration, type = 'sine', peakVolume = 0.2, startDelay = 0) {
    this.ensureAudio();
    if (!this.ctx || this.volume <= 0) return;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const t0 = this.ctx.currentTime + startDelay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);

      // Cyberpunk SFX Envelopes
      gainNode.gain.setValueAtTime(0, t0);
      gainNode.gain.linearRampToValueAtTime(peakVolume, t0 + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch (err) {
      console.error('Audio synthesizer tone execution failed', err);
    }
  }

  // Preset synthesized soundscapes
  playMove() {
    this.playTone(150 + Math.random() * 40, 0.04, 'triangle', 0.12);
  }

  playCoin() {
    this.playTone(987.77, 0.08, 'sine', 0.22); // B5 note
    this.playTone(1318.51, 0.15, 'sine', 0.18, 0.06); // E6 note
  }

  playHint() {
    this.playTone(587.33, 0.12, 'square', 0.15); // D5
    this.playTone(880.00, 0.2, 'sine', 0.1, 0.08); // A5
  }

  playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.35, 'sine', 0.25, idx * 0.09);
    });
  }

  playLose() {
    // Synth pitch dive
    this.ensureAudio();
    if (!this.ctx || this.volume <= 0) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filterNode = this.ctx.createBiquadFilter();
      const t0 = this.ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t0);
      osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.55);

      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(1000, t0);
      filterNode.frequency.exponentialRampToValueAtTime(120, t0 + 0.55);

      gainNode.gain.setValueAtTime(0.25, t0);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);

      osc.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(t0);
      osc.stop(t0 + 0.6);
    } catch (e) {}
  }

  playPause() {
    this.playTone(600, 0.05, 'triangle', 0.15);
    this.playTone(900, 0.06, 'triangle', 0.15, 0.035);
  }

  playUnpause() {
    this.playTone(900, 0.05, 'triangle', 0.15);
    this.playTone(600, 0.06, 'triangle', 0.15, 0.035);
  }
}

const audio = new AudioSystem();

/* ══════════════════════════════════════════
   4. PARTICLE ENGINE
   ══════════════════════════════════════════ */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.density = storage.getItem('mrp_parts') ?? 'high'; // high, medium, low, none
  }

  setDensity(val) {
    this.density = val;
    storage.setItem('mrp_parts', val);
  }

  spawnBurst(cx, cy, cellSize, color) {
    if (this.density === 'none') return;

    let count = 12;
    if (this.density === 'medium') count = 6;
    if (this.density === 'low') count = 3;

    const startX = cx * cellSize + cellSize / 2;
    const startY = cy * cellSize + cellSize / 2;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
      const speed = 1.2 + Math.random() * 2.0;
      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        dec: 0.024 + Math.random() * 0.022,
        sz: 2 + Math.random() * 2.5,
        color: color,
      });
    }
  }

  update(dt) {
    const simSpeedFactor = 60 * dt;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * simSpeedFactor;
      p.y += p.vy * simSpeedFactor;
      p.vy += 0.045 * simSpeedFactor; // Gravity pull
      p.life -= p.dec * simSpeedFactor;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
    });
    ctx.restore();
  }

  clear() {
    this.particles = [];
  }
}

/* ══════════════════════════════════════════
   5. MAZE GRID & GENERATION
   ══════════════════════════════════════════ */
class MazeCell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = [1, 1, 1, 1]; // Top, Right, Bottom, Left walls
    this.v = false;        // Visited flag
  }
}

class Maze {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.grid = this.initGrid();
    this.generate();
  }

  initGrid() {
    return Array.from({ length: this.rows }, (_, y) =>
      Array.from({ length: this.cols }, (_, x) => new MazeCell(x, y))
    );
  }

  generate() {
    const stack = [this.grid[0][0]];
    this.grid[0][0].v = true;

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = this.getUnvisitedNeighbors(current);

      if (neighbors.length > 0) {
        const next = neighbors[Math.random() * neighbors.length | 0];
        this.carveWalls(current, next);
        next.v = true;
        stack.push(next);
      } else {
        stack.pop();
      }
    }
  }

  getUnvisitedNeighbors(cell) {
    const { x, y } = cell;
    const list = [];
    if (y > 0 && !this.grid[y - 1][x].v) list.push(this.grid[y - 1][x]);
    if (x < this.cols - 1 && !this.grid[y][x + 1].v) list.push(this.grid[y][x + 1]);
    if (y < this.rows - 1 && !this.grid[y + 1][x].v) list.push(this.grid[y + 1][x]);
    if (x > 0 && !this.grid[y][x - 1].v) list.push(this.grid[y][x - 1]);
    return list;
  }

  carveWalls(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    if (dx === 1) { a.w[3] = 0; b.w[1] = 0; }
    if (dx === -1) { a.w[1] = 0; b.w[3] = 0; }
    if (dy === 1) { a.w[0] = 0; b.w[2] = 0; }
    if (dy === -1) { a.w[2] = 0; b.w[0] = 0; }
  }
}

/* ══════════════════════════════════════════
   6. CORE MAZE RUNNER GAME MANAGER
   ══════════════════════════════════════════ */
class MazeRunnerGame {
  constructor() {
    // DOM Bindings
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.mbgCanvas = document.getElementById('mbg');
    this.mbgCtx = this.mbgCanvas.getContext('2d');

    // Subsystems
    this.particles = new ParticleSystem();

    // Settings
    this.volume = parseInt(storage.getItem('mrp_vol_pct') ?? '50', 10);
    this.particleSetting = storage.getItem('mrp_parts') ?? 'high';
    this.screenShake = (storage.getItem('mrp_shake') ?? 'true') === 'true';

    // Game Variables
    this.gameState = 'menu'; // 'menu', 'play', 'end'
    this.paused = false;
    this.diff = 'easy';
    this.cols = 15;
    this.rows = 15;
    this.cs = 0; // cellSize computed on sizeCanvas()

    this.maze = null;
    this.player = { x: 0, y: 0, renderX: 0, renderY: 0 };
    this.enemy = { x: 0, y: 0, renderX: 0, renderY: 0 };
    this.coins = new Set();
    this.totalCoins = 0;
    this.coinCount = 0;
    this.score = 0;
    
    // Timer & loop variables
    this.timeLeft = 0;
    this.lastTimestamp = 0;
    this.timeAccumulator = 0;
    this.enemyTimeAccumulator = 0;
    
    // Trail / Visual tracking
    this.trail = [];
    this.trailTimer = 0;
    this.fogGrid = [];
    this.hasFog = false;

    // Hint variables
    this.hintSet = null;
    this.hintActive = false;
    this.hintTimer = 0;

    // Menu BG variables
    this.menuParticles = [];

    // Animations ticks
    this.enemyAnimPulse = 0;
    this.exitAnimPulse = 0;
    this.gameTick = 0;

    // Run basic setups
    this.initDOM();
    this.initListeners();
    this.initMenuBg();
    
    // Start Menu Loop
    requestAnimationFrame((t) => this.mainLoop(t));
  }

  /* ─── DOM INITS & CONFIG READS ─── */
  initDOM() {
    // Synced configuration elements
    document.getElementById('set-volume').value = this.volume;
    document.getElementById('set-volume-val').textContent = `${this.volume}%`;
    document.getElementById('set-particles').value = this.particleSetting;
    document.getElementById('set-shake').checked = this.screenShake;

    // Update settings systems
    audio.setVolume(this.volume);
    this.particles.setDensity(this.particleSetting);
  }

  initListeners() {
    // Window Resize event
    window.addEventListener('resize', () => {
      this.sizeCanvas();
      this.resizeMenuBg();
    });

    // Keyboard bindings
    document.addEventListener('keydown', (e) => {
      if (this.gameState === 'play') {
        const directionMap = {
          ArrowUp: 0, w: 0, W: 0,
          ArrowRight: 1, d: 1, D: 1,
          ArrowDown: 2, s: 2, S: 2,
          ArrowLeft: 3, a: 3, A: 3,
        };

        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          this.togglePause();
          return;
        }

        if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          this.showHint();
          return;
        }

        const dir = directionMap[e.key];
        if (dir !== undefined && !this.paused) {
          e.preventDefault();
          this.movePlayer(dir);
        }
      }
    });

    // Touch events for Canvas
    let touchStartX = null;
    let touchStartY = null;

    this.canvas.addEventListener('touchstart', (e) => {
      if (this.paused) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (this.paused || !touchStartX || !touchStartY) return;
      
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const threshold = 15;

      if (Math.max(Math.abs(dx), Math.abs(dy)) > threshold) {
        if (Math.abs(dx) > Math.abs(dy)) {
          this.movePlayer(dx > 0 ? 1 : 3); // Right / Left
        } else {
          this.movePlayer(dy > 0 ? 2 : 0); // Down / Up
        }
      }

      touchStartX = null;
      touchStartY = null;
      e.preventDefault();
    }, { passive: false });

    // Mobile D-Pad binding
    const dpadControls = [
      { id: 'dp-u', dir: 0 },
      { id: 'dp-r', dir: 1 },
      { id: 'dp-d', dir: 2 },
      { id: 'dp-l', dir: 3 }
    ];

    dpadControls.forEach(({ id, dir }) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!this.paused) this.movePlayer(dir);
      }, { passive: false });
      el.addEventListener('click', () => {
        if (!this.paused) this.movePlayer(dir);
      });
    });

    // Settings Controls Changes
    document.getElementById('set-volume').addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10);
      document.getElementById('set-volume-val').textContent = `${vol}%`;
      this.volume = vol;
      storage.setItem('mrp_vol_pct', vol);
      audio.setVolume(vol);
    });

    document.getElementById('set-particles').addEventListener('change', (e) => {
      const density = e.target.value;
      this.particleSetting = density;
      this.particles.setDensity(density);
    });

    document.getElementById('set-shake').addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      this.screenShake = isChecked;
      storage.setItem('mrp_shake', isChecked);
    });
  }

  /* ─── CANVAS SIZING SYSTEM ─── */
  sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const hudHeight = 64;
    const displaySize = Math.min(window.innerWidth, window.innerHeight - hudHeight - 16, CANVAS_SIZE);

    this.canvas.style.width = displaySize + 'px';
    this.canvas.style.height = displaySize + 'px';

    this.canvas.width = displaySize * dpr;
    this.canvas.height = displaySize * dpr;

    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.cs = displaySize / this.cols;
  }

  /* ─── MENU BACKGROUND PARTICLES ─── */
  initMenuBg() {
    this.resizeMenuBg();
    this.menuParticles = Array.from({ length: 80 }, () => ({
      x: Math.random() * this.mbgCanvas.width,
      y: Math.random() * this.mbgCanvas.height,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      r: Math.random() * 1.8 + 0.4,
      a: Math.random() * 0.42 + 0.12,
    }));
  }

  resizeMenuBg() {
    this.mbgCanvas.width = window.innerWidth;
    this.mbgCanvas.height = window.innerHeight;
  }

  updateMenuBg(dt) {
    const speedFactor = 60 * dt;
    this.menuParticles.forEach(p => {
      p.x += p.vx * speedFactor;
      p.y += p.vy * speedFactor;

      if (p.x < 0 || p.x > this.mbgCanvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.mbgCanvas.height) p.vy *= -1;
    });
  }

  drawMenuBg() {
    this.mbgCtx.clearRect(0, 0, this.mbgCanvas.width, this.mbgCanvas.height);
    
    // Draw connecting network lines
    const lineDist = 120;
    this.mbgCtx.lineWidth = 0.5;
    for (let i = 0; i < this.menuParticles.length; i++) {
      const pi = this.menuParticles[i];
      for (let j = i + 1; j < this.menuParticles.length; j++) {
        const pj = this.menuParticles[j];
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < lineDist) {
          this.mbgCtx.strokeStyle = `rgba(0, 229, 255, ${0.09 * (1 - dist / lineDist)})`;
          this.mbgCtx.beginPath();
          this.mbgCtx.moveTo(pi.x, pi.y);
          this.mbgCtx.lineTo(pj.x, pj.y);
          this.mbgCtx.stroke();
        }
      }
    }

    // Draw nodes
    this.menuParticles.forEach(p => {
      this.mbgCtx.fillStyle = `rgba(0, 229, 255, ${p.a})`;
      this.mbgCtx.beginPath();
      this.mbgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.mbgCtx.fill();
    });
  }

  /* ─── PATHFINDING UTILITIES ─── */
  cellMoves(c) {
    const cell = this.maze.grid[c.y][c.x];
    const moves = [];
    if (!cell.w[0]) moves.push({ x: c.x, y: c.y - 1 });
    if (!cell.w[1]) moves.push({ x: c.x + 1, y: c.y });
    if (!cell.w[2]) moves.push({ x: c.x, y: c.y + 1 });
    if (!cell.w[3]) moves.push({ x: c.x - 1, y: c.y });
    return moves;
  }

  ky(n) {
    return `${n.x},${n.y}`;
  }

  hdist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  bfsPath(start, end) {
    const q = [start];
    const visited = new Set([this.ky(start)]);
    const cameFrom = {};

    while (q.length > 0) {
      const current = q.shift();
      if (current.x === end.x && current.y === end.y) break;

      for (const next of this.cellMoves(current)) {
        const key = this.ky(next);
        if (!visited.has(key)) {
          visited.add(key);
          cameFrom[key] = current;
          q.push(next);
        }
      }
    }

    const path = new Set();
    let key = this.ky(end);
    while (cameFrom[key]) {
      const node = cameFrom[key];
      path.add(this.ky(node));
      key = this.ky(node);
    }
    return path;
  }

  astar(start, end) {
    const startKey = this.ky(start);
    const endKey = this.ky(end);
    if (startKey === endKey) return null;

    const openList = [start];
    const openSet = new Set([startKey]);
    const cameFrom = {};

    const gScore = { [startKey]: 0 };
    const fScore = { [startKey]: this.hdist(start, end) };

    while (openList.length > 0) {
      openList.sort((a, b) => (fScore[this.ky(a)] ?? Infinity) - (fScore[this.ky(b)] ?? Infinity));
      const current = openList.shift();
      const currentKey = this.ky(current);
      openSet.delete(currentKey);

      if (currentKey === endKey) {
        const path = [];
        let key = endKey;
        while (cameFrom[key]) {
          path.unshift(cameFrom[key]);
          key = this.ky(cameFrom[key]);
        }
        return path.length > 1 ? path[1] : { x: end.x, y: end.y };
      }

      for (const next of this.cellMoves(current)) {
        const nextKey = this.ky(next);
        const tentativeG = (gScore[currentKey] ?? 0) + 1;

        if (tentativeG < (gScore[nextKey] ?? Infinity)) {
          cameFrom[nextKey] = current;
          gScore[nextKey] = tentativeG;
          fScore[nextKey] = tentativeG + this.hdist(next, end);

          if (!openSet.has(nextKey)) {
            openSet.add(nextKey);
            openList.push(next);
          }
        }
      }
    }
    return null;
  }

  /* ─── FOG OF WAR ─── */
  initFog() {
    this.fogGrid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
    this.revealFog(0, 0);
  }

  revealFog(px, py) {
    const radius = 4;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx >= 0 && ny >= 0 && nx < this.cols && ny < this.rows && (dx*dx + dy*dy <= radius*radius)) {
          this.fogGrid[ny][nx] = true;
        }
      }
    }
  }

  isVisible(x, y) {
    return !this.hasFog || (this.fogGrid[y] && this.fogGrid[y][x] === true);
  }

  /* ─── COINS GENERATION ─── */
  spawnCoins() {
    this.coins.clear();
    const config = CONFIGS[this.diff];
    const skip = new Set(['0,0', `${this.cols-1},${this.rows-1}`, `${this.cols-1},0`]);
    let attempts = 0;

    while (this.coins.size < config.nCoins && attempts < 3500) {
      const x = Math.random() * this.cols | 0;
      const y = Math.random() * this.rows | 0;
      const key = `${x},${y}`;
      if (!skip.has(key)) {
        this.coins.add(key);
      }
      attempts++;
    }
    this.totalCoins = this.coins.size;
  }

  /* ─── SCREEN SHAKE TRIGGER ─── */
  triggerScreenShake() {
    if (!this.screenShake) return;
    const container = document.querySelector('.canvas-container');
    if (!container) return;
    container.classList.remove('shake-anim');
    void container.offsetWidth; // Reflow reset
    container.classList.add('shake-anim');
    
    setTimeout(() => {
      container.classList.remove('shake-anim');
    }, 400);
  }

  /* ─── INTERACTION & GAMEPLAY LOGIC ─── */
  checkCapture() {
    if (this.player.x === this.enemy.x && this.player.y === this.enemy.y) {
      this.gameState = 'captured';
      return true;
    }
    return false;
  }

  movePlayer(dir) {
    if (this.gameState !== 'play' || this.paused) return;
    audio.ensureAudio();

    const cell = this.maze.grid[this.player.y][this.player.x];
    let nextX = this.player.x;
    let nextY = this.player.y;

    if (dir === 0 && !cell.w[0]) nextY--;
    if (dir === 1 && !cell.w[1]) nextX++;
    if (dir === 2 && !cell.w[2]) nextY++;
    if (dir === 3 && !cell.w[3]) nextX--;

    // If hit a wall
    if (nextX === this.player.x && nextY === this.player.y) return;

    // Movement valid, proceed
    this.player.x = nextX;
    this.player.y = nextY;

    // Check instant collision when player moves
    if (this.checkCapture()) return;

    if (this.hasFog) {
      this.revealFog(this.player.x, this.player.y);
    }
    audio.playMove();

    // Check for coin collection
    const key = `${this.player.x},${this.player.y}`;
    if (this.coins.has(key)) {
      this.coins.delete(key);
      this.score += 10;
      this.coinCount++;
      audio.playCoin();
      this.triggerScreenShake();
      this.particles.spawnBurst(this.player.x, this.player.y, this.cs, '#ffd600');
      this.popHUDElement('hv-s');
      this.popHUDElement('hv-c');
      this.updateHUD();
    }

    this.checkWinCondition();
  }

  moveEnemy() {
    const nextStep = this.astar(this.enemy, this.player);
    if (nextStep) {
      this.enemy.x = nextStep.x;
      this.enemy.y = nextStep.y;
    }
    
    // Check instant collision when enemy moves
    this.checkCapture();
  }

  checkWinCondition() {
    if (this.player.x === this.cols - 1 && this.player.y === this.rows - 1) {
      this.triggerWin();
    }
  }

  /* ─── HUD & TOAST NOTIFICATION UTILITIES ─── */
  updateHUD() {
    const timeVal = document.getElementById('hv-t');
    timeVal.textContent = this.timeLeft;
    timeVal.classList.toggle('danger', this.timeLeft <= 15 && this.timeLeft > 0);
    
    document.getElementById('hv-s').textContent = this.score;
    document.getElementById('hv-c').textContent = `${this.coinCount}/${this.totalCoins}`;
    document.getElementById('hv-b').textContent = storage.getItem('mrp_best') || '--';
  }

  popHUDElement(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('pop');
      void el.offsetWidth; // Reflow reset
      el.classList.add('pop');
    }
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('on');
    
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('on');
    }, 2800);
  }

  /* ─── PAUSE & RESUME SYSTEMS ─── */
  togglePause() {
    if (this.gameState !== 'play') return;
    this.paused = !this.paused;

    const pauseOverlay = document.getElementById('pause-overlay');
    if (this.paused) {
      audio.playPause();
      pauseOverlay.style.display = 'flex';
      void pauseOverlay.offsetWidth;
      pauseOverlay.classList.add('show');
    } else {
      audio.playUnpause();
      pauseOverlay.classList.remove('show');
      setTimeout(() => {
        if (!this.paused) pauseOverlay.style.display = 'none';
      }, 250);
      
      // Prevent timestamp jump after pausing
      this.lastTimestamp = performance.now();
    }
  }

  /* ─── CONFIG SETTINGS PANEL ─── */
  toggleSettings(open) {
    const settingsPanel = document.getElementById('settings-overlay');
    if (open) {
      audio.ensureAudio();
      settingsPanel.style.display = 'flex';
      void settingsPanel.offsetWidth;
      settingsPanel.classList.add('show');
    } else {
      settingsPanel.classList.remove('show');
      setTimeout(() => {
        if (!settingsPanel.classList.contains('show')) {
          settingsPanel.style.display = 'none';
        }
      }, 250);
    }
  }

  /* ─── HINT SYSTEM ─── */
  showHint() {
    if (this.gameState !== 'play' || this.paused) return;
    audio.playHint();
    
    this.score = Math.max(0, this.score - 5);
    this.updateHUD();
    this.popHUDElement('hv-s');

    this.hintSet = this.bfsPath(this.player, { x: this.cols - 1, y: this.rows - 1 });
    this.hintActive = true;
    this.hintTimer = 5.0; // Show for 5 seconds

    this.showToast('PATH ACTIVATED // System penalty -5 pts');
  }

  /* ─── START & STOP OPERATIONS ─── */
  startGame(difficulty) {
    this.diff = difficulty;
    const config = CONFIGS[difficulty];
    
    this.cols = config.cols;
    this.rows = config.rows;
    this.timeLeft = config.time;
    this.hasFog = config.fog;

    // Build Maze structure
    this.maze = new Maze(this.cols, this.rows);

    // Positions & Lerp initializations
    this.player.x = 0;
    this.player.y = 0;
    this.player.renderX = 0;
    this.player.renderY = 0;

    this.enemy.x = this.cols - 1;
    this.enemy.y = 0;
    this.enemy.renderX = this.cols - 1;
    this.enemy.renderY = 0;

    // Reset scores & trail trackers
    this.score = 0;
    this.coinCount = 0;
    this.trail = [];
    this.trailTimer = 0;
    this.particles.clear();

    // Disable hints
    this.hintActive = false;
    this.hintSet = null;

    // Spawns
    this.spawnCoins();
    if (this.hasFog) {
      this.initFog();
    }

    // Canvas layout adjustment
    this.sizeCanvas();
    this.updateHUD();

    // Reset loop state parameters
    this.paused = false;
    this.timeAccumulator = 0;
    this.enemyTimeAccumulator = 0;
    this.lastTimestamp = performance.now();

    // Hide Main Menu
    const menuElement = document.getElementById('menu');
    menuElement.classList.add('out');
    setTimeout(() => {
      menuElement.style.display = 'none';
    }, 450);

    // Show Game Interface
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('game-wrap').style.display = 'flex';
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('toast').classList.remove('on');
    document.getElementById('pause-overlay').classList.remove('show');
    document.getElementById('pause-overlay').style.display = 'none';

    this.gameState = 'play';
  }

  goMenu() {
    this.gameState = 'menu';
    this.paused = false;
    this.particles.clear();
    
    const menuElement = document.getElementById('menu');
    menuElement.style.display = 'flex';
    void menuElement.offsetWidth;
    menuElement.classList.remove('out');

    document.getElementById('hud').style.display = 'none';
    document.getElementById('game-wrap').style.display = 'none';
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('pause-overlay').classList.remove('show');
    document.getElementById('pause-overlay').style.display = 'none';

    // Refresh best score display
    const bestScore = storage.getItem('mrp_best');
    document.getElementById('m-best').textContent = bestScore ? `Best Score: ${bestScore}` : '';
    
    this.lastTimestamp = performance.now();
  }

  triggerWin() {
    this.gameState = 'end';
    const timeBonus = this.timeLeft * 2;
    this.score += timeBonus;

    const previousBest = parseInt(storage.getItem('mrp_best') ?? '0', 10);
    const isNewRecord = this.score > previousBest;

    if (isNewRecord) {
      storage.setItem('mrp_best', this.score);
    }
    
    audio.playWin();
    this.showOverlay('win', isNewRecord, timeBonus);
  }

  triggerLose(reason) {
    this.gameState = 'end';
    audio.playLose();
    this.triggerScreenShake();
    this.showOverlay('lose', false, 0, reason);
  }

  showOverlay(type, isRecord, timeBonus, reason = '') {
    const title = document.getElementById('ov-title');
    const stats = document.getElementById('ov-stats');
    const replayButton = document.getElementById('ov-replay');
    const overlay = document.getElementById('overlay');

    if (type === 'win') {
      title.textContent = 'YOU ESCAPED!';
      title.className = 'ov-title win';
      stats.innerHTML = `
        Score <span class="ov-val ${isRecord ? 'rec' : ''}">${this.score} ${isRecord ? '★ NEW RECORD!' : ''}</span><br>
        Coins <span class="ov-val">${this.coinCount} / ${this.totalCoins}</span><br>
        Time Bonus <span class="ov-val">+${timeBonus} pts</span><br>
        Best Score <span class="ov-val">${storage.getItem('mrp_best')}</span>
      `;
    } else {
      title.textContent = reason === 'c' ? 'NODE CAPTURED!' : "TIME OUT!";
      title.className = 'ov-title lose';
      
      const distance = this.hdist(this.player, { x: this.cols - 1, y: this.rows - 1 });
      const progressPercent = Math.round((1 - distance / (this.cols + this.rows)) * 100);
      
      stats.innerHTML = `
        Score <span class="ov-val">${this.score}</span><br>
        Coins <span class="ov-val">${this.coinCount} / ${this.totalCoins}</span><br>
        Progress <span class="ov-val">~${Math.max(0, Math.min(100, progressPercent))}%</span>
      `;
    }

    replayButton.onclick = () => this.startGame(this.diff);
    overlay.classList.add('show');
  }

  /* ══════════════════════════════════════════
     7. MAIN GAME LOOP (requestAnimationFrame)
     ══════════════════════════════════════════ */
  mainLoop(timestamp) {
    // Avoid large time steps when the window drops focus
    let dt = (timestamp - this.lastTimestamp) / 1000;
    if (dt > 0.1) dt = 0.1;
    this.lastTimestamp = timestamp;

    if (this.gameState === 'menu') {
      this.updateMenuBg(dt);
      this.drawMenuBg();
    } else {
      this.update(dt);
      this.draw();
    }

    requestAnimationFrame((t) => this.mainLoop(t));
  }

  /* ─── ENGINE STATES UPDATE ─── */
  update(dt) {
    this.gameTick++;
    this.enemyAnimPulse = (this.enemyAnimPulse + 5.0 * dt) % (Math.PI * 2);
    this.exitAnimPulse = (this.exitAnimPulse + 3.0 * dt) % (Math.PI * 2);

    if (this.gameState === 'play' && !this.paused) {
      // 1. Time countdown system
      this.timeAccumulator += dt;
      if (this.timeAccumulator >= 1.0) {
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        this.timeAccumulator -= 1.0;
        this.updateHUD();

        if (this.timeLeft <= 0) {
          this.triggerLose('t');
        }
      }

      // 2. Enemy movement timer
      const config = CONFIGS[this.diff];
      this.enemyTimeAccumulator += dt;
      const intervalSec = config.enemyMs / 1000;
      if (this.enemyTimeAccumulator >= intervalSec) {
        this.moveEnemy();
        this.enemyTimeAccumulator -= intervalSec;
      }

      // 3. Hint timer countdown
      if (this.hintActive) {
        this.hintTimer -= dt;
        if (this.hintTimer <= 0) {
          this.hintActive = false;
          this.hintSet = null;
        }
      }
    }

    // Capture visual merge check
    if (this.gameState === 'captured') {
      const rDist = Math.abs(this.player.renderX - this.enemy.renderX) + Math.abs(this.player.renderY - this.enemy.renderY);
      if (rDist < 0.08) {
        this.triggerLose('c');
      }
    }

    // 4. Smooth Character Position Interpolation (Lerp)
    // Frame-rate independent slide updates
    const lerpSpeed = 16.0;
    const lerpFactor = 1 - Math.exp(-lerpSpeed * dt);
    
    // Player slide
    const pdx = this.player.x - this.player.renderX;
    const pdy = this.player.y - this.player.renderY;
    if (Math.abs(pdx) < 0.005) this.player.renderX = this.player.x;
    else this.player.renderX += pdx * lerpFactor;
    if (Math.abs(pdy) < 0.005) this.player.renderY = this.player.y;
    else this.player.renderY += pdy * lerpFactor;

    // Enemy slide
    const edx = this.enemy.x - this.enemy.renderX;
    const edy = this.enemy.y - this.enemy.renderY;
    if (Math.abs(edx) < 0.005) this.enemy.renderX = this.enemy.x;
    else this.enemy.renderX += edx * lerpFactor;
    if (Math.abs(edy) < 0.005) this.enemy.renderY = this.enemy.y;
    else this.enemy.renderY += edy * lerpFactor;

    // 5. Update player trails
    this.trailTimer += dt;
    if (this.trailTimer >= 0.035) {
      this.trailTimer = 0;
      if ((this.gameState === 'play' || this.gameState === 'captured') && !this.paused) {
        this.trail.push({ x: this.player.renderX, y: this.player.renderY });
        if (this.trail.length > 14) this.trail.shift();
      }
    }

    // 6. Update particles
    this.particles.update(dt);
  }

  /* ─── GRAPHICAL CANVAS DRAWINGS ─── */
  draw() {
    this.ctx.fillStyle = '#020712';
    this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 1. Hint Path highlights
    if (this.hintActive && this.hintSet) {
      this.ctx.fillStyle = 'rgba(255, 214, 0, 0.15)';
      this.hintSet.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        if (this.isVisible(x, y)) {
          this.ctx.fillRect(x * this.cs, y * this.cs, this.cs, this.cs);
        }
      });
    }

    // 2. Grid Maze Walls drawing (Batched stroke paths for performance)
    this.ctx.shadowColor = '#00e5ff';
    this.ctx.shadowBlur = 3.5;
    this.ctx.strokeStyle = '#00e5ff';
    this.ctx.lineWidth = this.cs > 16 ? 1.3 : 0.95;
    this.ctx.beginPath();

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.isVisible(x, y)) continue;

        const cell = this.maze.grid[y][x];
        const px = x * this.cs;
        const py = y * this.cs;

        if (cell.w[0]) { this.ctx.moveTo(px, py); this.ctx.lineTo(px + this.cs, py); }
        if (cell.w[1]) { this.ctx.moveTo(px + this.cs, py); this.ctx.lineTo(px + this.cs, py + this.cs); }
        if (cell.w[2]) { this.ctx.moveTo(px + this.cs, py + this.cs); this.ctx.lineTo(px, py + this.cs); }
        if (cell.w[3]) { this.ctx.moveTo(px, py + this.cs); this.ctx.lineTo(px, py); }
      }
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0; // Disable shadows for other layers

    // 3. Exit portal
    if (this.isVisible(this.cols - 1, this.rows - 1)) {
      const ex = (this.cols - 1) * this.cs;
      const ey = (this.rows - 1) * this.cs;
      const pulseRate = 0.55 + 0.45 * Math.sin(this.exitAnimPulse);
      
      this.ctx.fillStyle = `rgba(57, 255, 20, ${pulseRate * 0.28})`;
      this.ctx.fillRect(ex, ey, this.cs, this.cs);

      this.ctx.save();
      this.ctx.shadowColor = '#39ff14';
      this.ctx.shadowBlur = 12 * pulseRate;
      this.ctx.strokeStyle = `rgba(57, 255, 20, ${pulseRate})`;
      this.ctx.lineWidth = 1.8;
      this.ctx.strokeRect(ex + 1, ey + 1, this.cs - 2, this.cs - 2);
      this.ctx.restore();

      if (this.cs > 12) {
        this.ctx.fillStyle = `rgba(57, 255, 20, ${pulseRate})`;
        this.ctx.font = `bold ${Math.max(7, this.cs * 0.42)}px Orbitron, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('EXIT', ex + this.cs / 2, ey + this.cs / 2);
      }
    }

    // 4. Coins drawing
    this.coins.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (!this.isVisible(x, y)) return;

      const cx = x * this.cs + this.cs / 2;
      const cy = y * this.cs + this.cs / 2;
      const radius = Math.max(2, this.cs * 0.22) * (0.8 + 0.2 * Math.sin(this.gameTick * 0.08 + x + y));

      this.ctx.save();
      this.ctx.shadowColor = '#ffd600';
      this.ctx.shadowBlur = 9;
      this.ctx.fillStyle = '#ffd600';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 5. Player trails drawing
    this.trail.forEach((tPoint, idx) => {
      const alpha = (idx / this.trail.length) * 0.26;
      const size = this.cs * (0.28 + 0.44 * (idx / this.trail.length));
      this.ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`;
      this.ctx.fillRect(tPoint.x * this.cs + (this.cs - size) / 2, tPoint.y * this.cs + (this.cs - size) / 2, size, size);
    });

    // 6. Fog of war screen overlay
    if (this.hasFog) {
      this.ctx.fillStyle = 'rgba(2, 7, 18, 0.98)';
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!this.fogGrid[y] || !this.fogGrid[y][x]) {
            this.ctx.fillRect(x * this.cs, y * this.cs, this.cs, this.cs);
          }
        }
      }
    }

    // 7. Player drawing
    {
      const playerSize = this.cs * 0.74;
      const px = this.player.renderX * this.cs + (this.cs - playerSize) / 2;
      const py = this.player.renderY * this.cs + (this.cs - playerSize) / 2;
      
      this.ctx.save();
      this.ctx.shadowColor = '#00e5ff';
      this.ctx.shadowBlur = 20;
      this.ctx.fillStyle = '#00e5ff';
      this.ctx.fillRect(px, py, playerSize, playerSize);
      
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(px, py, playerSize, playerSize);
      this.ctx.restore();
    }

    // 8. Enemy tracker drawing
    {
      const pulse = 0.72 + 0.11 * Math.sin(this.enemyAnimPulse);
      const enemySize = this.cs * pulse;
      const ex = this.enemy.renderX * this.cs + (this.cs - enemySize) / 2;
      const ey = this.enemy.renderY * this.cs + (this.cs - enemySize) / 2;
      
      this.ctx.save();
      this.ctx.shadowColor = '#ff1744';
      this.ctx.shadowBlur = 16 + 10 * Math.sin(this.enemyAnimPulse);
      this.ctx.fillStyle = '#ff1744';
      this.ctx.fillRect(ex, ey, enemySize, enemySize);
      this.ctx.restore();
    }

    // 9. Particle arrays
    this.particles.draw(this.ctx);

    // 10. Proximity Danger vignette
    const dangerDist = this.hdist(this.enemy, this.player);
    if (dangerDist < 7) {
      const vignetteAlpha = (1 - dangerDist / 7) * 0.24;
      const gradient = this.ctx.createRadialGradient(
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.28,
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.72
      );
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, `rgba(255, 23, 68, ${vignetteAlpha})`);
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }

    // 11. Minimap (hard mode exclusive)
    if (this.diff === 'hard') {
      const mSize = 78;
      const mX = CANVAS_SIZE - mSize - 8;
      const mY = 8;
      const mCell = mSize / this.cols;

      this.ctx.save();
      this.ctx.globalAlpha = 0.82;
      this.ctx.fillStyle = 'rgba(2, 7, 18, 0.88)';
      this.ctx.fillRect(mX - 2, mY - 2, mSize + 4, mSize + 4);

      this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
      this.ctx.lineWidth = 0.45;
      this.ctx.beginPath();

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const cell = this.maze.grid[y][x];
          const px = mX + x * mCell;
          const py = mY + y * mCell;

          if (cell.w[0]) { this.ctx.moveTo(px, py); this.ctx.lineTo(px + mCell, py); }
          if (cell.w[1]) { this.ctx.moveTo(px + mCell, py); this.ctx.lineTo(px + mCell, py + mCell); }
          if (cell.w[2]) { this.ctx.moveTo(px + mCell, py + mCell); this.ctx.lineTo(px, py + mCell); }
          if (cell.w[3]) { this.ctx.moveTo(px, py + mCell); this.ctx.lineTo(px, py); }
        }
      }
      this.ctx.stroke();

      // Mini markers
      this.ctx.fillStyle = '#39ff14'; // Exit
      this.ctx.fillRect(mX + (this.cols - 1) * mCell - 0.5, mY + (this.rows - 1) * mCell - 0.5, mCell + 1, mCell + 1);
      
      this.ctx.fillStyle = '#ff1744'; // Enemy
      this.ctx.fillRect(mX + this.enemy.renderX * mCell - 0.5, mY + this.enemy.renderY * mCell - 0.5, mCell + 1, mCell + 1);
      
      this.ctx.fillStyle = '#00e5ff'; // Player
      this.ctx.fillRect(mX + this.player.renderX * mCell - 0.5, mY + this.player.renderY * mCell - 0.5, mCell + 1, mCell + 1);

      this.ctx.restore();
    }
  }
}

/* ══════════════════════════════════════════
   8. MAIN ENGINE TRIGGER
   ══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const game = new MazeRunnerGame();

  // Expose global actions for HTML click bindings
  window.startGame = (d) => game.startGame(d);
  window.showHint = () => game.showHint();
  window.goMenu = () => game.goMenu();
  window.toggleSettings = (open) => game.toggleSettings(open);
  window.togglePause = () => game.togglePause();
});