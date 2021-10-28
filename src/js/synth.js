import * as Tone from 'tone';
import { exprand, rnd, choose } from './random.js';


class Synth {

    constructor() {
        if (this.constructor == Synth) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    static random() {
        throw new Error("not implemented.");
    }

    build(ctx) {
        throw new Error("not implemented.");
    }

    isBuilt() {
        return (typeof this.out !== 'undefined');
    }

    trigger(ctx) {
        throw new Error("not implemented.");
    }

    triggerImmediate(ctx) {
        throw new Error("not implemented.");
    }

    copy() {
        throw new Error("not implemented.");
    }

    clone() {
        throw new Error("not implemented.");
    }

    toDestination() {
        this.out.toDestination();
    }

    dispose() {
        if (this.isBuilt()) {
            this.nodes.forEach(n => n.dispose());
        }
        this.nodes = [];
        this.out = undefined;
    }

    toAudioBuffer() {
        this.duration = 2.9;
        const context = new Tone.OfflineContext(1, this.duration, 44100);
        this.build(context);
        this.toDestination();
        this.triggerImmediate(context);
        return context.render();
    }


}


function reso(ctx, freq) {
    return new Tone.Filter({ context: ctx, frequency: freq, type: "bandpass", Q: 5.0 });
}


export class FBDelay extends Synth {
    constructor(freqs, ringAmp, duration) {
        super();
        this.freqs = freqs;
        this.ringAmp = ringAmp;
        this.duration = duration;
    }

    static random(duration) {
        let n = Math.round(exprand(2, 4));
        let freqs = [];
        for (let i = 0; i < n; i++) {
            freqs.push(exprand(60, 8000));
        };
        return new FBDelay(freqs, choose([0.0, 0.1, 0.2, 0.3]), duration)
    }

    dispose() {
        super.dispose();
        if (typeof this.intervals !== 'undefined') {
            this.intervals.forEach(i => clearInterval(i));
        }
    }


    build(ctx) {
        this.nodes = [];
        this.intervals = [];
        const filters = this.freqs.map(f => reso(ctx, f));
        const pulse = new Tone.PulseOscillator({ context: ctx, frequency: 0.001, width: 0.4 }).start();
        const pulseGain = new Tone.Gain({ context: ctx, gain: 0.1 });
        const gainNode = new Tone.Gain({ context: ctx, gain: 0.5 });
        const gainNodeLFO = new Tone.Gain({ context: ctx, gain: 1 });
        const mainDelay = new Tone.Delay({ context: ctx, delayTime: 0.0, maxDelay: 0.1 });

        this.nodes = [pulse, pulseGain, gainNode, gainNodeLFO, mainDelay].concat(filters);
        pulse.connect(pulseGain);
        pulseGain.connect(mainDelay);
        gainNode.connect(gainNodeLFO);
        gainNodeLFO.connect(mainDelay);
        const delays = filters.map(f => {
            const meter = new Tone.Meter({ context: ctx });
            const delay = new Tone.Delay({ context: ctx, delayTime: exprand(0.01,0.1), maxDelay: 2 });
            meter.normalRange = true;
            mainDelay.connect(f);
            f.connect(meter);
            // this.intervals.push(setInterval(() => {
            //     //console.log();
            //     let current = delay.delayTime.value;
            //     let target = Math.max(0, Math.min(meter.getValue(), 2));
            //     let next = current * 0.99 + (target * 0.01);
            //     delay.delayTime.linearRampToValueAtTime(next, 1.5 + ctx.now());
            // }, 1500));
            f.connect(delay);
            //const compressor = new Tone.Compressor({ context: ctx, threshold: -40, ratio: 12 });
            //const outGain = new Tone.Gain({ context: ctx, gain: 0.6 });
            //delay.connect(compressor);
            //compressor.connect(outGain);
            this.nodes.push(meter);
            this.nodes.push(delay);
            // this.nodes.push(compressor);
            //this.nodes.push(outGain);
            return delay;
        });

       const rings = new Tone.Gain({ context: ctx, gain: this.ringAmp });
       // const rings = new Tone.Gain({ context: ctx, gain: 0.0 });
        this.nodes.push(rings);

        delays.forEach((c, i) => {
            const ring = new Tone.Gain({ context: ctx });
            this.nodes.push(ring);
            c.connect(ring);
            delays[(i + 1) % delays.length].connect(ring.gain);
            ring.connect(rings);
        })


        const delayCompressor = new Tone.Compressor({ context: ctx, threshold: -40, ratio: 13 });
        const delayCompressorGain = new Tone.Gain({ context: ctx, gain: 0.8 });

        rings.connect(delayCompressor);


        delays.forEach(c => c.connect(delayCompressor));

        delayCompressor.connect(delayCompressorGain);
        delayCompressorGain.connect(gainNode);

        const lfo = new Tone.LFO({ context: ctx, frequency: exprand(0.15, 1.1), min: 0.18, max: 1.0 }).start();

        lfo.connect(gainNodeLFO.gain);

        this.nodes.push(lfo);

        const outGain = new Tone.Gain({ context: ctx, gain: 0.0 });
        this.nodes.push(outGain);
        gainNode.connect(outGain);
        this.out = outGain;
        this.innerGain = gainNode;
    }


