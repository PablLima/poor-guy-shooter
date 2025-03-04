# Performance Optimization and Resolution Settings

This implementation adds resolution scaling and performance optimizations to improve FPS on low-end devices. The key features include:

## Resolution Scaling

- **Resolution Presets**: Low (50%), Medium (75%), High (100%), Ultra (100% with enhanced effects)
- **Custom Resolution Scaling**: Adjust from 30% to 100% with a slider
- **Auto-Scale**: Automatically adjusts resolution based on performance

## Graphics Settings

- **Shadow Quality**: Off, Low, Medium, High options with different shadow map sizes
- **Antialiasing**: Toggle on/off
- **Effects Quality**: Low, Medium, High affecting particle counts and visual effects
- **Draw Distance**: Adjustable slider to limit rendering distance
- **Maximum Particles**: Control the maximum number of particles allowed

## Performance Features

- **FPS Limiter**: Cap FPS to 30, 60, 120 or unlimited
- **Vertical Sync**: Toggle to reduce screen tearing
- **Motion Effects**: Toggle on/off for reduced visual complexity
- **FPS Counter**: Monitor performance
- **Adaptive Quality**: Auto-adjust settings based on FPS

## Optimization Techniques

1. **Dynamic Resolution Scaling**: Renders at lower resolution while maintaining full-screen display
2. **Shadow Optimization**: Adjusts shadow map size or disables shadows entirely
3. **Particle System Optimizations**:
   - Reduced particle counts on lower settings
   - Shorter effect lifetimes
   - Fewer active particles allowed
4. **Bullet Trail Optimization**:
   - Shorter trails on lower settings
   - Less frequent updates
   - Maximum bullet count limits
5. **Lighting Effects Reduction**:
   - Disabled point lights on low settings
   - Simplified collision detection

## Settings UI

A comprehensive settings modal provides access to all graphics options with:
- Preset buttons for quick configuration
- Real-time display of current resolution
- Settings persistence across game sessions
- Apply/Cancel/Save options

## Adaptive Performance

The game automatically monitors FPS and can adjust settings to maintain target performance by:
1. Lowering resolution first
2. Disabling antialiasing
3. Reducing shadow quality
4. Disabling shadows completely

## Implementation Details

- Settings are saved to localStorage
- FPS monitoring with history tracking
- Graceful fallback for devices without localStorage
- Non-blocking UI for settings changes 