// Debug Panel Component
// Shows CPU state, memory, and performance metrics

import type { CPU65816Registers, CPU65816Flags } from '../core/CPU65816';

interface DebugPanelProps {
    registers: CPU65816Registers | null;
    flags: CPU65816Flags | null;
    fps: number;
    romInfo: { name: string; type: string } | null;
}

export function DebugPanel({ registers, flags, fps, romInfo }: DebugPanelProps) {
    const formatHex = (value: number, digits: number) => {
        return '0x' + value.toString(16).toUpperCase().padStart(digits, '0');
    };

    return (
        <div className="debug-panel">
            <h3>🔧 Debug Information</h3>

            {romInfo && (
                <div className="debug-section">
                    <h4>ROM Info</h4>
                    <div className="debug-info">
                        <div><span className="label">Name:</span> {romInfo.name}</div>
                        <div><span className="label">Type:</span> {romInfo.type}</div>
                    </div>
                </div>
            )}

            <div className="debug-section">
                <h4>Performance</h4>
                <div className="debug-info">
                    <div><span className="label">FPS:</span> {fps.toFixed(1)}</div>
                </div>
            </div>

            {registers && (
                <div className="debug-section">
                    <h4>CPU Registers</h4>
                    <div className="debug-info registers">
                        <div><span className="label">A:</span> {formatHex(registers.A, 4)}</div>
                        <div><span className="label">X:</span> {formatHex(registers.X, 4)}</div>
                        <div><span className="label">Y:</span> {formatHex(registers.Y, 4)}</div>
                        <div><span className="label">SP:</span> {formatHex(registers.SP, 4)}</div>
                        <div><span className="label">PC:</span> {formatHex(registers.PC, 4)}</div>
                        <div><span className="label">PB:</span> {formatHex(registers.PB, 2)}</div>
                        <div><span className="label">DB:</span> {formatHex(registers.DB, 2)}</div>
                        <div><span className="label">D:</span> {formatHex(registers.D, 4)}</div>
                    </div>
                </div>
            )}

            {flags && (
                <div className="debug-section">
                    <h4>CPU Flags</h4>
                    <div className="debug-info flags">
                        <div className={flags.N ? 'active' : ''}>N</div>
                        <div className={flags.V ? 'active' : ''}>V</div>
                        <div className={flags.M ? 'active' : ''}>M</div>
                        <div className={flags.X ? 'active' : ''}>X</div>
                        <div className={flags.D ? 'active' : ''}>D</div>
                        <div className={flags.I ? 'active' : ''}>I</div>
                        <div className={flags.Z ? 'active' : ''}>Z</div>
                        <div className={flags.C ? 'active' : ''}>C</div>
                        <div className={flags.E ? 'active' : ''}>E</div>
                    </div>
                </div>
            )}
        </div>
    );
}
