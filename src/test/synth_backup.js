import * as Tone from 'tone';


export class Synth {
    constructor(freq1, freq2, scale1, scale2, attack = 1, decay = 1, sustain = 1, release = 1, sustainLevel = 0.5, cheby = 0.0, duration = 3) {
        let sum = [attack, decay, sustain, release].reduce((x, y) => x + y);
        this.attack = (attack / sum) * duration;
        this.decay = (decay / sum) * duration;
        this.sustain = (sustain / sum) * duration;
        this.release = (release / sum) * duration;
        this.sustainLevel = sustainLevel;
        this.sustain = sustain;
        this.duration = duration;
        this.freq1 = freq1;
        this.freq2 = freq2;
        this.scale1 = scale1;
        this.scale2 = scale2;
        this.cheby = cheby;

    }

    static random(duration = 3) {
        return new Synth(exprand(20, 3300), exprand(20, 3300),
            exprand(1, 1), exprand(1, 1),
            rnd(2, 3.5), rnd(0.5, 0.8), rnd(0.5, 0.8), rnd(3, 5), rnd(0.5, 0.6),
            exprand(0.05, 0.3),
            duration);
    }

    withDuration(duration) {
        this.duration = duration;
        let sum = [this.attack, this.decay, this.sustain, this.release].reduce((x, y) => x + y);
        this.attack = (this.attack / sum) * duration;
        this.decay = (this.decay / sum) * duration;
        this.sustain = (this.sustain / sum) * duration;
        this.release = (this.release / sum) * duration;
        //console.log(`dur: ${duration}, attack: ${this.attack}`);
    }

    build() {

        const osc1 = new Tone.Oscillator(this.freq1);
        const osc2 = new Tone.Oscillator(this.freq2);


        const cheby = new Tone.Chebyshev(41);
        const chebyMul = new Tone.Gain(this.cheby);

        // const osc3 = new Tone.Oscillator(1);
        // const osc3Add = new Tone.Add(1.1);
        // const osc4 = new Tone.Oscillator(this.freq1 / 10);

        const delay1 = new Tone.Delay(0.0).connect(osc2.frequency);
        const delay2 = new Tone.Delay(0.0).connect(osc1.frequency);

        const s1 = new Tone.Multiply(this.scale1 * this.freq1).connect(delay1);
        const s2 = new Tone.Multiply(this.scale2 * this.freq2).connect(delay2);

        //osc3Add.connect(delay1.delayTime);
        // osc3.connect(osc3Mult);
        // osc3Mult.connect(s1.factor);

        // osc4.connect(osc4Mult);
        // osc4Mult.connect(s2.factor);

        const ampEnv = new Tone.AmplitudeEnvelope({
            attack: this.attack,
            decay: this.decay,
            sustain: this.sustainLevel,
            release: this.release,
        });




        const mix = new Tone.Gain(0.0).connect(ampEnv);

        mix.connect(cheby);
        cheby.connect(chebyMul);
        //chebyMul.connect(s1);

        osc1.connect(mix).connect(s1).start();
        osc2.connect(mix).connect(s2).start();
        this.nodes = [osc1, osc2, delay1, delay2, s1, s2, mix, ampEnv];
        //this.env = ampEnv;
        this.env = mix;
    }



    buildWithContext(ctx) {

        const osc1 = new Tone.Oscillator({ context: ctx, frequency: this.freq1 });
        const osc2 = new Tone.Oscillator({ context: ctx, frequency: this.freq1 });

        const delay1 = new Tone.Delay({ context: ctx, delayTime: 0.0 }).connect(osc2.frequency);
        const delay2 = new Tone.Delay({ context: ctx, delayTime: 0.0 }).connect(osc1.frequency);

        const s1 = new Tone.Multiply({ context: ctx, value: this.scale1 * this.freq1 }).connect(delay1);
        const s2 = new Tone.Multiply({ context: ctx, value: this.scale2 * this.freq2 }).connect(delay2);

        const ampEnv = new Tone.AmplitudeEnvelope({
            attack: this.attack,
            decay: this.decay,
            sustain: this.sustainLevel,
            release: this.release,
            context: ctx
        });

        const mix = new Tone.Gain({ context: ctx, gain: 0.0 }).connect(ampEnv);

        osc1.connect(mix).connect(s1).start();
        osc2.connect(mix).connect(s2).start();
        this.nodes = [osc1, osc2, delay1, delay2, s1, s2, mix, ampEnv];
        this.env = mix;
    }

