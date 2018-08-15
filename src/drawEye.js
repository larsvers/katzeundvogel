import { projectOnCircle } from './projectOnCircle.js';

export function drawEye(context, centre, focus) {
  // Get the point projected onto the eye.
  const eyePosition = projectOnCircle(focus, centre, centre.r);

  context.beginPath();
  context.arc(eyePosition.x, eyePosition.y, 2, 0, 2 * Math.PI);
  // context.fillStyle = 'tomato';
  context.fill();
  
  // context.beginPath();
  // context.moveTo(eyePosition.x - 2, eyePosition.y-4);
  // context.lineTo(eyePosition.x + 2, eyePosition.y+4);
  // context.closePath()
  // context.stroke()
}
