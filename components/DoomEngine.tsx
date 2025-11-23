import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SCREEN_WIDTH, SCREEN_HEIGHT, TEXTURES, MAP_SIZE, ENEMY_STATS, ROTATION_SPEED, MOVE_SPEED } from '../constants';
import { Entity, EnemyType, PlayerStats, GameState } from '../types';

// -- Helper Math --
const distance = (x1: number, y1: number, x2: number, y2: number) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

const DoomEngine: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // -- Game State Refs (Mutable for performance in loop) --
  const playerRef = useRef({
    x: 3.5,
    y: 3.5,
    dirX: -1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
    isBlocking: false,
    weaponFrame: 0,
    attackCooldown: 0,
  });

  const statsRef = useRef<PlayerStats>({
    hp: 200,
    maxHp: 200,
    attack: 100,
    defense: 0,
    resistance: 0,
    xp: 0,
    level: 1,
    xpToNextLevel: 200,
  });

  const enemiesRef = useRef<Entity[]>([]);
  const mapRef = useRef<number[][]>([]);
  
  // -- React State for UI Updates --
  const [uiStats, setUiStats] = useState<PlayerStats>(statsRef.current);
  const [gameState, setGameState] = useState<GameState>({
    floor: 1,
    messageLog: ["Bienvenido a la mazmorra. Rescata a tu esposa!"],
    isInventoryOpen: false,
    isStatsOpen: false,
    isPaused: false,
    screen: 'INTRO',
  });

  // -- Input State --
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // -- Helpers --
  const shadeColor = (color: string, percent: number) => {
    let R = parseInt(color.substring(1,3),16);
    let G = parseInt(color.substring(3,5),16);
    let B = parseInt(color.substring(5,7),16);

    R = Math.floor(R * (100 + percent) / 100);
    G = Math.floor(G * (100 + percent) / 100);
    B = Math.floor(B * (100 + percent) / 100);

    R = (R<255)?R:255;  
    G = (G<255)?G:255;  
    B = (B<255)?B:255;  
    
    R = Math.max(0, R);
    G = Math.max(0, G);
    B = Math.max(0, B);

    const RR = ((R.toString(16).length===1)?"0"+R.toString(16):R.toString(16));
    const GG = ((G.toString(16).length===1)?"0"+G.toString(16):G.toString(16));
    const BB = ((B.toString(16).length===1)?"0"+B.toString(16):B.toString(16));

    return "#"+RR+GG+BB;
  };

  // -- Initialization --
  const generateLevel = (floor: number) => {
    // 1. Generate Map Grid (0 = empty, 1+ = walls)
    const newMap: number[][] = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      newMap[x] = [];
      for (let y = 0; y < MAP_SIZE; y++) {
        // Walls on border
        if (x === 0 || x === MAP_SIZE - 1 || y === 0 || y === MAP_SIZE - 1) {
          newMap[x][y] = 1;
        } else {
          // Random pillars
          newMap[x][y] = Math.random() > 0.85 ? 2 : 0;
        }
      }
    }
    // Clear start area
    newMap[3][3] = 0;
    newMap[3][4] = 0;
    newMap[4][3] = 0;
    
    mapRef.current = newMap;
    playerRef.current.x = 3.5;
    playerRef.current.y = 3.5;

    // 2. Spawn Enemies based on Floor
    const newEnemies: Entity[] = [];
    let goblinCount = 0;
    let skeletonCount = 0;
    let dragonCount = 0;

    if (floor === 1) {
      goblinCount = 10;
    } else if (floor === 2) {
      goblinCount = 10;
      skeletonCount = 10; 
    } else if (floor === 3) {
      goblinCount = 20; // Hordes start
    } else if (floor === 4) {
      skeletonCount = 20;
    } else if (floor >= 5 && floor <= 9) {
      const isGoblinHorde = Math.random() > 0.5;
      if (isGoblinHorde) goblinCount = 20;
      else skeletonCount = 20;
    } else if (floor === 10) {
      dragonCount = 1;
    }

    const spawnEnemy = (type: EnemyType, count: number) => {
      for (let i = 0; i < count; i++) {
        let ex, ey;
        do {
          ex = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
          ey = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
        } while (mapRef.current[ex][ey] !== 0 || distance(ex, ey, 3.5, 3.5) < 5);

        const baseStats = ENEMY_STATS[type];
        newEnemies.push({
          id: Math.random(),
          x: ex + 0.5,
          y: ey + 0.5,
          type: type,
          hp: baseStats.hp,
          maxHp: baseStats.hp,
          damage: baseStats.damage,
          xpValue: baseStats.xp,
          dead: false,
          state: 'IDLE',
        });
      }
    };

    spawnEnemy(EnemyType.GOBLIN, goblinCount);
    spawnEnemy(EnemyType.SKELETON, skeletonCount);
    spawnEnemy(EnemyType.DRAGON, dragonCount);

    enemiesRef.current = newEnemies;
  };

  const addLog = (msg: string) => {
    setGameState(prev => ({ ...prev, messageLog: [msg, ...prev.messageLog].slice(0, 5) }));
  };

  const handleWin = () => {
    setGameState(prev => ({ ...prev, screen: 'WIN' }));
  };

  // -- Drawing Helpers --
  const drawSprite = (ctx: CanvasRenderingContext2D, type: EnemyType, x: number, y: number, w: number, h: number, seed: number, dist: number) => {
     // Procedural sprite drawing
     const stats = ENEMY_STATS[type];
     
     // Calculate Shading based on distance
     const fogPct = Math.min(80, Math.max(0, (dist - 2) * 10)); // 0 to 80% darker
     const bodyColor = shadeColor(stats.color, -fogPct);
     const boneColor = shadeColor('#e2e8f0', -fogPct);
     const wingColor = shadeColor('#6b46c1', -fogPct);

     // Shadow
     ctx.fillStyle = `rgba(0,0,0,${0.5 - fogPct/200})`;
     ctx.beginPath();
     ctx.ellipse(x + w/2, y + h, w/2, h/5, 0, 0, Math.PI * 2);
     ctx.fill();

     // Body
     if (type === EnemyType.DRAGON) {
         ctx.fillStyle = bodyColor;
         ctx.fillRect(x + w*0.2, y + h*0.2, w*0.6, h*0.6); // Main body
         // Wings
         ctx.fillStyle = wingColor; 
         ctx.beginPath();
         ctx.moveTo(x + w*0.2, y + h*0.3);
         ctx.lineTo(x - w*0.2, y);
         ctx.lineTo(x + w*0.2, y + h*0.5);
         ctx.fill();
         ctx.beginPath();
         ctx.moveTo(x + w*0.8, y + h*0.3);
         ctx.lineTo(x + w*1.2, y);
         ctx.lineTo(x + w*0.8, y + h*0.5);
         ctx.fill();
         // Eyes (Glowing, so not shaded)
         ctx.fillStyle = 'yellow';
         ctx.fillRect(x + w*0.4, y + h*0.3, w*0.05, h*0.05);
         ctx.fillRect(x + w*0.55, y + h*0.3, w*0.05, h*0.05);

     } else if (type === EnemyType.SKELETON) {
         ctx.fillStyle = boneColor;
         ctx.fillRect(x + w*0.3, y, w*0.4, h*0.9); // Bones
         ctx.fillStyle = 'black';
         ctx.fillRect(x + w*0.35, y + h*0.1, w*0.1, h*0.05); // Eye
         ctx.fillRect(x + w*0.55, y + h*0.1, w*0.1, h*0.05); // Eye
     } else {
         // Goblin
         ctx.fillStyle = bodyColor;
         ctx.fillRect(x + w*0.25, y + h*0.3, w*0.5, h*0.6);
         ctx.fillStyle = 'red';
         ctx.fillRect(x + w*0.35, y + h*0.4, w*0.1, h*0.05); // Eye
         ctx.fillRect(x + w*0.55, y + h*0.4, w*0.1, h*0.05); // Eye
     }
  };

  const renderWeapon = (ctx: CanvasRenderingContext2D, cooldown: number, isBlocking: number | boolean) => {
     // Draw Sword / Shield
     const handOffset = Math.sin(Date.now() / 200) * 10; // Bobbing

     if (isBlocking) {
         // Draw Shield
         ctx.fillStyle = '#718096'; // Gray shield
         ctx.fillRect(SCREEN_WIDTH/2 - 50, SCREEN_HEIGHT - 150 + handOffset, 100, 150);
         ctx.strokeStyle = '#2d3748';
         ctx.lineWidth = 5;
         ctx.strokeRect(SCREEN_WIDTH/2 - 50, SCREEN_HEIGHT - 150 + handOffset, 100, 150);
         return;
     }

     // Sword
     const swingOffset = cooldown > 0 ? 50 : 0;
     const swingRot = cooldown > 0 ? 0.5 : 0;
     
     ctx.save();
     ctx.translate(SCREEN_WIDTH - 150 + swingOffset, SCREEN_HEIGHT - 10 + handOffset);
     ctx.rotate(-0.2 + swingRot);
     
     // Blade
     ctx.fillStyle = '#cbd5e0';
     ctx.fillRect(0, -200, 40, 200);
     // Shiny edge
     ctx.fillStyle = '#fff';
     ctx.fillRect(35, -200, 5, 200);
     
     // Handle
     ctx.fillStyle = '#744210';
     ctx.fillRect(5, 0, 30, 60);
     // Guard
     ctx.fillStyle = '#f6e05e';
     ctx.fillRect(-20, 0, 80, 20);
     ctx.strokeStyle = '#d69e2e';
     ctx.strokeRect(-20, 0, 80, 20);
     
     ctx.restore();
  };

  // -- Game Loop --
  useEffect(() => {
    let animationFrameId: number;
    
    // Initial Level Gen
    if (gameState.screen === 'GAME' && mapRef.current.length === 0) {
      generateLevel(1);
    }

    const gameLoop = () => {
      if (gameState.screen !== 'GAME') {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      // Pause Logic: If paused, skip updates and render, just keep loop alive
      if (gameState.isPaused) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. UPDATE LOGIC
      const p = playerRef.current;
      const map = mapRef.current;

      // Movement
      if (keysPressed.current['w']) {
        if (map[Math.floor(p.x + p.dirX * MOVE_SPEED)][Math.floor(p.y)] === 0) p.x += p.dirX * MOVE_SPEED;
        if (map[Math.floor(p.x)][Math.floor(p.y + p.dirY * MOVE_SPEED)] === 0) p.y += p.dirY * MOVE_SPEED;
      }
      if (keysPressed.current['s']) {
        if (map[Math.floor(p.x - p.dirX * MOVE_SPEED)][Math.floor(p.y)] === 0) p.x -= p.dirX * MOVE_SPEED;
        if (map[Math.floor(p.x)][Math.floor(p.y - p.dirY * MOVE_SPEED)] === 0) p.y -= p.dirY * MOVE_SPEED;
      }
      if (keysPressed.current['d']) { // Strafe Right
        const strafeDirX = p.planeX; 
        const strafeDirY = p.planeY;
        if (map[Math.floor(p.x + strafeDirX * MOVE_SPEED)][Math.floor(p.y)] === 0) p.x += strafeDirX * MOVE_SPEED;
        if (map[Math.floor(p.x)][Math.floor(p.y + strafeDirY * MOVE_SPEED)] === 0) p.y += strafeDirY * MOVE_SPEED;
      }
      if (keysPressed.current['a']) { // Strafe Left
         const strafeDirX = p.planeX; 
         const strafeDirY = p.planeY;
        if (map[Math.floor(p.x - strafeDirX * MOVE_SPEED)][Math.floor(p.y)] === 0) p.x -= strafeDirX * MOVE_SPEED;
        if (map[Math.floor(p.x)][Math.floor(p.y - strafeDirY * MOVE_SPEED)] === 0) p.y -= strafeDirY * MOVE_SPEED;
      }

      // Keys Rotation (Fallback)
      if (keysPressed.current['q'] || keysPressed.current['ArrowLeft']) {
        const oldDirX = p.dirX;
        p.dirX = p.dirX * Math.cos(ROTATION_SPEED) - p.dirY * Math.sin(ROTATION_SPEED);
        p.dirY = oldDirX * Math.sin(ROTATION_SPEED) + p.dirY * Math.cos(ROTATION_SPEED);
        const oldPlaneX = p.planeX;
        p.planeX = p.planeX * Math.cos(ROTATION_SPEED) - p.planeY * Math.sin(ROTATION_SPEED);
        p.planeY = oldPlaneX * Math.sin(ROTATION_SPEED) + p.planeY * Math.cos(ROTATION_SPEED);
      }
      if (keysPressed.current['e'] || keysPressed.current['ArrowRight']) { 
         // E is inventory, check for ArrowRight specifically for turn
         if (keysPressed.current['ArrowRight']) {
            const oldDirX = p.dirX;
            const rot = -ROTATION_SPEED;
            p.dirX = p.dirX * Math.cos(rot) - p.dirY * Math.sin(rot);
            p.dirY = oldDirX * Math.sin(rot) + p.dirY * Math.cos(rot);
            const oldPlaneX = p.planeX;
            p.planeX = p.planeX * Math.cos(rot) - p.planeY * Math.sin(rot);
            p.planeY = oldPlaneX * Math.sin(rot) + p.planeY * Math.cos(rot);
         }
      }

      // Cooldowns
      if (p.attackCooldown > 0) p.attackCooldown--;

      // Update Enemies
      let activeEnemies = 0;
      enemiesRef.current.forEach(en => {
        if (en.dead) return;
        activeEnemies++;

        const dist = distance(p.x, p.y, en.x, en.y);
        
        // AI: Chase
        if (dist < 10 && dist > 1.0) {
           const dx = (p.x - en.x) / dist;
           const dy = (p.y - en.y) / dist;
           const speed = ENEMY_STATS[en.type].speed;
           
           if (map[Math.floor(en.x + dx * speed)][Math.floor(en.y)] === 0) en.x += dx * speed;
           if (map[Math.floor(en.x)][Math.floor(en.y + dy * speed)] === 0) en.y += dy * speed;
        }

        // AI: Attack
        if (dist < 1.2) {
          if (Math.random() < 0.05) {
            const rawDmg = en.damage;
            const blocked = p.isBlocking;
            const actualDmg = blocked ? Math.max(0, rawDmg - 5) : rawDmg;
            
            statsRef.current.hp -= actualDmg;
            if (statsRef.current.hp <= 0) {
               setGameState(g => ({...g, screen: 'LOSE'}));
            }
            setUiStats({...statsRef.current});
          }
        }
      });

      // Level Progression logic
      if (activeEnemies === 0 && enemiesRef.current.length > 0) {
        if (gameState.floor === 10) {
          handleWin();
        } else {
          addLog(`Piso ${gameState.floor} completado! Bajando...`);
          const nextFloor = gameState.floor + 1;
          setGameState(prev => ({ ...prev, floor: nextFloor }));
          generateLevel(nextFloor);
        }
      }

      // 2. RENDER LOGIC (Raycasting)
      
      // Ceiling
      ctx.fillStyle = TEXTURES.CEILING;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
      
      // Floor Gradient
      const floorGrad = ctx.createLinearGradient(0, SCREEN_HEIGHT/2, 0, SCREEN_HEIGHT);
      floorGrad.addColorStop(0, '#000000');
      floorGrad.addColorStop(0.3, TEXTURES.FLOOR);
      floorGrad.addColorStop(1, '#2d3748');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);

      const zBuffer: number[] = new Array(SCREEN_WIDTH).fill(0);

      // Raycast Walls
      for (let x = 0; x < SCREEN_WIDTH; x += 2) { 
        const cameraX = 2 * x / SCREEN_WIDTH - 1;
        const rayDirX = p.dirX + p.planeX * cameraX;
        const rayDirY = p.dirY + p.planeY * cameraX;

        let mapX = Math.floor(p.x);
        let mapY = Math.floor(p.y);

        let sideDistX;
        let sideDistY;

        const deltaDistX = Math.abs(1 / rayDirX);
        const deltaDistY = Math.abs(1 / rayDirY);
        let perpWallDist;

        let stepX;
        let stepY;

        let hit = 0;
        let side = 0;

        if (rayDirX < 0) {
          stepX = -1;
          sideDistX = (p.x - mapX) * deltaDistX;
        } else {
          stepX = 1;
          sideDistX = (mapX + 1.0 - p.x) * deltaDistX;
        }
        if (rayDirY < 0) {
          stepY = -1;
          sideDistY = (p.y - mapY) * deltaDistY;
        } else {
          stepY = 1;
          sideDistY = (mapY + 1.0 - p.y) * deltaDistY;
        }

        while (hit === 0) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
          } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
          }
          if (mapRef.current[mapX][mapY] > 0) hit = 1;
        }

        if (side === 0) perpWallDist = (mapX - p.x + (1 - stepX) / 2) / rayDirX;
        else perpWallDist = (mapY - p.y + (1 - stepY) / 2) / rayDirY;

        zBuffer[x] = perpWallDist;
        zBuffer[x+1] = perpWallDist; 

        const lineHeight = Math.floor(SCREEN_HEIGHT / perpWallDist);
        let drawStart = -lineHeight / 2 + SCREEN_HEIGHT / 2;
        if (drawStart < 0) drawStart = 0;
        let drawEnd = lineHeight / 2 + SCREEN_HEIGHT / 2;
        if (drawEnd >= SCREEN_HEIGHT) drawEnd = SCREEN_HEIGHT - 1;

        // Wall Color
        const wallType = mapRef.current[mapX][mapY];
        let color = wallType === 1 ? TEXTURES.WALL_1 : TEXTURES.WALL_2;
        if (side === 1) {
            color = shadeColor(color, -20);
        }
        // Distance Fog
        if (perpWallDist > 2) color = shadeColor(color, -10 * (perpWallDist - 2));

        ctx.fillStyle = color;
        ctx.fillRect(x, drawStart, 2, drawEnd - drawStart);
      }

      // Sprite Rendering
      const spriteList = enemiesRef.current
        .map(en => ({ ...en, dist: ((p.x - en.x) ** 2 + (p.y - en.y) ** 2) }))
        .sort((a, b) => b.dist - a.dist);

      for (const sprite of spriteList) {
        if (sprite.dead) continue;

        const spriteX = sprite.x - p.x;
        const spriteY = sprite.y - p.y;

        const invDet = 1.0 / (p.planeX * p.dirY - p.dirX * p.planeY);

        const transformX = invDet * (p.dirY * spriteX - p.dirX * spriteY);
        const transformY = invDet * (-p.planeY * spriteX + p.planeX * spriteY);

        // Near clip plane - Reduced to 0.05 to allow getting closer without disappearing
        if (transformY <= 0.05) continue;

        const spriteScreenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));

        const spriteScale = ENEMY_STATS[sprite.type].scale;
        
        // Clamp sprite size to prevent rendering massive artifacts when very close
        const rawSpriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY)) * spriteScale;
        const spriteHeight = Math.min(SCREEN_HEIGHT * 5, rawSpriteHeight);
        const spriteWidth = spriteHeight; // Square sprites

        const spriteTopY = Math.floor((SCREEN_HEIGHT - spriteHeight) / 2); 
        
        const drawStartY = Math.floor(-spriteHeight / 2 + SCREEN_HEIGHT / 2);
        const drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);
        const drawEndX = drawStartX + spriteWidth;

        // VISIBILITY CHECK
        // Only draw if the sprite is actually on screen horizontally
        if (drawStartX >= SCREEN_WIDTH || drawEndX <= 0) continue;

        // Calculate a sample point for Z-buffer check that is DEFINITELY on screen
        const visibleX1 = Math.max(0, drawStartX);
        const visibleX2 = Math.min(SCREEN_WIDTH - 1, drawEndX);
        const sampleX = Math.floor((visibleX1 + visibleX2) / 2);

        // Check depth at the visible center of the sprite
        // If transformY (distance to sprite) is less than wall distance, render it.
        // We relax the check slightly if very close to ensure it renders over wall glitches
        if (transformY < zBuffer[sampleX] || transformY < 0.5) {
             drawSprite(ctx, sprite.type, drawStartX, drawStartY, spriteWidth, spriteHeight, sprite.id, transformY);
             
             // Draw HP Bar
             const hpPct = sprite.hp / sprite.maxHp;
             const barWidth = Math.max(20, Math.min(spriteWidth, 100)); // Clamp bar size
             const barX = drawStartX + (spriteWidth - barWidth)/2;
             
             ctx.fillStyle = 'rgba(0,0,0,0.5)';
             ctx.fillRect(barX, drawStartY - 15, barWidth, 6);
             ctx.fillStyle = 'red';
             ctx.fillRect(barX, drawStartY - 15, barWidth, 6);
             ctx.fillStyle = '#48bb78';
             ctx.fillRect(barX, drawStartY - 15, barWidth * hpPct, 6);
        }
      }

      // Draw Weapon
      renderWeapon(ctx, p.attackCooldown, p.isBlocking);

      // Draw Damage Vignette
      if (statsRef.current.hp < 50) {
        ctx.fillStyle = `rgba(255, 0, 0, ${0.3 - (statsRef.current.hp / 200)})`;
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    // Start loop
    animationFrameId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState.screen, gameState.floor, gameState.isPaused]); // Dependency added for pause

  // -- Event Listeners --
  const handleKeyDown = (e: KeyboardEvent) => {
    keysPressed.current[e.key.toLowerCase()] = true;
    keysPressed.current[e.code] = true; 
    
    if (e.key === 'e') setGameState(prev => ({...prev, isInventoryOpen: !prev.isInventoryOpen}));
    if (e.key === 'j') setGameState(prev => ({...prev, isStatsOpen: !prev.isStatsOpen}));
    
    // Pause toggle
    if (e.key === 'p' || e.key === 'Escape') {
      setGameState(prev => ({...prev, isPaused: !prev.isPaused}));
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    keysPressed.current[e.key.toLowerCase()] = false;
    keysPressed.current[e.code] = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (gameState.isPaused) return;

    if (e.button === 0) { // Left Click
        performAttack();
    } else if (e.button === 2) { // Right Click
        playerRef.current.isBlocking = true;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2) {
        playerRef.current.isBlocking = false;
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
      // Basic mouse look
      if (gameState.screen === 'GAME' && !gameState.isPaused) {
          const movementX = e.movementX || 0;
          const rotSpeed = 0.002;
          const p = playerRef.current;
          const oldDirX = p.dirX;
          const rot = -movementX * rotSpeed;
          
          p.dirX = p.dirX * Math.cos(rot) - p.dirY * Math.sin(rot);
          p.dirY = oldDirX * Math.sin(rot) + p.dirY * Math.cos(rot);
          const oldPlaneX = p.planeX;
          p.planeX = p.planeX * Math.cos(rot) - p.planeY * Math.sin(rot);
          p.planeY = oldPlaneX * Math.sin(rot) + p.planeY * Math.cos(rot);
      }
  };

  const performAttack = () => {
      const p = playerRef.current;
      if (p.attackCooldown > 0) return;
      
      p.attackCooldown = 15; // Frames
      
      let hit = false;
      
      enemiesRef.current.forEach(en => {
          if (en.dead) return;
          const dist = distance(p.x, p.y, en.x, en.y);
          if (dist < 2.5) {
              const dx = en.x - p.x;
              const dy = en.y - p.y;
              const len = Math.sqrt(dx*dx + dy*dy);
              const ndx = dx/len;
              const ndy = dy/len;
              
              const dot = ndx * p.dirX + ndy * p.dirY;
              
              if (dot > 0.7) { 
                  hit = true;
                  const damage = statsRef.current.attack;
                  en.hp -= damage;
                  addLog(`Golpeas ${en.type} por ${damage} de daño!`);
                  
                  if (en.hp <= 0) {
                      en.dead = true;
                      handleKill(en);
                  }
              }
          }
      });
  };

  const handleKill = (en: Entity) => {
      addLog(`${en.type} derrotado! +${en.xpValue} XP`);
      
      // 1. Heal
      const healAmount = 20; 
      statsRef.current.hp = Math.min(statsRef.current.maxHp + 5, statsRef.current.hp + healAmount); 
      
      // 2. Buff Stats
      statsRef.current.maxHp += 5;
      statsRef.current.attack += 5;
      statsRef.current.resistance += 5;
      statsRef.current.defense += 5;

      // 3. XP
      statsRef.current.xp += en.xpValue;
      if (statsRef.current.xp >= statsRef.current.xpToNextLevel) {
          statsRef.current.level++;
          statsRef.current.xp = 0;
          statsRef.current.xpToNextLevel = Math.floor(statsRef.current.xpToNextLevel * 1.2);
          addLog(`NIVEL SUBIDO! Eres nivel ${statsRef.current.level}`);
          statsRef.current.hp = statsRef.current.maxHp;
      }
      
      setUiStats({...statsRef.current});
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove); 
    
    const canvas = canvasRef.current;
    const clickRequestLock = () => {
        if (gameState.screen === 'GAME') {
            canvas?.requestPointerLock();
        }
    };
    canvas?.addEventListener('click', clickRequestLock);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        document.removeEventListener('mousemove', handleMouseMove);
        canvas?.removeEventListener('click', clickRequestLock);
    };
  }, [gameState.screen]);


  // -- UI Renders --
  
  if (gameState.screen === 'INTRO') {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white p-8 text-center font-serif">
            <h1 className="text-6xl text-red-600 mb-6 font-bold tracking-widest drop-shadow-md">DRAGON SLAYER</h1>
            <p className="text-xl mb-4 max-w-2xl text-gray-300 leading-relaxed">
                Un día normal paseando con tu amada esposa... cuando una sombra gigante cubrió el cielo.
                Un Dragón Rojo Legendario descendió y la arrebató de tus brazos.
            </p>
            <p className="text-lg mb-8 max-w-2xl text-yellow-500">
                Has llegado a la Mazmorra del Dolor. 10 pisos te separan de tu amada.
                Mata monstruos para volverte más fuerte.
            </p>
            <button 
                onClick={() => setGameState(prev => ({...prev, screen: 'GAME'}))}
                className="px-8 py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded border-2 border-red-500 transition-colors"
            >
                ENTRAR A LA MAZMORRA
            </button>
            <div className="mt-8 text-sm text-gray-500">
                CONTROLES: WASD Mover | Mouse Girar | Click Atacar | Click Der. Bloquear | E Inventario | J Estadísticas | P Pausa
            </div>
        </div>
    );
  }

  if (gameState.screen === 'WIN') {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-8 text-center">
            <h1 className="text-6xl text-yellow-400 mb-4">¡VICTORIA!</h1>
            <p className="text-2xl mb-8">Has derrotado al Dragón Rojo y rescatado a tu esposa.</p>
            <p className="text-lg text-gray-400">Estadísticas Finales: Nivel {uiStats.level} | Daño {uiStats.attack}</p>
            <button 
                onClick={() => window.location.reload()}
                className="mt-8 px-6 py-2 border border-white hover:bg-white hover:text-black"
            >
                Jugar de nuevo
            </button>
        </div>
    );
  }

  if (gameState.screen === 'LOSE') {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950 text-white p-8 text-center">
            <h1 className="text-6xl text-red-600 mb-4">HAS MUERTO</h1>
            <p className="text-2xl mb-8">Tu esposa te extrañará...</p>
            <button 
                onClick={() => window.location.reload()}
                className="mt-8 px-6 py-2 border border-white hover:bg-white hover:text-black"
            >
                Reintentar
            </button>
        </div>
    );
  }

  return (
    <div className="relative w-full h-full flex justify-center items-center bg-gray-900" onContextMenu={(e) => e.preventDefault()}>
      {/* 3D Canvas */}
      <canvas 
        ref={canvasRef}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        className="w-full h-full object-contain cursor-none"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
      
      {/* HUD Layer */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-10">
          <div className="flex items-center gap-2">
            <div className="w-48 h-6 bg-gray-800 border-2 border-gray-600 relative">
                <div 
                    className="h-full bg-red-600 transition-all duration-200" 
                    style={{width: `${Math.max(0, Math.min(100, (uiStats.hp / uiStats.maxHp) * 100))}%`}}
                ></div>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white text-shadow">
                    HP {Math.floor(uiStats.hp)} / {uiStats.maxHp}
                </span>
            </div>
          </div>
          <div className="text-yellow-400 font-bold text-shadow">NIVEL {uiStats.level}</div>
          <div className="text-blue-300 font-bold text-shadow">PISO {gameState.floor}</div>
      </div>
      
      {/* Pause Button (HUD) */}
      <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={() => setGameState(prev => ({...prev, isPaused: !prev.isPaused}))}
            className="bg-gray-800 border-2 border-gray-500 text-white px-3 py-1 text-sm font-bold hover:bg-gray-700"
          >
            {gameState.isPaused ? 'REANUDAR' : 'PAUSA (P)'}
          </button>
      </div>

      {/* Log */}
      <div className="absolute bottom-4 left-4 pointer-events-none z-10">
          {gameState.messageLog.map((msg, i) => (
              <div key={i} className="text-white text-shadow opacity-80 text-sm bg-black/50 px-2 py-1 mb-1 rounded w-fit">
                  {msg}
              </div>
          ))}
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-green-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50 mix-blend-screen z-10" />

      {/* Stats Panel (J) */}
      {gameState.isStatsOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-stone-800 border-4 border-stone-600 p-8 w-96 text-stone-200 font-serif shadow-2xl">
                <h2 className="text-3xl border-b border-stone-600 mb-4 pb-2 text-yellow-500">Estadísticas</h2>
                <div className="space-y-3">
                    <div className="flex justify-between"><span>Vitalidad (HP)</span> <span className="text-white">{Math.floor(uiStats.hp)} / {uiStats.maxHp}</span></div>
                    <div className="flex justify-between"><span>Ataque</span> <span className="text-red-400">{uiStats.attack}</span></div>
                    <div className="flex justify-between"><span>Defensa</span> <span className="text-blue-400">{uiStats.defense}</span></div>
                    <div className="flex justify-between"><span>Resistencia</span> <span className="text-green-400">{uiStats.resistance}</span></div>
                    <div className="flex justify-between"><span>XP</span> <span className="text-purple-400">{uiStats.xp} / {uiStats.xpToNextLevel}</span></div>
                </div>
                <div className="mt-8 text-sm text-center text-stone-500">Presiona 'J' para cerrar</div>
            </div>
        </div>
      )}

      {/* Inventory Panel (E) */}
      {gameState.isInventoryOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-stone-800 border-4 border-stone-600 p-8 w-96 text-stone-200 font-serif shadow-2xl">
                <h2 className="text-3xl border-b border-stone-600 mb-4 pb-2 text-yellow-500">Inventario</h2>
                <div className="grid grid-cols-4 gap-2">
                    {/* Placeholder Inventory Slots */}
                    {Array.from({length: 12}).map((_, i) => (
                        <div key={i} className="w-16 h-16 bg-stone-900 border border-stone-700 flex items-center justify-center">
                            {i === 0 && <span className="text-2xl">⚔️</span>}
                            {i === 1 && <span className="text-2xl">🛡️</span>}
                        </div>
                    ))}
                </div>
                <div className="mt-4 text-sm text-stone-400">
                    <p>Espada Legendaria (Equipada)</p>
                    <p>Armadura de Caballero (Equipada)</p>
                </div>
                <div className="mt-8 text-sm text-center text-stone-500">Presiona 'E' para cerrar</div>
            </div>
        </div>
      )}
      
      {/* Pause Menu Overlay */}
      {gameState.isPaused && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-800 border-2 border-zinc-500 p-10 flex flex-col items-center gap-6 shadow-2xl">
                <h2 className="text-4xl font-bold text-white tracking-widest">PAUSA</h2>
                <div className="flex flex-col gap-4 w-48">
                    <button 
                        onClick={() => setGameState(prev => ({...prev, isPaused: false}))}
                        className="bg-zinc-700 hover:bg-zinc-600 text-white py-3 px-4 rounded font-bold transition-colors border border-zinc-600"
                    >
                        REANUDAR
                    </button>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-red-900 hover:bg-red-800 text-white py-3 px-4 rounded font-bold transition-colors border border-red-800"
                    >
                        SALIR
                    </button>
                </div>
                <div className="text-zinc-500 text-sm mt-2">Presiona 'P' o 'Esc' para volver</div>
            </div>
        </div>
      )}

    </div>
  );
};

export default DoomEngine;