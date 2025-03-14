// Game variables
let scene, camera, renderer, socket;
let playerObject, playerData;
let playerBalls = {}; // Other players' ball objects
let bullets = {}; // Bullet objects
let keys = {}; // Keyboard state
let velocity = { x: 0, y: 0, z: 0 };
let wasSpacePressed = false; // Tracks previous state of space key for infinite jumping
let lastShootTime = 0;
let overlay, respawnTimer;
let cooldownIndicator, cooldownProgress, crosshair;
const PLAYER_RADIUS = 1;
const BULLET_RADIUS = 0.2;
const GRAVITY = -0.01;
const JUMP_FORCE = 0.2;
const MOVEMENT_SPEED = 0.8;
const SHOOT_COOLDOWN = 500; // ms

// Running ball physics parameters
const RUNNING_UPWARD_SPEED = 0; // Set to 0 to disable bouncing
const STRIDE_FREQUENCY = 3; // Steps per second
const BOUNCE_HEIGHT = 0; // Set to 0 to disable bouncing
const GROUND_LEVEL = PLAYER_RADIUS; // Y position of ground + ball radius
let lastStepTime = 0; // Track when the last step occurred
let isRunning = false; // Track if the player is currently running
let runDirection = new THREE.Vector3(); // Direction of running

// Bullet properties
const BULLET_SPEED = 1.5; // Units per frame (faster than current server implementation)
const BULLET_LIFETIME = 3000; // ms
const BULLET_TRAIL_LENGTH = 8; // Length of the bullet trail

// Mouse control variables
let isPointerLocked = false;
let mouseX = 0;
let mouseY = 0;
let mouseSensitivity = 0.002;
let cameraRotationX = 0;
let cameraRotationY = 0;

// Music variables
let musicVolume = 70; // Default volume
let defaultVolume = 70;

// Settings system
let gameSettings = {
    // Resolution settings
    resolution: {
        scale: 1.0, // 1.0 = full resolution (native)
        autoScale: true, // Automatically adjust based on performance
        presets: {
            "low": 0.5,    // 50% of native resolution
            "medium": 0.75, // 75% of native resolution
            "high": 1.0,    // 100% of native resolution (native)
            "ultra": 1.0     // 100% but with enhanced effects
        },
        current: "high",  // Default to high
        width: window.innerWidth,
        height: window.innerHeight
    },
    
    // Graphics settings
    graphics: {
        shadows: "medium",       // off, low, medium, high
        antialiasing: true,      // true/false
        effects: "medium",       // low, medium, high (particle effects, lighting)
        drawDistance: 100,       // View distance
        maxParticles: 100,       // Maximum particles in the scene
        fpsLimit: 60,            // Limit FPS to save battery/resources, 0 = unlimited
        motionEffects: true,     // Enable/disable motion effects
        vsync: true              // Vertical sync
    },
    
    // Performance monitoring
    performance: {
        fps: 0,
        lastFrameTime: 0,
        framesThisSecond: 0,
        lastFpsUpdate: 0,
        fpsUpdateInterval: 1000, // Update FPS counter every second
        adaptiveQualityEnabled: true, // Automatically adjust quality based on FPS
        targetFps: 60, // Target FPS for adaptive quality
        fpsHistory: []
    }
};

// FPS counter and performance variables
let fpsCounter;
let statsVisible = true;
let rendererInfo = {}; // Will hold renderer stats

// Initialize the game
function init() {
    // Set up Socket.io connection
    socket = io();
    
    // Set up Three.js scene
    setupScene();
    
    // DOM elements
    overlay = document.getElementById('overlay');
    respawnTimer = document.getElementById('respawnTimer');
    cooldownIndicator = document.getElementById('cooldownIndicator');
    cooldownProgress = document.getElementById('cooldownProgress');
    crosshair = document.getElementById('crosshair');
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up Socket.io event handlers
    setupSocketHandlers();
    
    // Try to start background music automatically
    tryAutoplayMusic();
    
    // Start the game loop
    animate();
}

// Try to start background music automatically
function tryAutoplayMusic() {
    // Check if YouTube player is ready - either through forcePlayMusic or musicControls
    if (window.forcePlayMusic) {
        window.forcePlayMusic();
        console.log('Using enhanced force play method');
        return;
    }
    
    if (window.musicControls && window.musicControls.play) {
        window.musicControls.play();
        console.log('Using global music controls to autoplay');
        return;
    }
    
    // Fallback to basic approach if neither enhanced method is available
    if (window.player && typeof window.player.playVideo === 'function') {
        const playerState = window.player.getPlayerState && window.player.getPlayerState();
        
        // Only try to play if it's not already playing (state 1)
        if (playerState !== 1) {
            // Unmute first to ensure audio works
            window.player.unMute();
            window.player.playVideo();
            window.isMusicPlaying = true;
            
            // Update the toggle button text
            const toggleButton = document.getElementById('toggleMusic');
            if (toggleButton) {
                toggleButton.textContent = 'Pause Music';
            }
            
            console.log('Fallback autoplay music initialized');
        }
    } else {
        // If player isn't ready yet, try again in a short while
        console.log('YouTube player not ready, retrying in 1 second...');
        setTimeout(tryAutoplayMusic, 1000);
    }
}

// Set up the Three.js scene, camera, renderer, and basic objects
function setupScene() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create camera (perspective for 3D view)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 5); // Initial position
    
    // Create renderer with settings-based configuration
    renderer = new THREE.WebGLRenderer({ 
        antialias: gameSettings.graphics.antialiasing,
        powerPreference: "high-performance"
    });
    
    // Apply resolution scaling based on settings
    applyResolutionSettings();
    
    // Apply shadow settings
    renderer.shadowMap.enabled = gameSettings.graphics.shadows !== "off";
    
    // Set shadow map type based on quality
    if (gameSettings.graphics.shadows === "high") {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
        renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    
    // Add to DOM
    document.body.appendChild(renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 1); // Soft white light
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    
    // Only enable shadows if they are not turned off
    directionalLight.castShadow = gameSettings.graphics.shadows !== "off";
    
    // Adjust shadow map size based on quality
    if (gameSettings.graphics.shadows === "high") {
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
    } else if (gameSettings.graphics.shadows === "medium") {
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
    } else if (gameSettings.graphics.shadows === "low") {
        directionalLight.shadow.mapSize.width = 512;
        directionalLight.shadow.mapSize.height = 512;
    }
    
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    
    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2E8B57,  // Forest green
        roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.position.y = 0;
    ground.receiveShadow = gameSettings.graphics.shadows !== "off";
    scene.add(ground);
    
    // Add a simple skybox
    const skyboxGeometry = new THREE.BoxGeometry(500, 500, 500);
    const skyboxMaterials = [
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Sky blue
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }),
    ];
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    scene.add(skybox);
    
    // Set up an FPS counter
    setupFpsCounter();
}

