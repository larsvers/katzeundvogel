/**
 * Changes all coloured pixels of a 
 * given context in the given colour.
 * @param  {Object} context   Context.
 * @param  {Array}  rgb       Array of r, g, b numbers.
 * @return {undefined}        Updated canvas colours.
 */
export default function colourImage(context, rgb) {
  const [r,g,b] = rgb;
  var imgData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  for (var i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = r | imgData.data[i];
    imgData.data[i + 1] = g | imgData.data[i + 1];
    imgData.data[i + 2] = b | imgData.data[i + 2];
  }
  context.putImageData(imgData, 0, 0);
}
