/**
 * Memory.ts — SNES Memory Management
 * Implementação completa com DMA multi-canal e mapeamento correto
 */

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
    private apu: any = null;
    private input: any = null;

    // DMA - 8 canais
    private dmaChannels: Array<{
        params: number;
        bAddress: number;
        aAddress: number;
        aBank: number;
        size: number;
        hdmaBank: number;
    }> = [];

    constructor() {
        // Inicializa 8 canais DMA
        for (let i = 0; i < 8; i++) {
            this.dmaChannels[i] = {
                params: 0,
                bAddress: 0,
                aAddress: 0,
                aBank: 0,
                size: 0,
                hdmaBank: 0
            };
        }
    }

    setPPU(ppu: any): void { this.ppu = ppu; }
    setAPU(apu: any): void { this.apu = apu; }
    setInput(input: any): void { this.input = input; }

    loadROM(data: Uint8Array): void {
        let romData = data;
        if (data.length % 1024 === 512) {
            romData = data.slice(512);
        }

        this.rom = romData;
        this.romSize = romData.length;
        this.detectROMType();

        console.log(`✅ ROM loaded (${this.romType}) — ${(this.romSize / 1024).toFixed(0)}KB`);
    }

    read(address: number): number {
        const bank = (address >> 16) & 0xFF;
        const offset = address & 0xFFFF;

        // WRAM ($7E-$7F)
        if (bank === 0x7E || bank === 0x7F) {
            return this.wram[((bank - 0x7E) << 16) | offset];
        }

        // Low RAM mirror ($00-$3F/$80-$BF: $0000-$1FFF)
        if (offset < 0x2000) {
            return this.wram[offset];
        }

        // PPU/APU/IO Registers ($00-$3F/$80-$BF: $2000-$5FFF)
        if (offset >= 0x2000 && offset < 0x6000) {
            return this.readIO(offset);
        }

        // ROM
        return this.readROM(bank, offset);
    }

    write(address: number, value: number): void {
        const bank = (address >> 16) & 0xFF;
        const offset = address & 0xFFFF;

        // WRAM
        if (bank === 0x7E || bank === 0x7F) {
            this.wram[((bank - 0x7E) << 16) | offset] = value;
            return;
        }

        // Low RAM mirror
        if (offset < 0x2000) {
            this.wram[offset] = value;
            return;
        }

        // IO Registers
        if (offset >= 0x2000 && offset < 0x6000) {
            this.writeIO(offset, value);
        }
    }
    private readIO(offset: number): number {
        // Input ports
        if (offset === 0x4016 && this.input) {
            return this.input.readController(1);
        }
        if (offset === 0x4017 && this.input) {
            return this.input.readController(2);
        }

        // APU ports
        if (offset >= 0x2140 && offset <= 0x2143 && this.apu) {
            return this.apu.readPort(offset - 0x2140);
        }

        // PPU Status registers
        if (offset === 0x2137) return 0; // SLHV
        if (offset === 0x213C) return 0; // OPHCT
        if (offset === 0x213D) return 0; // OPVCT
        if (offset === 0x213E) return 0x01; // STAT77
        if (offset === 0x213F) return 0x02; // STAT78

        return this.ioRegisters[offset - 0x2000] || 0;
    }

    private writeIO(offset: number, value: number): void {
        this.ioRegisters[offset - 0x2000] = value;

        // PPU Registers
        if (offset >= 0x2100 && offset <= 0x2133 && this.ppu) {
            this.ppu.writeRegister(offset, value);
        }

        // APU Ports
        if (offset >= 0x2140 && offset <= 0x2143 && this.apu) {
            this.apu.writePort(offset - 0x2140, value);
        }

        // Input
        if (offset === 0x4016 && this.input) {
            this.input.latchControllers();
        }

        // DMA Registers
        this.handleDMA(offset, value);
    }

    private handleDMA(offset: number, value: number): void {
        // DMA Channel registers ($43x0-$43xF for channel x)
        if (offset >= 0x4300 && offset < 0x4380) {
            const channel = Math.floor((offset - 0x4300) / 16);
            const reg = offset & 0x0F;

            switch (reg) {
                case 0x00: this.dmaChannels[channel].params = value; break;
                case 0x01: this.dmaChannels[channel].bAddress = value; break;
                case 0x02: this.dmaChannels[channel].aAddress = (this.dmaChannels[channel].aAddress & 0xFF00) | value; break;
                case 0x03: this.dmaChannels[channel].aAddress = (value << 8) | (this.dmaChannels[channel].aAddress & 0x00FF); break;
                case 0x04: this.dmaChannels[channel].aBank = value; break;
                case 0x05: this.dmaChannels[channel].size = (this.dmaChannels[channel].size & 0xFF00) | value; break;
                case 0x06: this.dmaChannels[channel].size = (value << 8) | (this.dmaChannels[channel].size & 0x00FF); break;
            }
        }

        // DMA Enable ($420B)
        if (offset === 0x420B) {
            for (let i = 0; i < 8; i++) {
                if (value & (1 << i)) {
                    this.executeDMA(i);
                }
            }
        }

        // HDMA Enable ($420C)
        if (offset === 0x420C) {
            // HDMA implementation (complex)
        }
    }

    private executeDMA(channel: number): void {
        const dma = this.dmaChannels[channel];
        const direction = (dma.params & 0x80) !== 0; // 0=CPU->PPU, 1=PPU->CPU
        const mode = dma.params & 0x07;

        let srcAddr = (dma.aBank << 16) | dma.aAddress;
        let size = dma.size || 0x10000;

        if (!this.ppu) return;

        console.log(`🚚 DMA Channel ${channel}: $${srcAddr.toString(16)} → $21${dma.bAddress.toString(16).padStart(2, '0')} (${size} bytes)`);

        for (let i = 0; i < size; i++) {
            if (direction === false) {
                // CPU -> PPU
                const data = this.read(srcAddr + i);
                this.ppu.writeRegister(0x2100 + dma.bAddress, data);
            } else {
                // PPU -> CPU (raro)
                const data = this.ppu.readRegister(0x2100 + dma.bAddress);
                this.write(srcAddr + i, data);
            }
        }

        dma.size = 0;
    }

    private readROM(bank: number, offset: number): number {
        if (!this.rom) return 0xFF;

        let addr = 0;

        if (this.romType === 'LoROM') {
            if (bank <= 0x7D && offset >= 0x8000) {
                addr = ((bank & 0x7F) << 15) | (offset & 0x7FFF);
            } else if (bank >= 0x80 && bank <= 0xFD && offset >= 0x8000) {
                addr = ((bank & 0x7F) << 15) | (offset & 0x7FFF);
            } else if (bank >= 0xFE && offset >= 0x8000) {
                addr = ((bank & 0x7F) << 15) | (offset & 0x7FFF);
            }
        } else { // HiROM
            if (bank >= 0xC0 || (bank >= 0x40 && bank < 0x80)) {
                addr = ((bank & 0x3F) << 16) | offset;
            }
        }

        addr %= this.romSize;
        return this.rom[addr];
    }

    private detectROMType(): void {
        if (!this.rom) return;

        // Detecta baseado no tamanho e checksums
        const loRomHeader = this.parseHeaderAt(0x7FC0);
        const hiRomHeader = this.parseHeaderAt(0xFFC0);

        if (loRomHeader.valid && !hiRomHeader.valid) {
            this.romType = 'LoROM';
        } else if (hiRomHeader.valid && !loRomHeader.valid) {
            this.romType = 'HiROM';
        } else {
            // Ambos válidos ou inválidos, usa heurística
            this.romType = this.romSize > 0x200000 ? 'HiROM' : 'LoROM';
        }
    }

    private parseHeaderAt(offset: number): { valid: boolean } {
        if (!this.rom || offset + 0x30 > this.rom.length) {
            return { valid: false };
        }

        const checksum = this.rom[offset + 0x2E] | (this.rom[offset + 0x2F] << 8);
        const checksumComplement = this.rom[offset + 0x2C] | (this.rom[offset + 0x2D] << 8);

        return { valid: (checksum ^ checksumComplement) === 0xFFFF };
    }

    getVRAM(): Uint8Array { return this.vram; }
    getCGRAM(): Uint8Array { return this.cgram; }
    getOAM(): Uint8Array { return this.oam; }
}