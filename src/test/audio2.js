

// (
//     {
//         var input = LocalIn.ar(1,0.5);
//         var filters = Resonz.ar(input, [50,150,450,1350,4050,12150], 0.3);
//         var delayed = DelayC.ar(filters, 1, filters.abs.lag(20) );
//         var compressed = Compander.ar(delayed, delayed, 0.2, 1, 0.1)*2;
//         LocalOut.ar(compressed.sum);
//         Splay.ar(Limiter.ar(compressed*0.5, 0.5))
//     }.play
//     )


let commonGain = new Tone.Gain(0.5);

function reso(freq) {
    return new Tone.Filter({ frequency: freq, type: "bandpass", Q: 4.6 });
}


function delay(freqs, ringAmp) {
    //const freqs = [50, 150, 450, 1350, 4050, 12150];
    const filters = freqs.map(reso);

    const pulse = new Tone.PulseOscillator(0.001, 0.4).start();
    const pulseGain = new Tone.Gain(0.2);
    const gainNode = new Tone.Gain(0.25);
    const mainDelay = new Tone.Delay(0.0, 1);
    commonGain.connect(mainDelay);
    pulse.connect(pulseGain);
    pulseGain.connect(mainDelay);
    gainNode.connect(mainDelay);
    const compressors = filters.map(f => {
        const meter = new Tone.Meter();
        const delay = new Tone.Delay(Math.random() * 0.02, 2);
        meter.normalRange = true;
        mainDelay.connect(f);
        f.connect(meter);
        setInterval(() => {
            let current = delay.delayTime.value;
            let target = meter.getValue();
            let next = current * 0.99 + (target * 0.01);
            delay.delayTime.rampTo(next, 1);
        }, 1000);
        f.connect(delay);
        const compressor = new Tone.Compressor(-40, 12);
        const outGain = new Tone.Gain(0.4);
        delay.connect(compressor);
        compressor.connect(outGain);
        return outGain;
    });

    const rings = new Tone.Gain(ringAmp);

    compressors.forEach((c, i) => {
        const ring = new Tone.Gain();
        c.connect(ring);
        compressors[(i + 1) % compressors.length].connect(ring.gain);
        ring.connect(rings);
    })

    rings.connect(gainNode);
    compressors.forEach(c => c.connect(gainNode));

    const outGain = new Tone.Gain(0.0);
    gainNode.connect(outGain);

    return { out: outGain, innerGain: gainNode };
}


function feebackFM(f1, f2, s1, s2, ch) {
    const osc1 = new Tone.Oscillator(0);
    const osc2 = new Tone.Oscillator(0);

    const delay1 = new Tone.Delay(0.01).connect(osc2.frequency);
    const delay2 = new Tone.Delay(0.01).connect(osc1.frequency);

    const carrier1 = new Tone.Add(f1);
    const carrier2 = new Tone.Add(f2);


    const scale1 = new Tone.Multiply(s1 * f1).connect(carrier1);
    const scale2 = new Tone.Multiply(s2 * f2).connect(carrier2);

    carrier1.connect(delay1);
    carrier2.connect(delay2);

    const mix = new Tone.Gain(0.2).toDestination();

    osc1.connect(mix);
    osc2.connect(mix);

    //mix.connect(commonGain);

    osc1.connect(scale1).start();
    osc2.connect(scale2).start();

    return { osc1: osc1, scale1: scale1, scale2: scale2 };
}




document.getElementById("play-button").addEventListener("click", async () => {
    await Tone.start();
    //    delay([50, 150, 450, 1350, 4050, 12150]);
    let g = delay([1150, 272.4, 1221], 0.1);

    g.out.toDestination();
    g.out.gain.exponentialRampTo(0.5, 4, Tone.now());
    g.innerGain.gain.exponentialRampTo(0.85, 5, Tone.now());
    g.innerGain.gain.exponentialRampTo(0.2, 5, Tone.now() + 10);
    g.out.gain.exponentialRampTo(0.0, 5, Tone.now() + 10);

    //let fm = feebackFM(1000, 4.2, 11, 61.2)
    //   console.log(fm.scale1.minValue, fm.scale2.maxValue);

    //setInterval(() => { console.log(fm.osc1.frequency.value) }, 1000)

});
