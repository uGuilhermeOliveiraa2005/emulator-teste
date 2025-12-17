/**
 * PPU.ts — SNES Picture Processing Unit (Tile Rendering Engine)
 * Agora com suporte a renderização de Background Mode 1 (4bpp)
 */

export class PPU {
    private vram: Uint16Array;
    private cgram: Uint8Array;
    private oam: Uint8Array;

    private screenWidth = 256;
    private screenHeight = 224;
    private screenBuffer: Uint8ClampedArray;

    // Registradores
    private brightness = 0x0F;
    private vmain = 0;
    private vramAddress = 0;
    private cgramAddress = 0;
    private cgramFirstWrite = true; // Controle de escrita high/low byte da cgram

    // Estado
    private scanline = 0;
    private frameCounter = 0;

    // Background Registers
    private bgTilemapAddr = new Uint16Array(4); // SC
    private bgCharAddr = new Uint16Array(4);    // NBA
    private bgHScroll = new Uint16Array(4);     // HOFS
    private bgVScroll = new Uint16Array(4);     // VOFS
    private bgScrollPrev = new Uint8Array(4);   // Buffer para escrita dupla do scroll

    constructor(vram: Uint8Array, cgram: Uint8Array, oam: Uint8Array) {
        this.vram = new Uint16Array(vram.buffer); // VRAM como array de 16-bits
        this.cgram = cgram;
        this.oam = oam;
        this.screenBuffer = new Uint8ClampedArray(this.screenWidth * this.screenHeight * 4);
        this.reset();
    }

    public reset(): void {
        this.scanline = 0;
        this.frameCounter = 0;
        this.brightness = 0x0F;
        this.vramAddress = 0;
        this.cgramAddress = 0;
        this.screenBuffer.fill(0);
        console.log('🖼️ PPU Rendering Engine Loaded');
    }

    public getScanline(): number { return this.scanline; }
    public getScreenBuffer(): Uint8ClampedArray { return this.screenBuffer; }

    public writeRegister(address: number, value: number): void {
        const reg = address & 0xFFFF;

        switch (reg) {
            case 0x2100: this.brightness = value & 0x0F; break;

            // Mapeamento de Endereços de BG
            case 0x2107: this.bgTilemapAddr[0] = (value & 0x7C) << 8; break; // BG1 SC
            case 0x2108: this.bgTilemapAddr[1] = (value & 0x7C) << 8; break; // BG2 SC
            case 0x210B: // BG1 & BG2 Character Address
                this.bgCharAddr[0] = (value & 0x0F) << 12;
                this.bgCharAddr[1] = (value & 0xF0) << 8;
                break;

            // Scroll (Escrita Dupla: Primeiro byte = Low, Segundo = High)
            case 0x210D: // BG1 H-Scroll
                this.bgHScroll[0] = ((value << 8) | this.bgScrollPrev[0]) & 0x3FF;
                this.bgScrollPrev[0] = value;
                break;
            case 0x210E: // BG1 V-Scroll
                this.bgVScroll[0] = ((value << 8) | this.bgScrollPrev[0]) & 0x3FF;
                this.bgScrollPrev[0] = value;
                break;

            // VRAM Access
            case 0x2115: this.vmain = value; break;
            case 0x2116: this.vramAddress = (this.vramAddress & 0xFF00) | (value & 0xFF); break;
            case 0x2117: this.vramAddress = ((value & 0xFF) << 8) | (this.vramAddress & 0x00FF); break;
            case 0x2118: this.vramWrite(0, value); break;
            case 0x2119: this.vramWrite(1, value); break;

            // CGRAM Access
            case 0x2121:
                this.cgramAddress = value;
                this.cgramFirstWrite = true;
                break;
            case 0x2122:
                const addr = (this.cgramAddress << 1) & 0x1FF;
                if (this.cgramFirstWrite) {
                    this.cgram[addr] = value; // Low byte
                    this.cgramFirstWrite = false;
                } else {
                    this.cgram[addr + 1] = value; // High byte
                    this.cgramFirstWrite = true;
                    this.cgramAddress = (this.cgramAddress + 1) & 0xFF;
                }
                break;
        }
    }

    private vramWrite(byteSel: number, value: number): void {
        const addr = this.vramAddress & 0x7FFF;
        let current = this.vram[addr];

        if (byteSel === 0) current = (current & 0xFF00) | value;
        else current = (current & 0x00FF) | (value << 8);

        this.vram[addr] = current;

        // Auto-incremento V-Main
        const incMode = (this.vmain & 0x80) >> 7; // 0=inc on low, 1=inc on high
        if (incMode === byteSel) {
            const steps = [1, 32, 128, 128];
            const step = steps[this.vmain & 0x03];
            this.vramAddress = (this.vramAddress + step) & 0xFFFF;
        }
    }

    // ==========================================
    // 🎨 RENDERIZAÇÃO
    // ==========================================

    public renderScanline(): void {
        if (this.scanline < this.screenHeight) {
            // Limpa com a cor de fundo (Backdrop color - índice 0)
            this.clearScanlineToBackdrop(this.scanline);

            // Desenha BG1 (Assumindo Mode 1 - 4bpp)
            // Contra III usa BG1 pesadamente
            this.renderLayerMode1(0, this.scanline);
        }

        this.scanline++;
        if (this.scanline >= 262) {
            this.scanline = 0;
            this.frameCounter++;
        }
    }

