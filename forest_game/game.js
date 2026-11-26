const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Screen & World constants
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;

// Camera state
const camera = {
    x: 0,
    y: 0
};

// Assets
const bgImg = new Image(); // Central clearing (house + coop + paths)
bgImg.src = 'background.png';
const chickenImg = new Image();
chickenImg.src = 'chicken.png';
const girlImg = new Image();
girlImg.src = 'girl.png';
const animalImg = new Image();
animalImg.src = 'animal.png';
const foxImg = new Image();
foxImg.src = 'fox-4.png';
const goldenImg = new Image();
goldenImg.src = 'pouleor.png';
const dogImg = new Image();
dogImg.src = 'dog.png';

const dogBarkAudio = new Audio('dog_bark.wav');
const chickenAudio = new Audio('poule.wav');
chickenAudio.volume = 0.35;

// Game state
let keys = {};
let gamepadState = {};
let score = 0;

// Entities
const player = {
    x: 350,
    y: 420,
    width: 48,
    height: 48,
    speed: 4,
    direction: 'down',
    facingLeft: false,
    isMoving: false,
    walkTimer: 0,
    stepTimer: 0
};

// Central clearing (background.png placed harmoniously in the upper-center)
const clearing = {
    x: 400,
    y: 40,
    width: 800,
    height: 600
};

// Landmarks calibrated to background.png inside clearing
const house = {
    x: clearing.x + 175,
    y: clearing.y + 87,
    width: 145,
    height: 175
};

const coop = {
    x: clearing.x + 428,
    y: clearing.y + 34,
    width: 125,
    height: 155
};

// River & Bridges (horizontal river in the southern half of the map)
const river = {
    y: 780,
    height: 70
};

const bridges = [
    { x: 495, y: river.y - 10, width: 120, height: river.height + 20 },
    { x: 1120, y: river.y - 10, width: 120, height: river.height + 20 }
];

// Game State
let playerName = "Joueur";
let isPlaying = false;
let isPaused = false;
let gameWon = false;
let particles = [];
let floatingTexts = [];
let footprints = [];
let weatherParticles = [];
let obstacles = [];
let foxes = [];
let dog;

// Screen transition fade (1 -> 0)
let screenFade = 0;

// PowerUps
let powerups = [];
let speedBoostTimer = 0;
const normalSpeed = 4;
const boostedSpeed = 8;

// Timer & Score State
let startTime = 0;
let elapsedTime = 0;
const targetScore = 30;

// Countdown State
let countdown = 3;
let isCountingDown = false;
let countdownTimer = 0;

// HUD Elements
const hudElement = document.getElementById('game-hud');
const hudScore = document.getElementById('hud-score');
const hudTimer = document.getElementById('hud-timer');
const hudPlayerName = document.getElementById('hud-player-name');
const mainTitle = document.getElementById('main-title');

function triggerShake() {
    canvas.classList.remove('shake-canvas');
    void canvas.offsetWidth;
    canvas.classList.add('shake-canvas');
    setTimeout(() => canvas.classList.remove('shake-canvas'), 400);
}

// --- WORLD & OBSTACLE GENERATION ---

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh, padding = 0) {
    return ax < bx + bw + padding &&
           ax + aw + padding > bx &&
           ay < by + bh + padding &&
           ay + ah + padding > by;
}

function isInsideBridgeCorridor(x, w) {
    const cx = x + w / 2;
    for (const b of bridges) {
        if (cx >= b.x + 8 && cx <= b.x + b.width - 8) {
            return true;
        }
    }
    return false;
}

function collidesWithEnvironment(x, y, w, h, ignoreRiver = false) {
    // World boundaries (inside natural hedge)
    const border = 14;
    if (x < border || y < border || x + w > WORLD_WIDTH - border || y + h > WORLD_HEIGHT - border) {
        return true;
    }

    // House collision (solid base of the house in background.png)
    if (rectsOverlap(x + 6, y + h * 0.5, w - 12, h * 0.45, house.x + 10, house.y + 40, house.width - 20, house.height - 50)) {
        return true;
    }

    // River collision: allow crossing seamlessly inside bridge horizontal corridor
    const footX = x + 8;
    const footW = w - 16;
    const footY = y + h - 14;
    const footH = 14;
    if (!ignoreRiver && rectsOverlap(footX, footY, footW, footH, 0, river.y, WORLD_WIDTH, river.height)) {
        if (!isInsideBridgeCorridor(x, w)) {
            return true;
        }
    }

    // Natural obstacles (rocks, trees, bushes)
    for (const obs of obstacles) {
        if (rectsOverlap(x + 6, y + h * 0.5, w - 12, h * 0.45, obs.hx, obs.hy, obs.hw, obs.hh)) {
            return true;
        }
    }

    return false;
}

function generateObstacles() {
    obstacles = [];
    const types = ['tree', 'tree', 'rock', 'bush'];
    let attempts = 0;

    while (obstacles.length < 36 && attempts < 450) {
        attempts++;
        const type = types[Math.floor(Math.random() * types.length)];
        const x = 50 + Math.random() * (WORLD_WIDTH - 150);
        const y = 50 + Math.random() * (WORLD_HEIGHT - 150);

        let w = 64, h = 80, hx = x + 16, hy = y + 48, hw = 32, hh = 26;
        if (type === 'rock') {
            w = 48; h = 38;
            hx = x + 6; hy = y + 12; hw = 36; hh = 22;
        } else if (type === 'bush') {
            w = 46; h = 40;
            hx = x + 6; hy = y + 14; hw = 34; hh = 22;
        }

        // Keep clear of the central clearing (background.png already has its own trees/rocks), river, and bridges
        if (rectsOverlap(x, y, w, h, clearing.x + 20, clearing.y + 20, clearing.width - 40, clearing.height - 40, 15)) continue;
        if (rectsOverlap(x, y, w, h, 0, river.y, WORLD_WIDTH, river.height, 30)) continue;
        if (bridges.some(b => rectsOverlap(x, y, w, h, b.x - 20, b.y - 60, b.width + 40, b.height + 120))) continue;
        if (obstacles.some(o => rectsOverlap(x, y, w, h, o.x, o.y, o.w, o.h, 24))) continue;

        obstacles.push({ type, x, y, w, h, hx, hy, hw, hh, swayOffset: Math.random() * Math.PI * 2 });
    }
}

