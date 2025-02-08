const paused = document.getElementById('paused') as HTMLInputElement;
const yScale = document.getElementById('paused') as HTMLInputElement;
const audioCtx = new AudioContext();
audioCtx.suspend();
const colors = ['#f004', '#0f04', '#00f4', '#ff04'];
const infoText: Text = document.getElementById('info')!.appendChild(document.createTextNode(''))

class Analyzer {
    static readonly fftSize: 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384 | 32768 = 2048;

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
    infoText.nodeValue = `There is audio soruce of ${source.numberOfOutputs} outputs and ${source.channelCount} channels`;

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
        const value = Math.floor(+yScale.value);
        analysers.forEach((it) => it.analyzer.maxDecibels = value);
    });

    const canvas = document.getElementById("oscilloscope") as HTMLCanvasElement;
    canvas.width = Analyzer.fftSize;
    canvas.height = 300;
    const canvasCtx = canvas.getContext("2d")!;
    canvasCtx.font = '24px sans-serif'
    canvasCtx.fillStyle = "#000";
    for (let i = 0; true; i += 1) {
        const x = i * audioCtx.sampleRate / 1000;
        if (x >= Analyzer.fftSize) {
            break;
        }
        canvasCtx.fillRect(x, 256, 1, 300 - 256);
        if (i % 5 === 0) {
            canvasCtx.fillText(`${i}ms`, x + 1, 300);
        }
    }

    canvasCtx.fillStyle = "#eee";
    canvasCtx.lineWidth = 1;
    function draw(): void {
        if (!paused.checked) {
            analysers.forEach((analyser) => analyser.getData());
            canvasCtx.fillRect(0, 0, canvas.width, 256);
            analysers.forEach((analyser) => analyser.draw(canvasCtx));
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