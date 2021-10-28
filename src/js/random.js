export function choose(array) {
    return array[Math.floor(Math.random() * array.length)];
}


export function rnd(min, max) {
    let acutalMin = Math.min(min, max);
    let actualMax = Math.max(min, max);
    return Math.random() * (actualMax - acutalMin) + acutalMin;
}

export function exprand(lo, hi) { return lo * Math.exp(Math.log(hi / lo) * Math.random()) }
