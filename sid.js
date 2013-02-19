(function ($) {
   "use strict";

    var context     = new webkitAudioContext(),
        master      = context.createGainNode(),
        preGain     = context.createGainNode(),
        genCount    = 3,
        filters     = [],
        voices      = [],
        keys        = [],
        generators  = [],
        monophonic  = false;

    /* enumerable for oscillator modes */
    var OSC   = 0,
        RING  = 1,
        NOISE = 2;

    function init() {
        console.log(voices[3]);
        for (var i = 0; i < genCount; i++) {
            generators.push(new SoundGen());
        }

        for (var t = 0; t < 3; t++) {
            filters.push(new Filter(t));
        }

        updateRoutes();
        master.gain.value = 1/16;
        master.connect(context.destination);
    }

    /* helper functions */
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

        console.log('hi');
        voices[note].noteOn();
    }

    function noteOff(note) {
        if (voices[note] !== undefined) {
            voices[note].noteOff();
        }
    }

    function updateRoutes() {
        var lastOn = -1;

        preGain.disconnect();
        filters.forEach(function(filter, i) {
            filter.disconnect();

            if (filter.on) {
                if (lastOn === -1) {
                    preGain.connect(filter);
                } else {
                    filters[lastOn].connect(filter);
                }

                lastOn = i;
            }
        });

        if (lastOn === -1) {
            preGain.connect(master);
        } else {
            filters[lastOn].connect(master);
        }
    }

    function Filter(type) {
        var filter  = context.createBiquadFilter();
        filter.on   = false;
        filter.type = type;

        return filter;
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

        self.type           = 1;
        self.ringModulation = false;
        self.noise          = false;
        self.mode           = OSC;
        self.att            = 0;
        self.sus            = 1;
        self.dec            = 1;
        self.rel            = 3;
    }

    SoundGen.prototype.createGenerator = function(frequency) {
        var self = this;

        if (self.type >= 0 && self.type <= 3) {
            var oscillator = context.createOscillator();
            
            oscillator.type            = self.type;
            oscillator.frequency.value = frequency;
            oscillator.noteOn(0);
            return oscillator;
        } else if (self.ringModulation) {
            return new NoiseGen();
        }  else if (self.noise) {
            return new NoiseGen();
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

            self.oscillators[i] = generators[i].createGenerator(self.frequency);

            self.oscillators[i].connect(self.envelopes[i].gainNode);
            self.envelopes[i].gainNode.connect(preGain);
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

    function NoiseGen() {
        var bufferSize = 1024;

        var node = context.createJavaScriptNode(bufferSize, 1, 1);
        node.onaudioprocess = function(e) {
            var out = e.outputBuffer.getChannelData(0);

            for (var i = 0; i < bufferSize; i++) {
                out[i] = Math.random() * 2 - 1;
            }
        };

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
    });
}(jQuery));