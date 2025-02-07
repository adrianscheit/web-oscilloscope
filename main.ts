const paused = document.getElementById('paused') as HTMLInputElement;
const yScale = document.getElementById('paused') as HTMLInputElement;
const audioCtx = new AudioContext();
const colors = ['#f004', '#0f04', '#00f4', '#ff04'];

class Analyzer {
    static readonly fftSize = 2048;

    readonly analyzer: AnalyserNode = audioCtx.createAnalyser();
    readonly data = new Uint8Array(Analyzer.fftSize);

    constructor(private readonly strokeStyle: string) {
        this.analyzer.fftSize = Analyzer.fftSize;
        this.analyzer.smoothingTimeConstant = 0;
        this.analyzer.channelCount = 1;
    }

    getData(): void {
        this.analyzer.getByteTimeDomainData(this.data);
    }

    draw(canvasCtx: CanvasRenderingContext2D): void {
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = this.strokeStyle;
        canvasCtx.moveTo(0, this.data[0]);
        for (let i = 1; i < Analyzer.fftSize; i++) {
            canvasCtx.lineTo(i, this.data[i]);
        }
        canvasCtx.stroke();
    }
}

navigator.mediaDevices.getUserMedia({ audio: { deviceId: undefined } }).then((mediaStream: MediaStream) => {
    const source = audioCtx.createMediaStreamSource(mediaStream);
    const splitter = audioCtx.createChannelSplitter(source.channelCount);
    const analysers: Analyzer[] = Array(source.channelCount)
        .fill(undefined)
        .map((_, index) => new Analyzer(colors[index % 4]));
    analysers.forEach((analyser, index) => {
        splitter.connect(analyser.analyzer, index);
    });
    source.connect(splitter);
    console.log(source, splitter, analysers);

    yScale.addEventListener('change', () => {
        const value = +yScale.value;
        analysers.forEach((it) => it.analyzer.maxDecibels = value);
    });

    const canvas = document.getElementById("oscilloscope") as HTMLCanvasElement;
    canvas.width = Analyzer.fftSize;
    canvas.height = 300;
    const canvasCtx = canvas.getContext("2d")!;
    canvasCtx.font = '24px sans-serif'
    canvasCtx.fillStyle = "#000";
    for (let i = 0; i < Analyzer.fftSize; i += 100) {
        canvasCtx.fillText(`${Math.round(1000 * i / audioCtx.sampleRate)}ms`, i, 300);
    }

    canvasCtx.fillStyle = "#eee";
    canvasCtx.lineWidth = 1;
    function draw(): void {
        if (!paused.checked) {
            analysers.forEach((analyser) => analyser.getData());
            canvasCtx.fillRect(0, 0, canvas.width, 256);
            analysers.forEach((analyser) => analyser.draw(canvasCtx));
            requestAnimationFrame(draw);
        }
    }

    const pausedHandler = () => {
        if (paused.checked) {
            audioCtx.suspend();
        } else {
            audioCtx.resume();
            draw();
        }
    };

    paused.addEventListener('change', () => pausedHandler());

    pausedHandler();
});