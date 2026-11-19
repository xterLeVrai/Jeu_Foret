const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// Assets
const bgImg = new Image(); // Composite background (terrain + house + coop)
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
let gamepadState = {}; // Separate state for gamepad
let score = 0;

// Entities
const player = {
    x: 100,
    y: 300,
    width: 48,
    height: 48,
    speed: 4,
    direction: 'down',
    facingLeft: false
};

// Game State
let playerName = "Joueur";
let isPlaying = false;
let isPaused = false;
let gameWon = false;
let particles = [];
let floatingTexts = [];
let foxes = [];
let dog;

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

// NEW: HUD Elements
const hudElement = document.getElementById('game-hud');
const hudScore = document.getElementById('hud-score');
const hudTimer = document.getElementById('hud-timer');
const hudPlayerName = document.getElementById('hud-player-name');
const mainTitle = document.getElementById('main-title');

// NEW: Visual Effects State
function triggerShake() {
    canvas.classList.remove('shake-canvas');
    void canvas.offsetWidth; // Trigger reflow
    canvas.classList.add('shake-canvas');
    setTimeout(() => canvas.classList.remove('shake-canvas'), 400);
}

// --- GRAPHICS OVERHAUL ---

// B2: Dynamic Foliage (generated once per game)
let foliageItems = [];
function generateFoliage() {
    foliageItems = [];
    const types = ['grass', 'flower', 'pebble'];
    for (let i = 0; i < 80; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const x = Math.random() * SCREEN_WIDTH;
        const y = Math.random() * SCREEN_HEIGHT;
        // Avoid spawning on top of house or coop
        if (x > house.x - 10 && x < house.x + house.width + 10 &&
            y > house.y - 10 && y < house.y + house.height + 10) continue;
        if (x > coop.x - 10 && x < coop.x + coop.width + 10 &&
            y > coop.y - 10 && y < coop.y + coop.height + 10) continue;
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
            // Stem
            ctx.strokeStyle = '#2d8a4e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(item.x, item.y);
            ctx.lineTo(item.x, item.y - item.size * 2);
            ctx.stroke();
            // Petals
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(item.x, item.y - item.size * 2, item.size, 0, Math.PI * 2);
            ctx.fill();
            // Center
            ctx.fillStyle = '#ffd93d';
            ctx.beginPath();
            ctx.arc(item.x, item.y - item.size * 2, item.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Pebble
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.ellipse(item.x, item.y, item.size, item.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
}

// B1: Shadow system
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height + 5, width * 0.55, height * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// B3: Chimney smoke particles
let smokeParticles = [];
class SmokeParticle {
    constructor() {
        this.reset();
    }
    reset() {
        // Chimney position - calibrated to the chimney in background.png
        // The chimney is roughly at 28% from left, 5% from top of canvas
        this.x = 338 + (Math.random() - 0.5) * 6;
        this.y = 45;
        this.size = 3 + Math.random() * 3;
        this.alpha = 0.4 + Math.random() * 0.2;
        this.dx = (Math.random() - 0.5) * 0.3;
        this.dy = -0.3 - Math.random() * 0.4;
        this.life = 80 + Math.random() * 40;
        this.maxLife = this.life;
    }
    update() {
        this.x += this.dx + Math.sin(Date.now() / 500 + this.life) * 0.15;
        this.y += this.dy;
        this.size += 0.05;
        this.life--;
        this.alpha = (this.life / this.maxLife) * 0.35;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#c8d6e5';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function updateAndDrawSmoke() {
    // Spawn new smoke
    if (Math.random() < 0.15) {
        smokeParticles.push(new SmokeParticle());
    }
    // Update and draw
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        smokeParticles[i].update();
        smokeParticles[i].draw();
        if (smokeParticles[i].life <= 0) smokeParticles.splice(i, 1);
    }
}

// B3: Coop glow
function drawCoopGlow() {
    const time = Date.now() / 1000;
    const pulse = 0.5 + Math.sin(time * 2) * 0.15;
    ctx.save();
    const gradient = ctx.createRadialGradient(
        coop.x + coop.width / 2, coop.y + coop.height / 2, 10,
        coop.x + coop.width / 2, coop.y + coop.height / 2, coop.width * 0.8
    );
    gradient.addColorStop(0, `rgba(255, 215, 0, ${pulse * 0.3})`);
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(coop.x + coop.width / 2, coop.y + coop.height / 2, coop.width * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// C1: Cloud shadows (parallax)
let cloudShadows = [];
function generateCloudShadows() {
    cloudShadows = [];
    for (let i = 0; i < 4; i++) {
        cloudShadows.push({
            x: Math.random() * SCREEN_WIDTH * 1.5,
            y: Math.random() * SCREEN_HEIGHT,
            width: 120 + Math.random() * 150,
            height: 60 + Math.random() * 40,
            speed: 0.15 + Math.random() * 0.2
        });
    }
}

function drawCloudShadows() {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    cloudShadows.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x > SCREEN_WIDTH + cloud.width) {
            cloud.x = -cloud.width;
            cloud.y = Math.random() * SCREEN_HEIGHT;
        }
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

// C2: Natural border (hedge)
function drawBorder() {
    ctx.save();
    const borderWidth = 12;
    // Draw textured hedge border around edges
    for (let i = 0; i < SCREEN_WIDTH; i += 8) {
        const topH = borderWidth + Math.sin(i * 0.15) * 3;
        const botH = borderWidth + Math.cos(i * 0.12) * 3;
        // Top
        ctx.fillStyle = `hsl(${120 + Math.sin(i * 0.1) * 10}, 50%, ${25 + Math.sin(i * 0.2) * 5}%)`;
        ctx.fillRect(i, 0, 8, topH);
        // Bottom
        ctx.fillStyle = `hsl(${120 + Math.cos(i * 0.1) * 10}, 50%, ${25 + Math.cos(i * 0.2) * 5}%)`;
        ctx.fillRect(i, SCREEN_HEIGHT - botH, 8, botH);
    }
    for (let j = 0; j < SCREEN_HEIGHT; j += 8) {
        const leftW = borderWidth + Math.sin(j * 0.15) * 3;
        const rightW = borderWidth + Math.cos(j * 0.12) * 3;
        // Left
        ctx.fillStyle = `hsl(${120 + Math.sin(j * 0.1) * 10}, 50%, ${25 + Math.sin(j * 0.2) * 5}%)`;
        ctx.fillRect(0, j, leftW, 8);
        // Right
        ctx.fillStyle = `hsl(${120 + Math.cos(j * 0.1) * 10}, 50%, ${25 + Math.cos(j * 0.2) * 5}%)`;
        ctx.fillRect(SCREEN_WIDTH - rightW, j, rightW, 8);
    }
    // Lighter leaf highlights
    for (let i = 0; i < SCREEN_WIDTH; i += 12) {
        ctx.fillStyle = `rgba(100, 200, 100, ${0.3 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(i + 4, 5 + Math.sin(i * 0.2) * 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(i + 4, SCREEN_HEIGHT - 5 + Math.cos(i * 0.2) * 2, 3, 0, Math.PI * 2);
        ctx.fill();
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
        this.alpha = 1;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.dy += 0.1; // gravity
        this.life--;
        this.alpha = this.life / 100;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
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
        ctx.globalAlpha = this.life / 60;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px Outfit';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

function spawnCaptureParticles(x, y) {
    for (let i = 0; i < 10; i++) {
        const p = new Particle(x, y, '#FFD700'); // Gold sparks
        p.life = 30; // Shorter life
        particles.push(p);
    }
}

function spawnFirework() {
    const x = Math.random() * SCREEN_WIDTH;
    const y = Math.random() * (SCREEN_HEIGHT / 2); // Top half
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    for (let i = 0; i < 50; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Positions calibrated to match background.png (1188x891 → 800x600)
const house = {
    x: 175,
    y: 87,
    width: 145,
    height: 175
};

const coop = {
    x: 428,
    y: 34,
    width: 125,
    height: 155
};

class Animal {
    constructor(type = 'rabbit') {
        this.type = type;
        if (type === 'golden') {
            this.points = 10;
        } else {
            this.points = (type === 'chicken') ? 2 : 1;
        }
        this.lifeTime = (type === 'golden') ? 300 : -1; // 5 seconds (60fps) for golden
        this.removed = false;
        this.reset();
    }

    reset() {
        // Spawn somewhere random away from edges and house/coop
        this.x = 200 + Math.random() * (SCREEN_WIDTH - 400);
        this.y = 100 + Math.random() * (SCREEN_HEIGHT - 200);
        this.width = 40;
        this.height = 40;

        if (this.type === 'golden') {
            this.speed = 3.0; // Very fast
        } else {
            this.speed = (this.type === 'chicken') ? 1.0 : 0.8;
        }

        this.dx = (Math.random() - 0.5) * this.speed;
        this.dy = (Math.random() - 0.5) * this.speed;
        this.changeDirTimer = 0;
        this.captured = false;
    }

    update() {
        if (this.captured) {
            // Wandering inside coop
            const speed = 0.5; // Very slow

            // Change direction occasionally
            this.changeDirTimer++;
            if (this.changeDirTimer > 100 + Math.random() * 100) {
                const angle = Math.random() * Math.PI * 2;
                this.dx = Math.cos(angle) * speed;
                this.dy = Math.sin(angle) * speed;
                this.changeDirTimer = 0;
            }

            this.x += this.dx;
            this.y += this.dy;

            // Stay inside coop boundaries
            const margin = 5;
            if (this.x < coop.x + margin) {
                this.x = coop.x + margin;
                this.dx = Math.abs(this.dx);
            }
            if (this.x + this.width > coop.x + coop.width - margin) {
                this.x = coop.x + coop.width - this.width - margin;
                this.dx = -Math.abs(this.dx);
            }
            if (this.y < coop.y + margin) {
                this.y = coop.y + margin;
                this.dy = Math.abs(this.dy);
            }
            if (this.y + this.height > coop.y + coop.height - margin) {
                this.y = coop.y + coop.height - this.height - margin;
                this.dy = -Math.abs(this.dy);
            }
            return;
        }

        // Golden Chicken Logic
        if (this.type === 'golden') {
            this.lifeTime--;
            if (this.lifeTime <= 0) {
                // Poof! it vanishes
                spawnCaptureParticles(this.x, this.y); // Visual effect on vanish
                this.removed = true;
                return;
            }
        }

        // Calculate distance to player
        const dx = (this.x + this.width / 2) - (player.x + player.width / 2);
        const dy = (this.y + this.height / 2) - (player.y + player.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Flee behavior
        if (dist < 150) {
            // Run away!
            const angle = Math.atan2(dy, dx);
            this.dx = Math.cos(angle) * this.speed * 2.5;
            this.dy = Math.sin(angle) * this.speed * 2.5;
            this.changeDirTimer = 0;
        } else {
            // Normal wandering
            this.changeDirTimer++;
            if (this.changeDirTimer > 60 + Math.random() * 60) {
                const angle = Math.random() * Math.PI * 2;
                this.dx = Math.cos(angle) * this.speed;
                this.dy = Math.sin(angle) * this.speed;
                this.changeDirTimer = 0;
            }
        }

        // Apply movement
        this.x += this.dx;
        this.y += this.dy;

        // Bounce off walls with margin to prevent sticking
        const margin = 10;
        if (this.x < margin) {
            this.x = margin;
            this.dx = Math.abs(this.dx);
        }
        if (this.x + this.width > SCREEN_WIDTH - margin) {
            this.x = SCREEN_WIDTH - this.width - margin;
            this.dx = -Math.abs(this.dx);
        }
        if (this.y < margin) {
            this.y = margin;
            this.dy = Math.abs(this.dy);
        }
        if (this.y + this.height > SCREEN_HEIGHT - margin) {
            this.y = SCREEN_HEIGHT - this.height - margin;
            this.dy = -Math.abs(this.dy);
        }
    }
    draw() {
        // Always draw normally using current x,y
        let img = animalImg;
        if (this.type === 'chicken') img = chickenImg;
        if (this.type === 'golden') img = goldenImg;

        // Use simpler size if captured to fit in potentially crowded coop?  
        const size = this.captured ? 32 : 48;
        // Bobbing animation
        const bob = Math.sin(Date.now() / 200) * 3;
        const flipX = this.dx < 0;
        safeDrawImage(img, this.x, this.y + (this.captured ? 0 : bob), size, size, flipX);
    }
}

class Fox {
    constructor() {
        // Start at random edge
        if (Math.random() < 0.5) {
            this.x = (Math.random() < 0.5) ? -50 : SCREEN_WIDTH + 50;
            this.y = Math.random() * SCREEN_HEIGHT;
        } else {
            this.x = Math.random() * SCREEN_WIDTH;
            this.y = (Math.random() < 0.5) ? -50 : SCREEN_HEIGHT + 50;
        }

        this.width = 50;
        this.height = 50;
        this.speed = 0.8; // Reduced speed
        this.state = 'hunting'; // or 'fleeing'
        this.fleeTimer = 0;
    }

    update() {
        if (this.state === 'hunting') {
            // Move towards coop
            const dx = coop.x + coop.width / 2 - this.x;
            const dy = coop.y + coop.height / 2 - this.y;
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
            this.movingLeft = Math.cos(angle) < 0;

            // Check collision with player (Player scares fox)
            if (
                player.x < this.x + this.width &&
                player.x + player.width > this.x &&
                player.y < this.y + this.height &&
                player.y + player.height > this.y
            ) {
                this.state = 'fleeing';
                // Optional: Play scare sound
            }

            // Check collision with coop (Steal chicken!)
            const distToCoop = Math.sqrt(dx * dx + dy * dy);
            if (distToCoop < 50) {
                // Steal!
                if (score > 0) {
                    score = Math.max(0, score - 2); // Lose 2 points
                    floatingTexts.push(new FloatingText(this.x, this.y, "-2", "red"));
                    triggerShake(); // NEW: Trigger camera shake on steal
                }
                this.state = 'fleeing'; // Mission accomplished, run away
            }

        } else if (this.state === 'fleeing') {
            // Run away from coop/player
            const dx = this.x - (coop.x + coop.width / 2);
            const dy = this.y - (coop.y + coop.height / 2);
            const angle = Math.atan2(dy, dx); // Run directly away from coop center
            this.x += Math.cos(angle) * (this.speed * 2);
            this.y += Math.sin(angle) * (this.speed * 2);
            this.movingLeft = Math.cos(angle) < 0;
        }
    }

    draw() {
        const bob = Math.sin(Date.now() / 150) * 4; // Faster bob for fox
        safeDrawImage(foxImg, this.x, this.y + bob, this.width, this.height, this.movingLeft);
    }
}

// Sound effect
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playCaptureSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.1); // C6

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

    // Use the high-quality external WAV for the bark
    // We clone it to allow overlapping barks if needed, though here it's simple
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
        this.speed = 3.5;
        this.barkCooldown = 0;
        this.facingLeft = false;
    }
    update() {
        // Follow player with a slight delay/distance
        const targetX = player.x - 20;
        const targetY = player.y + 10;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            this.x += dx * 0.1;
            this.y += dy * 0.1;
            if (dx < -0.5) this.facingLeft = true;
            else if (dx > 0.5) this.facingLeft = false;
        }

        if (this.barkCooldown > 0) this.barkCooldown--;

        // Scare foxes
        foxes.forEach(fox => {
            if (fox.state === 'hunting') {
                const fdx = fox.x - this.x;
                const fdy = fox.y - this.y;
                const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
                if (fdist < 100 && this.barkCooldown === 0) {
                    fox.state = 'fleeing';
                    playBarkSound();
                    floatingTexts.push(new FloatingText(this.x, this.y - 20, "WOUF!", "#ffffff"));
                    this.barkCooldown = 120; // 2 seconds
                }
            }
        });
    }
    draw() {
        if (dogImg.complete && dogImg.naturalWidth !== 0) {
            safeDrawImage(dogImg, this.x, this.y, this.width, this.height, this.facingLeft);
        } else {
            // Placeholder: brown circle
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(this.x + 16, this.y + 16, 12, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class PowerUp {
    constructor() {
        this.x = 100 + Math.random() * (SCREEN_WIDTH - 200);
        this.y = 100 + Math.random() * (SCREEN_HEIGHT - 200);
        this.width = 30;
        this.height = 30;
        this.life = 600; // 10 seconds
    }
    draw() {
        this.life--;
        ctx.save();
        const pulse = Math.sin(Date.now() / 100) * 5;
        // Draw simple lightning bolt/star
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
        // Shadow/Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'yellow';
        ctx.restore();
    }
}

// Create a few animals
let animals = [];
function spawnAnimals(count) {
    for (let i = 0; i < count; i++) {
        const type = (Math.random() > 0.5) ? 'chicken' : 'rabbit';
        animals.push(new Animal(type));
    }
}
spawnAnimals(5); // Initial spawn

// Respawn button logic
// Respawn button logic
function respawnRabbits() {
    if (gameWon) return; // No more spawning if won

    // Count active (not captured) animals
    const activeCount = animals.filter(a => !a.captured).length;
    const maxAnimals = 10;

    if (activeCount >= maxAnimals) {
        // Optional: Provide visual feedback or just do nothing
        console.log("Too many animals!");
        return;
    }

    // Spawn only enough to reach max or a small batch, let's just spawn a standard batch but cap it
    const count = 3 + Math.floor(Math.random() * 3); // 3 to 5
    // Only add what fits under the limit
    const numToSpawn = Math.min(count, maxAnimals - activeCount);

    if (numToSpawn > 0) {
        spawnAnimals(numToSpawn);
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
    // Sort by best time (ascending) and keep top 10
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
    playCountdownSound(false);
    resetGame(false); // Prepare world but don't start isPlaying

    // Update HUD visibility
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
    powerups = [];
    speedBoostTimer = 0;
    player.speed = 4; // Reset to normal speed
    player.facingLeft = false;

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

    dog = new Dog();

    // Player starts at house
    player.x = house.x + house.width / 2 - player.width / 2;
    player.y = house.y + house.height - 10;

    animals = [];
    spawnAnimals(5);

    // Generate environment graphics
    generateFoliage();
    generateCloudShadows();
    smokeParticles = [];
}

// Initialize but wait for start
// resetGame(); is called by startGame


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


// Helper to safely draw images (with optional horizontal flip)
function safeDrawImage(img, x, y, w, h, flipX = false) {
    if (img && img.complete && img.naturalWidth !== 0) {
        try {
            ctx.save();
            ctx.globalAlpha = 1.0; // Ensure opacity is reset
            if (flipX) {
                ctx.translate(x + w, y);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, w, h);
            } else {
                ctx.drawImage(img, x, y, w, h);
            }
            ctx.restore();
        } catch (e) {
            console.error("Error drawing image:", img.src, e);
            // Fallback rectangle
            ctx.fillStyle = 'magenta';
            ctx.fillRect(x, y, w, h);
        }
    } else {
        // Fallback placeholder while loading
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.fillRect(x, y, w, h);
    }
}

// Gamepad Support
function handleGamepad() {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0]; // Take first gamepad
    if (!gp) {
        gamepadState = {};
        return;
    }

    // Movement (Axes 0 and 1 are usually the left stick)
    const threshold = 0.25; // Larger deadzone for reliability

    gamepadState['ArrowLeft'] = gp.axes[0] < -threshold;
    gamepadState['ArrowRight'] = gp.axes[0] > threshold;
    gamepadState['ArrowUp'] = gp.axes[1] < -threshold;
    gamepadState['ArrowDown'] = gp.axes[1] > threshold;

    // Buttons
    // Button 0 (A/Cross) to start or restart
    if (gp.buttons[0] && gp.buttons[0].pressed) {
        if (!isPlaying && !gameWon) startGame();
        else if (gameWon) startCountdown();
    }
}

function update() {
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

    if (Math.random() < 0.008 && foxes.length < 2) {
        foxes.push(new Fox());
        playFoxSound();
    }

    if (Math.random() < 0.001) {
        animals.push(new Animal('golden'));
        playGoldenSound();
    }

    if (Math.random() < 0.002 && powerups.length < 1) {
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
        if (foxes[i].x < -100 || foxes[i].x > SCREEN_WIDTH + 100 ||
            foxes[i].y < -100 || foxes[i].y > SCREEN_HEIGHT + 100) {
            foxes.splice(i, 1);
        }
    }

    const activeAnimals = animals.filter(a => !a.captured).length;
    if (activeAnimals <= 2) {
        spawnAnimals(3 + Math.floor(Math.random() * 3));
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

    // Diagonal normalization to keep constant speed
    if (moveX !== 0 && moveY !== 0) {
        const inv = 1 / Math.SQRT2;
        moveX *= inv;
        moveY *= inv;
    }

    player.x += moveX * player.speed;
    player.y += moveY * player.speed;

    if (moveX < -0.1) player.facingLeft = true;
    else if (moveX > 0.1) player.facingLeft = false;

    if (player.x < 0) player.x = 0;
    if (player.y < 0) player.y = 0;
    if (player.x + player.width > SCREEN_WIDTH) player.x = SCREEN_WIDTH - player.width;
    if (player.y + player.height > SCREEN_HEIGHT) player.y = SCREEN_HEIGHT - player.height;

    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        if (p.life <= 0) { powerups.splice(i, 1); continue; }
        if (player.x < p.x + p.width && player.x + player.width > p.x &&
            player.y < p.y + p.height && player.y + player.height > p.y) {
            speedBoostTimer = 300;
            player.speed = boostedSpeed;
            floatingTexts.push(new FloatingText(player.x, player.y, "VITESSE MAX!", "#fffa65"));
            powerups.splice(i, 1);
        }
    }

    for (let i = animals.length - 1; i >= 0; i--) {
        const animal = animals[i];
        animal.update();

        if (animal.removed) {
            animals.splice(i, 1);
            continue;
        }

        const hitboxMargin = (animal.type === 'golden') ? 60 : 40;
        if (!animal.captured &&
            player.x < animal.x + hitboxMargin &&
            player.x + player.width > animal.x &&
            player.y < animal.y + hitboxMargin &&
            player.y + player.height > animal.y) {

            animal.captured = true;
            animal.x = coop.x + 20 + Math.random() * (coop.width - 40);
            animal.y = coop.y + 20 + Math.random() * (coop.height - 40);
            animal.dx = (Math.random() - 0.5) * 0.5;
            animal.dy = (Math.random() - 0.5) * 0.5;

            score += animal.points;
            const pts = "+" + animal.points;
            floatingTexts.push(new FloatingText(animal.x, animal.y, pts, "#FFD700"));
            spawnCaptureParticles(animal.x, animal.y);
            playCaptureSound();
            if (animal.type === 'chicken' || animal.type === 'golden') {
                playChickenSound();
            }

            if (score >= targetScore && !gameWon) {
                gameWon = true;
                // Celebration phase: 2 seconds of fireworks before showing victory screen
                for (let i = 0; i < 20; i++) {
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
}

function draw() {
    // --- Background (composite: terrain + house + coop) ---
    if (bgImg && bgImg.complete && bgImg.naturalWidth !== 0) {
        ctx.drawImage(bgImg, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    } else {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    // C1: Cloud shadows (moving over terrain)
    drawCloudShadows();

    // B2: Dynamic Foliage (Grass, flowers & pebbles)
    drawFoliage();

    // B3: Coop glow (behind captured animals)
    drawCoopGlow();

    // B3: Chimney smoke (calibrated to chimney in background.png)
    updateAndDrawSmoke();

    // B1: Animal shadows
    animals.forEach(animal => {
        if (!animal.captured) drawShadow(animal.x, animal.y, animal.width || 40, animal.height || 40, 0.2);
    });
    animals.forEach(animal => animal.draw());

    // B1: Fox shadows
    foxes.forEach(fox => {
        drawShadow(fox.x, fox.y, fox.width, fox.height, 0.2);
    });
    foxes.forEach(fox => fox.draw());

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].update();
        floatingTexts[i].draw();
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }

    powerups.forEach(p => p.draw());

    // B1: Dog shadow
    if (dog) drawShadow(dog.x, dog.y, dog.width, dog.height, 0.2);
    if (dog) dog.draw();

    const isMoving = keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] ||
        keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ||
        keys['KeyZ'] || keys['KeyQ'] ||
        gamepadState['ArrowUp'] || gamepadState['ArrowDown'] || gamepadState['ArrowLeft'] || gamepadState['ArrowRight'];
    const playerBob = isMoving ? Math.sin(Date.now() / 100) * 3 : 0;

    // B1: Player shadow
    drawShadow(player.x, player.y + playerBob, player.width, player.height, 0.3);

    if (speedBoostTimer > 0) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'yellow';
        safeDrawImage(girlImg, player.x, player.y + playerBob, player.width, player.height, player.facingLeft);
        ctx.restore();
    } else {
        safeDrawImage(girlImg, player.x, player.y + playerBob, player.width, player.height, player.facingLeft);
    }

    // C2: Natural border (drawn on top of everything except HUD overlays)
    drawBorder();

    // Draw particles on top
    particles.forEach(p => p.draw());
    floatingTexts.forEach(ft => ft.draw());

    // Update HUD
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
        ctx.font = 'bold 60px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('VICTOIRE ! Bravo ' + playerName, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);
        ctx.textAlign = 'left';
    }

    if (isCountingDown) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
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
        ctx.fillText('Attrape les animaux pour les mettre dans le poulailler !', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 100);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
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

displayHighScores();
requestAnimationFrame(gameLoop);
