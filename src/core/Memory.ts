// Memory.ts — SNES Memory Management
// PASSO 4 — DMA mínimo funcional (CPU → VRAM)

export class Memory {
    private wram = new Uint8Array(128 * 1024);
    private vram = new Uint8Array(64 * 1024);
    private cgram = new Uint8Array(512);
    private oam = new Uint8Array(544);

    private rom: Uint8Array | null = null;
    private romSize = 0;
    private romType: 'LoROM' | 'HiROM' = 'LoROM';

    private ioRegisters = new Uint8Array(0x4380);
    private ppu: any = null;

    // DMA (apenas canal 0)
    private dmaSource = 0;
    private dmaDest = 0;
    private dmaSize = 0;
    private dmaActive = false;

    setPPU(ppu: any): void {
        this.ppu = ppu;
    }

    loadROM(data: Uint8Array): void {
        let romData = data;
        if (data.length % 1024 === 512) {
            romData = data.slice(512);
        }

        this.rom = romData;
        this.romSize = romData.length;
        this.detectROMType();

        console.log(`✅ ROM loaded (${this.romType}) — ${this.romSize} bytes`);
    }

    // ======================
    // CPU READ / WRITE
    // ======================
    read(address: number): number {
        const bank = (address >> 16) & 0xFF;
        const offset = address & 0xFFFF;

        if (bank === 0x7E || bank === 0x7F) {
            return this.wram[((bank - 0x7E) << 16) | offset];
        }

        if (offset < 0x2000) return this.wram[offset];

        if (offset >= 0x2100 && offset < 0x4400) {
            return this.ioRegisters[offset - 0x2000];
        }

        return this.readROM(bank, offset);
    }

    write(address: number, value: number): void {
        const bank = (address >> 16) & 0xFF;
        const offset = address & 0xFFFF;

        if (bank === 0x7E || bank === 0x7F) {
            this.wram[((bank - 0x7E) << 16) | offset] = value;
            return;
        }

        if (offset < 0x2000) {
            this.wram[offset] = value;
            return;
        }

        // IO REGISTERS
        if (offset >= 0x2100 && offset < 0x4400) {
            this.ioRegisters[offset - 0x2000] = value;

            // Forward PPU registers
            if (offset >= 0x2100 && offset <= 0x213F && this.ppu) {
                this.ppu.writeRegister(offset, value);
            }

            // DMA REGISTERS (CANAL 0)
            this.handleDMARegister(offset, value);
        }
    }

    // ======================
    // DMA IMPLEMENTATION
    // ======================
    private handleDMARegister(offset: number, value: number): void {
        switch (offset) {
            case 0x4302: // A1T low
                this.dmaSource = (this.dmaSource & 0xFF00) | value;
                break;
            case 0x4303: // A1T high
                this.dmaSource = (value << 8) | (this.dmaSource & 0x00FF);
                break;
            case 0x4304: // A1B (bank)
                this.dmaSource |= value << 16;
                break;
            case 0x4301: // B-Bus dest
                this.dmaDest = value;
                break;
            case 0x4305: // DAS low
                this.dmaSize = (this.dmaSize & 0xFF00) | value;
                break;
            case 0x4306: // DAS high
                this.dmaSize = (value << 8) | (this.dmaSize & 0x00FF);
                break;
            case 0x420B: // DMA enable
                if (value & 0x01) {
                    this.executeDMA();
                }
                break;
        }
    }

    private executeDMA(): void {
        if (!this.ppu || this.dmaSize === 0) return;

        console.log(
            `🚚 DMA START → SRC=$${this.dmaSource.toString(16)} ` +
            `SIZE=${this.dmaSize} DEST=$${this.dmaDest.toString(16)}`
        );

        for (let i = 0; i < this.dmaSize; i++) {
            const data = this.read(this.dmaSource + i);

            // VRAM write via $2118 / $2119
            if (this.dmaDest === 0x18 || this.dmaDest === 0x19) {
                this.ppu.writeRegister(0x2118 + (i & 1), data);
            }
        }

        this.dmaSize = 0;
    }

    // ======================
    // ROM MAPPING
    // ======================
    private readROM(bank: number, offset: number): number {
        if (!this.rom) return 0xFF;

        let addr = 0;

        if (this.romType === 'LoROM') {
            if (offset >= 0x8000) {
                addr = ((bank & 0x7F) * 0x8000) + (offset - 0x8000);
            }
        } else {
            addr = ((bank & 0x7F) << 16) | offset;
        }

        addr %= this.romSize;
        return this.rom[addr];
    }

    private detectROMType(): void {
        if (!this.rom) return;
        this.romType = this.rom.length > 0x200000 ? 'HiROM' : 'LoROM';
    }

    // ======================
    // ACCESSORS
    // ======================
    getVRAM(): Uint8Array { return this.vram; }
    getCGRAM(): Uint8Array { return this.cgram; }
    getOAM(): Uint8Array { return this.oam; }
}