// Set up event listeners for keyboard and mouse
function setupEventListeners() {
    // Keyboard event listeners
    document.addEventListener('keydown', (event) => {
        keys[event.key.toLowerCase()] = true;
    });
    
    document.addEventListener('keyup', (event) => {
        keys[event.key.toLowerCase()] = false;
    });
    
    // Pointer lock setup
    const canvas = renderer.domElement;
    
    // Request pointer lock on canvas click
    canvas.addEventListener('click', () => {
        if (!isPointerLocked) {
            canvas.requestPointerLock();
            
            // Only auto-start music if it's not already playing
            if (window.player && !window.isMusicPlaying) {
                window.player.playVideo();
                window.isMusicPlaying = true;
                document.getElementById('toggleMusic').textContent = 'Pause Music';
            }
        }
    });
    
    // Handle pointer lock change
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === canvas;
        console.log('Pointer lock state:', isPointerLocked ? 'locked' : 'unlocked');
        
        // Show/hide crosshair based on pointer lock state
        crosshair.style.opacity = isPointerLocked ? 1 : 0;
    });
    
    // Handle pointer lock error
    document.addEventListener('pointerlockerror', () => {
        console.error('Pointer lock failed');
    });
    
    // Mouse movement event listener
    document.addEventListener('mousemove', (event) => {
        if (isPointerLocked) {
            // Get mouse movement (not absolute position)
            mouseX = event.movementX || 0;
            mouseY = event.movementY || 0;
            
            // Update camera rotation
            cameraRotationY -= mouseX * mouseSensitivity;
            cameraRotationX -= mouseY * mouseSensitivity;
            
            // Clamp vertical rotation to prevent flipping
            cameraRotationX = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, cameraRotationX));
        }
    });
    
    // Mouse click event listener for shooting
    document.addEventListener('mousedown', (event) => {
        if (event.button === 0 && isPointerLocked) { // Left mouse button and pointer is locked
            shoot();
        }
    });
    
    // Window resize event listener
    window.addEventListener('resize', () => {
        applyResolutionSettings();
    });
    
    // Setup settings UI handlers
    setupSettingsHandlers();
}

// Set up the settings UI and handlers
function setupSettingsHandlers() {
    // Get references to settings UI elements
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const settingsCancel = document.getElementById('settingsCancel');
    const settingsApply = document.getElementById('settingsApply');
    const settingsSave = document.getElementById('settingsSave');
    
    // Open settings modal
    settingsButton.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
        
        // Exit pointer lock when settings are opened
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        
        // Load current settings into UI
        loadSettingsToUI();
    });
    
    // Close settings modal without saving
    settingsCancel.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    
    // Apply settings without closing
    settingsApply.addEventListener('click', () => {
        applySettingsFromUI();
    });
    
    // Save and close
    settingsSave.addEventListener('click', () => {
        applySettingsFromUI();
        settingsModal.style.display = 'none';
        
        // Save settings to localStorage
        saveSettings();
    });
    
    // Set up quality preset buttons
    document.querySelectorAll('.preset').forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active class from all presets
            document.querySelectorAll('.preset').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            e.target.classList.add('active');
            
            // Apply the preset
            applyPreset(e.target.id.replace('preset', '').toLowerCase());
            
            // Update UI with new settings
            loadSettingsToUI();
        });
    });
    
    // Setup range input displays
    setupRangeDisplays();
    
    // Load saved settings on init
    loadSettings();
}

// Load settings from localStorage if available
function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        try {
            const parsedSettings = JSON.parse(savedSettings);
            
            // Merge saved settings with defaults
            gameSettings.resolution.scale = parsedSettings.resolution.scale || gameSettings.resolution.scale;
            gameSettings.resolution.autoScale = parsedSettings.resolution.autoScale !== undefined ? 
                parsedSettings.resolution.autoScale : gameSettings.resolution.autoScale;
            gameSettings.resolution.current = parsedSettings.resolution.current || gameSettings.resolution.current;
            
            gameSettings.graphics.shadows = parsedSettings.graphics.shadows || gameSettings.graphics.shadows;
            gameSettings.graphics.antialiasing = parsedSettings.graphics.antialiasing !== undefined ? 
                parsedSettings.graphics.antialiasing : gameSettings.graphics.antialiasing;
            gameSettings.graphics.effects = parsedSettings.graphics.effects || gameSettings.graphics.effects;
            gameSettings.graphics.drawDistance = parsedSettings.graphics.drawDistance || gameSettings.graphics.drawDistance;
            gameSettings.graphics.maxParticles = parsedSettings.graphics.maxParticles || gameSettings.graphics.maxParticles;
            gameSettings.graphics.fpsLimit = parsedSettings.graphics.fpsLimit || gameSettings.graphics.fpsLimit;
            gameSettings.graphics.motionEffects = parsedSettings.graphics.motionEffects !== undefined ? 
                parsedSettings.graphics.motionEffects : gameSettings.graphics.motionEffects;
            gameSettings.graphics.vsync = parsedSettings.graphics.vsync !== undefined ? 
                parsedSettings.graphics.vsync : gameSettings.graphics.vsync;
                
            gameSettings.performance.adaptiveQualityEnabled = parsedSettings.performance.adaptiveQualityEnabled !== undefined ? 
                parsedSettings.performance.adaptiveQualityEnabled : gameSettings.performance.adaptiveQualityEnabled;
            
            // Apply loaded settings
            applySettingsFromStorage();
            
            console.log('Settings loaded from storage');
        } catch (err) {
            console.error('Error loading settings:', err);
        }
    }
}

// Save current settings to localStorage
function saveSettings() {
    try {
        localStorage.setItem('gameSettings', JSON.stringify(gameSettings));
        console.log('Settings saved to storage');
    } catch (err) {
        console.error('Error saving settings:', err);
    }
}

// Apply settings from storage (on initial load)
function applySettingsFromStorage() {
    // Apply resolution settings
    applyResolutionSettings();
    
    // Apply shadow settings
    applyShadowSettings();
    
    // Update UI with current settings
    loadSettingsToUI();
    
    // Update FPS counter visibility
    if (fpsCounter) {
        fpsCounter.style.display = statsVisible ? 'block' : 'none';
    }
}

