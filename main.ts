const paused = document.getElementById('paused') as HTMLInputElement;
const yScale = document.getElementById('yScale') as HTMLInputElement;
const fftSizeInput = document.querySelector('[name=fftSize]') as HTMLInputElement;
const audioCtx = new AudioContext();
audioCtx.suspend();
const colors = ['#f00', '#0f0', '#00f', '#aa0', '#0aa', '#a0a'];
const infoText: Text = document.getElementById('info')!.appendChild(document.createTextNode(''));

const getGetParams = (): ReadonlyMap<string, string> => {
    const result = new Map<string, string>();
    const search = window.location.search;
    console.log(search);
    if (search) {
        for (const segement of search.slice(1).split('&')) {
            const eqIndex = segement.indexOf('=');
            const name = segement.substring(0, eqIndex);
            const value = segement.substring(eqIndex + 1);
            result.set(name, value);
            (document.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value;
        }
    }
    return result;
};
const getParmas: ReadonlyMap<string, string> = getGetParams();
console.log(getParmas);


class Analyzer {
    static readonly fftSize: number = parseInt(fftSizeInput.value);

    readonly gain: GainNode = audioCtx.createGain();
    readonly analyzer: AnalyserNode = audioCtx.createAnalyser();
    readonly data = new Uint8Array(Analyzer.fftSize);
    readonly fftData = new Uint8Array(this.analyzer.frequencyBinCount);
    readonly gainControl = document.createElement('label');

    constructor(private readonly strokeStyle: string) {
        this.analyzer.fftSize = Analyzer.fftSize;
        this.analyzer.smoothingTimeConstant = 0;
        this.analyzer.channelCount = 1;
        this.gain.channelCount = 1;
        this.gain.connect(this.analyzer);

        this.gainControl.style.color = strokeStyle;
        this.gainControl.appendChild(document.createTextNode('yScale'));
        const input = document.createElement('input');
        input.type = 'range';
        input.min = '1';
        input.max = '10';
        input.step = '0.1';
        input.value = '1';
        this.gainControl.appendChild(input);
        input.addEventListener('change', () => this.gain.gain.value = +input.value);
    }

    getData(): void {
        this.analyzer.getByteTimeDomainData(this.data);
    }

    getFftData(): void {
        this.analyzer.getByteFrequencyData(this.fftData);
    }

    draw(canvasCtx: CanvasRenderingContext2D): void {
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = this.strokeStyle;
        canvasCtx.moveTo(0, this.data[0]);
        for (let i = 1; i < this.data.length; i++) {
            canvasCtx.lineTo(i, this.data[i]);
        }
        canvasCtx.stroke();
    }

    drawFft(canvasCtx: CanvasRenderingContext2D): void {
        let max = 0, maxI = 0;
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = this.strokeStyle;
        canvasCtx.moveTo(0, this.fftData[0]);
        for (let i = 1; i < this.fftData.length; i++) {
            canvasCtx.lineTo(i, 255 - this.fftData[i]);
            if (this.fftData[i] > max) {
                max = this.fftData[i];
                maxI = i;
            }
        }
        canvasCtx.stroke();
        const previousFillStyle = canvasCtx.fillStyle;
        canvasCtx.fillStyle = this.strokeStyle;
        canvasCtx.fillText(`${(maxI + 0.5) * audioCtx.sampleRate / Analyzer.fftSize}Hz`, maxI, 20);
        canvasCtx.fillStyle = previousFillStyle;
    }
}

navigator.mediaDevices.getUserMedia({ audio: { deviceId: undefined } }).then((mediaStream: MediaStream) => {
    const source = audioCtx.createMediaStreamSource(mediaStream);
    infoText.nodeValue = `There is audio soruce of ${source.numberOfOutputs} outputs and ${source.channelCount} channels`;
    const splitter = audioCtx.createChannelSplitter(source.channelCount);
    const analysers: Analyzer[] = Array(source.channelCount)
        .fill(undefined)
        .map((_, index) => new Analyzer(colors[index % 4]));
    analysers.forEach((analyser, index) => {
        splitter.connect(analyser.gain, index);
        document.getElementById('gains')!.appendChild(analyser.gainControl);
    });
    source.connect(splitter);
    console.log(source, splitter, analysers);

    const canvas = document.getElementById("oscilloscope") as HTMLCanvasElement;
    const fftCanvas = document.getElementById("fft") as HTMLCanvasElement;
    canvas.width = Analyzer.fftSize;
    fftCanvas.width = analysers[0].analyzer.frequencyBinCount;
    canvas.height = 300;
    fftCanvas.height = 300;
    const canvasCtx = canvas.getContext("2d")!;
    const fftCanvasCtx = fftCanvas.getContext("2d")!;

    canvasCtx.font = '20px sans-serif';
    canvasCtx.fillStyle = "#000";
    for (let i = 0; true; i += 1) {
        const x = i * audioCtx.sampleRate / 1000;
        if (x >= canvas.width) {
            break;
        }
        canvasCtx.fillRect(x, 256, 1, 300 - 256);
        if (i % 5 === 0) {
            canvasCtx.fillText(`${i}ms`, x + 1, 300);
        }
    }
    fftCanvasCtx.font = '20px sans-serif';
    fftCanvasCtx.fillStyle = "#000";
    for (let i = 0; true; i += 1) {
        const x = 1000 * i * Analyzer.fftSize / audioCtx.sampleRate;
        if (x >= fftCanvas.width) {
            break;
        }
        fftCanvasCtx.fillRect(x, 256, 1, 300 - 256);
        fftCanvasCtx.fillText(`${i}kHz`, x + 1, 300);
    }

    canvasCtx.fillStyle = "#eee";
    fftCanvasCtx.fillStyle = "#eee";
    canvasCtx.lineWidth = 1;
    function draw(): void {
        if (!paused.checked) {
            analysers.forEach((analyser) => analyser.getData());
            canvasCtx.fillRect(0, 0, Analyzer.fftSize, 256);
            analysers.forEach((analyser) => analyser.draw(canvasCtx));
            analysers.forEach((analyser) => analyser.getFftData());
            fftCanvasCtx.fillRect(0, 0, Analyzer.fftSize, 256);
            analysers.forEach((analyser) => analyser.drawFft(fftCanvasCtx));
            requestAnimationFrame(draw);
        } else {
            audioCtx.suspend();
        }
    }

    const pausedHandler = () => {
        if (!paused.checked) {
            audioCtx.resume();
            draw();
        }
    };

    paused.addEventListener('change', () => pausedHandler());

    pausedHandler();
});