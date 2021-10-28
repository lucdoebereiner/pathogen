//import * as Pathogens from 'pathogens.js';
import { pathogens } from './pathogens.js';
import * as Tone from 'tone';

let recorder;
let meter;
let mic;
let levelInterval;

export async function openPathogenMic(ctx, elmLevelReport, elmAllowRecording) {
    await Tone.start();
    recorder = new Tone.Recorder({context: ctx});
    meter = new Tone.Meter({context: ctx});
    mic = new Tone.UserMedia({context: ctx}).connect(recorder);

    mic.connect(meter);

    mic.open().then(() => {
        levelInterval = setInterval(() => { elmLevelReport(meter.getValue()); }, 200);
        elmAllowRecording(true);
    }).catch(e => {
        // promise is rejected when the user doesn't have or allow mic access
        console.log("mic not open");
    });
}


export async function recordPathogen(ctx, callback, elmTimeReport, startFun) {
    recorder.start();

    let i = 0;
    let interval = setInterval(() => { elmTimeReport(i*0.1); i++; }, 100);
    
    setTimeout(async () => {
        const recording = await recorder.stop();
        const buffer = await recording.arrayBuffer();
        const audioData = await Tone.context.rawContext.decodeAudioData(buffer);
        pathogens.addPathogenFromBuffer(audioData);
        callback(startFun);
        clearInterval(levelInterval);
        clearInterval(interval);
        recorder.dispose();
        meter.dispose();
        mic.dispose();
    }, 3000);
    
}

// export function recordPathogen(ctx, callback, elmLevelReport, startFun) {
//     navigator.mediaDevices.getUserMedia({ audio: true })
//         .then(s => recordToBuffer(ctx, s, callback, elmLevelReport, startFun));
// }


// function recordToBuffer(ctx, stream, callback, elmLevelReport, startFun) {
//     const data = [];
//     const mediaRecorder = new MediaRecorder(stream);
//     mediaRecorder.ondataavailable = e => {
//         console.log(e.data);
//         e.data.size && data.push(e.data);
//     };
//     console.log("started");
//     mediaRecorder.start();
//     setTimeout(() => mediaRecorder.stop(), 3000);
//     mediaRecorder.onstop = () => {
//         console.log("stopped");
//         process(ctx, data, callback, startFun);
//     }
// }


function process(ctx, data, callback, startFun) {
    const blob = new Blob(data);

    console.log("process fun");
    
    blob.arrayBuffer().then(buffer => ctx.decodeAudioData(buffer, b => {
        console.log("decoded", b);
        pathogens.addPathogenFromBuffer(b);
        console.log(pathogens);
        callback(startFun);
    },
        e => { console.log("Error with decoding audio data" + e); }
    ));

}

