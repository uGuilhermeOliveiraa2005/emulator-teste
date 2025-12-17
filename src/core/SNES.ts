// SNES.ts - Fixed Core System
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
    private readonly CPU_CYCLES_PER_SCANLINE = 227; // ~1364/6

    private frameCallback: ((buffer: Uint8ClampedArray) => void) | null = null;
    private animationFrameId: number = 0;

    constructor() {
        this.memory = new Memory();
        this.ppu = new PPU(
            this.memory.getVRAM(),
            this.memory.getCGRAM(),
            this.memory.getOAM()
        );

        // IMPORTANTE: Conectar PPU ao Memory
        this.memory.setPPU(this.ppu);

        this.apu = new APU();
        this.input = new Input();
        this.cpu = new CPU65816(this.memory);

        console.log('🎮 SNES system initialized');
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
        console.log('🔄 SNES system reset complete');
    }

    init(): void {
        this.apu.init();
    }

    start(): void {
        if (!this.running) {
            this.running = true;
            console.log('▶️  SNES started');
            this.runFrame();
        }
    }

    stop(): void {
        this.running = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
        }
        console.log('⏹️  SNES stopped');
    }

    pause(): void {
        this.running = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
        }
        this.apu.suspend();
        console.log('⏸️  SNES paused');
    }

    resume(): void {
        if (!this.running) {
            this.running = true;
            this.apu.resume();
            console.log('▶️  SNES resumed');
            this.runFrame();
        }
    }

    private runFrame(): void {
        if (!this.running) return;

        const startTime = performance.now();

        // Run one frame (262 scanlines)
        for (let scanline = 0; scanline < this.SCANLINES_PER_FRAME; scanline++) {
            this.runScanline();
        }

        this.frameCount++;

        // Trigger frame callback with rendered buffer
        if (this.frameCallback) {
            this.frameCallback(this.ppu.getScreenBuffer());
        }

        // Log PPU state every 60 frames (1 second)
        if (this.frameCount % 60 === 0) {
            console.log(`📊 Frame ${this.frameCount}: scanline=${this.ppu.getScanline()}`);
        }

        // Schedule next frame with proper timing
        const elapsed = performance.now() - startTime;
        const targetFrameTime = 1000 / 60; // 60 FPS
        const delay = Math.max(0, targetFrameTime - elapsed);

        setTimeout(() => {
            this.animationFrameId = requestAnimationFrame(() => this.runFrame());
        }, delay);
    }

    private runScanline(): void {
        // Run PPU for one scanline
        this.ppu.renderScanline();

        // Run CPU for scanline duration
        let cyclesRun = 0;
        while (cyclesRun < this.CPU_CYCLES_PER_SCANLINE) {
            try {
                const cycles = this.cpu.step();
                cyclesRun += cycles;

                // Run APU
                this.apu.step(cycles);
            } catch (error) {
                // Silently handle CPU errors to prevent crashes
                cyclesRun = this.CPU_CYCLES_PER_SCANLINE;
            }
        }

        this.masterClock += cyclesRun;
    }

    setFrameCallback(callback: (buffer: Uint8ClampedArray) => void): void {
        this.frameCallback = callback;
    }

    getMemory(): Memory {
        return this.memory;
    }

    getCPU(): CPU65816 {
        return this.cpu;
    }

    getPPU(): PPU {
        return this.ppu;
    }

    getAPU(): APU {
        return this.apu;
    }

    getInput(): Input {
        return this.input;
    }

    isRunning(): boolean {
        return this.running;
    }

    getMasterClock(): number {
        return this.masterClock;
    }

    getFrameCount(): number {
        return this.frameCount;
    }

    saveState(): any {
        return {
            cpu: this.cpu.getRegisters(),
            flags: this.cpu.getFlags(),
            masterClock: this.masterClock,
            frameCount: this.frameCount
        };
    }

    loadState(state: any): void {
        this.masterClock = state.masterClock || 0;
        this.frameCount = state.frameCount || 0;
    }
}