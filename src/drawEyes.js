/**
 * Drawing the cat's eyes
 * @param  {Object} context  Canvas' context to draw on.
 * @param  {Object} imgDims  Dimensions of thhe image to draw eys into.
 * @param  {Object} focus    Position of the thing to move the eyes to.
 * @return {undefined}       DOM side effects.
 */
export function drawEyes(context, imgDims, focus) {

  // Mapping the flock's x position to the eyes x position.
  const maxRange  = imgDims.width * 0.19;
  const xMove     = maxRange * focus.xPerc;

  // x position of eyes in pixel.
  const xLeftEye  = imgDims.width * 0.30 + xMove;
  const xRightEye = imgDims.width * 0.69 + xMove;

  // y position of eyes in pixel.
  const yLeftEye  = imgDims.y + imgDims.height * 0.66;
  const yRightEye = imgDims.y + imgDims.height * 0.64;

  // Draw.
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)

  context.beginPath();
  context.arc(xLeftEye, yLeftEye, 2, 0, 2 * Math.PI);
  context.arc(xRightEye, yRightEye, 2, 0, 2 * Math.PI);
  context.fill();
}