// Load current settings values into UI elements
function loadSettingsToUI() {
    // Resolution settings
    document.getElementById('resScale').value = gameSettings.resolution.scale;
    document.getElementById('resScaleValue').textContent = Math.round(gameSettings.resolution.scale * 100) + '%';
    document.getElementById('autoScale').checked = gameSettings.resolution.autoScale;
    
    // Set active preset
    document.querySelectorAll('.preset').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('preset' + gameSettings.resolution.current.charAt(0).toUpperCase() + 
        gameSettings.resolution.current.slice(1)).classList.add('active');
    
    // Update current resolution display
    updateResolutionDisplay();
    
    // Graphics settings
    document.getElementById('shadows').value = gameSettings.graphics.shadows;
    document.getElementById('antialiasing').checked = gameSettings.graphics.antialiasing;
    document.getElementById('effects').value = gameSettings.graphics.effects;
    document.getElementById('drawDistance').value = gameSettings.graphics.drawDistance;
    document.getElementById('drawDistanceValue').textContent = gameSettings.graphics.drawDistance;
    document.getElementById('maxParticles').value = gameSettings.graphics.maxParticles;
    document.getElementById('maxParticlesValue').textContent = gameSettings.graphics.maxParticles;
    
    // Performance settings
    document.getElementById('fpsLimit').value = gameSettings.graphics.fpsLimit;
    document.getElementById('vsync').checked = gameSettings.graphics.vsync;
    document.getElementById('motionEffects').checked = gameSettings.graphics.motionEffects;
    document.getElementById('showFps').checked = statsVisible;
    document.getElementById('adaptiveQuality').checked = gameSettings.performance.adaptiveQualityEnabled;
}

// Apply settings from UI to the game
function applySettingsFromUI() {
    // Resolution settings
    gameSettings.resolution.scale = parseFloat(document.getElementById('resScale').value);
    gameSettings.resolution.autoScale = document.getElementById('autoScale').checked;
    
    // Graphics settings
    gameSettings.graphics.shadows = document.getElementById('shadows').value;
    gameSettings.graphics.antialiasing = document.getElementById('antialiasing').checked;
    gameSettings.graphics.effects = document.getElementById('effects').value;
    gameSettings.graphics.drawDistance = parseInt(document.getElementById('drawDistance').value);
    gameSettings.graphics.maxParticles = parseInt(document.getElementById('maxParticles').value);
    
    // Performance settings
    gameSettings.graphics.fpsLimit = parseInt(document.getElementById('fpsLimit').value);
    gameSettings.graphics.vsync = document.getElementById('vsync').checked;
    gameSettings.graphics.motionEffects = document.getElementById('motionEffects').checked;
    statsVisible = document.getElementById('showFps').checked;
    gameSettings.performance.adaptiveQualityEnabled = document.getElementById('adaptiveQuality').checked;
    
    // Apply the settings
    applyResolutionSettings();
    applyShadowSettings();
    updateEffectsQuality();
    
    // Show/hide FPS counter
    if (fpsCounter) {
        fpsCounter.style.display = statsVisible ? 'block' : 'none';
    }
    
    // Reset FPS history after settings change
    gameSettings.performance.fpsHistory = [];
    
    console.log('Settings applied from UI');
}

// Apply quality presets
function applyPreset(presetName) {
    // Update current preset
    gameSettings.resolution.current = presetName;
    
    // Set quality based on preset
    switch (presetName) {
        case 'low':
            gameSettings.resolution.scale = gameSettings.resolution.presets.low;
            gameSettings.graphics.shadows = 'off';
            gameSettings.graphics.antialiasing = false;
            gameSettings.graphics.effects = 'low';
            gameSettings.graphics.drawDistance = 50;
            gameSettings.graphics.maxParticles = 20;
            break;
            
        case 'medium':
            gameSettings.resolution.scale = gameSettings.resolution.presets.medium;
            gameSettings.graphics.shadows = 'low';
            gameSettings.graphics.antialiasing = false;
            gameSettings.graphics.effects = 'medium';
            gameSettings.graphics.drawDistance = 100;
            gameSettings.graphics.maxParticles = 50;
            break;
            
        case 'high':
            gameSettings.resolution.scale = gameSettings.resolution.presets.high;
            gameSettings.graphics.shadows = 'medium';
            gameSettings.graphics.antialiasing = true;
            gameSettings.graphics.effects = 'medium';
            gameSettings.graphics.drawDistance = 100;
            gameSettings.graphics.maxParticles = 100;
            break;
            
        case 'ultra':
            gameSettings.resolution.scale = gameSettings.resolution.presets.ultra;
            gameSettings.graphics.shadows = 'high';
            gameSettings.graphics.antialiasing = true;
            gameSettings.graphics.effects = 'high';
            gameSettings.graphics.drawDistance = 500;
            gameSettings.graphics.maxParticles = 200;
            break;
    }
    
    console.log(`Applied ${presetName} preset`);
}

// Update resolution display
function updateResolutionDisplay() {
    const width = Math.floor(window.innerWidth * gameSettings.resolution.scale);
    const height = Math.floor(window.innerHeight * gameSettings.resolution.scale);
    
    document.getElementById('currentResolution').textContent = 
        `Current: ${width}x${height} (${Math.round(gameSettings.resolution.scale * 100)}%)`;
}

// Setup range displays
function setupRangeDisplays() {
    // Resolution scale range
    document.getElementById('resScale').addEventListener('input', function() {
        document.getElementById('resScaleValue').textContent = Math.round(this.value * 100) + '%';
        updateResolutionDisplay();
    });
    
    // Draw distance range
    document.getElementById('drawDistance').addEventListener('input', function() {
        document.getElementById('drawDistanceValue').textContent = this.value;
    });
    
    // Max particles range
    document.getElementById('maxParticles').addEventListener('input', function() {
        document.getElementById('maxParticlesValue').textContent = this.value;
    });
}

// Update effects quality based on settings
function updateEffectsQuality() {
    const qualityLevel = gameSettings.graphics.effects;
    
    // Apply motion effects setting
    const enableMotionEffects = gameSettings.graphics.motionEffects;
    
    // TODO: Adjust particle effects count, complexity, etc. based on quality level
    // This function can be expanded as more effects are added to the game
    console.log(`Effects quality set to: ${qualityLevel}, Motion effects: ${enableMotionEffects ? 'enabled' : 'disabled'}`);
}

