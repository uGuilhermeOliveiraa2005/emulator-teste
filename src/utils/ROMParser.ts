// ROM Parser Utility
// Parses SNES ROM files and extracts header information

export interface ROMInfo {
    name: string;
    type: 'LoROM' | 'HiROM' | 'Unknown';
    romSize: number;
    ramSize: number;
    region: string;
    version: number;
    checksum: number;
    checksumComplement: number;
    valid: boolean;
}

export class ROMParser {
    static parse(data: Uint8Array): ROMInfo {
        const loRomInfo = this.parseHeader(data, 0x7FC0);
        const hiRomInfo = this.parseHeader(data, 0xFFC0);

        // Choose the header with better validation score
        if (loRomInfo.valid && hiRomInfo.valid) {
            // Both valid, prefer based on checksum
            return loRomInfo.checksum !== 0 ? loRomInfo : hiRomInfo;
        } else if (loRomInfo.valid) {
            return loRomInfo;
        } else if (hiRomInfo.valid) {
            return hiRomInfo;
        }

        // Neither valid, return LoROM as default
        return { ...loRomInfo, valid: false, type: 'Unknown' };
    }

    private static parseHeader(data: Uint8Array, offset: number): ROMInfo {
        if (offset + 0x30 > data.length) {
            return this.getEmptyInfo();
        }

        // Read ROM name (21 bytes at offset+0x00)
        let name = '';
        for (let i = 0; i < 21; i++) {
            const char = data[offset + i];
            if (char >= 32 && char < 127) {
                name += String.fromCharCode(char);
            } else {
                name += ' ';
            }
        }
        name = name.trim();

        // ROM makeup byte (offset+0x25)
        const makeup = data[offset + 0x25];
        const isLoROM = (makeup & 0x01) === 0;

        // ROM size (offset+0x27)
        const romSizeCode = data[offset + 0x27];
        const romSize = 1024 << romSizeCode;

        // RAM size (offset+0x28)
        const ramSizeCode = data[offset + 0x28];
        const ramSize = ramSizeCode > 0 ? 1024 << ramSizeCode : 0;

        // Region (offset+0x29)
        const regionCode = data[offset + 0x29];
        const region = this.getRegionName(regionCode);

        // Version (offset+0x2B)
        const version = data[offset + 0x2B];

        // Checksum complement (offset+0x2C-0x2D)
        const checksumComplement = data[offset + 0x2C] | (data[offset + 0x2D] << 8);

        // Checksum (offset+0x2E-0x2F)
        const checksum = data[offset + 0x2E] | (data[offset + 0x2F] << 8);

        // Validate checksum
        const valid = (checksum ^ checksumComplement) === 0xFFFF;

        return {
            name,
            type: isLoROM ? 'LoROM' : 'HiROM',
            romSize,
            ramSize,
            region,
            version,
            checksum,
            checksumComplement,
            valid
        };
    }

    private static getRegionName(code: number): string {
        const regions: { [key: number]: string } = {
            0x00: 'Japan',
            0x01: 'USA',
            0x02: 'Europe',
            0x03: 'Sweden',
            0x04: 'Finland',
            0x05: 'Denmark',
            0x06: 'France',
            0x07: 'Netherlands',
            0x08: 'Spain',
            0x09: 'Germany',
            0x0A: 'Italy',
            0x0B: 'China',
            0x0C: 'Indonesia',
            0x0D: 'South Korea'
        };

        return regions[code] || 'Unknown';
    }

    private static getEmptyInfo(): ROMInfo {
        return {
            name: '',
            type: 'LoROM',
            romSize: 0,
            ramSize: 0,
            region: 'Unknown',
            version: 0,
            checksum: 0,
            checksumComplement: 0,
            valid: false
        };
    }

    static validateChecksum(data: Uint8Array, info: ROMInfo): boolean {
        // Calculate actual checksum
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum = (sum + data[i]) & 0xFFFF;
        }

        return sum === info.checksum;
    }
}
