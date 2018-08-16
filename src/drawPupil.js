import { projectOnCircle } from './projectOnCircle.js';

export function drawPupil(context, centre, focus, radius = 2, colour = '#000') {
  // Get the point projected onto the eye.
  const eyePosition = projectOnCircle(focus, centre, centre.r);

  context.beginPath();
  context.arc(eyePosition.x, eyePosition.y, radius, 0, 2 * Math.PI);
  context.fillStyle = colour;
  context.fill();
}
