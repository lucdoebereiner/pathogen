import * as Synth from './synth.js';
import * as Tone from 'tone';
import { choose, exprand, rnd } from './random.js';

// state can be
// { state: "plasma" }
// { state: "matching", pathogen: <PATHOGEN-ID>, generation: <int>}
// { state: "memory" }

let ANTIBODYID = 0;

class AntiBody {
    constructor() {
        this.state = { state: "plasma" }
        //this.synth = Math.random() > 0.5 ? Synth.FBDelay.random(exprand(4, 14)) : Synth.FBFM.random(exprand(1.8, 8));
        //this.synth = Synth.FBFM.random(exprand(3, 16));
        this.synth = Synth.FBDelay.random(exprand(3, 9));
        this.playedCounter = 0;
        this.toBeDeleted = false;
        this.posX = rnd(3, 12) * choose([1, -1]);
        this.posZ = rnd(3, 12) * choose([1, -1]);
        this.playing = false;
        this.id = ANTIBODYID;
        ANTIBODYID++;
    }

    info() {
        return {
            posX: this.posX,
            posZ: this.posZ,
            state: this.state,
            level: this.playing ? this.synth.out.gain.value : 0.0,
            id: this.id
        }
    }

    static matching(synth, pathoId, generation) {
        let ab = new AntiBody();
        ab.state = { state: "matching", pathogen: pathoId, generation: generation };
        ab.synth = synth;
        ab.synth.duration = exprand(4, 12);
        ab.posX = rnd(-5, 5);
        ab.posZ = rnd(-5, 5);
        return ab;
    }

    static memory(synth, pathoId) {
//        console.log("creating MEMORY");
        let ab = new AntiBody();
        ab.state = { state: "memory", pathogen: pathoId };
        ab.synth = synth;
        //console.log("setting duration");
        ab.synth.duration = exprand(15, 40);
        ab.posX = rnd(5, 15) * choose([1, -1]);
        ab.posZ = rnd(5, 15) * choose([1, -1]);
        return ab;
    }

    isPlasma() {
        return this.state.state == "plasma";
    }

    isMatching() {
        return this.state.state == "matching";
    }

    isMemory() {
        return this.state.state == "memory";
    }

    canBeDeleted() {
        if ((this.isPlasma() && (this.playedCounter >= 1)) ||
            //((this.state.state == "matching") && (this.playedCounter >= 50)) ||
            (this.isMemory() && (this.playedCounter >= 4))) {
            this.toBeDeleted = true;
        }

        // never played but old generation
        if (this.isMatching() && this.toBeDeleted && !(this.synth.isBuilt())) {
            return true;
        } else if (this.synth.isBuilt() && this.toBeDeleted && !(this.playing)) {
            return true;
        } else {
            return false;
        }
    }

    play() {
        if (this.synth.isBuilt()) {
            this.dispose();
        }
        let amp = 1.0;
        if (this.isMemory()) {
            amp = Synth.linlin(this.playedCounter, 0, 10, 1, 0.2);
        }
        this.synth.build(Tone.context);
        this.panner = new Tone.Panner3D(this.posX, 0, this.posZ);
        this.panner.connect(main);
        this.synth.out.connect(this.panner);
        this.synth.trigger(Tone.context, amp);
        this.playing = true;
        setTimeout(() => { this.playedCounter += 1; this.playing = false; }, (this.synth.duration + 0.1) * 1000);
    }

    dispose() {
        this.synth.dispose();
        if (typeof this.panner !== 'undefined') {
            this.panner.dispose();
        }
    }

}


let pathogenID = 0;

class Pathogen {
    constructor(buffer) {
        this.buffer = buffer;
        this.id = pathogenID;
        this.analyis = undefined;
        pathogenID++;
    }

    info() {
        return {
            id: this.id
        }
    }
}


let tickCounter = 0;


const AFFINITY_THRESHOLD = 1.1;

export class PathogensDB {
    constructor() {
        this.pathogens = [];
        this.antiBodies = [new AntiBody(), new AntiBody(), new AntiBody(), new AntiBody(), new AntiBody()];
    }

    info() {
        return {
            pathogens: this.pathogens.map(p => p.info()),
            antiBodies: this.antiBodies.map(a => a.info())
        }
    }

    get(id) {
        return this.pathogens.find(p => p.id == id);
    }

    deletePathogen(id) {
        this.pathogens = this.pathogens.filter(p => p.id != id);
    }

    addPathogenFromBuffer(buffer) {
        let pathogen = new Pathogen(buffer)
        this.pathogens.push(pathogen);

        let plasmaSynths = this.antiBodies.filter(ab => ab.isPlasma()).map(ab => ab.synth.copy());
        this.matchingIteration(pathogen.id, plasmaSynths, 0).then(abs => {
            this.antiBodies = this.antiBodies.concat(abs.antibodies);
        })
    }