    trigger() {
        // this.env.triggerAttackRelease(this.sustain + this.attack + this.decay);
        this.env.gain.exponentialRampTo(0.5, this.duration / 4, Tone.now());
        this.env.gain.exponentialRampTo(0.0, this.duration * (3 / 4), Tone.now() + (this.duration / 2));

    }

    triggerWithContext(ctx) {
        // this.env.triggerAttackRelease(this.sustain + this.attack + this.decay);
        this.env.gain.exponentialRampTo(0.5, this.duration / 4, ctx.now());
        this.env.gain.exponentialRampTo(0.0, this.duration * (3 / 4), ctx.now() + (this.duration / 2));

    }


    toDestination() {
        this.env.toDestination();
    }

    disposeAudio() {
        this.nodes.forEach(n => n.dispose());
        this.nodes = [];
        this.env = undefined;
    }

    // convolveWithBuffer(b) {
    //     console.log('conv', b);
    //     const convolver = new Tone.Convolver(b).toDestination();
    //     this.env.connect(convolver);
    //     this.env.triggerAttackRelease(this.sustain);
    // }

    toAudioBuffer() {
        //console.log("setting up audio buffer for offline synth");
        this.withDuration(2.9);
        const context = new Tone.OfflineContext(1, this.duration, 44100);
        // const osc1 = new Tone.Oscillator({ context: context, frequency: this.freq1 });
        // osc1.start().toDestination();
        this.buildWithContext(context);
        this.toDestination();
        this.triggerWithContext(context);
        // console.log("built synth for offline rec");
        return context.render();

        // return Tone.Offline(() => {
        //     const osc1 = new Tone.Oscillator(this.freq1).start().toDestination();
        //     // console.log("building");
        //     //  this.build();
        //     //this.toDestination();
        //     //console.log("triggering");
        //     //this.trigger();
        // }, this.duration, 1);
    }

    copy() {
        return new Synth(this.freq1, this.freq2,
            this.scale1, this.scale2, this.attack,
            this.decay, this.sustain, this.release,
            this.sustainLevel, this.cheby, this.duration);
    }

    clone(comparison) {
        //console.log("cloning!");
        //console.log(comparison);
        //console.log(`affinity ${this.affinity(comparison)}`);
        let freq1Offset = rnd(comparison.peakDist, 0) * 0.25;
        let freq2Dev = lincurve(Math.abs(comparison.bands), 0, 1, 2, 1, -6);
        // let centroidOffset = rnd(comparison.centroid, 0) * 0.5;
        let envDev = lincurve(Math.abs(comparison.env), 0, 1, 1.8, 1, -6);
        //let rollOffDiff = lincurve(comparison.rollOff, -2000, 2000, -1, 1, 0);
        let newSynth = new Synth(fold(this.freq1 + freq1Offset, 0.5, 2000),
            deviate(this.freq2, freq2Dev, 0.1, 2000),
            fold(this.scale1 + comparison.centroid, 0.25, 20),
            deviate(this.scale2, freq2Dev, 0.25, 20),
            deviate(this.attack, envDev, 0.5, 8),
            deviate(this.decay, envDev, 0.05, 1),
            deviate(this.sustain, envDev, 0.1, 3),
            deviate(this.release, envDev, 1, 8),
            deviate(this.sustainLevel, envDev, 0.1, 0.8),
            deviate(this.cheby, freq2Dev, 0.01, 0.5),
            this.duration);
        //console.log(`New Synth with diffs: peak f1: ${freq1Offset}, bands f2: ${freq2Dev},  env: ${envDev}`);
        //console.log(newSynth);
        //console.log("done cloning!");
        return newSynth;
    }

    static affinity(comparison) {
        let peak = linlin(Math.abs(comparison.peakDist), 0, 400, 0.95, 0);
        return (peak + Math.pow(Math.abs(comparison.bands), 1.3) + Math.pow(Math.abs(comparison.env), 1.3)) / 2;
    }

}

export function rnd(min, max) {
    let acutalMin = Math.min(min, max);
    let actualMax = Math.max(min, max);
    return Math.random() * (actualMax - acutalMin) + acutalMin;
}

export function exprand(lo, hi) { return lo * Math.exp(Math.log(hi / lo) * Math.random()) }

