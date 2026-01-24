const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// Assets
const groundImg = new Image();
groundImg.src = 'ground.png';
const chickenImg = new Image();
chickenImg.src = 'chicken.png';
const girlImg = new Image();
girlImg.src = 'girl.png';
const houseImg = new Image();
houseImg.src = 'house.png';
const animalImg = new Image();
animalImg.src = 'animal.png';
const coopImg = new Image();
coopImg.src = 'coop.png';

// Game state
let keys = {};
let score = 0;

// Entities
const player = {
    x: 100,
    y: 300,
    width: 48,
    height: 48,
    speed: 4,
    direction: 'down'
};

// Game State
let playerName = "Joueur";
let isPlaying = false;
let gameWon = false;
let particles = [];

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
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
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

const house = {
    x: 50,
    y: 50,
    width: 128,
    height: 128
};

const coop = {
    x: 200,
    y: 80,
    width: 96,
    height: 96
};

class Animal {
    constructor(type = 'rabbit') {
        this.type = type;
        this.points = (type === 'chicken') ? 2 : 1;
        this.reset();
    }

    reset() {
        // Spawn somewhere random away from edges and house/coop
        this.x = 200 + Math.random() * (SCREEN_WIDTH - 400);
        this.y = 100 + Math.random() * (SCREEN_HEIGHT - 200);
        this.width = 40;
        this.height = 40;
        this.speed = (this.type === 'chicken') ? 1.0 : 0.8; // Chickens slightly faster
        this.dx = (Math.random() - 0.5) * this.speed;
        this.dy = (Math.random() - 0.5) * this.speed;
        this.changeDirTimer = 0;
        this.captured = false;
        // Ensure initial DX/DY are set for wandering
        this.dx = (Math.random() - 0.5) * this.speed;
        this.dy = (Math.random() - 0.5) * this.speed;
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
        const img = (this.type === 'chicken') ? chickenImg : animalImg;
        // Use simpler size if captured to fit in potentially crowded coop? 
        // Or keep same size. Let's keep 48 but maybe slightly smaller inside coop to fit more
        const size = this.captured ? 32 : 48;
        safeDrawImage(img, this.x, this.y, size, size);
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

// Start Game Logic
function startGame() {
    const input = document.getElementById('player-name-input');
    if (input.value.trim() !== "") {
        playerName = input.value.trim();
    }
    document.getElementById('start-screen').classList.add('hidden');
    isPlaying = true;
    resetGame();
}

// Reset game logic
function resetGame() {
    score = 0;
    gameWon = false;
    particles = [];

    // Player starts at house
    player.x = house.x + house.width / 2 - player.width / 2;
    player.y = house.y + house.height - 10;

    animals = [];
    spawnAnimals(5);
}

// Initialize but wait for start
// resetGame(); is called by startGame


// Input handling
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});


// Helper to safely draw images
function safeDrawImage(img, x, y, w, h) {
    if (img && img.complete && img.naturalWidth !== 0) {
        try {
            ctx.drawImage(img, x, y, w, h);
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

function update() {
    if (!isPlaying) return;

    // Auto-Respawn Logic
    const activeAnimals = animals.filter(a => !a.captured).length;
    if (activeAnimals <= 2) {
        spawnAnimals(3 + Math.floor(Math.random() * 3)); // Add 3-5 more
    }

    // Player movement
    if (keys['ArrowUp']) player.y -= player.speed;
    if (keys['ArrowDown']) player.y += player.speed;
    if (keys['ArrowLeft']) player.x -= player.speed;
    if (keys['ArrowRight']) player.x += player.speed;

    // Boundary checks
    if (player.x < 0) player.x = 0;
    if (player.y < 0) player.y = 0;
    if (player.x + player.width > SCREEN_WIDTH) player.x = SCREEN_WIDTH - player.width;
    if (player.y + player.height > SCREEN_HEIGHT) player.y = SCREEN_HEIGHT - player.height;

    // Update animals
    animals.forEach(animal => {
        animal.update();

        // Collision detection
        if (!animal.captured &&
            player.x < animal.x + 40 &&
            player.x + player.width > animal.x &&
            player.y < animal.y + 40 &&
            player.y + player.height > animal.y) {

            // Capture!
            animal.captured = true;
            // Place somewhere inside the coop initially, to avoid "teleporting" to outside if coop is far
            animal.x = coop.x + 20 + Math.random() * (coop.width - 40);
            animal.y = coop.y + 20 + Math.random() * (coop.height - 40);
            // Reset movement vectors for calm wandering
            animal.dx = (Math.random() - 0.5) * 0.5;
            animal.dy = (Math.random() - 0.5) * 0.5;


            score += animal.points; // 1 or 2
            playCaptureSound();

            if (score >= 30 && !gameWon) {
                gameWon = true;
                // Launch initial fireworks
                for (let i = 0; i < 5; i++) setTimeout(spawnFirework, i * 500);
            }
        }
    });

    // Firework updates
    if (gameWon) {
        if (Math.random() < 0.05) spawnFirework(); // Random fireworks
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) particles.splice(i, 1);
        }
    }

}

function draw() {
    // Background tiling
    let bgDrawn = false;
    if (groundImg && groundImg.complete && groundImg.naturalWidth !== 0) {
        try {
            ctx.drawImage(groundImg, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
            bgDrawn = true;
        } catch (e) {
            console.error("Pattern creation failed:", e);
        }
    }

    if (!bgDrawn) {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    // Draw House
    safeDrawImage(houseImg, house.x, house.y, house.width, house.height);

    // Draw Coop
    safeDrawImage(coopImg, coop.x, coop.y, coop.width, coop.height);

    // Draw Animals
    animals.forEach(animal => {
        animal.draw();
    });

    // Draw Player
    safeDrawImage(girlImg, player.x, player.y, player.width, player.height);

    // Score
    ctx.fillStyle = 'white';
    ctx.font = '24px Outfit';
    ctx.fillText('Animaux sauvés par ' + playerName + ': ' + score + '/30', 20, 40);

    // Victory Message and Fireworks
    if (gameWon) {
        particles.forEach(p => p.draw());

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, SCREEN_HEIGHT / 2 - 60, SCREEN_WIDTH, 120);

        ctx.fillStyle = '#FFD700'; // Gold
        ctx.font = 'bold 60px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('VICTOIRE ! Bravo ' + playerName, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);
        ctx.textAlign = 'left'; // Reset
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start immediately but rely on safeDrawImage to handle loading states
requestAnimationFrame(gameLoop);
