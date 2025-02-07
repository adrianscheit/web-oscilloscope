const paused = document.getElementById('paused') as HTMLInputElement;
const audioCtx = new AudioContext();

class Analyzer {
    static readonly fftSize = 4096;

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
    console.log(source, splitter);
    const colors = ['#f004', '#0f04', '#00f4', '#ff04']
    const analysers: Analyzer[] = Array(source.channelCount)
        .fill(undefined)
        .map((_, index) => new Analyzer(colors[index % 4]));
    analysers.forEach((analyser, index) => {
        splitter.connect(analyser.analyzer, index);
    });
    source.connect(splitter);
    console.log(source, splitter, analysers);

    const canvas = document.getElementById("oscilloscope") as HTMLCanvasElement;
    canvas.width = Analyzer.fftSize;
    canvas.height = 256;
    const canvasCtx = canvas.getContext("2d")!;
    canvasCtx.fillStyle = "#ddd";
    canvasCtx.lineWidth = 1;

    function draw(): void {
        if (!paused.checked) {
            analysers.forEach((analyser) => analyser.getData());
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            analysers.forEach((analyser) => analyser.draw(canvasCtx));
            requestAnimationFrame(draw);
        }
    }
    audioCtx.resume();
    draw();

    paused.addEventListener('change', () => {
        if (paused.checked) {
            audioCtx.suspend();
        } else {
            audioCtx.resume();
            draw();
        }
    });
});