function drawObstacles() {
    const time = Date.now() / 1000;
    obstacles.forEach(obs => {
        // Cull off-screen obstacles
        if (obs.x + obs.w < camera.x - 40 || obs.x > camera.x + SCREEN_WIDTH + 40 ||
            obs.y + obs.h < camera.y - 40 || obs.y > camera.y + SCREEN_HEIGHT + 40) {
            return;
        }

        ctx.save();
        if (obs.type === 'tree') {
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h - 6, 26, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            // Trunk
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(obs.x + obs.w / 2 - 7, obs.y + obs.h - 30, 14, 24);
            ctx.fillStyle = '#4e342e';
            ctx.fillRect(obs.x + obs.w / 2, obs.y + obs.h - 30, 7, 24);

            // Foliage layers with gentle wind sway
            const sway = Math.sin(time * 1.4 + obs.swayOffset) * 2.5;
            ctx.fillStyle = '#1e5631';
            ctx.beginPath();
            ctx.arc(obs.x + obs.w / 2 + sway * 0.5, obs.y + 38, 26, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#2e7d32';
            ctx.beginPath();
            ctx.arc(obs.x + obs.w / 2 - 10 + sway * 0.7, obs.y + 28, 18, 0, Math.PI * 2);
            ctx.arc(obs.x + obs.w / 2 + 12 + sway * 0.7, obs.y + 30, 17, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#43a047';
            ctx.beginPath();
            ctx.arc(obs.x + obs.w / 2 + sway, obs.y + 20, 16, 0, Math.PI * 2);
            ctx.fill();
        } else if (obs.type === 'rock') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h - 3, 22, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#636e72';
            ctx.beginPath();
            ctx.moveTo(obs.x + 6, obs.y + obs.h - 6);
            ctx.lineTo(obs.x + 10, obs.y + 10);
            ctx.lineTo(obs.x + 26, obs.y + 4);
            ctx.lineTo(obs.x + obs.w - 6, obs.y + 14);
            ctx.lineTo(obs.x + obs.w - 4, obs.y + obs.h - 6);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#95a5a6';
            ctx.beginPath();
            ctx.moveTo(obs.x + 12, obs.y + 12);
            ctx.lineTo(obs.x + 26, obs.y + 6);
            ctx.lineTo(obs.x + obs.w - 14, obs.y + 14);
            ctx.lineTo(obs.x + 24, obs.y + 20);
            ctx.closePath();
            ctx.fill();
        } else {
            // Bush
            ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h - 4, 20, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.arc(obs.x + 14, obs.y + 22, 13, 0, Math.PI * 2);
            ctx.arc(obs.x + 32, obs.y + 22, 13, 0, Math.PI * 2);
            ctx.arc(obs.x + 23, obs.y + 14, 14, 0, Math.PI * 2);
            ctx.fill();

            // Little berries
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(obs.x + 16, obs.y + 18, 2.5, 0, Math.PI * 2);
            ctx.arc(obs.x + 28, obs.y + 14, 2.5, 0, Math.PI * 2);
            ctx.arc(obs.x + 25, obs.y + 24, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
}

// --- GRAPHICS & ATMOSPHERE ---

// Dynamic Foliage across the entire world
let foliageItems = [];
function generateFoliage() {
    foliageItems = [];
    const types = ['grass', 'flower', 'pebble'];
    for (let i = 0; i < 240; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const x = 20 + Math.random() * (WORLD_WIDTH - 40);
        const y = 20 + Math.random() * (WORLD_HEIGHT - 40);

        if (rectsOverlap(x, y, 10, 10, house.x, house.y, house.width, house.height, 10)) continue;
        if (rectsOverlap(x, y, 10, 10, coop.x, coop.y, coop.width, coop.height, 10)) continue;
        if (rectsOverlap(x, y, 10, 10, 0, river.y, WORLD_WIDTH, river.height, 10)) continue;

        let color;
        let size = 3 + Math.random() * 5;
        if (type === 'grass') {
            color = `hsl(${110 + Math.random() * 30}, ${60 + Math.random() * 20}%, ${30 + Math.random() * 20}%)`;
            size = 4 + Math.random() * 6;
        } else if (type === 'flower') {
            const flowerColors = ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#ffffff'];
            color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
            size = 3 + Math.random() * 3;
        } else {
            color = `hsl(0, 0%, ${50 + Math.random() * 20}%)`;
            size = 2 + Math.random() * 4;
        }
        foliageItems.push({ type, x, y, size, color, sway: Math.random() * Math.PI * 2 });
    }
}

function drawFoliage() {
    const time = Date.now() / 1000;
    foliageItems.forEach(item => {
        if (item.x < camera.x - 20 || item.x > camera.x + SCREEN_WIDTH + 20 ||
            item.y < camera.y - 20 || item.y > camera.y + SCREEN_HEIGHT + 20) {
            return;
        }

        ctx.save();
        if (item.type === 'grass') {
            const sway = Math.sin(time * 1.5 + item.sway) * 2;
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.moveTo(item.x, item.y);
            ctx.lineTo(item.x - item.size / 3, item.y - item.size);
            ctx.lineTo(item.x + sway, item.y - item.size * 1.5);
            ctx.lineTo(item.x + item.size / 3, item.y - item.size);
            ctx.closePath();
            ctx.fill();
        } else if (item.type === 'flower') {
            ctx.strokeStyle = '#2d8a4e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(item.x, item.y);
            ctx.lineTo(item.x, item.y - item.size * 2);
            ctx.stroke();

            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(item.x, item.y - item.size * 2, item.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffd93d';
            ctx.beginPath();
            ctx.arc(item.x, item.y - item.size * 2, item.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.ellipse(item.x, item.y, item.size, item.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
}

function drawWorldTerrain() {
    // Rich forest meadow background matching background.png palette
    const bgGrad = ctx.createRadialGradient(
        clearing.x + clearing.width / 2, clearing.y + clearing.height / 2, 300,
        WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 1100
    );
    bgGrad.addColorStop(0, '#2a6f33');
    bgGrad.addColorStop(0.6, '#21592b');
    bgGrad.addColorStop(1, '#163d1e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(camera.x, camera.y, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Subtle meadow patches outside clearing for organic texture
    ctx.save();
    ctx.fillStyle = 'rgba(56, 142, 60, 0.22)';
    for (let px = 80; px < WORLD_WIDTH; px += 190) {
        for (let py = 80; py < WORLD_HEIGHT; py += 170) {
            if (rectsOverlap(px, py, 90, 60, clearing.x, clearing.y, clearing.width, clearing.height)) continue;
            ctx.beginPath();
            ctx.ellipse(px + ((py * 13) % 40), py + ((px * 7) % 30), 55, 32, 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    // Extended dirt paths connecting background.png exits to the bridges & southern woods
    ctx.save();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 48;
    ctx.beginPath();
    // South exit from background.png -> West Bridge -> South forest
    ctx.moveTo(clearing.x + 158, clearing.y + clearing.height - 25);
    ctx.quadraticCurveTo(555, 690, bridges[0].x + bridges[0].width / 2, river.y);
    ctx.moveTo(bridges[0].x + bridges[0].width / 2, river.y + river.height);
    ctx.quadraticCurveTo(530, 980, 420, 1130);
    // East exit from background.png -> East Bridge -> South-East forest
    ctx.moveTo(clearing.x + clearing.width - 25, clearing.y + 372);
    ctx.quadraticCurveTo(1180, 420, bridges[1].x + bridges[1].width / 2, river.y);
    ctx.moveTo(bridges[1].x + bridges[1].width / 2, river.y + river.height);
    ctx.quadraticCurveTo(1210, 980, 1340, 1120);
    ctx.stroke();

    // Lighter inner path highlight
    ctx.strokeStyle = '#a0724d';
    ctx.lineWidth = 30;
    ctx.stroke();
    ctx.restore();

    // Central clearing (background.png with house & coop)
    if (bgImg && bgImg.complete && bgImg.naturalWidth !== 0) {
        ctx.drawImage(bgImg, clearing.x, clearing.y, clearing.width, clearing.height);

        // Soft feathered edge blend so background.png integrates seamlessly into the forest
        const feather = 48;
        ctx.save();
        // Top fade
        let gTop = ctx.createLinearGradient(0, clearing.y, 0, clearing.y + feather);
        gTop.addColorStop(0, '#225b2b');
        gTop.addColorStop(1, 'rgba(34, 91, 43, 0)');
        ctx.fillStyle = gTop;
        ctx.fillRect(clearing.x, clearing.y, clearing.width, feather);

        // Bottom fade (skip around south path exit)
        let gBot = ctx.createLinearGradient(0, clearing.y + clearing.height - feather, 0, clearing.y + clearing.height);
        gBot.addColorStop(0, 'rgba(34, 91, 43, 0)');
        gBot.addColorStop(1, '#235e2c');
        ctx.fillStyle = gBot;
        ctx.fillRect(clearing.x, clearing.y + clearing.height - feather, 115, feather);
        ctx.fillRect(clearing.x + 205, clearing.y + clearing.height - feather, clearing.width - 205, feather);

        // Left fade
        let gLeft = ctx.createLinearGradient(clearing.x, 0, clearing.x + feather, 0);
        gLeft.addColorStop(0, '#225b2b');
        gLeft.addColorStop(1, 'rgba(34, 91, 43, 0)');
        ctx.fillStyle = gLeft;
        ctx.fillRect(clearing.x, clearing.y, feather, clearing.height);

        // Right fade (skip around east path exit)
        let gRight = ctx.createLinearGradient(clearing.x + clearing.width - feather, 0, clearing.x + clearing.width, 0);
        gRight.addColorStop(0, 'rgba(34, 91, 43, 0)');
        gRight.addColorStop(1, '#235e2c');
        ctx.fillStyle = gRight;
        ctx.fillRect(clearing.x + clearing.width - feather, clearing.y, feather, 330);
        ctx.fillRect(clearing.x + clearing.width - feather, clearing.y + 415, feather, clearing.height - 415);
        ctx.restore();
    }

    // Animated River
    const time = Date.now() / 1000;
    ctx.save();
    // Riverbanks
    ctx.fillStyle = '#8c7a5b';
    ctx.fillRect(0, river.y - 6, WORLD_WIDTH, river.height + 12);

    // Water gradient
    const waterGrad = ctx.createLinearGradient(0, river.y, 0, river.y + river.height);
    waterGrad.addColorStop(0, '#1e88e5');
    waterGrad.addColorStop(0.5, '#29b6f6');
    waterGrad.addColorStop(1, '#1565c0');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, river.y, WORLD_WIDTH, river.height);

    // Flowing water ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let wx = ((time * 45) % 120) - 120; wx < WORLD_WIDTH; wx += 120) {
        ctx.beginPath();
        ctx.moveTo(wx, river.y + 20);
        ctx.quadraticCurveTo(wx + 25, river.y + 14, wx + 50, river.y + 20);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(wx + 55, river.y + 48);
        ctx.quadraticCurveTo(wx + 80, river.y + 54, wx + 105, river.y + 48);
        ctx.stroke();
    }
    ctx.restore();

    // Wooden Bridges
    bridges.forEach(b => {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(b.x + 4, b.y + 6, b.width, b.height);

        // Planks
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 2;
        for (let py = b.y + 10; py < b.y + b.height; py += 12) {
            ctx.beginPath();
            ctx.moveTo(b.x, py);
            ctx.lineTo(b.x + b.width, py);
            ctx.stroke();
        }
        // Side rails
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(b.x - 4, b.y, 8, b.height);
        ctx.fillRect(b.x + b.width - 4, b.y, 8, b.height);
        ctx.restore();
    });
}

// Shadow system
function drawShadow(x, y, width, height, opacity = 0.25) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height - 2, width * 0.45, height * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawBuildingShadow(x, y, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height - 4, width * 0.52, height * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Footprints behind player & foxes
class Footprint {
    constructor(x, y, angle = 0) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.life = 45;
        this.maxLife = 45;
    }
    update() {
        this.life--;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = (this.life / this.maxLife) * 0.35;
        ctx.fillStyle = '#2d3436';
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Weather particles (floating forest leaves & pollen in screen space)
function initWeather() {
    weatherParticles = [];
    for (let i = 0; i < 28; i++) {
        weatherParticles.push({
            x: Math.random() * SCREEN_WIDTH,
            y: Math.random() * SCREEN_HEIGHT,
            size: 2 + Math.random() * 3.5,
            speedX: 0.3 + Math.random() * 0.6,
            speedY: 0.4 + Math.random() * 0.5,
            sway: Math.random() * Math.PI * 2,
            isLeaf: Math.random() < 0.35,
            color: Math.random() < 0.5 ? '#a8e6cf' : '#ffd3b6'
        });
    }
}

function updateAndDrawWeather() {
    const time = Date.now() / 1000;
    ctx.save();
    weatherParticles.forEach(p => {
        p.x += p.speedX + Math.sin(time + p.sway) * 0.3;
        p.y += p.speedY;
        if (p.x > SCREEN_WIDTH + 10) p.x = -10;
        if (p.y > SCREEN_HEIGHT + 10) {
            p.y = -10;
            p.x = Math.random() * SCREEN_WIDTH;
        }

        if (p.isLeaf) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(time * 1.5 + p.sway);
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 1.4, p.size * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#fff9c4';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.restore();
}

// Chimney smoke particles
let smokeParticles = [];
class SmokeParticle {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = clearing.x + 338 + (Math.random() - 0.5) * 6;
        this.y = clearing.y + 45;
        this.size = 4 + Math.random() * 3;
        this.alpha = 0.4 + Math.random() * 0.2;
        this.dx = (Math.random() - 0.5) * 0.3;
        this.dy = -0.35 - Math.random() * 0.4;
        this.life = 80 + Math.random() * 40;
        this.maxLife = this.life;
    }
    update() {
        this.x += this.dx + Math.sin(Date.now() / 500 + this.life) * 0.15;
        this.y += this.dy;
        this.size += 0.06;
        this.life--;
        this.alpha = (this.life / this.maxLife) * 0.35;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#dfe6e9';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function updateAndDrawSmoke() {
    if (Math.random() < 0.15) {
        smokeParticles.push(new SmokeParticle());
    }
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        smokeParticles[i].update();
        smokeParticles[i].draw();
        if (smokeParticles[i].life <= 0) smokeParticles.splice(i, 1);
    }
}

// Coop glow
function drawCoopGlow() {
    const time = Date.now() / 1000;
    const pulse = 0.5 + Math.sin(time * 2) * 0.15;
    ctx.save();
    const gradient = ctx.createRadialGradient(
        coop.x + coop.width / 2, coop.y + coop.height / 2, 10,
        coop.x + coop.width / 2, coop.y + coop.height / 2, coop.width * 0.9
    );
    gradient.addColorStop(0, `rgba(255, 215, 0, ${pulse * 0.32})`);
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(coop.x + coop.width / 2, coop.y + coop.height / 2, coop.width * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Cloud shadows (parallax across the world)
let cloudShadows = [];
function generateCloudShadows() {
    cloudShadows = [];
    for (let i = 0; i < 8; i++) {
        cloudShadows.push({
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * WORLD_HEIGHT,
            width: 140 + Math.random() * 180,
            height: 70 + Math.random() * 50,
            speed: 0.2 + Math.random() * 0.25
        });
    }
}

function drawCloudShadows() {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    cloudShadows.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x > WORLD_WIDTH + cloud.width) {
            cloud.x = -cloud.width;
            cloud.y = Math.random() * WORLD_HEIGHT;
        }
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

// Natural border (hedge around WORLD_WIDTH x WORLD_HEIGHT)
function drawBorder() {
    ctx.save();
    const borderWidth = 14;
    const startX = Math.max(0, Math.floor(camera.x / 8) * 8);
    const endX = Math.min(WORLD_WIDTH, camera.x + SCREEN_WIDTH + 8);
    const startY = Math.max(0, Math.floor(camera.y / 8) * 8);
    const endY = Math.min(WORLD_HEIGHT, camera.y + SCREEN_HEIGHT + 8);

    if (camera.y < 30) {
        for (let i = startX; i < endX; i += 8) {
            const topH = borderWidth + Math.sin(i * 0.15) * 3;
            ctx.fillStyle = `hsl(${120 + Math.sin(i * 0.1) * 10}, 50%, ${25 + Math.sin(i * 0.2) * 5}%)`;
            ctx.fillRect(i, 0, 8, topH);
        }
    }
    if (camera.y + SCREEN_HEIGHT > WORLD_HEIGHT - 30) {
        for (let i = startX; i < endX; i += 8) {
            const botH = borderWidth + Math.cos(i * 0.12) * 3;
            ctx.fillStyle = `hsl(${120 + Math.cos(i * 0.1) * 10}, 50%, ${25 + Math.cos(i * 0.2) * 5}%)`;
            ctx.fillRect(i, WORLD_HEIGHT - botH, 8, botH);
        }
    }
    if (camera.x < 30) {
        for (let j = startY; j < endY; j += 8) {
            const leftW = borderWidth + Math.sin(j * 0.15) * 3;
            ctx.fillStyle = `hsl(${120 + Math.sin(j * 0.1) * 10}, 50%, ${25 + Math.sin(j * 0.2) * 5}%)`;
            ctx.fillRect(0, j, leftW, 8);
        }
    }
    if (camera.x + SCREEN_WIDTH > WORLD_WIDTH - 30) {
        for (let j = startY; j < endY; j += 8) {
            const rightW = borderWidth + Math.cos(j * 0.12) * 3;
            ctx.fillStyle = `hsl(${120 + Math.cos(j * 0.1) * 10}, 50%, ${25 + Math.cos(j * 0.2) * 5}%)`;
            ctx.fillRect(WORLD_WIDTH - rightW, j, rightW, 8);
        }
    }
    ctx.restore();
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.dx = Math.cos(angle) * speed;
        this.dy = Math.sin(angle) * speed;
        this.life = 100;
        this.maxLife = 100;
        this.alpha = 1;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.dy += 0.1;
        this.life--;
        this.alpha = this.life / this.maxLife;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 60;
        this.dy = -1;
    }
    update() {
        this.y += this.dy;
        this.life--;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / 60);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px Outfit';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

function spawnCaptureParticles(x, y) {
    for (let i = 0; i < 12; i++) {
        const p = new Particle(x, y, '#FFD700');
        p.life = 30;
        p.maxLife = 30;
        particles.push(p);
    }
}

function spawnFirework() {
    const x = camera.x + Math.random() * SCREEN_WIDTH;
    const y = camera.y + Math.random() * (SCREEN_HEIGHT / 2);
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    for (let i = 0; i < 50; i++) {
        particles.push(new Particle(x, y, color));
    }
}

class Animal {
    constructor(type = 'rabbit') {
        this.type = type;
        if (type === 'golden') {
            this.points = 10;
        } else {
            this.points = (type === 'chicken') ? 2 : 1;
        }
        this.lifeTime = (type === 'golden') ? 450 : -1; // 7.5s for golden on larger map
        this.removed = false;
        this.animPhase = Math.random() * Math.PI * 2;
        this.reset();
    }

    reset() {
        this.width = 40;
        this.height = 40;

        // Find a valid spawn position not colliding with obstacles or river
        let attempts = 0;
        do {
            this.x = 60 + Math.random() * (WORLD_WIDTH - 120);
            this.y = 60 + Math.random() * (WORLD_HEIGHT - 120);
            attempts++;
        } while (
            attempts < 40 &&
            (collidesWithEnvironment(this.x, this.y, this.width, this.height) ||
             rectsOverlap(this.x, this.y, this.width, this.height, coop.x, coop.y, coop.width, coop.height, 40))
        );

        if (this.type === 'golden') {
            this.speed = 3.2;
        } else {
            this.speed = (this.type === 'chicken') ? 1.0 : 0.85;
        }

        const angle = Math.random() * Math.PI * 2;
        this.dx = Math.cos(angle) * this.speed;
        this.dy = Math.sin(angle) * this.speed;
        this.changeDirTimer = 0;
        this.captured = false;
        this.fleeing = false;
    }

    update() {
        if (this.captured) {
            const speed = 0.5;
            this.changeDirTimer++;
            if (this.changeDirTimer > 100 + Math.random() * 100) {
                const angle = Math.random() * Math.PI * 2;
                this.dx = Math.cos(angle) * speed;
                this.dy = Math.sin(angle) * speed;
                this.changeDirTimer = 0;
            }

            this.x += this.dx;
            this.y += this.dy;

            const margin = 8;
            if (this.x < coop.x + margin) { this.x = coop.x + margin; this.dx = Math.abs(this.dx); }
            if (this.x + this.width > coop.x + coop.width - margin) { this.x = coop.x + coop.width - this.width - margin; this.dx = -Math.abs(this.dx); }
            if (this.y < coop.y + margin) { this.y = coop.y + margin; this.dy = Math.abs(this.dy); }
            if (this.y + this.height > coop.y + coop.height - margin) { this.y = coop.y + coop.height - this.height - margin; this.dy = -Math.abs(this.dy); }
            return;
        }

        // Golden Chicken Logic + sparkle trail
        if (this.type === 'golden') {
            this.lifeTime--;
            if (Math.random() < 0.35) {
                const spark = new Particle(this.x + 20, this.y + 20, '#ffd700');
                spark.dx *= 0.3;
                spark.dy *= 0.3;
                spark.life = 20;
                spark.maxLife = 20;
                particles.push(spark);
            }
            if (this.lifeTime <= 0) {
                spawnCaptureParticles(this.x, this.y);
                this.removed = true;
                return;
            }
        }

        // Calculate distance to player
        const dx = (this.x + this.width / 2) - (player.x + player.width / 2);
        const dy = (this.y + this.height / 2) - (player.y + player.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 160) {
            this.fleeing = true;
            const angle = Math.atan2(dy, dx);
            this.dx = Math.cos(angle) * this.speed * 2.4;
            this.dy = Math.sin(angle) * this.speed * 2.4;
            this.changeDirTimer = 0;
        } else {
            this.fleeing = false;
            this.changeDirTimer++;
            if (this.changeDirTimer > 60 + Math.random() * 60) {
                const angle = Math.random() * Math.PI * 2;
                this.dx = Math.cos(angle) * this.speed;
                this.dy = Math.sin(angle) * this.speed;
                this.changeDirTimer = 0;
            }
        }

        // Move with obstacle & river avoidance (slide/bounce)
        const nextX = this.x + this.dx;
        if (!collidesWithEnvironment(nextX, this.y, this.width, this.height)) {
            this.x = nextX;
        } else {
            this.dx = -this.dx;
        }

        const nextY = this.y + this.dy;
        if (!collidesWithEnvironment(this.x, nextY, this.width, this.height)) {
            this.y = nextY;
        } else {
            this.dy = -this.dy;
        }
    }

    draw() {
        let img = animalImg;
        if (this.type === 'chicken') img = chickenImg;
        if (this.type === 'golden') img = goldenImg;

        const size = this.captured ? 32 : 48;
        const t = Date.now() / 1000 + this.animPhase;
        const flipX = this.dx < 0;

        let offsetY = 0;
        let rot = 0;
        let scaleX = 1;
        let scaleY = 1;

        if (!this.captured) {
            if (this.type === 'rabbit') {
                // Hopping cycle
                const hop = Math.abs(Math.sin(t * (this.fleeing ? 9 : 4.5)));
                offsetY = -hop * (this.fleeing ? 10 : 6);
                scaleY = 0.9 + hop * 0.2;
                scaleX = 1.1 - hop * 0.15;
            } else {
                // Chicken pecking / fluttering
                if (this.fleeing) {
                    offsetY = Math.sin(t * 14) * 4;
                    rot = Math.sin(t * 14) * 0.14;
                } else {
                    const peck = Math.sin(t * 3);
                    if (peck > 0.7) {
                        rot = (flipX ? -1 : 1) * 0.25;
                        offsetY = 3;
                    } else {
                        offsetY = Math.sin(t * 6) * 2;
                    }
                }
            }
        }

        ctx.save();
        if (this.type === 'golden' && !this.captured) {
            const glow = 12 + Math.sin(t * 6) * 6;
            ctx.shadowBlur = glow;
            ctx.shadowColor = '#ffd700';
        }
        safeDrawAnimatedImage(img, this.x, this.y + offsetY, size, size, flipX, rot, scaleX, scaleY);
        ctx.restore();
    }
}

class Fox {
    constructor() {
        // Start at random edge of the world
        if (Math.random() < 0.5) {
            this.x = (Math.random() < 0.5) ? -50 : WORLD_WIDTH + 50;
            this.y = Math.random() * WORLD_HEIGHT;
        } else {
            this.x = Math.random() * WORLD_WIDTH;
            this.y = (Math.random() < 0.5) ? -50 : WORLD_HEIGHT + 50;
        }

        this.width = 50;
        this.height = 50;
        this.speed = 0.95;
        this.state = 'hunting';
        this.movingLeft = false;
        this.distToCoop = 999;
    }

    update() {
        if (this.state === 'hunting') {
            const dx = coop.x + coop.width / 2 - this.x;
            const dy = coop.y + coop.height / 2 - this.y;
            this.distToCoop = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            const stepX = Math.cos(angle) * this.speed;
            const stepY = Math.sin(angle) * this.speed;
            this.movingLeft = stepX < 0;

            // Simple obstacle avoidance (foxes can swim/jump river if needed, only avoid rocks/trees)
            const nextX = this.x + stepX;
            if (!collidesWithEnvironment(nextX, this.y, this.width, this.height, true)) {
                this.x = nextX;
            } else {
                this.y += (stepY >= 0 ? 1 : -1) * this.speed;
            }

            const nextY = this.y + stepY;
            if (!collidesWithEnvironment(this.x, nextY, this.width, this.height, true)) {
                this.y = nextY;
            } else {
                this.x += (stepX >= 0 ? 1 : -1) * this.speed;
            }

            // Player scares fox
            if (rectsOverlap(player.x, player.y, player.width, player.height, this.x, this.y, this.width, this.height)) {
                this.state = 'fleeing';
            }

            // Steal chicken from coop
            if (this.distToCoop < 55) {
                if (score > 0) {
                    score = Math.max(0, score - 2);
                    floatingTexts.push(new FloatingText(this.x, this.y, "-2", "#ff4757"));
                    triggerShake();
                }
                this.state = 'fleeing';
            }
        } else if (this.state === 'fleeing') {
            const dx = this.x - (coop.x + coop.width / 2);
            const dy = this.y - (coop.y + coop.height / 2);
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * (this.speed * 2.1);
            this.y += Math.sin(angle) * (this.speed * 2.1);
            this.movingLeft = Math.cos(angle) < 0;
        }
    }

    draw() {
        const t = Date.now() / 120;
        const bob = Math.sin(t) * 4;
        const rot = Math.sin(t) * 0.08;
        safeDrawAnimatedImage(foxImg, this.x, this.y + bob, this.width, this.height, this.movingLeft, rot, 1.04, 0.96);

        // Glowing red eyes when hunting near the coop
        if (this.state === 'hunting' && this.distToCoop < 300) {
            ctx.save();
            const eyeX = this.x + (this.movingLeft ? 13 : 33);
            const eyeY = this.y + bob + 16;
            ctx.fillStyle = '#ff2e2e';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0000';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, 2.5, 0, Math.PI * 2);
            ctx.arc(eyeX + (this.movingLeft ? 5 : -5), eyeY, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

// Sound effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playCaptureSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function playFoxSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function playGoldenSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(800 + i * 200, audioCtx.currentTime + i * 0.05);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2 + i * 0.05);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2 + i * 0.05);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + i * 0.05); osc.stop(audioCtx.currentTime + 0.2 + i * 0.05);
    }
}

function playBarkSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const sound = dogBarkAudio.cloneNode();
    sound.volume = 0.3;
    sound.play().catch(e => console.error("Error playing bark sound:", e));
}

function playChickenSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const sound = chickenAudio.cloneNode();
    sound.volume = 0.35;
    sound.play().catch(e => console.error("Error playing chicken sound:", e));
}

function playCountdownSound(isGo = false) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

class Dog {
    constructor() {
        this.x = player.x - 30;
        this.y = player.y + 10;
        this.width = 32;
        this.height = 32;
        this.barkCooldown = 0;
        this.facingLeft = false;
        this.isMoving = false;
    }
    update() {
        const targetX = player.x - 24;
        const targetY = player.y + 12;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 6) {
            this.isMoving = true;
            this.x += dx * 0.1;
            this.y += dy * 0.1;
            if (dx < -0.5) this.facingLeft = true;
            else if (dx > 0.5) this.facingLeft = false;
        } else {
            this.isMoving = false;
        }

        if (this.barkCooldown > 0) this.barkCooldown--;

        foxes.forEach(fox => {
            if (fox.state === 'hunting') {
                const fdx = fox.x - this.x;
                const fdy = fox.y - this.y;
                const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
                if (fdist < 110 && this.barkCooldown === 0) {
                    fox.state = 'fleeing';
                    playBarkSound();
                    floatingTexts.push(new FloatingText(this.x, this.y - 20, "WOUF!", "#ffffff"));
                    this.barkCooldown = 120;
                }
            }
        });
    }
    draw() {
        const bob = this.isMoving ? Math.abs(Math.sin(Date.now() / 90)) * -4 : 0;
        if (dogImg.complete && dogImg.naturalWidth !== 0) {
            safeDrawAnimatedImage(dogImg, this.x, this.y + bob, this.width, this.height, this.facingLeft);
        } else {
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(this.x + 16, this.y + 16 + bob, 12, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class PowerUp {
    constructor() {
        let attempts = 0;
        do {
            this.x = 80 + Math.random() * (WORLD_WIDTH - 160);
            this.y = 80 + Math.random() * (WORLD_HEIGHT - 160);
            attempts++;
        } while (attempts < 30 && collidesWithEnvironment(this.x, this.y, 30, 30));
        this.width = 30;
        this.height = 30;
        this.life = 700;
    }
    draw() {
        this.life--;
        ctx.save();
        const pulse = Math.sin(Date.now() / 100) * 4;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'yellow';
        ctx.fillStyle = '#fffa65';
        ctx.beginPath();
        ctx.moveTo(this.x + 15, this.y + pulse);
        ctx.lineTo(this.x + 5, this.y + 15 + pulse);
        ctx.lineTo(this.x + 15, this.y + 15 + pulse);
        ctx.lineTo(this.x + 10, this.y + 30 + pulse);
        ctx.lineTo(this.x + 25, this.y + 10 + pulse);
        ctx.lineTo(this.x + 15, this.y + 10 + pulse);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// Animals array
let animals = [];
function spawnAnimals(count) {
    for (let i = 0; i < count; i++) {
        const type = (Math.random() > 0.45) ? 'chicken' : 'rabbit';
        animals.push(new Animal(type));
    }
}

// High Score Logic
function getHighScores() {
    const scores = localStorage.getItem('forestGameScores');
    return scores ? JSON.parse(scores) : [];
}

function saveHighScore() {
    const scores = getHighScores();
    scores.push({
        name: playerName,
        time: (elapsedTime / 1000).toFixed(1),
        date: new Date().toLocaleDateString()
    });
    scores.sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
    localStorage.setItem('forestGameScores', JSON.stringify(scores.slice(0, 10)));
    displayHighScores();
}

function displayHighScores() {
    const scores = getHighScores();
    const containers = [document.getElementById('high-scores'), document.getElementById('victory-high-scores')];

    containers.forEach(container => {
        if (!container) return;

        if (scores.length === 0) {
            container.innerHTML = "<p>Aucun record pour le moment</p>";
            return;
        }

        let html = "<strong>🏆 Top 10 des Meilleurs Temps</strong><ul style='list-style:none; padding:0; margin: 10px 0;'>";
        scores.forEach((s, index) => {
            let medal = "";
            if (index === 0) medal = "🥇 ";
            else if (index === 1) medal = "🥈 ";
            else if (index === 2) medal = "🥉 ";
            else medal = `${index + 1}. `;

            html += `<li style="padding: 3px 0; border-bottom: 1px dotted rgba(255,255,255,0.1); display: flex; align-items: center;">
                <span style="display:inline-block; width: 30px;">${medal}</span>
                <strong style="color: #ffd700; margin-right: 5px;">${s.name}</strong> : ${s.time}s
            </li>`;
        });
        html += "</ul>";
        if (container.id === 'high-scores') {
            html += "<button onclick='resetHighScores()' style='font-size: 0.7em; background: #eb4d4b; padding: 5px 10px; margin-top: 10px;'>Effacer les scores 🗑️</button>";
        }
        container.innerHTML = html;
    });
}

function resetHighScores() {
    if (confirm("Voulez-vous vraiment effacer tous les records ?")) {
        localStorage.removeItem('forestGameScores');
        displayHighScores();
    }
}

// Menu Navigation
function returnToMenu() {
    isPlaying = false;
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('victory-screen').classList.add('hidden');
    displayHighScores();
    hudElement.classList.add('hidden');
    mainTitle.classList.remove('hidden');
}

function showVictoryScreen() {
    document.getElementById('victory-title').innerText = "BRAVO " + playerName.toUpperCase() + " !";
    document.getElementById('victory-msg').innerText = "Temps record : " + (elapsedTime / 1000).toFixed(1) + " secondes.";
    document.getElementById('victory-screen').classList.remove('hidden');
    displayHighScores();
}

// Start Game Logic
function startGame() {
    const input = document.getElementById('player-name-input');
    if (input && input.value.trim() !== "") {
        playerName = input.value.trim();
        localStorage.setItem('forestGamePlayerName', playerName);
    }
    document.getElementById('start-screen').classList.add('hidden');
    startCountdown();
}

function startCountdown() {
    isPlaying = false;
    isPaused = false;
    isCountingDown = true;
    countdown = 3;
    countdownTimer = Date.now();
    screenFade = 1.0;
    playCountdownSound(false);
    resetGame(false);

    hudElement.classList.remove('hidden');
    mainTitle.classList.add('hidden');
    hudPlayerName.innerText = playerName;
}

// Reset game logic
function resetGame(shouldStart = true) {
    score = 0;
    gameWon = false;
    isPaused = false;
    pauseStartTime = 0;
    particles = [];
    foxes = [];
    floatingTexts = [];
    footprints = [];
    powerups = [];
    speedBoostTimer = 0;
    player.speed = normalSpeed;
    player.facingLeft = false;
    player.isMoving = false;
    player.walkTimer = 0;

    document.getElementById('victory-screen').classList.add('hidden');

    if (shouldStart) {
        isPlaying = true;
        startTime = Date.now();
        elapsedTime = 0;
    } else {
        isPlaying = false;
        startTime = 0;
        elapsedTime = 0;
    }

    // Player starts near house
    player.x = house.x + house.width / 2 - player.width / 2;
    player.y = house.y + house.height + 10;

    // Snap camera immediately on player at start
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - SCREEN_WIDTH, player.x + player.width / 2 - SCREEN_WIDTH / 2));
    camera.y = Math.max(0, Math.min(WORLD_HEIGHT - SCREEN_HEIGHT, player.y + player.height / 2 - SCREEN_HEIGHT / 2));

    dog = new Dog();

    generateObstacles();
    generateFoliage();
    generateCloudShadows();
    initWeather();
    smokeParticles = [];

    animals = [];
    spawnAnimals(12); // More animals across the expanded 1600x1200 world
}

// Pause handling
let pauseStartTime = 0;
function togglePause() {
    if (!isPlaying || gameWon || isCountingDown) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseStartTime = Date.now();
    } else if (pauseStartTime > 0) {
        startTime += (Date.now() - pauseStartTime);
        pauseStartTime = 0;
    }
}

// Input handling
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Helper to safely draw animated images (flip + rotation + squash & stretch)
function safeDrawAnimatedImage(img, x, y, w, h, flipX = false, rotation = 0, scaleX = 1, scaleY = 1) {
    if (img && img.complete && img.naturalWidth !== 0) {
        try {
            ctx.save();
            ctx.translate(x + w / 2, y + h / 2);
            if (rotation !== 0) ctx.rotate(rotation);
            ctx.scale(flipX ? -scaleX : scaleX, scaleY);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        } catch (e) {
            console.error("Error drawing image:", img.src, e);
            ctx.fillStyle = 'magenta';
            ctx.fillRect(x, y, w, h);
        }
    } else {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.fillRect(x, y, w, h);
    }
}

// Gamepad Support
function handleGamepad() {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (!gp) {
        gamepadState = {};
        return;
    }

    const threshold = 0.25;
    gamepadState['ArrowLeft'] = gp.axes[0] < -threshold;
    gamepadState['ArrowRight'] = gp.axes[0] > threshold;
    gamepadState['ArrowUp'] = gp.axes[1] < -threshold;
    gamepadState['ArrowDown'] = gp.axes[1] > threshold;

    if (gp.buttons[0] && gp.buttons[0].pressed) {
        if (!isPlaying && !gameWon) startGame();
        else if (gameWon) startCountdown();
    }
}

function updateCamera() {
    const targetCamX = Math.max(0, Math.min(WORLD_WIDTH - SCREEN_WIDTH, player.x + player.width / 2 - SCREEN_WIDTH / 2));
    const targetCamY = Math.max(0, Math.min(WORLD_HEIGHT - SCREEN_HEIGHT, player.y + player.height / 2 - SCREEN_HEIGHT / 2));
    camera.x += (targetCamX - camera.x) * 0.12;
    camera.y += (targetCamY - camera.y) * 0.12;
}

function update() {
    if (screenFade > 0) {
        screenFade = Math.max(0, screenFade - 0.04);
    }

    if (isCountingDown) {
        const now = Date.now();
        if (now - countdownTimer >= 1000) {
            countdown--;
            countdownTimer = now;
            if (countdown > 0) {
                playCountdownSound(false);
            } else {
                playCountdownSound(true);
                isCountingDown = false;
                isPlaying = true;
                startTime = Date.now();
            }
        }
        handleGamepad();
        updateCamera();
        return;
    }

    if (!isPlaying) {
        handleGamepad();
        return;
    }

    if (isPaused) {
        handleGamepad();
        return;
    }

    handleGamepad();
    if (dog) dog.update();

    if (!gameWon) {
        elapsedTime = Date.now() - startTime;
    }

    if (Math.random() < 0.008 && foxes.length < 3) {
        foxes.push(new Fox());
        playFoxSound();
    }

    if (Math.random() < 0.0014) {
        animals.push(new Animal('golden'));
        playGoldenSound();
    }

    if (Math.random() < 0.0025 && powerups.length < 2) {
        powerups.push(new PowerUp());
    }

    if (speedBoostTimer > 0) {
        speedBoostTimer--;
        if (speedBoostTimer <= 0) {
            player.speed = normalSpeed;
        }
    }

    for (let i = foxes.length - 1; i >= 0; i--) {
        foxes[i].update();
        if (foxes[i].x < -120 || foxes[i].x > WORLD_WIDTH + 120 ||
            foxes[i].y < -120 || foxes[i].y > WORLD_HEIGHT + 120) {
            foxes.splice(i, 1);
        }
    }

    const activeAnimals = animals.filter(a => !a.captured).length;
    if (activeAnimals <= 5) {
        spawnAnimals(4 + Math.floor(Math.random() * 3));
    }

    // Directional inputs (Arrows + ZQSD / WASD + Gamepad)
    const up = keys['ArrowUp'] || keys['KeyW'] || keys['KeyZ'] || gamepadState['ArrowUp'];
    const down = keys['ArrowDown'] || keys['KeyS'] || gamepadState['ArrowDown'];
    const left = keys['ArrowLeft'] || keys['KeyA'] || keys['KeyQ'] || gamepadState['ArrowLeft'];
    const right = keys['ArrowRight'] || keys['KeyD'] || gamepadState['ArrowRight'];

    let moveX = 0;
    let moveY = 0;
    if (up) moveY -= 1;
    if (down) moveY += 1;
    if (left) moveX -= 1;
    if (right) moveX += 1;

    player.isMoving = (moveX !== 0 || moveY !== 0);

    if (moveX !== 0 && moveY !== 0) {
        const inv = 1 / Math.SQRT2;
        moveX *= inv;
        moveY *= inv;
    }

    if (player.isMoving) {
        player.walkTimer += 0.25;
        player.stepTimer++;
        if (player.stepTimer >= 10) {
            player.stepTimer = 0;
            const footSide = (Math.floor(player.walkTimer) % 2 === 0) ? -5 : 5;
            footprints.push(new Footprint(
                player.x + player.width / 2 + footSide,
                player.y + player.height - 4,
                Math.atan2(moveY, moveX)
            ));
        }

        const nextX = player.x + moveX * player.speed;
        if (!collidesWithEnvironment(nextX, player.y, player.width, player.height)) {
            player.x = nextX;
        }
        const nextY = player.y + moveY * player.speed;
        if (!collidesWithEnvironment(player.x, nextY, player.width, player.height)) {
            player.y = nextY;
        }
    } else {
        player.walkTimer = 0;
    }

    if (moveX < -0.1) player.facingLeft = true;
    else if (moveX > 0.1) player.facingLeft = false;

    updateCamera();

    // Update footprints
    for (let i = footprints.length - 1; i >= 0; i--) {
        footprints[i].update();
        if (footprints[i].life <= 0) footprints.splice(i, 1);
    }

    // Powerups collision
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        if (p.life <= 0) { powerups.splice(i, 1); continue; }
        if (rectsOverlap(player.x, player.y, player.width, player.height, p.x, p.y, p.width, p.height)) {
            speedBoostTimer = 300;
            player.speed = boostedSpeed;
            floatingTexts.push(new FloatingText(player.x, player.y, "VITESSE MAX!", "#fffa65"));
            powerups.splice(i, 1);
        }
    }

    // Animals update & capture
    for (let i = animals.length - 1; i >= 0; i--) {
        const animal = animals[i];
        animal.update();

        if (animal.removed) {
            animals.splice(i, 1);
            continue;
        }

        const hitboxMargin = (animal.type === 'golden') ? 56 : 42;
        if (!animal.captured &&
            rectsOverlap(player.x, player.y, player.width, player.height, animal.x, animal.y, hitboxMargin, hitboxMargin)) {

            animal.captured = true;
            animal.x = coop.x + 20 + Math.random() * (coop.width - 40);
            animal.y = coop.y + 20 + Math.random() * (coop.height - 40);
            animal.dx = (Math.random() - 0.5) * 0.5;
            animal.dy = (Math.random() - 0.5) * 0.5;

            score += animal.points;
            const pts = "+" + animal.points;
            floatingTexts.push(new FloatingText(player.x, player.y - 10, pts, "#FFD700"));
            spawnCaptureParticles(player.x + player.width / 2, player.y + player.height / 2);
            playCaptureSound();
            if (animal.type === 'chicken' || animal.type === 'golden') {
                playChickenSound();
            }

            if (score >= targetScore && !gameWon) {
                gameWon = true;
                for (let j = 0; j < 20; j++) {
                    setTimeout(spawnFirework, Math.random() * 2000);
                }
                setTimeout(() => {
                    saveHighScore();
                    showVictoryScreen();
                }, 2000);
            }
        }
    }

    if (gameWon && Math.random() < 0.05) {
        spawnFirework();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].update();
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
}

// --- MINI-MAP & OFF-SCREEN INDICATORS ---

function drawMiniMap() {
    const mapW = 160;
    const mapH = 120;
    const mapX = SCREEN_WIDTH - mapW - 14;
    const mapY = 14;
    const scaleX = mapW / WORLD_WIDTH;
    const scaleY = mapH / WORLD_HEIGHT;

    ctx.save();
    // Background
    ctx.fillStyle = 'rgba(14, 26, 18, 0.78)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(mapX, mapY, mapW, mapH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(mapX, mapY, mapW, mapH, 10);
    ctx.clip();

    // River on minimap
    ctx.fillStyle = 'rgba(41, 182, 246, 0.7)';
    ctx.fillRect(mapX, mapY + river.y * scaleY, mapW, river.height * scaleY);

    // Bridges on minimap
    ctx.fillStyle = '#8d6e63';
    bridges.forEach(b => {
        ctx.fillRect(mapX + b.x * scaleX, mapY + b.y * scaleY, b.width * scaleX, b.height * scaleY);
    });

    // House & Coop
    ctx.fillStyle = '#a29bfe';
    ctx.fillRect(mapX + house.x * scaleX, mapY + house.y * scaleY, house.width * scaleX, house.height * scaleY);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(mapX + coop.x * scaleX, mapY + coop.y * scaleY, coop.width * scaleX, coop.height * scaleY);

    // Camera viewport frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
        mapX + camera.x * scaleX,
        mapY + camera.y * scaleY,
        SCREEN_WIDTH * scaleX,
        SCREEN_HEIGHT * scaleY
    );

    // Animals
    animals.forEach(a => {
        if (a.captured) return;
        ctx.fillStyle = (a.type === 'golden') ? '#ffd700' : (a.type === 'chicken' ? '#ffffff' : '#fab1a0');
        ctx.beginPath();
        ctx.arc(mapX + a.x * scaleX, mapY + a.y * scaleY, a.type === 'golden' ? 3.5 : 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Foxes (red triangles)
    foxes.forEach(f => {
        if (f.state !== 'hunting') return;
        const fx = mapX + f.x * scaleX;
        const fy = mapY + f.y * scaleY;
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.moveTo(fx, fy - 4);
        ctx.lineTo(fx - 3.5, fy + 3);
        ctx.lineTo(fx + 3.5, fy + 3);
        ctx.closePath();
        ctx.fill();
    });

    // Player (bright green dot)
    ctx.fillStyle = '#2ecc71';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(
        mapX + (player.x + player.width / 2) * scaleX,
        mapY + (player.y + player.height / 2) * scaleY,
        3.5, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

function drawOffscreenAlerts() {
    // Show subtle edge arrow if a hunting fox or golden chicken is off-screen
    const targets = [];
    foxes.forEach(f => {
        if (f.state === 'hunting') targets.push({ x: f.x + 25, y: f.y + 25, color: '#ff4757', label: '🦊' });
    });
    animals.forEach(a => {
        if (!a.captured && a.type === 'golden') targets.push({ x: a.x + 20, y: a.y + 20, color: '#ffd700', label: '🌟' });
    });

    targets.forEach(t => {
        const sx = t.x - camera.x;
        const sy = t.y - camera.y;
        if (sx >= 20 && sx <= SCREEN_WIDTH - 20 && sy >= 20 && sy <= SCREEN_HEIGHT - 20) return;

        const angle = Math.atan2(sy - SCREEN_HEIGHT / 2, sx - SCREEN_WIDTH / 2);
        const edgeX = Math.max(26, Math.min(SCREEN_WIDTH - 26, sx));
        const edgeY = Math.max(26, Math.min(SCREEN_HEIGHT - 26, sy));

        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.label, 0, 1);

        // Directional pointer
        ctx.rotate(angle);
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(13, -5);
        ctx.lineTo(13, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });
}

function draw() {
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // --- WORLD SPACE RENDERING (with camera offset) ---
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    drawWorldTerrain();
    drawCloudShadows();
    drawFoliage();

    // Footprints on ground
    footprints.forEach(fp => fp.draw());

    // Coop glow & Chimney smoke (over background.png clearing)
    drawCoopGlow();
    updateAndDrawSmoke();

    // Obstacles (trees, rocks, bushes)
    drawObstacles();

    // Animals
    animals.forEach(animal => {
        if (!animal.captured) drawShadow(animal.x, animal.y, animal.width || 40, animal.height || 40, 0.2);
    });
    animals.forEach(animal => animal.draw());

    // Foxes
    foxes.forEach(fox => {
        drawShadow(fox.x, fox.y, fox.width, fox.height, 0.2);
    });
    foxes.forEach(fox => fox.draw());

    // Powerups
    powerups.forEach(p => p.draw());

    // Dog
    if (dog) drawShadow(dog.x, dog.y, dog.width, dog.height, 0.2);
    if (dog) dog.draw();

    // Player with animated walk / idle breathing
    const t = Date.now() / 1000;
    const playerBob = player.isMoving ? Math.abs(Math.sin(player.walkTimer)) * -5 : Math.sin(t * 2.5) * 1.2;
    const playerRot = player.isMoving ? Math.sin(player.walkTimer) * 0.09 : 0;
    const playerScaleY = player.isMoving ? 1 + Math.sin(player.walkTimer * 2) * 0.05 : 1 + Math.sin(t * 2.5) * 0.02;
    const playerScaleX = 2 - playerScaleY;

    drawShadow(player.x, player.y + (player.isMoving ? 0 : playerBob * 0.3), player.width, player.height, 0.3);

    if (speedBoostTimer > 0) {
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = 'yellow';
        safeDrawAnimatedImage(girlImg, player.x, player.y + playerBob, player.width, player.height, player.facingLeft, playerRot, playerScaleX, playerScaleY);
        ctx.restore();
    } else {
        safeDrawAnimatedImage(girlImg, player.x, player.y + playerBob, player.width, player.height, player.facingLeft, playerRot, playerScaleX, playerScaleY);
    }

    drawBorder();

    // World particles & floating texts
    particles.forEach(p => p.draw());
    floatingTexts.forEach(ft => ft.draw());

    ctx.restore();

    // --- SCREEN SPACE RENDERING (HUD, Weather, Mini-map, Overlays) ---
    updateAndDrawWeather();

    if (isPlaying || isCountingDown) {
        drawOffscreenAlerts();
        drawMiniMap();
    }

    // Update HTML HUD
    hudScore.innerText = score;
    hudTimer.innerText = (elapsedTime / 1000).toFixed(1) + "s";

    if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 48px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSE', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Outfit';
        ctx.fillText('Appuyez sur P ou Échap pour reprendre la partie', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 30);
        ctx.textAlign = 'left';
    }

    if (gameWon) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, SCREEN_HEIGHT / 2 - 60, SCREEN_WIDTH, 120);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 54px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('VICTOIRE ! Bravo ' + playerName, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 18);
        ctx.textAlign = 'left';
    }

    if (isCountingDown) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 120px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(countdown, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        ctx.font = 'bold 30px Outfit';
        ctx.fillText('PRÊT ?', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 100);
        ctx.font = '20px Outfit';
        ctx.fillStyle = '#a8e6cf';
        ctx.fillText('Explore la forêt et ramène les animaux au poulailler !', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 100);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    // Smooth fade-in transition
    if (screenFade > 0) {
        ctx.fillStyle = `rgba(14, 26, 18, ${screenFade})`;
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Restore saved player name and enable Enter key on input
const nameInput = document.getElementById('player-name-input');
const savedPlayerName = localStorage.getItem('forestGamePlayerName');
if (savedPlayerName) {
    playerName = savedPlayerName;
    if (nameInput) nameInput.value = savedPlayerName;
}
if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            startGame();
        }
    });
}

// Initialize world preview behind start screen
resetGame(false);
displayHighScores();
requestAnimationFrame(gameLoop);