    private clearScanlineToBackdrop(y: number): void {
        const color = this.getColor(0); // Cor 0 da CGRAM
        const start = y * this.screenWidth * 4;
        for (let x = 0; x < this.screenWidth; x++) {
            const i = start + x * 4;
            this.screenBuffer[i] = color.r;
            this.screenBuffer[i + 1] = color.g;
            this.screenBuffer[i + 2] = color.b;
            this.screenBuffer[i + 3] = 255;
        }
    }

    /**
     * Renderiza uma linha de Background no Modo 1 (4bpp)
     */
    private renderLayerMode1(bgIndex: number, y: number): void {
        const scrollX = this.bgHScroll[bgIndex];
        const scrollY = this.bgVScroll[bgIndex];

        const mapBase = this.bgTilemapAddr[bgIndex]; // Endereço base do Tilemap na VRAM
        const charBase = this.bgCharAddr[bgIndex];   // Endereço base dos Tiles na VRAM

        // Coordenada Y absoluta no mapa virtual (32x32 tiles repetidos)
        const vY = (y + scrollY) & 0x3FF; // Wrap em 1024 pixels

        for (let x = 0; x < this.screenWidth; x++) {
            const vX = (x + scrollX) & 0x3FF;

            // Descobrir qual Tile estamos desenhando
            // O mapa é dividido em 4 telas de 32x32 tiles (32*8 = 256 pixels)
            // Layout simples (sem levar em conta Size bit por enquanto para facilitar)
            const tileX = (vX >> 3) & 31;
            const tileY = (vY >> 3) & 31;

            // Calcular endereço no Tilemap (Word address)
            // Lógica simples para mapa 32x32. Jogos complexos usam espelhamento.
            const mapAddr = mapBase + (tileY * 32) + tileX;

            const tileEntry = this.vram[mapAddr & 0x7FFF]; // Lê atributos do tile

            const tileNum = tileEntry & 0x03FF;     // 10 bits para número do tile
            const palette = (tileEntry >> 10) & 7;  // 3 bits para paleta (0-7)
            const priority = (tileEntry >> 13) & 1; // Prioridade
            const flipX = (tileEntry >> 14) & 1;
            const flipY = (tileEntry >> 15) & 1;

            // Renderizar pixel dentro do tile (0-7)
            let row = vY & 7;
            let col = vX & 7;

            if (flipY) row = 7 - row;
            if (flipX) col = 7 - col;

            // Ler dados do gráfico (4bpp = 2 words por linha)
            // Cada tile tem 8 words (16 bytes) para os planos 0 e 1
            // E mais 8 words (16 bytes) para os planos 2 e 3 logo depois? 
            // Não, no SNES 4bpp é: 8 words (plano 0,1) seguido de 8 words (plano 2,3) não é linear assim.
            // Correção: Um tile 4bpp ocupa 32 bytes (16 words).
            // Estrutura: [p0 row0, p1 row0], [p0 row1, p1 row1]... 
            // VRAM é acessada por Words. Cada endereço tem 2 bytes.

            const charAddr = charBase + (tileNum * 16); // 16 words por tile 4bpp

            const bp01 = this.vram[(charAddr + row) & 0x7FFF];      // Bitplanes 0 e 1
            const bp23 = this.vram[(charAddr + 8 + row) & 0x7FFF];  // Bitplanes 2 e 3

            // Decodificar bitplanes
            const bit = 7 - col;
            const p0 = (bp01 >> bit) & 1;
            const p1 = (bp01 >> (8 + bit)) & 1;
            const p2 = (bp23 >> bit) & 1;
            const p3 = (bp23 >> (8 + bit)) & 1;

            const colorIndex = p0 | (p1 << 1) | (p2 << 2) | (p3 << 3);

            // Se pixel não for transparente (cor 0), desenha
            if (colorIndex !== 0) {
                // Paletas de BG usam as primeiras 8 paletas (0-7), cada uma com 16 cores
                const finalColorIndex = (palette * 16) + colorIndex;
                const color = this.getColor(finalColorIndex);

                const pixelIndex = (y * this.screenWidth + x) * 4;
                const brightnessScale = this.brightness / 15;

                this.screenBuffer[pixelIndex] = color.r * brightnessScale;
                this.screenBuffer[pixelIndex + 1] = color.g * brightnessScale;
                this.screenBuffer[pixelIndex + 2] = color.b * brightnessScale;
                this.screenBuffer[pixelIndex + 3] = 255;
            }
        }
    }

    private getColor(index: number): { r: number, g: number, b: number } {
        const addr = (index * 2) & 0x1FF;
        const low = this.cgram[addr];
        const high = this.cgram[addr + 1];
        const word = low | (high << 8);

        // SNES Color: BGR555 (5 bits Blue, 5 bits Green, 5 bits Red)
        // RGB888 output
        const r = (word & 0x1F) << 3;
        const g = ((word >> 5) & 0x1F) << 3;
        const b = ((word >> 10) & 0x1F) << 3;

        return { r, g, b };
    }
}