    matchingIteration(id, synths, generation) {
        return Promise.all(synths.map(synth => {
            return Synth.compareWithBuffer(pathogens.get(id), synth).catch(() => undefined)
        })).then(comparisons => {
            let removedIdxs = [];
            let filteredComparisons = comparisons.filter((c,i) => {
                if (typeof c !== 'undefined') {
                    return true
                } else {
                    removedIdxs.push(i);
                    return false;
                }
            });
            let filteredSynths = synths;
            removedIdxs.forEach(i => filteredSynths[i] = undefined);
            filteredSynths = filteredSynths.filter((s) => typeof s !== 'undefined');
            let mostAffineSynths = filteredSynths.map((s, i) => {
                console.log(`affinity: ${Synth.affinity(filteredComparisons[i])}`);
                return { synth: s, comparison: filteredComparisons[i],
                         affinity: Synth.affinity(filteredComparisons[i]) };
            }).sort((a, b) => (a.affinity < b.affinity) ? 1 : -1).slice(0, 3);

            if (mostAffineSynths[0].affinity > AFFINITY_THRESHOLD) {
                return { antibodies: [AntiBody.memory(mostAffineSynths[0].synth.copy(), id)], done: true };
            } else {
                let matchingSynthsToBeAdded = [];
                for (let i = 0; i < 3; i++) {
                    let synth = mostAffineSynths[i].synth;
                    let comparison = mostAffineSynths[i].comparison;
                    matchingSynthsToBeAdded = matchingSynthsToBeAdded.concat(Array(3 - i).fill().map(() => synth.clone(comparison)));
                }
                return { antibodies: matchingSynthsToBeAdded.map(s => AntiBody.matching(s, id, generation)), done: false };
            }
        });
    }

    // threeMatchingIterations(id, synths, generation) {
    //     return this.matchingIteration(id, synths, generation).then(abs => {
    //         if (abs.done) {
    //             return abs;
    //         } else {
    //             return this.matchingIteration(id, abs.antibodies.map(a => a.synth.copy()), abs[0].state.generation);
    //         }
    //     }).then(abs => {
    //         if (abs.done) {
    //             return abs;
    //         } else {
    //             return this.matchingIteration(id, abs.antibodies.map(a => a.synth.copy()), abs[0].state.generation);
    //         }
    //     });
    // }

    twoMatchingIterations(id, synths, generation) {
        return this.matchingIteration(id, synths, generation).then(abs => {
            if (abs.done) {
                return abs;
            } else {
                return this.matchingIteration(id, abs.antibodies.map(a => a.synth.copy()), abs.antibodies[0].state.generation);
            }
        });
    }

    updateMatchingForPathogen(id) {
        let matching = this.antiBodies.filter(ab => ab.isMatching() && ab.state.pathogen == id && !ab.toBeDeleted);
        if (matching.length > 0) {
            //console.log(`updating ${matching.length} matching`)
            let gen = matching[0].state.generation;
            this.matchingIteration(id, matching.map(ab => ab.synth), gen + 1).then(newAbs => {
                matching.forEach(ab => {
                    ab.toBeDeleted = true;
                });
                this.antiBodies = this.antiBodies.concat(newAbs.antibodies);
            })
        }
    }

    updatePlasmas() {
        this.antiBodies = this.antiBodies.filter(ab => {
            if (ab.canBeDeleted()) {
                if (ab.isMemory()) {
                    this.deletePathogen(ab.state.pathogen);
                }
                ab.dispose();
                return false;
            } else {
                return true;
            }
        });
        let plasmas = this.antiBodies.filter(ab => ab.isPlasma());
        if (plasmas.length < 5) {
            this.antiBodies.push(new AntiBody());
        }
    }

    tick() {
        //console.log(`tick ${tickCounter}`);
        //console.log(this);
        this.updatePlasmas();
        let totalPlaying = this.antiBodies.filter(ab => ab.playing).length;
        let nPlasmaPlaying = this.antiBodies.filter(ab => { return ab.isPlasma() && ab.playing }).length;

        
        let plasmas = this.antiBodies.filter(ab => { return ab.isPlasma() && !(ab.playing) });
        if ((nPlasmaPlaying < 2) && (totalPlaying < 3)) {
            if (Math.random() < 0.1 && (plasmas.length > 0)) {
                choose(plasmas).play();
            }
        } else if (totalPlaying < 3) {
            if (Math.random() < 0.04 && (plasmas.length > 0)) {
                choose(plasmas).play();
            }
        }

        let nMatchingPlaying = this.antiBodies.filter(ab => { return ab.isMatching() && ab.playing }).length;
        let matching = this.antiBodies.filter(ab => { return ab.isMatching() && !(ab.playing) });
        if (nMatchingPlaying < 2) {
            if ((Math.random() < 0.07) && (matching.length > 0)) {
                choose(matching).play();
            }
        }

        let nMemoryPlaying = this.antiBodies.filter(ab => { return ab.isMemory() && ab.playing }).length;
        let memory = this.antiBodies.filter(ab => { return ab.isMemory() && !(ab.playing) });

        if (nMemoryPlaying < 2) {
            if ((Math.random() < 0.06) && (memory.length > 0)) {
                choose(memory).play();
            }
        }

        if ((tickCounter % 30) == 0) {
            //console.log("UPDATE MATCHING");
//            console.log(this);
            this.pathogens.forEach(p => this.updateMatchingForPathogen(p.id));
        }
        tickCounter++;
    }

}

export const pathogens = new PathogensDB();


let main;
let mainCompressor;
let mainReverb;

export function mute() {
    main.gain.rampTo(0.0, 0.1);
}

export function unmute() {
    main.gain.rampTo(1.0, 0.1);
}


export function buildMain() {
    main = new Tone.Gain(1.0);
    mainCompressor = new Tone.Compressor(-18, 5);
    mainReverb = new Tone.Reverb({ wet: 0.1, decay: 8.0 }).toDestination();
    main.connect(mainCompressor);
    mainCompressor.connect(mainReverb);
}

// Todo create fadeout and dispose main
export function disposeMain() {
    //main.gain.rampTo(0, 0.3);
    main.decay = 0.5;
    setTimeout(() => { main.dispose(); mainCompressor.dispose(); mainReverb.dispose(); }, 800);
}