// Set up Socket.io event handlers
function setupSocketHandlers() {
    // Initialize player on connection
    socket.on('init', (data) => {
        playerData = data.players[data.id];
        
        // Create the player's ball
        const ballGeometry = new THREE.SphereGeometry(PLAYER_RADIUS, 32, 32);
        const ballMaterial = new THREE.MeshStandardMaterial({ color: playerData.color });
        playerObject = new THREE.Mesh(ballGeometry, ballMaterial);
        playerObject.position.copy(new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z));
        playerObject.castShadow = true;
        scene.add(playerObject);
        
        // Create a name tag for the player
        createNameTag(playerObject, "You");
        
        // Add all existing players
        for (const id in data.players) {
            if (id !== data.id) {
                addPlayer(data.players[id]);
            }
        }
        
        // Add all existing bullets
        for (const id in data.bullets) {
            addBullet(data.bullets[id]);
        }
    });
    
    // New player joined
    socket.on('newPlayer', (player) => {
        addPlayer(player);
        
        // Play a join sound or effect
        playJoinSound();
    });
    
    // Player moved
    socket.on('playerMoved', (data) => {
        if (playerBalls[data.id]) {
            playerBalls[data.id].position.x = data.position.x;
            playerBalls[data.id].position.y = data.position.y;
            playerBalls[data.id].position.z = data.position.z;
            playerBalls[data.id].rotation.y = data.rotation;
        }
    });
    
    // Player disconnected
    socket.on('playerDisconnected', (id) => {
        if (playerBalls[id]) {
            // Remove the player's name tag
            scene.remove(playerBalls[id].nameTag);
            
            // Remove the player's ball
            scene.remove(playerBalls[id]);
            delete playerBalls[id];
            
            // Play a leave sound or effect
            playLeaveSound();
        }
    });
    
    // New bullet
    socket.on('newBullet', (bullet) => {
        addBullet(bullet);
    });
    
    // Remove bullet
    socket.on('removeBullet', (id) => {
        if (bullets[id]) {
            // Remove both bullet mesh and trail
            if (bullets[id].trail) {
                scene.remove(bullets[id].trail);
            }
            scene.remove(bullets[id]);
            delete bullets[id];
        }
    });
    
    // Bullet impact event
    socket.on('bulletImpact', (data) => {
        // Create visual impact effect at the position with the given normal
        createBulletImpact(
            new THREE.Vector3(data.position.x, data.position.y, data.position.z),
            new THREE.Vector3(data.normal.x, data.normal.y, data.normal.z)
        );
        
        // Play impact sound (if enabled in the future)
        // playImpactSound();
    });
    
    // Player hit
    socket.on('playerHit', (id) => {
        if (id === playerData.id) {
            // This is the local player getting hit
            showDeathOverlay();
            
            // Lower music volume when player is hit
            adjustMusicVolume(30, 500);
        } else if (playerBalls[id]) {
            // Another player got hit, hide their ball
            playerBalls[id].visible = false;
        }
    });
    
    // Player respawn
    socket.on('playerRespawn', (data) => {
        if (data.id === playerData.id) {
            // Local player respawned
            hideDeathOverlay();
            
            // Restore music volume when player respawns
            adjustMusicVolume(defaultVolume, 1000);
            
            // Update position
            playerObject.position.copy(new THREE.Vector3(data.position.x, data.position.y, data.position.z));
            
            // Reset velocity
            velocity.x = 0;
            velocity.y = 0;
            velocity.z = 0;
        } else if (playerBalls[data.id]) {
            // Another player respawned
            playerBalls[data.id].position.copy(new THREE.Vector3(data.position.x, data.position.y, data.position.z));
            playerBalls[data.id].visible = true;
        }
    });
}

// Add a new player to the scene
function addPlayer(player) {
    const ballGeometry = new THREE.SphereGeometry(PLAYER_RADIUS, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: player.color });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.copy(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
    ball.castShadow = true;
    scene.add(ball);
    
    // Create a name tag for the player
    createNameTag(ball, player.id.substring(0, 5));
    
    playerBalls[player.id] = ball;
}

// Temporarily adjust music volume and then fade back
function adjustMusicVolume(newVolume, duration) {
    if (window.player && window.isMusicPlaying) {
        // Store current volume
        const originalVolume = window.player.getVolume();
        
        // Set new volume immediately
        window.player.setVolume(newVolume);
        
        // Update the volume slider to match
        document.getElementById('volumeControl').value = newVolume;
        
        // If duration is provided, restore volume after delay
        if (duration) {
            setTimeout(() => {
                // Gradually restore original volume
                const steps = 10;
                const stepDuration = 100;
                const volumeDiff = defaultVolume - newVolume;
                const volumeStep = volumeDiff / steps;
                
                let currentStep = 0;
                const fadeInterval = setInterval(() => {
                    currentStep++;
                    const stepVolume = newVolume + (volumeStep * currentStep);
                    window.player.setVolume(stepVolume);
                    document.getElementById('volumeControl').value = stepVolume;
                    
                    if (currentStep >= steps) {
                        clearInterval(fadeInterval);
                    }
                }, stepDuration);
            }, duration);
        }
    }
}

// Simple sound effects using the Web Audio API
function playJoinSound() {
    if (window.AudioContext || window.webkitAudioContext) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.2); // A5
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }
}

function playLeaveSound() {
    if (window.AudioContext || window.webkitAudioContext) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.2); // A4
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }
}