function deviate(value, deviation, min, max) {
    let d = rnd(1.0, deviation);
    if (Math.random() > 0.5) {
        return fold(value * d, min, max);
    } else {
        return fold(value * (1 / d), min, max);
    }

}

// function exprand(scale) {
//     return -Math.log(Math.random()) * scale;
// }

export async function correlateWithBuffer(buffer, synth) {
    let thisBuffer = await synth.toAudioBuffer();
    console.log(thisBuffer);
    let synthArray = thisBuffer.toArray(0);
    console.log(synthArray);
    let bufferArray = buffer.getChannelData(0);
    return pearsonCC(synthArray, bufferArray);
}

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
    // prints version of the essentia wasm backend
    //console.log(essentia.version)
    // prints all the available algorithms in essentia.js
    //console.log(essentia.algorithmNames);
    // add your custom audio feature extraction callbacks here
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
    //console.log(data.length, buffer.getChannelData(0).length)
    const inputSignal = essentia.arrayToVector(data);
    //console.log(inputSignal);
    let spec = essentia.Spectrum(inputSignal);
    let peaks = essentia.SpectralPeaks(spec.spectrum, 1, 8000, 1, 80, "magnitude");
    let bands = essentia.BarkBands(spec.spectrum);
    let centroid = essentia.Centroid(spec.spectrum);
    //console.log(centroid);
    // let rollOff = essentia.RollOff(spec.spectrum);
    let env = essentia.Envelope(inputSignal, true, 10, 100);
    let bandsNorm = normalize(essentia.vectorToArray(bands.bands));
    //console.log(`bandsNorm ${bandsNorm} for ${name}`);
    let obj = {
        peak: essentia.vectorToArray(peaks.frequencies)[0],
        bands: bandsNorm,
        centroid: centroid.centroid,
        //  rollOff: rollOff.rollOff,
        env: sampleEveryN(essentia.vectorToArray(env.signal), 4000)
    };
    //console.log("Done analyzing " + name, obj);
    return obj;
}

export async function compareWithBuffer(buffer, synth) {
    let synthBuffer = await synth.toAudioBuffer();
    // console.log("COMPARING", synthBuffer);
    let analysisRec = analyzeAudioBuffer(buffer);
    // console.log("analyzed rec", analysisRec);
    let analysisSynth = analyzeAudioBuffer(synthBuffer, "synth");
    // console.log("analyzed synth", analysisSynth);
    //console.log(analysisRec, analysisSynth);
    return {
        peakDist: analysisRec.peak - analysisSynth.peak,
        bands: pearsonCC(analysisRec.bands, analysisSynth.bands),
        centroid: analysisRec.centroid - analysisSynth.centroid,
        //  rollOff: analysisRec.rollOff - analysisSynth.rollOff,
        env: pearsonCC(analysisRec.env, analysisSynth.env),
    }
}

export function compare(buffer) {
    console.log(analyzeAudioBuffer(buffer))
    //let data = powerOfTwoSlice(buffer.getChannelData(0));
    //const inputSignal = essentia.arrayToVector(data);
    //console.log(data.length);
    //  Meyda.bufferSize = 1024;
    //const analyzer = Meyda.createMeydaAnalyzer({ bufferSize: 1024 });

    //console.log(Meyda.extract("amplitudeSpectrum", data));

    // let spec = essentia.Spectrum(inputSignal);
    // let peaks = essentia.SpectralPeaks(spec.spectrum, 1, 8000, 1, 80, "magnitude");
    // console.log(essentia.vectorToArray(peaks.frequencies));

    // let centroid = essentia.Centroid(spec.spectrum);
    // console.log(centroid);

    // let flatness = essentia.Flatness(spec.spectrum);
    // console.log(flatness);

    // let bands = essentia.BarkBands(spec.spectrum);
    // console.log(essentia.vectorToArray(bands.bands));

    // let env = essentia.Envelope(inputSignal);
    // console.log(essentia.vectorToArray(env.signal));

    //console.log(essentia.vectorToArray(spec.spectrum));

    //let peaks = essentia.PeakDetection(spec.spectrum, true, 10, 10, 0.001);
    //console.log(essentia.vectorToArray(peaks.positions));
    //console.log(spec.spectrum);

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


function linlin(x, inMin, inMax, outMin, outMax) {

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

