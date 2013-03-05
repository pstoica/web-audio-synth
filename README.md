# Web Audio Synth

This is a basic synthesizer created using the Web Audio API, with features based on the SID chip in the Commodore 64, including:

* Polyphony
* 3 Sound Generators
  * ADSR Envelopes
  * Square, Sawtooth, Triangle, and Noise (sonar-esque) waveforms
  * Ring Modulation switch (Triangle * Square)
* Low, high, and bandpass filters
* Gain control

## Polyphony
Polyphony is accomplished by having an array of voices, where each voice has an oscillator and envelope for each sound generator. The voices are all regenerated whenever the sound generators are altered, seamlessly changing the tones and envelopes. At the moment, voices don't destroy themselves since they rely on the envelope's release to set them off, and the user might want to change the release midst playing a note.

When a key is pressed, it indexes the array of voices by the MIDI note and creates the voice if it doesn't exist yet. The voice is then triggered, meaning each envelope starts running. When a key is released, all of the envelopes are told to release.

Polyphony typically ends up adding a lot of voices without any sort of compression, so be sure to keep the master volume low to prevent clipping.

## Oscillators
Web audio's built-in oscillators were used for square, sawtooth, and triangle waves. Using one simply involves setting a frequency (generated from a MIDI note number), setting `noteOn`, and connecting it to some output.

### Noise
Noise is created using a `javascriptNode` which allows you to directly manipulate the output buffer. For this oscillator, the buffer was simply filled with random values between -1 and 1. To create a sonar effect, the noise is connected to bandpass filter using the specified frequency and a high Q value.

### Ring Modulation
Ring modulation involves multiplying two signals together. The requirement was to combine a square and triangle wave. I created functions to generate the appropriate values of the waves. The position of the waves is dependent on the sample rate, so the sample number `x` is incremented by `frequency / context.sampleRate` every iteration. This way, all we have to do to combine the waves is:

	square(x * Math.PI * 2.0) * triangle(x * Math.PI * 2.0)

## Envelopes
The envelopes have 4 phases: attack, decay, sustain, release. The values are represented in seconds, except for sustain which takes in a gain value from 0 to 1. An envelope is essentially a gain node wrapped with scheduled values.

For example, an envelope starts at 0 and is told to go to 1 when the time hits the attack by using `linearRampToValueAtTime`. Next, the envelope must reach the sustain gain value in the decay phase, using the same scheduling idea with attack. Sustain is held until a 'note off' message is received, at which point the release phase begins: going from the sustain volume to 0. The envelope prototype has `trigger` and `release` methods to automate all of this.

## Filter
All voices are attached to a filter, a master gain node, and then the device output. The filter is created using the `biquadFilter` node and can be set to low, high, and bandpass modes. Each mode accepts a cutoff frequency and a Q factor which represents the bandwidth. For example, the sonar effect required a high Q value to bring out the main frequency more.

Low pass filters allow only frequencies below the cutoff to go through. High pass filters only permit higher frequencies. Bandpass filters arc, allowing only a range determined by the center frequency and the Q factor.

## Master Gain
Lastly is the master gain node. This is just a final step before reaching your speakers so you can change the overall volume!

## References
* (SynthJS)[https://github.com/mattdiamond/synthjs]: inspiration for envelopes
* (Generating Tones Using Web Audio)[http://0xfe.blogspot.com/2011/08/generating-tones-with-web-audio-api.html]: information on using JavascriptNode
* (Teenage Engineering OP-1)[http://www.teenageengineering.com/products/op-1]: UI inspiration. I was going to emulate the knobs and screen, but I got lazy. Maybe another time.
