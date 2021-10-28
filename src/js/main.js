import { recordPathogen, openPathogenMic } from './rec.js';
import * as Pathogens from './pathogens.js';
import * as Tone from 'tone';

//const audioCtx = new AudioContext();


let pathogenTick;

// document.getElementById('start-button').onclick = () => {
//     console.log("starting");
//     //  audioCtx.resume();
//     // Tone.setContext(new Tone.Context());
// };

// document.getElementById('stop-button').onclick = () => {
//     //console.log("starting");
//     //  audioCtx.resume();
//     clearInterval(pathogenTick);
// };


// document.getElementById('rec-button').onclick = () => {
//     console.log("record");
//     clearInterval(pathogenTick);
//     // Pathogens.disposeMain();
//     //Tone.context.dispose();
//     //   audioCtx.resume();
//     //Tone.context.dispose();
//     setTimeout(() => recordPathogen(Tone.context.rawContext), 850);
// };

export function start(startFun) {
    Tone.start().then(() => {
        Pathogens.buildMain();
        Pathogens.unmute();
        startFun(true);
        pathogenTick = setInterval(() => Pathogens.pathogens.tick(), 200);
    });
}

export function openMic(elmLevelReport, allowRecording) {
    clearInterval(pathogenTick);
    Pathogens.mute();
    setTimeout(() => openPathogenMic(Tone.context, elmLevelReport, allowRecording), 50);
}


export function record(elmTimeReport, startFun) {
    recordPathogen(Tone.context, start, elmTimeReport, startFun);
}

export function toneStart() {
    return Tone.start();
}

export function info() {
    return Pathogens.pathogens.info()
}