    trigger(ctx, amp) {
        let durUnit = this.duration / 3;
        this.out.gain.exponentialRampTo(2.0 * amp, Math.max(0.5, durUnit * 0.75), ctx.now());
        this.out.gain.exponentialRampTo(0.0, durUnit, ctx.now() + (durUnit * 2));
        this.innerGain.gain.exponentialRampTo(0.9, durUnit * 1.5, ctx.now());
        this.innerGain.gain.exponentialRampTo(0.35, durUnit, ctx.now() + (durUnit * 2));
    }


    triggerImmediate(ctx) {
        this.out.gain.value = 1.0;
        this.innerGain.gain.value = 0.9;
    }

    copy() {
        return new FBDelay(this.freqs, this.ringAmp, this.duration);
    }

    clone(comparison) {
        let freqOffset = rnd(comparison.recPeak - this.freqs[0], 0) * 0.35;
        let bandsDev = lincurve(Math.abs(comparison.bands), 0, 1, 2, 1, -6);
        let bandsRnd = rnd(comparison.bands, 0) * 0.5;
//        let centroidDev = rnd(comparison.centroid, 0) * 0.5;
        let newFreqs = [];
        for (let i = 0; i < this.freqs.length; i++) {
            if (i == 0) {
                newFreqs.push(fold(this.freqs[i] + freqOffset, 50, 8000));
            } else {
                newFreqs.push(deviate(this.freqs[i], bandsDev, 50, 8000));
            }
        }
        // if (comparison.bands > 0.2 && (newFreqs.length > 2)) {
        //     //console.log("removing freq");
        //     newFreqs = newFreqs.slice(0, 2);
        // } else if (comparison.bands < -0.2) {
        //     //console.log("adding freq");
        //     newFreqs.push(exprand(50, 6000));
        //     newFreqs = newFreqs.slice(0, 4);
        // }
        return new FBDelay(newFreqs, fold(this.ringAmp + bandsRnd, 0.001, 0.4), this.duration);

    }



}

// export class FBFM extends Synth {
//     constructor(freq1, freq2, scale1, scale2, duration = 3) {
//         super();
//         this.duration = duration;
//         this.freq1 = freq1;
//         this.freq2 = freq2;
//         this.scale1 = scale1;
//         this.scale2 = scale2;
//     }

//     static random(duration = 3) {
//         let freq1 = exprand(10, 2500);
//         let freq2 = exprand(10, 2500);
//         let minS1 = freq1 < 30 ? 6 : 1;
//         let minS2 = freq2 < 30 ? 6 : 1;
//         let s1 = exprand(minS1, linlin(freq1, 10, 2500, 50, 2));
//         let s2 = exprand(minS2, linlin(freq2, 10, 2500, 50, 2))

//         return new FBFM(freq1, freq2, s1, s2,
//             duration);
//     }


//     build(ctx) {

//         const osc1 = new Tone.Oscillator({ context: ctx, frequency: 0 });
//         const osc2 = new Tone.Oscillator({ context: ctx, frequency: 0 });

//         const osc1Gain = new Tone.Gain({ context: ctx, gain: 0.2 });
//         const osc2Gain = new Tone.Gain({ context: ctx, gain: 0.2 });

//         const delay1 = new Tone.Delay({ context: ctx, delayTime: 0.01 }).connect(osc2.frequency);
//         const delay2 = new Tone.Delay({ context: ctx, delayTime: 0.01 }).connect(osc1.frequency);

//         const carrier1 = new Tone.Add({ context: ctx, value: this.freq1 });
//         const carrier2 = new Tone.Add({ context: ctx, value: this.freq2 });


//         const s1 = new Tone.Multiply({ context: ctx, value: this.scale1 * this.freq1 }).connect(carrier1);
//         const s2 = new Tone.Multiply({ context: ctx, value: this.scale2 * this.freq2 }).connect(carrier2);

//         carrier1.connect(delay1);
//         carrier2.connect(delay2);

//         const mix = new Tone.Gain({ context: ctx, gain: 0.0 });

//         osc1.connect(osc1Gain).start();
//         osc2.connect(osc2Gain).start();

//         osc1Gain.connect(s1);
//         osc2Gain.connect(s2);

//         osc1.connect(mix);
//         osc2.connect(mix);

//         this.nodes = [osc1, osc2, osc1Gain, osc2Gain, carrier1, carrier2, delay1, delay2, s1, s2, mix];
//         this.out = mix;
//         this.innerGain1 = osc1Gain;
//         this.innerGain2 = osc2Gain;
//     }

//     trigger(ctx, amp) {
//         this.out.gain.exponentialRampTo(0.5 * amp, this.duration / 4, ctx.now());
//         this.out.gain.exponentialRampTo(0.0, this.duration * 0.7, ctx.now() + (this.duration * 0.3));

//         this.innerGain1.gain.exponentialRampTo(1, this.duration / 2, ctx.now());
//         this.innerGain2.gain.exponentialRampTo(1, this.duration / 2, ctx.now());

//         this.innerGain1.gain.exponentialRampTo(0.2, this.duration / 2, ctx.now() + (this.duration / 2));
//         this.innerGain2.gain.exponentialRampTo(0.2, this.duration / 2, ctx.now() + (this.duration / 2));
//     }

//     triggerImmediate(ctx) {
//         this.innerGain1.gain.value = 1.0;
//         this.innerGain2.gain.value = 1.0;
//         this.out.gain.value = 0.7;
//     }


//     copy() {
//         return new FBFM(this.freq1, this.freq2,
//             this.scale1, this.scale2, this.duration);
//     }

//     clone(comparison) {
//         //console.log("cloning!");
//         //console.log(comparison);
//         //console.log(`affinity ${this.affinity(comparison)}`);
//         let freq1Offset = rnd(comparison.peakDist, 0) * 0.25;
//         let freq2Dev = lincurve(Math.abs(comparison.bands), 0, 1, 2, 1, -6);
//         // let centroidOffset = rnd(comparison.centroid, 0) * 0.5;
//         // let envDev = lincurve(Math.abs(comparison.env), 0, 1, 1.8, 1, -6);
//         //let rollOffDiff = lincurve(comparison.rollOff, -2000, 2000, -1, 1, 0);
//         let newSynth = new FBFM(fold(this.freq1 + freq1Offset, 0.5, 2000),
//             deviate(this.freq2, freq2Dev, 0.1, 2000),
//             fold(this.scale1 + comparison.centroid, 0.25, 20),
//             deviate(this.scale2, freq2Dev, 0.25, 20),
//             this.duration);
//         //console.log(`New Synth with diffs: peak f1: ${freq1Offset}, bands f2: ${freq2Dev},  env: ${envDev}`);
//         //console.log(newSynth);
//         //console.log("done cloning!");
//         return newSynth;
//     }

// }

function deviate(value, deviation, min, max) {
    let d = rnd(1.0, deviation);
    if (Math.random() > 0.5) {
        return fold(value * d, min, max);
    } else {
        return fold(value * (1 / d), min, max);
    }
}


export function affinity(comparison) {
    let peak = linlin(Math.abs(comparison.peakDist), 0, 100, 1, 0);
    return (peak + Math.pow(Math.abs(comparison.bands), 1.2)) * 0.95;
    // return (peak + Math.pow(Math.abs(comparison.bands), 1.25) + linlin(Math.abs(comparison.flatness), 0, 1, 0.6, 0)
    //     + linlin(Math.abs(comparison.centroid), 0, 1, 0.6, 0)
    // ) / 2;
}


// export async function correlateWithBuffer(buffer, synth) {
//     let copiedSynth = synth.copy();
//     let thisBuffer = await synth.toAudioBuffer();
//     console.log(thisBuffer);
//     let synthArray = thisBuffer.toArray(0);
//     console.log(synthArray);
//     let bufferArray = buffer.getChannelData(0);
//     return pearsonCC(synthArray, bufferArray);
// }

function nextPowerOfTwo(n) {
    let power = 1;
    while (power < n) {
        power *= 2;
    }
    return power;
}

function zeroPad(array) {
    let n = nextPowerOfTwo(array.length);
    let newArray = new Float32Array(n);
    newArray.set(array);
    return newArray;
}

let essentia;

EssentiaWASM().then(function (EssentiaWasmModule) {
    essentia = new Essentia(EssentiaWasmModule);
});


function sampleEveryN(array, n) {
    let outLength = Math.floor(array.length / n);
    let newArray = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
        newArray[i] = array[i * n];
    }
    return newArray;
}

