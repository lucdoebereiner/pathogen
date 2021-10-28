//const reverb = new Tone.Reverb(10).toDestination();


function feebackFM(f1, f2, s1, s2, ch) {
    const osc1 = new Tone.Oscillator(0);
    const osc2 = new Tone.Oscillator(0);

    const delay1 = new Tone.Delay(0.01).connect(osc2.frequency);
    const delay2 = new Tone.Delay(0.01).connect(osc1.frequency);

    const carrier1 = new Tone.Add(f1);
    const carrier2 = new Tone.Add(f2);


    // const cheby = new Tone.Chebyshev(51);
    // const chebyMul = new Tone.Gain(ch);

    const scale1 = new Tone.Multiply(s1 * f1).connect(carrier1);
    const scale2 = new Tone.Multiply(s2 * f2).connect(carrier2);

    carrier1.connect(delay1);
    carrier2.connect(delay2);

    const mix = new Tone.Gain(0.1).toDestination();


    //const comb = new Tone.AutoFilter("4n").start();


    osc1.connect(mix);
    //  comb.connect(mix);
    osc2.connect(mix);

    // mix.connect(cheby);
    // cheby.connect(chebyMul);

    // const prescale1 = new Tone.Gain(1);
    // chebyMul.connect(prescale1);

    //osc1.connect(comb).start();
    osc1.connect(scale1).start();
    osc2.connect(scale2).start();

    //  prescale1.connect(scale1);

    return { osc1: osc1, scale1: scale1, scale2: scale2 };
}

// const synth = new Tone.FMSynth().connect(panner);
// synth.modulationIndex.value = 20;
// synth.harmonicity.value = 2.1;
// synth.modulationEnvelope.attack = 5;
// synth.modulationEnvelope.decay = 0.0;
// synth.modulationEnvelope.release = 10;

// synth.envelope.attack = 5;
// synth.envelope.decay = 0;
// synth.envelope.release = 10;

// //const gainNode = new Tone.Gain(0).connect(synth.modulationIndex);
// //gainNode.gain.value = 2;


// const gainNode = new Tone.Gain(1).connect(synth.frequency);
// const delay = new Tone.Delay(0.1).connect(gainNode);
// //const osc = new Tone.Oscillator(0.3).connect(gainNode).start();
// gainNode.gain.value = 100;
// synth.connect(delay);

//synth.connect(synth.harmonicity);

//console.log(synth.harmonicity);




document.getElementById("play-button").addEventListener("click", async () => {
    await Tone.start();

    let fm = feebackFM(1000, 1.2, 11, 61.2)
    console.log(fm.scale1.minValue, fm.scale2.maxValue);

    setInterval(() => { console.log(fm.osc1.frequency.value) }, 1000)

});