// Add a new bullet to the scene
function addBullet(bullet) {
    // Create bullet mesh
    const bulletGeometry = new THREE.SphereGeometry(BULLET_RADIUS, 16, 16);
    const bulletMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFFD700, // Gold color
        emissive: 0xFFAA00, // Add glow effect
        emissiveIntensity: 0.5
    });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bulletMesh.position.copy(new THREE.Vector3(bullet.position.x, bullet.position.y, bullet.position.z));
    
    // Only enable shadows for bullets if shadows are enabled and not set to low
    bulletMesh.castShadow = gameSettings.graphics.shadows !== "off" && gameSettings.graphics.shadows !== "low";
    
    scene.add(bulletMesh);
    
    // Store the direction for client-side prediction
    bulletMesh.direction = new THREE.Vector3(
        bullet.direction.x,
        bullet.direction.y,
        bullet.direction.z
    );
    
    // Store creation time for lifetime tracking
    bulletMesh.creationTime = Date.now();
    
    // Determine trail length based on effects quality
    let trailLength = BULLET_TRAIL_LENGTH;
    if (gameSettings.graphics.effects === "low") {
        trailLength = 3;
    } else if (gameSettings.graphics.effects === "medium") {
        trailLength = 6;
    } else { // high
        trailLength = 10;
    }
    
    // Skip creating trail if effects quality is low and we have too many bullets
    const skipTrail = gameSettings.graphics.effects === "low" && Object.keys(bullets).length > 10;
    
    if (!skipTrail) {
    // Create bullet trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({ 
        color: 0xFF5500, 
        linewidth: 1, 
        transparent: true,
        opacity: 0.7
    });
    
    // Initialize trail with just the bullet's current position
        const trailPositions = new Float32Array(trailLength * 3);
    trailPositions[0] = bullet.position.x;
    trailPositions[1] = bullet.position.y;
    trailPositions[2] = bullet.position.z;
    
    // Fill the rest with the same position initially
        for (let i = 1; i < trailLength; i++) {
        trailPositions[i * 3] = bullet.position.x;
        trailPositions[i * 3 + 1] = bullet.position.y;
        trailPositions[i * 3 + 2] = bullet.position.z;
    }
    
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trail);
    
    // Store the trail with the bullet for easy updates and cleanup
    bulletMesh.trail = trail;
    bulletMesh.trailPositions = trailPositions;
        bulletMesh.trailLength = trailLength;
    }
    
    // Add a small light at the bullet only for medium and high effects quality
    if (gameSettings.graphics.effects !== "low") {
    const bulletLight = new THREE.PointLight(0xFFAA00, 1, 3);
    bulletLight.position.copy(bulletMesh.position);
    bulletMesh.add(bulletLight);
    }
    
    bullets[bullet.id] = bulletMesh;
}

// Create a text label that follows an object
function createNameTag(object, name) {
    // Create a canvas for the text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Draw the text onto the canvas
    context.font = '24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(name, canvas.width / 2, canvas.height / 2);
    
    // Create a texture from the canvas
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    // Create a sprite using the texture
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = 2; // Position above the ball
    
    // Add the sprite to the object
    object.add(sprite);
    object.nameTag = sprite;
}

// Create a bullet impact effect with normal direction
function createBulletImpact(position, normal) {
    // Skip effect creation if effects quality is low and we have too many active impacts
    if (gameSettings.graphics.effects === "low" && 
        window.impactEffects && window.impactEffects.length > 5) {
        return; // Skip creating more effects
    }
    
    // Adjust particle count based on effects quality
    let particleCount;
    if (gameSettings.graphics.effects === "high") {
        particleCount = 30;
    } else if (gameSettings.graphics.effects === "medium") {
        particleCount = 15;
    } else { // low
        particleCount = 5;
    }
    
    // Limit to max particles from settings
    particleCount = Math.min(particleCount, gameSettings.graphics.maxParticles / 5);
    
    // Create a particle system for impact
    const particles = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    const color = new THREE.Color();
    
    for (let i = 0; i < particleCount; i++) {
        // Random position around impact point
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;
        
        // Random color between yellow and orange
        color.setHSL(0.1, 0.9, 0.5 + Math.random() * 0.2);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        // Random size
        sizes[i] = 0.1 + Math.random() * 0.2;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Material with custom shader to render particles
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });
    
    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
    
    // Store initial creation time
    particleSystem.startTime = Date.now();
    particleSystem.lifetime = gameSettings.graphics.effects === "high" ? 800 : 
                             (gameSettings.graphics.effects === "medium" ? 500 : 300); // Adjust lifetime based on quality
    
    // Store velocities for each particle - use normal to direct particles
    const velocities = [];
    for (let i = 0; i < particleCount; i++) {
        // Create a random velocity direction that's biased along the normal
        const randomVel = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        
        // Add the normal direction (scaled) to bias particles in that direction
        randomVel.add(normal.clone().multiplyScalar(0.2));
        
        velocities.push({
            x: randomVel.x,
            y: randomVel.y,
            z: randomVel.z
        });
    }
    particleSystem.velocities = velocities;
    
    // Add to a list to update in animation loop
    if (!window.impactEffects) window.impactEffects = [];
    window.impactEffects.push(particleSystem);
    
    // Only add light effect if effects quality is medium or higher
    if (gameSettings.graphics.effects !== "low") {
    // Create a flash light at impact point
    const impactLight = new THREE.PointLight(0xFFAA00, 2, 4);
    impactLight.position.copy(position);
    scene.add(impactLight);
    
    // Remove the light after a short time
    setTimeout(() => {
        scene.remove(impactLight);
    }, 100);
    }
}

// Update impact particle effects
function updateImpactEffects() {
    if (!window.impactEffects) return;
    
    const now = Date.now();
    const impactsToRemove = [];
    
    for (let i = 0; i < window.impactEffects.length; i++) {
        const effect = window.impactEffects[i];
        const elapsed = now - effect.startTime;
        
        if (elapsed > effect.lifetime) {
            // Mark for removal if lifetime is exceeded
            impactsToRemove.push(i);
            scene.remove(effect);
            continue;
        }
        
        // Calculate opacity based on lifetime (fade out)
        const opacity = 1 - (elapsed / effect.lifetime);
        effect.material.opacity = opacity;
        
        // Update particle positions
        const positions = effect.geometry.attributes.position.array;
        
        for (let j = 0; j < positions.length / 3; j++) {
            positions[j * 3] += effect.velocities[j].x;
            positions[j * 3 + 1] += effect.velocities[j].y - 0.01; // Add a bit of gravity
            positions[j * 3 + 2] += effect.velocities[j].z;
            
            // Slow down particles over time
            effect.velocities[j].x *= 0.95;
            effect.velocities[j].y *= 0.95;
            effect.velocities[j].z *= 0.95;
        }
        
        effect.geometry.attributes.position.needsUpdate = true;
    }
    
    // Remove expired effects
    for (let i = impactsToRemove.length - 1; i >= 0; i--) {
        window.impactEffects.splice(impactsToRemove[i], 1);
    }
}

