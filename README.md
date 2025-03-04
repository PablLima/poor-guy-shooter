# Multiplayer 3D Ball Shooter

A 3D multiplayer game built with Three.js and Socket.io where players control balls that can move, jump, and shoot. Players can die when hit by bullets and respawn after a short delay.

## Features

- 3D third-person gameplay with Three.js
- Real-time multiplayer functionality with Socket.io
- Player controls:
  - WASD / Arrow Keys for movement
  - Spacebar for jumping
  - Left Mouse Button for shooting
- Player identification with unique colors and name tags
- Death and respawn mechanics
- Realistic ball movement physics:
  - Balls move with human-like running motion
  - Periodic bouncing that mimics human stride
  - Proper rolling animation based on movement direction
  - Footstep sounds synchronized with bounces
- Enhanced bullet physics and visual effects:
  - Bullet trails
  - Muzzle flash
  - Impact particles
  - Lighting effects
  - Shooting cooldown indicator
  - Dynamic crosshair
- Background music and sound effects:
  - Epic background music that loops continuously
  - Music controls (play/pause and volume)
  - Dynamic volume adjustment during gameplay events
  - Sound effects for player joining/leaving
- Simple physics simulation (gravity, collision detection)

## Setup and Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3000`
5. For multiplayer, have other players connect to your IP address on port 3000

## How to Play

1. When you join the game, you'll be assigned a random color and spawn position
2. Click on the game to enable mouse controls (pointer lock)
3. Use WASD to move your ball around the arena
4. Press Spacebar to jump
5. Click the Left Mouse Button to shoot bullets
6. If you're hit by another player's bullet, you'll die and respawn after 5 seconds
7. Press ESC to release the mouse pointer
8. Watch the cooldown indicator in the bottom right to know when you can shoot again
9. Use the music controls in the bottom left to adjust or toggle background music
10. Try to hit other players while avoiding their bullets!

## Technical Details

The game utilizes:
- Three.js for 3D rendering
- Socket.io for real-time multiplayer communication
- Express.js for the server
- HTML5 Canvas for name tag rendering
- YouTube IFrame API for background music

### Ball Movement Physics

The game implements realistic ball movement that mimics human running:

- **Stride Simulation**: Balls bounce periodically at a frequency of 3 steps per second, matching human running cadence
- **Vertical Dynamics**: Each bounce reaches a height of ~13cm, similar to a human's vertical displacement during running
- **Rolling Physics**: Balls rotate realistically based on movement direction and speed
- **Footstep Sounds**: Audio feedback synchronized with each bounce for immersion
- **Smooth Transitions**: Natural transitions between running, jumping, and stopping

### Bullet Physics Implementation

The game implements advanced bullet physics:

#### Server-Side
- Segment-sphere collision detection for precise hit detection
- Bullet lifetime management to prevent lingering projectiles
- Normalized vectors for consistent bullet speed
- Impact detection for ground and player collisions

#### Client-Side
- Bullet trails using dynamic geometry
- Client-side prediction for smooth movement between server updates
- Visual effects:
  - Particle systems for impacts
  - Light sources for muzzle flash and impacts
  - Emissive materials for bullet glow

### Audio Implementation

- Background music via YouTube IFrame API
- Music auto-starts when player begins gameplay
- Volume adjusts dynamically during gameplay events:
  - Lowers volume when player is hit
  - Returns to normal volume on respawn
- Simple sound effects generated with Web Audio API

## Project Structure

- `server.js` - Node.js server handling game logic and multiplayer
- `public/index.html` - Main HTML file and UI elements
- `public/game.js` - Client-side game logic with Three.js

## License

MIT 