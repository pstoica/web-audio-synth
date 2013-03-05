(function ($) {
   "use strict";

    var context     = new webkitAudioContext(),
        master      = context.createGainNode(),
        genCount    = 3,
        maxVoices   = 16,
        filter      = context.createBiquadFilter(),
        voices      = [],
        keys        = [],
        generators  = [];

    /* enumerable for oscillator modes */
    var SQUARE   = 1,
        SAWTOOTH = 2,
        TRIANGLE = 3,
        NOISE    = 4;

    function init() {
        for (var i = 0; i < genCount; i++) {
            generators.push(new SoundGen());
        }

        filter.connect(master);
        master.gain.value = 0.25;
        master.connect(context.destination);
    }

    /* maths functions */
    function triangle(t) {
        return Math.abs(2 * (t / Math.PI - Math.floor((t / Math.PI) + (1 / 2))));
    }

    function square(t) {
        var val = Math.sin(t * 2 * Math.PI);
        if (val >= 0) {
            return 1;
        } else {
            return -1;
        }
    }

    function frequencyFromNoteNumber(note) {
        return 440 * Math.pow(2, (note-69) / 12);
    }

    function noteOn(note) {
        if (voices[note] === undefined) {
            voices[note] = new Voice(note);
        }

        voices[note].noteOn();
    }

    function noteOff(note) {
        if (voices[note] !== undefined) {
            voices[note].noteOff();
        }
    }

    function regenerate() {
        voices.forEach(function(voice) {
            voice.generate();
        });
    }

    /* wraps gainNode with envelope functionality */
    function EnvelopeNode(a, d, s, r) {
        var self = this;

        self.gainNode = context.createGainNode();
        self.gainNode.gain.value = 0;
        self.att = a;
        self.dec = d;
        self.sus = s;
        self.rel = r;

        return self;
    }

    EnvelopeNode.prototype.setFromGenerator = function(generator) {
        var self = this;

        self.att = generator.att;
        self.sus = generator.sus;
        self.dec = generator.dec;
        self.rel = generator.rel;
    };

    EnvelopeNode.prototype.trigger = function() {
        var self = this,
            now  = self.gainNode.context.currentTime,
            gain = self.gainNode.gain;

        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0, now);
        gain.linearRampToValueAtTime(1.0, now + self.att);
        
        now += self.att;
        gain.linearRampToValueAtTime(self.sus, now + self.dec);
    };

    EnvelopeNode.prototype.release = function() {
        var self = this,
            now  = self.gainNode.context.currentTime,
            gain = self.gainNode.gain;

        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + self.rel);
    };

    function SoundGen() {
        var self = this;

        self.type   = SQUARE;
        self.ring   = false;
        self.att    = 0;
        self.sus    = 1;
        self.dec    = 1;
        self.rel    = 3;
        self.active = true;
    }

    SoundGen.prototype.createGenerator = function(frequency) {
        var self = this;

        if (self.ring) {
            return new RingGen(frequency);
        } else if (self.type >= 0 && self.type <= 3) {
            var oscillator = context.createOscillator();
            
            oscillator.type            = self.type;
            oscillator.frequency.value = frequency;
            oscillator.noteOn(0);
            return oscillator;
        } else if (self.type == NOISE) {
            return new NoiseGen(frequency);
        }
    };

    SoundGen.prototype.createEnvelope = function() {
        var self = this;

        return new EnvelopeNode(self.att,
                                self.sus,
                                self.dec,
                                self.rel);
    };

    function Voice(note) {
        var self         = this;
        
        self.frequency   = frequencyFromNoteNumber(note);
        self.oscillators = new Array(genCount);
        self.envelopes   = new Array(genCount);

        self.init();
        self.generate();
    }

    Voice.prototype.init = function() {
        var self = this;

        for (var i = 0; i < genCount; i++) {
            self.envelopes[i] = generators[i].createEnvelope();
        }
    };

    Voice.prototype.generate = function() {
        var self = this;

        for (var i = 0; i < genCount; i++) {
            self.envelopes[i].setFromGenerator(generators[i]);

            if (self.oscillators[i] !== undefined) {
                self.oscillators[i].disconnect();
            } else {
                self.oscillators[i] = undefined;
            }

            if (generators[i].active) {
                self.oscillators[i] = generators[i].createGenerator(self.frequency);
                self.oscillators[i].connect(self.envelopes[i].gainNode);
                self.envelopes[i].gainNode.connect(filter);
            }
        }
    };

    Voice.prototype.noteOn = function() {
        var self = this;

        self.envelopes.forEach(function(element) {
            element.trigger();
        });
    };

    Voice.prototype.noteOff = function() {
        var self = this;

        self.envelopes.forEach(function(element) {
            element.release();
        });
    };

    function NoiseGen(frequency) {
        var bufferSize = 1024,
            noiseNode,
            filter;

        var noiseNode = context.createJavaScriptNode(bufferSize, 1, 1);
        noiseNode.onaudioprocess = function(e) {
            var out = e.outputBuffer.getChannelData(0);

            for (var i = 0; i < bufferSize; i++) {
                out[i] = Math.random() * 2 - 1;
            }
        };

        filter      = context.createBiquadFilter();
        filter.type = 2;

        filter.frequency.value = frequency;
        filter.Q.value         = 100;

        noiseNode.connect(filter);

        return filter;
    }

    function RingGen(frequency) {
        var self = this,
            bufferSize = 1024,
            x = 0, // initial sample number
            node = context.createJavaScriptNode(bufferSize, 1, 1);

        node.onaudioprocess = function(e) {
            var out = e.outputBuffer.getChannelData(0);

            for (var i = 0; i < bufferSize; ++i) {
                var value = square(x * Math.PI * 2.0) * triangle(x * Math.PI * 2.0);
                x += frequency / context.sampleRate;
                out[i] = value;
            }
        }

        return node;
    }

    /* initialization */
    window.onload = init;

    $(document).ready(function() {

        $('.synth-key').mousedown(function(e) {
            noteOn($(this).data('note'));
        }).mouseup(function(e) {
            noteOff($(this).data('note'));
        });

        $('.gen select').on('change', function() {
            var $e = $(this);
            generators[$e.data('gen')].type = $e.val();
            regenerate();
        });

        $('.gen input[type="checkbox"]').on('change', function() {
            var $e = $(this);
            generators[$e.data('gen')][$e.data('field')] = this.checked;
            regenerate();
        });

        $('[data-field="ring"]').on('change', function() {
            var $e = $(this);
            generators[$e.data('gen')].ring = this.checked;
            regenerate();
        });

        $('.gen input[type="range"]').on('change', function() {
            var $e = $(this);
            generators[$e.data('gen')][$e.data('field')] = parseFloat(this.value);
            regenerate();
        });

        $('.filter input[type="range"]').on('change', function() {
            var $e = $(this);
            filter[$e.data('field')].value = parseFloat(this.value);
        });

        $('.filter select').on('change', function() {
            var $e = $(this);
            filter.type = $e.val();
        });

        $('.master input[type="range"]').on('change', function() {
            var $e = $(this);
            master[$e.data('field')].value = parseFloat(this.value);
        });
    });
}(jQuery));