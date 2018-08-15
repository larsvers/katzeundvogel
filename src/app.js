import { select } from 'd3-selection';
import { dispatch } from 'd3-dispatch';
import { mean } from 'd3-array';
import { interval, timer } from 'd3-timer';
import debounce from 'debounce';
import {
  el,
  each,
  padd,
  paddto,
  psub,
  psubfrom,
  pmul,
  pmulby,
  metric,
  magnitude,
  near,
  yz,
  circle,
  line
} from './utils.js';
import { beatDetect } from './beatDetect.js';
import { drawEyes } from './drawEyes.js';
import { drawEye } from './drawEye.js';

function ready(w, h) {
  /* The sound */
  /* --------- */

  const audio = document.querySelector('#music');

  const dispatcher = dispatch('beat');

  beatDetect(audio, dispatcher);

  /* The birds */
  /* --------- */

  // Flock canvas and context.
  const canFlock = select('#flock').node();
  (canFlock.width = w), (canFlock.height = h);
  const ctxFlock = canFlock.getContext('2d');

  // Settings.
  // Keep unchanged.
  let FLOCK_SIZE = 100;
  let NUM_POWER_LINES = 3;
  let POWER_LINES_Z = 20.0;
  let POWER_LINES_Y = 5.0;
  let POWER_LINES_SPACING = 3.0;
  let WALL_COLLISION_DISTANCE = 4.0;
  let POWER_LINE_ATTRACTION_WEIGHT = 0.2;
  let POWER_LINE_ATTRACT_DISTANCE = 3.0;
  let POWER_LINE_SIT_DISTANCE = 0.4;
  let MINIMUM_SIT_VELOCITY = 0.5;
  let SITTING_INFLUENCE_DISTANCE = 3.5;
  let STEP_DISTANCE = 0.2;
  let STEP_TIMING = 10;
  let IDEAL_LINE_DISTANCE = 1.0;
  let TOLERABLE_LINE_DISTANCE = 0.5;
  let MINIMUM_LINE_DISTANCE = 0.4;
  let PYRAMID_BASE = 5.0;
  let PYRAMID_TOP = 50.0;
  let PYRAMID_HALFWIDTH_AT_BASE = PYRAMID_BASE;
  let PYRAMID_HALFWIDTH_AT_TOP = PYRAMID_TOP;
  let WALL_SLOPE =
    (PYRAMID_HALFWIDTH_AT_TOP - PYRAMID_HALFWIDTH_AT_BASE) /
    (PYRAMID_TOP - PYRAMID_BASE);
  let WIDTH_AT_BASE = PYRAMID_HALFWIDTH_AT_BASE - PYRAMID_BASE * WALL_SLOPE;
  let CENTER_ATTRACTION_WEIGHT = 0.01;
  let VELOCITY_ATTRACTION_WEIGHT = 0.125;
  let COLLISION_AVOIDANCE_WEIGHT = 0.2;
  let MESMARIZE_DISTANCE = 2.0;
  let LAUNCH_INFLUENCE = 3.0;
  let LAUNCH_VELOCITY = 1.0;

  // To be changed on beats.
  let COLLISION_DISTANCE = 1.0; // good
  let MAXIMUM_VELOCITY = 1; // good

  // General.
  let timerBirds;
  let flock = [];
  let lines = [];
  const flockBounds = { x: w * 0.26, y: w * 0.34 };
  const aspect = w / h;
  const mobile = false;

  // Boids.
  function Boid(x, y, z) {
    const boid = {
      p: { x: x, y: y, z: z },
      powerLine: -1,
      v: { x: 0, y: 0, z: 0 }
    };

    let lastStep = 0;
    function stepSitting() {
      let i, b;
      let rightNeighbor = boid.p.z * WALL_SLOPE + WIDTH_AT_BASE,
        leftNeighbor = -rightNeighbor,
        difference = 0.0,
        flockInfluence = { x: 0, y: 0, z: 0 },
        influence = 0.0,
        distance = 0.0;

      for (i = 0; (b = flock[i]); i++) {
        if (b === boid) continue;
        if (b.powerLine == boid.powerLine) {
          if (b.p.x < boid.p.x && b.p.x > leftNeighbor) leftNeighbor = b.p.x;
          if (b.p.x > boid.p.x && b.p.x < rightNeighbor) rightNeighbor = b.p.x;
        } else if (
          b.powerLine < 0 &&
          near(boid.p, b.p, SITTING_INFLUENCE_DISTANCE)
        ) {
          flockInfluence = padd(flockInfluence, b.v);
        }
      }
      leftNeighbor = boid.p.x - leftNeighbor;
      rightNeighbor -= boid.p.x;

      // if nearest neighbor is below minimum distance, launch
      if (
        leftNeighbor < MINIMUM_LINE_DISTANCE ||
        rightNeighbor < MINIMUM_LINE_DISTANCE
      ) {
        return launch();
      }

      // determine if the flock has influenced this boid to launch
      influence = magnitude(flockInfluence);
      if (influence > LAUNCH_INFLUENCE)
        return launch(pmul(flockInfluence, 1 / influence));

      if (++lastStep >= STEP_TIMING) {
        if (leftNeighbor < IDEAL_LINE_DISTANCE) {
          if (rightNeighbor < IDEAL_LINE_DISTANCE) {
            difference = rightNeighbor - leftNeighbor;
            if (difference < -STEP_DISTANCE) {
              boid.p.x -= STEP_DISTANCE;
              lastStep = 0;
            } else if (difference > STEP_DISTANCE) {
              boid.p.x += STEP_DISTANCE;
              lastStep = 0;
            } else if (
              rightNeighbor < TOLERABLE_LINE_DISTANCE ||
              leftNeighbor < TOLERABLE_LINE_DISTANCE
            ) {
              return launch();
            }
          } else if (leftNeighbor < IDEAL_LINE_DISTANCE - STEP_DISTANCE) {
            boid.p.x += STEP_DISTANCE;
            lastStep = 0;
          }
        } else if (rightNeighbor < IDEAL_LINE_DISTANCE - STEP_DISTANCE) {
          boid.p.x -= STEP_DISTANCE;
          lastStep = 0;
        }
      }
    }

    function stepFlying() {
      let centerOfFlock = { x: 0, y: 0, z: 0 };
      let averageVelocity = { x: 0, y: 0, z: 0 };
      let collisionAvoidance = { x: 0, y: 0, z: 0 };
      let powerLineAttraction = { x: 0, y: 0, z: 0 };
      let powerLineAdjustment = 1.0;
      let tmpPowerLineAdj = 1.0;
      let distance = 0.0;
      let vBar = 0.0;
      let widthAtZ = 0.0;
      let flying = 0;
      let mesmarized = false;

      // perform power line calculations
      for (let i = 0, line; (line = lines[i]); i++) {
        distance = metric(yz(boid.p), line);
        if (distance <= POWER_LINE_ATTRACT_DISTANCE) {
          vBar = line.directionalVelocity(boid.p, boid.v);
          if (vBar >= 0) {
            powerLineAttraction.y += line.y - boid.p.y;
            powerLineAttraction.z += line.z - boid.p.z;
            tmpPowerLineAdj = distance / POWER_LINE_ATTRACT_DISTANCE;
            if (tmpPowerLineAdj < powerLineAdjustment)
              powerLineAdjustment = tmpPowerLineAdj;
            if (
              distance < POWER_LINE_SIT_DISTANCE &&
              vBar < MINIMUM_SIT_VELOCITY
            ) {
              // bird is now sitting, discontinue calculations
              boid.v.x = boid.v.y = boid.v.z = 0;
              boid.p.y = line.y;
              boid.p.z = line.z;
              boid.powerLine = i;
              return;
            }
            if (distance < MESMARIZE_DISTANCE) mesmarized = true;
          }
        }
      }

      // iterate through all boids calculating new velocity
      for (let i = 0, b; (b = flock[i]); i++) {
        if (b === boid || b.powerLine >= 0) continue;
        if (!mesmarized) {
          centerOfFlock = padd(centerOfFlock, b.p);
          averageVelocity = padd(averageVelocity, b.v);
        }

        if (near(b.p, boid.p, COLLISION_DISTANCE))
          psubfrom(collisionAvoidance, psub(b.p, boid.p));

        flying++;
      }

      if (!mesmarized)
        centerOfFlock = psub(pmul(centerOfFlock, 1.0 / flying), boid.p);

      // perform collision avoidance on area boundries
      if (boid.p.z > PYRAMID_TOP - WALL_COLLISION_DISTANCE)
        collisionAvoidance.z +=
          PYRAMID_TOP - WALL_COLLISION_DISTANCE - boid.p.z;
      if (boid.p.z < PYRAMID_BASE + WALL_COLLISION_DISTANCE)
        collisionAvoidance.z +=
          PYRAMID_BASE + WALL_COLLISION_DISTANCE - boid.p.z;
      widthAtZ = boid.p.z * WALL_SLOPE + WIDTH_AT_BASE;
      if (boid.p.x > widthAtZ - WALL_COLLISION_DISTANCE)
        collisionAvoidance.x += widthAtZ - WALL_COLLISION_DISTANCE - boid.p.x;
      if (boid.p.x < -widthAtZ + WALL_COLLISION_DISTANCE)
        collisionAvoidance.x += -widthAtZ + WALL_COLLISION_DISTANCE - boid.p.x;
      if (boid.p.y > widthAtZ - WALL_COLLISION_DISTANCE)
        collisionAvoidance.y += widthAtZ - WALL_COLLISION_DISTANCE - boid.p.y;
      if (boid.p.y < -widthAtZ + WALL_COLLISION_DISTANCE)
        collisionAvoidance.y += -widthAtZ + WALL_COLLISION_DISTANCE - boid.p.y;

      // scale velocity modifiers
      if (!mesmarized) {
        pmulby(centerOfFlock, CENTER_ATTRACTION_WEIGHT);
        pmulby(averageVelocity, VELOCITY_ATTRACTION_WEIGHT / flying);
      }
      pmulby(collisionAvoidance, COLLISION_AVOIDANCE_WEIGHT);
      pmulby(powerLineAttraction, POWER_LINE_ATTRACTION_WEIGHT);

      // use calculations to compute new velocity
      paddto(
        boid.v,
        padd(
          padd(centerOfFlock, averageVelocity),
          padd(collisionAvoidance, powerLineAttraction)
        )
      );
      vBar = magnitude(boid.v);
      if (powerLineAdjustment < 1.0 && vBar > 0.2)
        pmulby(boid.v, powerLineAdjustment);

      // do not let velocity exceed a maximum
      if (vBar > MAXIMUM_VELOCITY) pmulby(boid.v, MAXIMUM_VELOCITY / vBar);

      paddto(boid.p, boid.v);
    }

    function launch(direction) {
      if (!direction) {
        let theta = 2.0 * Math.PI * Math.random();
        direction = { x: 0, y: Math.sin(theta), z: Math.cos(theta) };
      }
      lastStep = 0;
      boid.powerLine = -1;
      boid.v.x = LAUNCH_VELOCITY * direction.x;
      boid.v.y = LAUNCH_VELOCITY * direction.y;
      boid.v.z = LAUNCH_VELOCITY * direction.z;
      return 0;
    }

    boid.step = function() {
      let pl = boid.powerLine;
      if (boid.powerLine >= 0) stepSitting();
      else stepFlying();
    };

    return boid;
  }

  // Power lines.
  function PowerLine(y, z) {
    const line = { x: 0, y: y, z: z };
    line.directionalVelocity = function(p, v) {
      let distance = metric(yz(p), line);
      return distance > 0.0
        ? ((line.y - p.y) * v.y + (line.z - p.z) * v.z) / distance
        : -magnitude(yz(v));
    };
    return line;
  }

  // Calculations.
  function step() {
    each(flock, function(b) {
      b.step();
    });
    draw();
  }

  function fog(ctx, z) {
    let c = Math.max(0, parseInt(-50 + 284 * (z / PYRAMID_TOP)));
    ctx.fillStyle = 'rgb(' + c + ',' + c + ',' + c + ')';
  }

  function getFlockCentre(currentFlock, canvasDims) {
    const flockCentre = currentFlock.map(b => ({
      x: (b.p.x * flockBounds.x) / b.p.z + flockBounds.y,
      y: (b.p.y * flockBounds.x) / b.p.z + flockBounds.y
    }));

    const xCentre = mean(flockCentre, d => d.x);
    const yCentre = mean(flockCentre, d => d.y);
    const xCentrePerc = xCentre / canvasDims.width;
    const yCentrePerc = yCentre / canvasDims.height;

    return {
      x: xCentre,
      y: yCentre,
      xPerc: xCentrePerc,
      yPerc: yCentrePerc
    };
  }

  // Draw.
  function draw() {
    let ctx = ctxFlock;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;

    flock.sort(function(a, b) {
      return b.p.z - a.p.z;
    });
    each(flock, function(b) {
      fog(ctx, b.p.z);
      circle(
        ctx,
        (flockBounds.x * b.p.x) / b.p.z + flockBounds.y,
        (flockBounds.x * b.p.y) / b.p.z + flockBounds.x,
        mobile ? 30 / b.p.z : 60 / b.p.z
      );
    });
    each(lines, function(l) {
      let v = parseInt((flockBounds.x * l.y) / l.z + flockBounds.x);
      line(ctx, 0, v, ctx.canvas.width, v);
    });
  }

  // Init.
  function initBirds() {
    // place all boids on side edge of world
    for (let i = 0; i < FLOCK_SIZE; i++) {
      let z = (PYRAMID_TOP - PYRAMID_BASE) * Math.random() + PYRAMID_BASE,
        w =
          ((z - PYRAMID_BASE) *
            (PYRAMID_HALFWIDTH_AT_TOP - PYRAMID_HALFWIDTH_AT_BASE)) /
            (PYRAMID_TOP - PYRAMID_BASE) -
          PYRAMID_HALFWIDTH_AT_BASE,
        w2 = 2 * w * Math.random() - w;
      let xy = [
        { x: w2, y: w },
        { x: w2, y: -w },
        { y: w2, x: w },
        { y: w2, x: -w }
      ][parseInt(Math.random() * 3.99999)];
      flock.push(Boid(xy.x, xy.y, z));
    }

    // create power lines
    for (let i = 0; i < NUM_POWER_LINES; i++)
      lines.push(
        PowerLine(POWER_LINES_Y + i * POWER_LINES_SPACING, POWER_LINES_Z)
      );

    const timerBirds = interval(step, 50);
  }

  initBirds();


  /* Draw the cat */
  /* ------------ */

  // The cat
  const canCat = select('#cat').node();
  (canCat.width = w), (canCat.height = h);
  const ctxCat = canCat.getContext('2d');

  const cat = document.getElementById('cat-image');

  // Cat half the size for mobile.
  const catDims = mobile
    ? {
        x: 0,
        y: h - cat.height / 2,
        width: cat.width / 2,
        height: cat.height / 2
      }
    : {
        x: 0,
        y: h - cat.height,
        width: cat.width,
        height: cat.height
      };

  ctxCat.drawImage(cat, catDims.x, catDims.y, catDims.width, catDims.height);

  const canDims = { width: canCat.width, height: canCat.height };

  // The eyes
  const canEyes = select('#eyes').node();
  (canEyes.width = w), (canEyes.height = h);
  const ctxEyes = canEyes.getContext('2d');

  // Set the eye dimensions.
  const leftEye = {
    // x: catDims.width * 0.32,
    x: catDims.width * 0.34,
    y: catDims.y + catDims.height * 0.71,
    r: catDims.width * 0.055
  };
  const rightEye = {
    // x: catDims.width * 0.72,
    x: catDims.width * 0.74,
    y: catDims.y + catDims.height * 0.6985,
    r: catDims.width * 0.055
  };

  // Calculate and draw.
  function moveEyes() {
    // Get flock position.
    const flockPosition = getFlockCentre(flock, canDims);

    // Draw.
    ctxEyes.clearRect(0, 0, ctxEyes.canvas.width, ctxEyes.canvas.height);
    drawEye(ctxEyes, leftEye, flockPosition);
    drawEye(ctxEyes, rightEye, flockPosition);
  }

  // Run the eyes.
  const timerEyes = interval(moveEyes, 50);

  /* Prep the cat blink */
  /* ------------------ */

  // The lids.
  const canLids = select('#lids').node();
  (canLids.width = w), (canLids.height = h);
  const ctxLids = canLids.getContext('2d');

  function drawLids(height) {
    ctxLids.clearRect(0, 0, canLids.width, canLids.height)
    ctxLids.fillRect(
      catDims.width * 0.24,
      catDims.y + catDims.height / 2,
      catDims.width * 0.6,
      height
    );    
  }

  function moveLids() {
    let count = 0;
    let countup = true;

    function timerLids() {
      if (countup) {
        count += 8;
        if (count >= 30) countup = false;
      } else {
        count -= 8;
        if (count <= 0) intervalLids.stop()
      }
      drawLids(count);
    }

    const intervalLids = interval(timerLids, 10);
  }


  /* Move birds and cat's lids on beat */
  /* --------------------------------- */

  // Flock movement changes on beat and on open beat gate.
  let beatGate = true;
  let beatTimer = interval(() => (beatGate = true), 1000);


  // Update flock movement
  function changeFlockMovement() {
    COLLISION_DISTANCE = COLLISION_DISTANCE === 1.0 ? 2.0 : 1.0;
    MAXIMUM_VELOCITY = MAXIMUM_VELOCITY === 1 ? 1.5 : 1;
  }

  // Beat handler.
  dispatcher.on('beat', e => {    
    if (beatGate) {
      console.log(beatGate); 
      changeFlockMovement();
      moveLids();
    }
    beatGate = false;
  });
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ready(w, h);
}

// window.addEventListener('resize', debounce(resize, 150));
resize();
