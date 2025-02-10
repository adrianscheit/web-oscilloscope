const paused = document.getElementById('paused') as HTMLInputElement;
const yScale = document.getElementById('yScale') as HTMLInputElement;
const fftSizeInput = document.querySelector('[name=fftSize]') as HTMLInputElement;
const xStabilization = document.querySelector('[name=xStabilization]') as HTMLInputElement;
const audioContext = new AudioContext();
audioContext.suspend();
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
    static readonly dataMiddleIndex = Math.floor(this.fftSize / 2);
    static readonly xStabilization: number = parseInt(xStabilization.value);
    static readonly maxShift = this.fftSize / this.xStabilization;

    readonly gain: GainNode = audioContext.createGain();
    readonly analyzer: AnalyserNode = audioContext.createAnalyser();
    readonly data = new Uint8Array(Analyzer.fftSize);
    readonly fftData: Uint8Array;
    readonly gainControl = document.createElement('label');

    constructor(private readonly strokeStyle: string) {
        this.analyzer.fftSize = Analyzer.fftSize;
        this.analyzer.smoothingTimeConstant = 0;
        this.fftData = new Uint8Array(this.analyzer.frequencyBinCount);
        this.gain.channelCount = 1;
        this.gain.connect(this.analyzer);

        this.createGainControl();
    }

    getData(): void {
        this.analyzer.getByteTimeDomainData(this.data);
    }

    getFftData(): void {
        this.analyzer.getByteFrequencyData(this.fftData);
    }

    calc0Shift(): number {
        for (let shift = 1; shift < Analyzer.maxShift; ++shift) {
            if (this.data[Analyzer.dataMiddleIndex + shift - 1] < 128 && this.data[Analyzer.dataMiddleIndex + shift] >= 128) {
                return shift;
            }
        }
        return 0;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillRect(0, 0, ctx.canvas.width, 256);
        ctx.beginPath();
        ctx.strokeStyle = this.strokeStyle;
        const shift = this.calc0Shift();
        ctx.moveTo(0, this.data[shift]);
        for (let i = shift + 1; i < this.data.length; i++) {
            ctx.lineTo(i - shift, this.data[i]);
        }
        ctx.stroke();
    }

    drawFft(ctx: CanvasRenderingContext2D): void {
        let maxI = 0, max = this.fftData[maxI];
        ctx.fillRect(0, 0, ctx.canvas.width, 256);
        ctx.beginPath();
        ctx.strokeStyle = this.strokeStyle;
        ctx.moveTo(0, 255 - this.fftData[0]);
        for (let i = 1; i < this.fftData.length; i++) {
            ctx.lineTo(i, 255 - this.fftData[i]);
            if (this.fftData[i] > max) {
                max = this.fftData[i];
                maxI = i;
            }
        }
        ctx.stroke();
        const previousFillStyle = ctx.fillStyle;
        ctx.fillStyle = this.strokeStyle;
        ctx.fillText(`${(maxI + 0.5) * audioContext.sampleRate / Analyzer.fftSize}Hz`, maxI, 20);
        ctx.fillStyle = previousFillStyle;
    }

    private createGainControl(): void {
        this.gainControl.style.color = this.strokeStyle;
        this.gainControl.appendChild(document.createTextNode('GAIN'));
        const input = this.gainControl.appendChild(document.createElement('input'));
        input.type = 'range';
        input.min = '1';
        input.max = '10';
        input.step = '0.1';
        input.value = '1';
        input.addEventListener('change', () => this.gain.gain.value = +input.value);
    }
}

const drawXInfo = (ctx: CanvasRenderingContext2D, x: number, text: string): boolean => {
    ctx.fillRect(x, 256, 1, 300 - 256);
    ctx.fillText(text, x + 1, 300 - 1);
    return x < ctx.canvas.width;
};

navigator.mediaDevices.getUserMedia({ audio: { deviceId: undefined } }).then((mediaStream: MediaStream) => {
    const source = audioContext.createMediaStreamSource(mediaStream);
    infoText.nodeValue = `There is audio soruce of:
        ${source.numberOfOutputs} outputs,
        ${source.channelCount} channels,
        ${audioContext.sampleRate} sample rate,
        ${1000 * Analyzer.fftSize / audioContext.sampleRate}ms oscilloscope view width
        `;
    const splitter = audioContext.createChannelSplitter(source.channelCount);
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
        const x = i * audioContext.sampleRate / 1000 + Analyzer.dataMiddleIndex;
        if (!drawXInfo(canvasCtx, x, i % 5 ? '' : `${i}ms`)) {
            break;
        }
    }
    fftCanvasCtx.font = '20px sans-serif';
    fftCanvasCtx.fillStyle = "#000";
    for (let i = 0; true; i += 1) {
        const x = 1000 * i * Analyzer.fftSize / audioContext.sampleRate;
        if (!drawXInfo(fftCanvasCtx, x, `${i}kHz`)) {
            break;
        }
    }

    canvasCtx.fillStyle = "#eee";
    fftCanvasCtx.fillStyle = "#eee";
    canvasCtx.lineWidth = 1;
    function draw(): void {
        if (!paused.checked) {
            analysers.forEach((analyser) => {
                analyser.getData();
                analyser.getFftData();
            });
            analysers.forEach((analyser) => {
                analyser.draw(canvasCtx);
                analyser.drawFft(fftCanvasCtx);
            });
            requestAnimationFrame(draw);
        } else {
            audioContext.suspend();
        }
    }

    const pausedHandler = () => {
        if (!paused.checked) {
            audioContext.resume();
            draw();
        }
    };

    paused.addEventListener('change', () => pausedHandler());

    pausedHandler();
});