function normalize(array) {
    let maxElement = array.reduce(function (a, b) {
        return Math.max(a, b);
    });
    for (let i = 0; i < array.length; i++) {
        array[i] = array[i] / maxElement;
    }
    return array;
}

function analyzeAudioBuffer(buffer, name) {
    let data = zeroPad(buffer.getChannelData(0));
    //console.log(data.length, buffer.getChannelData(0).length, name)
    const inputSignal = essentia.arrayToVector(data);
    //console.log(inputSignal, name);
    let spec = essentia.Spectrum(inputSignal);
    let peaks = essentia.SpectralPeaks(spec.spectrum, 0, 9000, 12, 70, "magnitude");
    let bands = essentia.BarkBands(spec.spectrum);
//    let centroid = essentia.Centroid(spec.spectrum);
  //  let flatness = essentia.Flatness(spec.spectrum);

    //console.log(centroid);
    // let rollOff = essentia.RollOff(spec.spectrum);
  //  let env = essentia.Envelope(inputSignal, true, 10, 100);
    let bandsNorm = normalize(essentia.vectorToArray(bands.bands));
    //console.log(`peaks ${essentia.vectorToArray(peaks.frequencies)} for ${name}`);
    let obj = {
        peak: Array.from(essentia.vectorToArray(peaks.frequencies)),
        bands: bandsNorm,
    //    flatness: flatness.flatness,
    //    centroid: centroid.centroid,
        //  rollOff: rollOff.rollOff,
//        env: sampleEveryN(essentia.vectorToArray(env.signal), 4000)
    };
//    console.log("Done analyzing " + name, obj);
    return obj;
}

