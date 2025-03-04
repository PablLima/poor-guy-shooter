const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// Create the Express app, HTTP server, and Socket.io instance
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Game state
const players = {};
const bullets = {};
let bulletId = 0;

// Game constants
const BULLET_SPEED = 0.5; // Units per frame
const PLAYER_RADIUS = 1;
const BULLET_RADIUS = 0.2;
const BULLET_LIFETIME = 5000; // 5 seconds in ms

// Vector utility functions
const vectorLength = (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const normalizeVector = (v) => {
    const length = vectorLength(v);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / length, y: v.y / length, z: v.z / length };
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  // Create a new player
  players[socket.id] = {
    id: socket.id,
    position: {
      x: Math.random() * 80 - 40,
      y: 1, // Starting height (ball radius)
      z: Math.random() * 80 - 40
    },
    rotation: 0,
    color: getRandomColor(),
    isDead: false,
    respawnTimer: null
  };
  
  // Send the new player their ID and the current game state
  socket.emit('init', {
    id: socket.id,
    players: players,
    bullets: bullets
  });
  
  // Broadcast the new player to all other players
  socket.broadcast.emit('newPlayer', players[socket.id]);
  
  // Player movement
  socket.on('updatePosition', (data) => {
    if (players[socket.id] && !players[socket.id].isDead) {
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position: data.position,
        rotation: data.rotation
      });
    }
  });
  
  // Player shooting
  socket.on('shoot', (data) => {
    if (players[socket.id] && !players[socket.id].isDead) {
      const bulletId = `bullet_${socket.id}_${Date.now()}`;
      
      // Normalize direction vector
      const normalizedDirection = normalizeVector(data.direction);
      
      const newBullet = {
        id: bulletId,
        position: data.position,
        direction: normalizedDirection,
        ownerId: socket.id,
        creationTime: Date.now()
      };
      
      bullets[bulletId] = newBullet;
      io.emit('newBullet', newBullet);
    }
  });
  
  // Player disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Remove player's bullets
    for (let bid in bullets) {
      if (bullets[bid].ownerId === socket.id) {
        delete bullets[bid];
      }
    }
    
    // Remove the player
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Game loop for server-side physics (bullet movement and collision detection)
setInterval(() => {
  // Update bullet positions and check for collisions
  updateBullets();
}, 16); // ~60 updates per second

// Bullet physics and collision detection
function updateBullets() {
  const now = Date.now();
  
  // Update bullet positions and check lifetime
  for (let bid in bullets) {
    const bullet = bullets[bid];
    
    // Check bullet lifetime
    if (now - bullet.creationTime > BULLET_LIFETIME) {
      delete bullets[bid];
      io.emit('removeBullet', bid);
      continue;
    }
    
    // Previous position (for collision checking)
    const prevPosition = { ...bullet.position };
    
    // Move bullet forward in its direction
    bullet.position.x += bullet.direction.x * BULLET_SPEED;
    bullet.position.y += bullet.direction.y * BULLET_SPEED;
    bullet.position.z += bullet.direction.z * BULLET_SPEED;
    
    // Check if bullet is out of bounds
    if (
      bullet.position.x > 100 || bullet.position.x < -100 ||
      bullet.position.y > 100 || bullet.position.y < -100 ||
      bullet.position.z > 100 || bullet.position.z < -100
    ) {
      delete bullets[bid];
      io.emit('removeBullet', bid);
      continue;
    }
    
    // Check if bullet hits the ground
    if (bullet.position.y < BULLET_RADIUS) {
      // Emit special impact event for visual effect
      io.emit('bulletImpact', {
        position: {
          x: bullet.position.x,
          y: BULLET_RADIUS,
          z: bullet.position.z
        },
        normal: { x: 0, y: 1, z: 0 }
      });
      
      delete bullets[bid];
      io.emit('removeBullet', bid);
      continue;
    }
    
    // Check for collisions with players
    let collisionDetected = false;
    
    for (let pid in players) {
      const player = players[pid];
      
      // Skip if this player is already dead or if the bullet belongs to this player
      if (player.isDead || bullet.ownerId === pid) continue;
      
      // Segment-sphere collision detection for more accuracy
      // Check if the line segment from prevPosition to bullet.position intersects with player sphere
      
      // Direction vector of the bullet's movement this frame
      const moveVector = {
        x: bullet.position.x - prevPosition.x,
        y: bullet.position.y - prevPosition.y,
        z: bullet.position.z - prevPosition.z
      };
      
      // Vector from previous bullet position to player center
      const toCenterVector = {
        x: player.position.x - prevPosition.x,
        y: player.position.y - prevPosition.y,
        z: player.position.z - prevPosition.z
      };
      
      // Length of bullet movement
      const moveLength = vectorLength(moveVector);
      
      // Normalize move vector
      const moveDirection = normalizeVector(moveVector);
      
      // Project toCenterVector onto moveDirection to find closest point
      const dotProduct = 
        toCenterVector.x * moveDirection.x + 
        toCenterVector.y * moveDirection.y + 
        toCenterVector.z * moveDirection.z;
      
      // Clamp to segment
      const t = Math.max(0, Math.min(moveLength, dotProduct));
      
      // Find closest point on segment to player center
      const closestPoint = {
        x: prevPosition.x + moveDirection.x * t,
        y: prevPosition.y + moveDirection.y * t,
        z: prevPosition.z + moveDirection.z * t
      };
      
      // Calculate distance from closest point to player center
      const dx = closestPoint.x - player.position.x;
      const dy = closestPoint.y - player.position.y;
      const dz = closestPoint.z - player.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // Check if distance is less than sum of radii
      if (distance < PLAYER_RADIUS + BULLET_RADIUS) {
        // Player is hit
        player.isDead = true;
        
        // Calculate impact point (slightly inside the player's sphere)
        const impactPoint = {
          x: closestPoint.x + (player.position.x - closestPoint.x) * 0.9,
          y: closestPoint.y + (player.position.y - closestPoint.y) * 0.9,
          z: closestPoint.z + (player.position.z - closestPoint.z) * 0.9
        };
        
        // Calculate impact normal (towards bullet direction)
        const impactNormal = normalizeVector({
          x: -bullet.direction.x,
          y: -bullet.direction.y,
          z: -bullet.direction.z
        });
        
        // Emit impact effect for visual feedback
        io.emit('bulletImpact', {
          position: impactPoint,
          normal: impactNormal
        });
        
        // Remove the bullet
        delete bullets[bid];
        
        // Broadcast the hit and bullet removal
        io.emit('playerHit', pid);
        io.emit('removeBullet', bid);
        
        // Set up respawn timer (5 seconds)
        player.respawnTimer = setTimeout(() => {
          // Respawn the player at a random position
          player.position = {
            x: Math.random() * 80 - 40,
            y: 1,
            z: Math.random() * 80 - 40
          };
          player.isDead = false;
          
          // Broadcast the respawn
          io.emit('playerRespawn', {
            id: pid,
            position: player.position
          });
        }, 5000);
        
        collisionDetected = true;
        break; // Break since this bullet has been removed
      }
    }
    
    // Skip the rest if collision was detected
    if (collisionDetected) continue;
  }
}

// Helper function to get a random color
function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 