// Show the death overlay and start the respawn timer
function showDeathOverlay() {
    overlay.style.opacity = 1;
    
    let timeLeft = 5;
    respawnTimer.textContent = `Respawning in ${timeLeft}...`;
    
    const countdownInterval = setInterval(() => {
        timeLeft--;
        respawnTimer.textContent = `Respawning in ${timeLeft}...`;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

// Hide the death overlay
function hideDeathOverlay() {
    overlay.style.opacity = 0;
}

// Update cooldown indicator
function updateCooldownIndicator() {
    const now = Date.now();
    const timeSinceShot = now - lastShootTime;
    
    if (timeSinceShot < SHOOT_COOLDOWN) {
        // Still in cooldown
        const progress = timeSinceShot / SHOOT_COOLDOWN;
        
        // Show cooling state
        cooldownIndicator.classList.remove('ready');
        cooldownIndicator.classList.add('cooling');
        cooldownIndicator.querySelector('span').textContent = 'WAIT';
        
        // Update visual progress
        const angle = progress * 360;
        cooldownProgress.style.transform = `rotate(${angle}deg)`;
        if (angle >= 180) {
            cooldownProgress.style.clip = 'rect(0px, 60px, 60px, 0px)';
        } else {
            cooldownProgress.style.clip = 'rect(0px, 30px, 60px, 0px)';
        }
    } else {
        // Ready to shoot
        cooldownIndicator.classList.remove('cooling');
        cooldownIndicator.classList.add('ready');
        cooldownIndicator.querySelector('span').textContent = 'READY';
        cooldownProgress.style.transform = 'rotate(0deg)';
        cooldownProgress.style.clip = 'rect(0px, 60px, 60px, 0px)';
    }
}

// Shoot a bullet
function shoot() {
    if (playerData.isDead) return;
    
    const now = Date.now();
    if (now - lastShootTime < SHOOT_COOLDOWN) return;
    lastShootTime = now;
    
    // Add recoil effect to the cooldown indicator
    cooldownIndicator.classList.add('recoil');
    setTimeout(() => {
        cooldownIndicator.classList.remove('recoil');
    }, 100);
    
    // Calculate direction (forward vector from camera)
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    
    // Create bullet position (slightly in front of the player)
    const position = playerObject.position.clone();
    position.add(direction.clone().multiplyScalar(PLAYER_RADIUS + 0.1));
    
    // Add bullet muzzle flash effect
    createMuzzleFlash(position, direction);
    
    // Send shoot event to server
    socket.emit('shoot', {
        position: {
            x: position.x,
            y: position.y,
            z: position.z
        },
        direction: {
            x: direction.x,
            y: direction.y,
            z: direction.z
        }
    });
}

// Create muzzle flash effect when shooting
function createMuzzleFlash(position, direction) {
    // Create a point light for the flash
    const flashLight = new THREE.PointLight(0xFFAA00, 3, 5);
    flashLight.position.copy(position);
    scene.add(flashLight);
    
    // Remove the light after a short time
    setTimeout(() => {
        scene.remove(flashLight);
    }, 100);
}

// Update player movement based on keyboard input
function updateMovement() {
    if (playerData.isDead) return;
    
    // Apply gravity
    velocity.y += GRAVITY;
    
    // Movement direction based on camera orientation
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(new THREE.Euler(0, cameraRotationY, 0)); // Use stored rotation
    forward.y = 0; // Keep movement on xz plane
    forward.normalize();
    
    const right = new THREE.Vector3(1, 0, 0);
    right.applyEuler(new THREE.Euler(0, cameraRotationY, 0)); // Use stored rotation
    right.y = 0; // Keep movement on xz plane
    right.normalize();
    
    // Reset movement velocity
    velocity.x = 0;
    velocity.z = 0;
    
    // Determine if any movement keys are pressed
    const movingForward = keys['w'];
    const movingBackward = keys['s'];
    const movingLeft = keys['a'];
    const movingRight = keys['d'];
    
    // Check if player is moving at all
    const isMoving = movingForward || movingBackward || movingLeft || movingRight;
    
    // Calculate movement direction
    if (movingForward) {
        velocity.x += forward.x * MOVEMENT_SPEED;
        velocity.z += forward.z * MOVEMENT_SPEED;
    }
    if (movingBackward) {
        velocity.x -= forward.x * MOVEMENT_SPEED;
        velocity.z -= forward.z * MOVEMENT_SPEED;
    }
    if (movingLeft) {
        velocity.x -= right.x * MOVEMENT_SPEED;
        velocity.z -= right.z * MOVEMENT_SPEED;
    }
    if (movingRight) {
        velocity.x += right.x * MOVEMENT_SPEED;
        velocity.z += right.z * MOVEMENT_SPEED;
    }
    
    // Normalize velocity if moving diagonally to prevent faster diagonal movement
    if ((movingForward || movingBackward) && (movingLeft || movingRight)) {
        const length = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        if (length > 0) {
            velocity.x = (velocity.x / length) * MOVEMENT_SPEED;
            velocity.z = (velocity.z / length) * MOVEMENT_SPEED;
        }
    }
    
    // Store the running direction if moving
    if (isMoving) {
        runDirection.set(velocity.x, 0, velocity.z).normalize();
        isRunning = true;
    } else {
        isRunning = false;
    }
    
    // Infinite jumping: Jump when space transitions from not pressed to pressed
    const isSpacePressed = keys[' '];
    if (isSpacePressed && !wasSpacePressed) {
        velocity.y = JUMP_FORCE;
    }
    
    // Update player position based on velocity
    playerObject.position.x += velocity.x;
    playerObject.position.y += velocity.y;
    playerObject.position.z += velocity.z;
    
    // Ground collision
    if (playerObject.position.y < GROUND_LEVEL) {
        playerObject.position.y = GROUND_LEVEL;
        velocity.y = 0;
    }
    
    // Update ball rotation based on movement
    if (isMoving) {
        // Calculate rotation axis (perpendicular to movement direction)
        const rotationAxis = new THREE.Vector3(-velocity.z, 0, velocity.x).normalize();
        
        // Calculate rotation amount based on distance moved
        const moveDistance = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        const rotationAmount = moveDistance / PLAYER_RADIUS;
        
        // Apply rotation to the ball
        playerObject.rotateOnAxis(rotationAxis, rotationAmount);
    }
    
    // Boundaries
    const BOUNDARY = 50 - PLAYER_RADIUS;
    if (playerObject.position.x > BOUNDARY) playerObject.position.x = BOUNDARY;
    if (playerObject.position.x < -BOUNDARY) playerObject.position.x = -BOUNDARY;
    if (playerObject.position.z > BOUNDARY) playerObject.position.z = BOUNDARY;
    if (playerObject.position.z < -BOUNDARY) playerObject.position.z = -BOUNDARY;
    
    // Update camera position (third-person view)
    updateCamera();
    
    // Send position update to server
    socket.emit('updatePosition', {
        position: {
            x: playerObject.position.x,
            y: playerObject.position.y,
            z: playerObject.position.z
        },
        rotation: cameraRotationY // Use stored rotation instead of camera.rotation.y
    });
    
    // Update space key state for next frame
    wasSpacePressed = isSpacePressed;
}

// Update the camera position to follow the player in third-person view
function updateCamera() {
    // Apply rotations to the camera
    camera.quaternion.setFromEuler(new THREE.Euler(cameraRotationX, cameraRotationY, 0, 'YXZ'));
    
    // Calculate the camera position relative to the player
    const cameraOffset = new THREE.Vector3(0, 3, 5); // Default offset (behind and above)
    cameraOffset.applyQuaternion(camera.quaternion); // Rotate the offset based on camera rotation
    
    // Set camera position
    camera.position.copy(playerObject.position).add(cameraOffset);
}

// Update bullet positions and trails
function updateBullets() {
    const now = Date.now();
    
    // Skip full update if we have too many bullets and low effects quality
    const optimizeUpdate = gameSettings.graphics.effects === "low" && Object.keys(bullets).length > 15;
    
    // Counter for active bullets to limit based on max particles setting
    const maxBullets = gameSettings.graphics.maxParticles / 5; // Each bullet uses multiple particles
    let activeBullets = 0;
    
    for (const id in bullets) {
        const bullet = bullets[id];
        activeBullets++;
        
        // If we have too many bullets and are on low settings, remove oldest bullets
        if (activeBullets > maxBullets && gameSettings.graphics.effects !== "high") {
            // Remove both bullet mesh and trail
            if (bullet.trail) {
                scene.remove(bullet.trail);
            }
            scene.remove(bullet);
            delete bullets[id];
            continue;
        }
        
        // Client-side prediction of bullet movement
        const predictedPosition = bullet.position.clone().add(
            bullet.direction.clone().multiplyScalar(BULLET_SPEED)
        );
        
        // Check for collisions with raycasting - only in medium and high quality
        if (!optimizeUpdate && gameSettings.graphics.effects !== "low") {
        const raycaster = new THREE.Raycaster(
            bullet.position.clone(),
            bullet.direction.clone().normalize(),
            0,
            bullet.direction.clone().multiplyScalar(BULLET_SPEED).length()
        );
        
        // We only check for collisions with scenery here, not players
        // Player collisions are handled by the server
        }
        
        // Update bullet position
        bullet.position.copy(predictedPosition);
        
        // Update bullet trail if it exists
        if (bullet.trail && bullet.trailPositions) {
            const trailLength = bullet.trailLength || BULLET_TRAIL_LENGTH;
            
            // For optimization on low settings, update trail less frequently
            if (optimizeUpdate && Math.random() > 0.5) {
                continue; // Skip trail update on this frame
            }
            
            // Shift all positions one step back
            for (let i = trailLength - 1; i > 0; i--) {
                bullet.trailPositions[i * 3] = bullet.trailPositions[(i - 1) * 3];
                bullet.trailPositions[i * 3 + 1] = bullet.trailPositions[(i - 1) * 3 + 1];
                bullet.trailPositions[i * 3 + 2] = bullet.trailPositions[(i - 1) * 3 + 2];
            }
            
            // Set first position to current bullet position
            bullet.trailPositions[0] = bullet.position.x;
            bullet.trailPositions[1] = bullet.position.y;
            bullet.trailPositions[2] = bullet.position.z;
            
            // Update the buffer
            bullet.trail.geometry.attributes.position.needsUpdate = true;
        }
        
        // Check lifetime
        if (now - bullet.creationTime > BULLET_LIFETIME) {
            // Remove both bullet mesh and trail
            if (bullet.trail) {
                scene.remove(bullet.trail);
            }
            scene.remove(bullet);
            delete bullets[id];
        }
    }
}

// Main animation loop
function animate() {
    // Request next frame
    if (gameSettings.graphics.fpsLimit > 0) {
        // FPS limiting using setTimeout
        setTimeout(() => {
    requestAnimationFrame(animate);
        }, 1000 / gameSettings.graphics.fpsLimit);
    } else {
        // No FPS limit
        requestAnimationFrame(animate);
    }
    
    // Update FPS counter
    const frameTime = updateFpsCounter();
    
    if (playerObject) {
        updateMovement();
    }
    
    // Update bullets with client-side prediction
    updateBullets();
    
    // Update impact effects
    updateImpactEffects();
    
    // Update cooldown indicator
    updateCooldownIndicator();
    
    // Render the scene with current settings
    renderer.render(scene, camera);
}

// Start the game when the page loads
window.onload = init;

// Play a footstep sound
function playFootstepSound() {
    if (window.AudioContext || window.webkitAudioContext) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Use a low frequency for footstep sound
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(60, audioContext.currentTime);
        
        // Short duration with quick fade out
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }
}

// Apply resolution settings to the renderer
function applyResolutionSettings() {
    // Get current preset scale
    const scale = gameSettings.resolution.scale;
    
    // Calculate scaled dimensions
    const scaledWidth = Math.floor(window.innerWidth * scale);
    const scaledHeight = Math.floor(window.innerHeight * scale);
    
    // Update internal resolution tracking
    gameSettings.resolution.width = scaledWidth;
    gameSettings.resolution.height = scaledHeight;
    
    // Set renderer size to the scaled dimensions
    renderer.setSize(scaledWidth, scaledHeight);
    
    // Adjust the pixel ratio based on scale
    // For lower resolutions, we reduce the pixel ratio to improve performance
    if (scale < 1.0) {
        renderer.setPixelRatio(window.devicePixelRatio * scale);
    } else {
        renderer.setPixelRatio(window.devicePixelRatio);
    }
    
    // Update the CSS to maintain full screen size
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    
    // Update camera aspect ratio
    camera.aspect = scaledWidth / scaledHeight;
    camera.updateProjectionMatrix();
    
    console.log(`Resolution set to: ${scaledWidth}x${scaledHeight} (scale: ${scale})`);
}

// Set up an FPS counter
function setupFpsCounter() {
    // Create FPS counter element
    fpsCounter = document.createElement('div');
    fpsCounter.id = 'fpsCounter';
    fpsCounter.style.position = 'absolute';
    fpsCounter.style.top = '10px';
    fpsCounter.style.right = '10px';
    fpsCounter.style.color = 'white';
    fpsCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    fpsCounter.style.padding = '5px';
    fpsCounter.style.borderRadius = '5px';
    fpsCounter.style.fontFamily = 'monospace';
    fpsCounter.style.fontSize = '14px';
    fpsCounter.style.zIndex = '100';
    fpsCounter.textContent = 'FPS: 0';
    document.body.appendChild(fpsCounter);
    
    // Initialize performance tracking
    gameSettings.performance.lastFrameTime = performance.now();
    gameSettings.performance.lastFpsUpdate = performance.now();
}

// Update FPS counter
function updateFpsCounter() {
    const now = performance.now();
    
    // Count frames
    gameSettings.performance.framesThisSecond++;
    
    // If a second has passed since last update
    if (now - gameSettings.performance.lastFpsUpdate >= gameSettings.performance.fpsUpdateInterval) {
        // Calculate FPS
        gameSettings.performance.fps = Math.round(
            (gameSettings.performance.framesThisSecond * 1000) / 
            (now - gameSettings.performance.lastFpsUpdate)
        );
        
        // Update FPS counter display
        fpsCounter.textContent = `FPS: ${gameSettings.performance.fps}`;
        
        // Add to history for adaptive scaling
        gameSettings.performance.fpsHistory.push(gameSettings.performance.fps);
        
        // Keep history at a reasonable size
        if (gameSettings.performance.fpsHistory.length > 10) {
            gameSettings.performance.fpsHistory.shift();
        }
        
        // Check if we need to apply adaptive scaling
        if (gameSettings.performance.adaptiveQualityEnabled) {
            checkAdaptiveScaling();
        }
        
        // Reset frame counter and update time
        gameSettings.performance.framesThisSecond = 0;
        gameSettings.performance.lastFpsUpdate = now;
    }
    
    // Calculate frame time
    const frameTime = now - gameSettings.performance.lastFrameTime;
    gameSettings.performance.lastFrameTime = now;
    
    return frameTime;
}

// Check and apply adaptive scaling based on performance
function checkAdaptiveScaling() {
    // Only apply if auto-scale is enabled
    if (!gameSettings.resolution.autoScale) return;
    
    // Calculate average FPS from history
    const avgFps = gameSettings.performance.fpsHistory.reduce((a, b) => a + b, 0) / 
                  gameSettings.performance.fpsHistory.length;
    
    // If FPS is consistently below target by 20%, reduce quality
    if (avgFps < gameSettings.performance.targetFps * 0.8) {
        lowerGraphicsQuality();
    }
    // If FPS is consistently above target by 20%, we can increase quality
    else if (avgFps > gameSettings.performance.targetFps * 1.2) {
        increaseGraphicsQuality();
    }
}

// Lower graphics quality to improve performance
function lowerGraphicsQuality() {
    let changed = false;
    
    // First try reducing resolution
    if (gameSettings.resolution.scale > 0.5) {
        gameSettings.resolution.scale -= 0.1;
        applyResolutionSettings();
        changed = true;
        console.log("Adaptive scaling: Reduced resolution to improve performance");
    }
    // Then try disabling antialiasing
    else if (gameSettings.graphics.antialiasing) {
        gameSettings.graphics.antialiasing = false;
        console.log("Adaptive scaling: Disabled antialiasing to improve performance");
        changed = true;
        // This requires renderer recreation, which we'll handle in the settings UI for now
    }
    // Then try reducing shadows
    else if (gameSettings.graphics.shadows === "high") {
        gameSettings.graphics.shadows = "medium";
        applyShadowSettings();
        changed = true;
        console.log("Adaptive scaling: Reduced shadow quality to improve performance");
    }
    else if (gameSettings.graphics.shadows === "medium") {
        gameSettings.graphics.shadows = "low";
        applyShadowSettings();
        changed = true;
        console.log("Adaptive scaling: Reduced shadow quality to improve performance");
    }
    else if (gameSettings.graphics.shadows === "low") {
        gameSettings.graphics.shadows = "off";
        applyShadowSettings();
        changed = true;
        console.log("Adaptive scaling: Disabled shadows to improve performance");
    }
    
    if (changed) {
        // Reset FPS history after making a change
        gameSettings.performance.fpsHistory = [];
    }
}

// Increase graphics quality if performance allows
function increaseGraphicsQuality() {
    let changed = false;
    
    // First try enabling shadows
    if (gameSettings.graphics.shadows === "off") {
        gameSettings.graphics.shadows = "low";
        applyShadowSettings();
        changed = true;
        console.log("Adaptive scaling: Enabled low shadows due to good performance");
    }
    // Then try increasing shadow quality
    else if (gameSettings.graphics.shadows === "low") {
        gameSettings.graphics.shadows = "medium";
        applyShadowSettings();
        changed = true;
        console.log("Adaptive scaling: Increased shadow quality due to good performance");
    }
    else if (gameSettings.graphics.shadows === "medium") {
        gameSettings.graphics.shadows = "high";
        applyShadowSettings();
        changed = true;
        console.log("Adaptive scaling: Increased shadow quality to high due to good performance");
    }
    // Then try enabling antialiasing
    else if (!gameSettings.graphics.antialiasing) {
        gameSettings.graphics.antialiasing = true;
        console.log("Adaptive scaling: Enabled antialiasing due to good performance");
        changed = true;
        // This requires renderer recreation, which we'll handle in the settings UI for now
    }
    // Finally try increasing resolution
    else if (gameSettings.resolution.scale < 1.0) {
        gameSettings.resolution.scale += 0.1;
        if (gameSettings.resolution.scale > 1.0) gameSettings.resolution.scale = 1.0;
        applyResolutionSettings();
        changed = true;
        console.log("Adaptive scaling: Increased resolution due to good performance");
    }
    
    if (changed) {
        // Reset FPS history after making a change
        gameSettings.performance.fpsHistory = [];
    }
}

// Apply shadow settings
function applyShadowSettings() {
    // Enable/disable shadows based on settings
    renderer.shadowMap.enabled = gameSettings.graphics.shadows !== "off";
    
    // Update directional light shadow settings if it exists
    const directionalLights = scene.children.filter(
        child => child instanceof THREE.DirectionalLight
    );
    
    for (const light of directionalLights) {
        light.castShadow = gameSettings.graphics.shadows !== "off";
        
        if (light.castShadow) {
            // Adjust shadow map size based on quality
            if (gameSettings.graphics.shadows === "high") {
                light.shadow.mapSize.width = 2048;
                light.shadow.mapSize.height = 2048;
            } else if (gameSettings.graphics.shadows === "medium") {
                light.shadow.mapSize.width = 1024;
                light.shadow.mapSize.height = 1024;
            } else if (gameSettings.graphics.shadows === "low") {
                light.shadow.mapSize.width = 512;
                light.shadow.mapSize.height = 512;
            }
        }
    }
    
    // Update all objects in the scene that can receive shadows
    scene.traverse(function(object) {
        if (object.isMesh) {
            object.receiveShadow = gameSettings.graphics.shadows !== "off";
            // Only enable cast shadow for non-ground objects (to save performance)
            if (object !== ground) {
                object.castShadow = gameSettings.graphics.shadows !== "off";
            }
        }
    });
} 