function compareAbs(a, b) {
    if (Math.abs(a) < Math.abs(b)) {
        return -1;
    }
    if (Math.abs(a) > Math.abs(b)) {
        return 1;
    }
    // a must be equal to b
    return 0;
}

function sameOctaveDiff(f1,f2) {
    let bigger = Math.max(f1,f2);
    let smaller =  Math.min(f1,f2);
    let div = Math.floor(bigger/smaller);
    let diff = (bigger/div) - smaller;
    if (f1 > f2) {
        return diff;
    } else {
        return diff * -1;
    }
}

export async function compareWithBuffer(pathogen, synth) {
    let copiedSynth = synth.copy();
    let synthBuffer = await copiedSynth.toAudioBuffer();
    copiedSynth.dispose();
//    console.log("COMPARING", synthBuffer);
    let analysisRec = pathogen.analysis;
    if (typeof analysisRec == 'undefined') {
        analysisRec = analyzeAudioBuffer(pathogen.buffer, "rec");
        pathogen.analysis = analysisRec;
    }
  //  console.log("analyzed rec", analysisRec);
    let analysisSynth = analyzeAudioBuffer(synthBuffer, "synth");
    //console.log("analyzed synth", analysisSynth);
    //    console.log(analysisSynth.peak);
//    console.log(synth.freqs, analysisSynth.peak);
    let peakDiffs = analysisRec.peak.flatMap(p => analysisSynth.peak.map(sp => p - sp)).sort(compareAbs);
    return {
        recPeak: analysisRec.peak[0],
        peakDist: peakDiffs[0], //analysisRec.peak - analysisSynth.peak,
        bands: pearsonCC(analysisRec.bands, analysisSynth.bands),
//        centroid: analysisRec.centroid - analysisSynth.centroid,
//        flatness: analysisRec.flatness - analysisSynth.flatness,
        //  rollOff: analysisRec.rollOff - analysisSynth.rollOff,
//        env: pearsonCC(analysisRec.env, analysisSynth.env),
    }
}


