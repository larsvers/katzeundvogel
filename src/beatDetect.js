import { max } from 'd3-array';

// Uint8Array polyfill for iOS Safari.
// https://stackoverflow.com/questions/39129200/javascript-arraybuffer-slice-apparently-broken-in-safari-9-1-2
if(!Uint8Array.prototype.slice) {
  Uint8Array.prototype.slice = function(a,b){
    var Uint8ArraySlice = new Uint8Array(this.buffer.slice(a,b));
    return Uint8ArraySlice;
  }
}

export function beatDetect(audioElement, dispatcher) {
  // AudioContext, Analyser and Audio.
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  // Get the Analyser node.
  const analyser = audioContext.createAnalyser();

  // Connect the nodes from source to destination.
  const source = audioContext.createMediaElementSource(audioElement);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  // Set up the audio data capture.
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.8;
  let bufferLength = analyser.frequencyBinCount;
  let dataArrayTime = new Uint8Array(bufferLength);
  let dataArrayFreq = new Uint8Array(bufferLength);

  let queue = [];
  let event = {};
  let firstBeat = true;

  function declareEvent(data) {
    // debugger
    // Get max of the low frequencies.
    const maxAmplitude = Math.round(max(data.slice(1, 6)));

    // Implement 2-item queue.
    queue.push(maxAmplitude);
    if (queue.length > 2) {
      queue.shift();
    }

    // Establish beat event.
    if (queue[0] === 255 && queue[1] - queue[0] < 0) {
      // This is the core. Sort of works
      // debugger
      // console.log(`ding ${Math.random()}`);

      event = {
        message: "It's a beat it is",
        beat: true,
        firstBeat: firstBeat
      };

      firstBeat = false;

      dispatcher.call('beat', undefined, event);
    }
  }

  function loop() {
    requestAnimationFrame(loop);

    analyser.getByteFrequencyData(dataArrayFreq);

    declareEvent(dataArrayFreq);
  }

  loop();

  return audioContext;

}
