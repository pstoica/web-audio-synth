var context     = new webkitAudioContext(),
    master      = context.createGainNode(),
    oscCount    = 3,
    keys        = new Array(256),
    voices      = new Array(),
    oscillators = new Array(oscCount),
    monophonic  = false;

    function frequencyFromNoteNumber(note) {
        return 440 * Math.pow(2, (note-69) / 12);
    }

    function noteOn(note) {
        if (voices[note] == null) {
            voices[note] = new Voice(note);
        }
    }

    function noteOff(note) {
        if (voices[note] != null) {
            for (var i = 0; i < oscCount; i++) {
                voices[note].oscillators[i].gainNode.release();
            }
        }
    }

    function RingNode() {
        this.vb = 0.2;
        this.vl = 0.4;
        this.h  = 1;
    }

    RingNode.prototype.setCurve = function() {
        var samples = 1024,
            wsCurve = new Float32Array(samples),
            value;

            for (var i = 0; i < samples; i++) {
                var v = Math.abs((i - samples / 2) / (samples / 2));
                if (v <= vb) {
                    value = 0;
                } else if (this.vb < v && v <= this.vl) {
                    value = this.h * ((Math.pow(v - this.vb, 2)) / (2 * this.vl - 2 * this.vb));
                } else {
                    value = this.h * v - this.h * this.vl + 
                        (this.h * ((Math.pow(this.vl - this.vb, 2)) /
                            (2 * this.vl - 2 * this.vb)));
                }

                wsCurve[i] = value;
            }

            this.curve = wsCurve;
    };

    function RingNodeFactory(context) {
        var ws = context.createWaveShaper();
    }

    function EnvelopeNode(a, d, s, r) {
        this.gain.value = 0;
        this.att        = a;
        this.dec        = d;
        this.sus        = s;
        this.rel        = r;

        this.trigger = function() {
            var now  = this.context.currentTime;

            this.gain.cancelScheduledValues(now);
            this.gain.setValueAtTime(0, now);
            this.gain.linearRampToValueAtTime(1.0, now + this.att);

            now += this.att;

            this.gain.linearRampToValueAtTime(this.sus, now + this.dec);
        };

        this.release = function() {
            var now  = this.context.currentTime;

            this.gain.cancelScheduledValues(now);
            this.gain.setValueAtTime(this.gain.value, now);
            this.gain.linearRampToValueAtTime(0, now + this.rel);
        };
    }

    /* wraps gainNode with envelope functionality */
    function EnvelopFactory(context, a, d, s, r) {
        var gain = context.createGainNode();
        EnvelopeNode.call(gain, a, d, s, r);
        return gain;
    }

    AudioContext.prototype.createEnvelope = function(a, s, d, r) {
        return EnvelopeFactory(this, a, s, d, r);
    };

    function SoundGen() {
        this.type           = 1;
        this.ringModulation = false;
    }

    SoundGen.prototype.createGenerator = function() {
        if (this.type >= 0 && this.type <= 3) {
            var oscillator = context.createOscillator();
            oscillator.type = this.type;
            return oscillator;
        } else if (this.ringModulation) {
            return false;
        }  else if (this.type === 4) {
            return false;
        }
    };

    function Voice(note) {
        this.frequency = frequencyFromNoteNumber(note);
        this.oscillators = new Array(oscCount);

        for (var i = 0; i < oscCount; i++) {
            this.oscillators[i]           = oscillators[i].createGenerator();
            this.oscillators[i].frequency = this.frequency;

            this.oscillators[i].connect(master);
            this.oscillators[i].noteOn(0);
        }
    }

    Voice.prototype.noteOff = function() {
        var now     =  audioContext.currentTime,
            release = now + (currentEnvR/10.0);

        this.envelope.gain.cancelScheduledValues(now);
        this.envelope.gain.setValueAtTime( this.envelope.gain.value, now );  // this is necessary because of the linear ramp
        this.envelope.gain.setTargetValueAtTime(0.0, now, (currentEnvR/100));

        this.osc1.noteOff(release);
        this.osc2.noteOff(release);
    };

    function NoiseGen(context) {
        var bufferSize = 4096;

        var node = createJavaScriptNode(bufferSize, 1, 1);
        node.onaudioprocess = function(e) {
            var out = e.outputBuffer.getChannelData(0);

            for (var i = 0; i < bufferSize; i++) {
                out[i] = Math.random() * 2 - 1;
            }
        };

        return node;
    }

$(document).ready(function() {

});