function mean(array) {
    return array.reduce((x, y) => x + y) / array.length;
}


function fold(input, lowerThreshold, threshold) {
    let adjustedIn = input;

    while ((adjustedIn > threshold) || (adjustedIn < lowerThreshold)) {
        // mirror at positive threshold
        if (adjustedIn > threshold) {
            adjustedIn = threshold - (adjustedIn - threshold);
        }
        // mirror at negative threshold
        if (adjustedIn < lowerThreshold) {
            adjustedIn = lowerThreshold + (lowerThreshold - adjustedIn);
        }
    }

    return adjustedIn;
}


function linexp(x, a, b, c, d) {
    if (x <= a) {
        return c;
    }
    if (x >= b) {
        return d;
    }
    return Math.pow(d / c, ((x - a) / (b - a))) * c
}


export function linlin(x, inMin, inMax, outMin, outMax) {

    if (x <= inMin) { return outMin; }
    if (x >= inMax) { return outMax; }

    return (x - inMin) / (inMax - inMin) * (outMax - outMin) + outMin
}



function lincurve(x, inMin = 0, inMax = 1, outMin = 0, outMax = 1, curve = -4) {
    var grow, a, b, scaled;
    if (x <= inMin) { return outMin; }
    if (x >= inMax) { return outMax; }

    if (Math.abs(curve) < 0.001) {

        return (x - inMin) / (inMax - inMin) * (outMax - outMin) + outMin
    }

    grow = Math.exp(curve);
    a = outMax - outMin / (1.0 - grow);
    b = outMin + a;
    scaled = (x - inMin) / (inMax - inMin);

    return b - (a * Math.pow(grow, scaled))
}

// pearson correlation coefficient (normalized)
function pearsonCC(x, y) {
    let meanX = mean(x);
    let meanY = mean(y);
    let maxIdx = Math.min(x.length, y.length);
    let corrSum = 0.0;
    let xNorm = 0.0;
    let yNorm = 0.0;
    for (let i = 0; i < maxIdx; i++) {
        let xVal = x[i] - meanX;
        let yVal = y[i] - meanY;
        corrSum += xVal * yVal;
        xNorm += xVal * xVal;
        yNorm += yVal * yVal;
    };
    return corrSum / (Math.sqrt(xNorm) * Math.sqrt(yNorm));
}

