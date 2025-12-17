import { CPU65816 } from './CPU65816';
import { Memory } from './Memory';
import { PPU } from './PPU';
import { APU } from './APU';
import { Input } from './Input';

export class SNES {
    private cpu: CPU65816;
    private memory: Memory;
    private ppu: PPU;
    private apu: APU;
    private input: Input;

    private running: boolean = false;
    private masterClock: number = 0;
    private frameCount: number = 0;

    private readonly SCANLINES_PER_FRAME = 262;
    private readonly MASTER_CYCLES_PER_SCANLINE = 1364;
    private readonly CPU_CYCLES_PER_SCANLINE = 227;

    private frameCallback: ((buffer: Uint8ClampedArray) => void) | null = null;
    private animationFrameId: number = 0;
    private lastFrameTime: number = 0;

    constructor() {
        this.memory = new Memory();
        this.ppu = new PPU(
            this.memory.getVRAM(),
            this.memory.getCGRAM(),
            this.memory.getOAM()
        );
        this.apu = new APU();
        this.input = new Input();

        // Conectar componentes
        this.memory.setPPU(this.ppu);
        this.memory.setAPU(this.apu);
        this.memory.setInput(this.input);

        this.cpu = new CPU65816(this.memory);

        console.log('🎮 SNES System Initialized');
        console.log('📺 PPU: All 8 modes + sprites ready');
        console.log('🔊 APU: Audio system ready');
        console.log('🎯 Input: Controller support active');
    }

    loadROM(data: Uint8Array): void {
        this.memory.loadROM(data);
        this.reset();
    }

    reset(): void {
        this.cpu.reset();
        this.ppu.reset();
        this.apu.reset();
        this.masterClock = 0;
        this.frameCount = 0;
        console.log('🔄 System Reset Complete');
    }

    init(): void {
        this.apu.init();
    }

    start(): void {
        if (!this.running) {
            this.running = true;
            this.lastFrameTime = performance.now();
            console.log('▶️  Emulation Started');
            this.runFrame();
        }
    }

    stop(): void {
        this.running = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
        }
        console.log('⏹️  Emulation Stopped');
    }

    pause(): void {
        this.running = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
        }
        this.apu.suspend();
        console.log('⏸️  Emulation Paused');
    }

    resume(): void {
        if (!this.running) {
            this.running = true;
            this.apu.resume();
            this.lastFrameTime = performance.now();
            console.log('▶️  Emulation Resumed');
            this.runFrame();
        }
    }

    private runFrame(): void {
        if (!this.running) return;

        const frameStartTime = performance.now();

        try {
            // Executa 262 scanlines (1 frame NTSC)
            for (let scanline = 0; scanline < this.SCANLINES_PER_FRAME; scanline++) {
                this.runScanline();
            }

            this.frameCount++;

            // Callback com buffer renderizado
            if (this.frameCallback) {
                this.frameCallback(this.ppu.getScreenBuffer());
            }

            // Log de performance a cada 60 frames
            if (this.frameCount % 60 === 0) {
                const fps = 1000 / (frameStartTime - this.lastFrameTime);
                console.log(`📊 Frame ${this.frameCount}: ${fps.toFixed(1)} FPS`);
                this.lastFrameTime = frameStartTime;
            }

        } catch (error) {
            console.error('❌ Frame execution error:', error);
        }

        // Agenda próximo frame
        const elapsed = performance.now() - frameStartTime;
        const targetFrameTime = 1000 / 60.0988; // NTSC timing preciso
        const delay = Math.max(0, targetFrameTime - elapsed);

        setTimeout(() => {
            this.animationFrameId = requestAnimationFrame(() => this.runFrame());
        }, delay);
    }

    private runScanline(): void {
        // Renderiza scanline na PPU
        this.ppu.renderScanline();

        // Executa CPU por uma scanline
        let cyclesRun = 0;
        const targetCycles = this.CPU_CYCLES_PER_SCANLINE;

        while (cyclesRun < targetCycles && this.running) {
            try {
                const cycles = this.cpu.step();
                cyclesRun += cycles;

                // Executa APU em paralelo
                this.apu.step(cycles);

            } catch (error) {
                // Silencia erros de CPU para evitar crashes
                cyclesRun = targetCycles;
            }
        }

        this.masterClock += cyclesRun;
    }

    setFrameCallback(callback: (buffer: Uint8ClampedArray) => void): void {
        this.frameCallback = callback;
    }

    // Getters
    getMemory(): Memory { return this.memory; }
    getCPU(): CPU65816 { return this.cpu; }
    getPPU(): PPU { return this.ppu; }
    getAPU(): APU { return this.apu; }
    getInput(): Input { return this.input; }
    isRunning(): boolean { return this.running; }
    getMasterClock(): number { return this.masterClock; }
    getFrameCount(): number { return this.frameCount; }

    // Save states
    saveState(): any {
        return {
            cpu: this.cpu.getRegisters(),
            flags: this.cpu.getFlags(),
            masterClock: this.masterClock,
            frameCount: this.frameCount,
            wram: Array.from(this.memory['wram']).slice(0, 1000) // Sample
        };
    }

    loadState(state: any): void {
        this.masterClock = state.masterClock || 0;
        this.frameCount = state.frameCount || 0;
        // Restaurar registradores seria mais complexo
    }
}