// Controls Component
// UI controls for the emulator

interface ControlsProps {
    onLoadROM: (file: File) => void;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
    isRunning: boolean;
    romLoaded: boolean;
}

export function Controls({
    onLoadROM,
    onStart,
    onPause,
    onReset,
    isRunning,
    romLoaded
}: ControlsProps) {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onLoadROM(file);
        }
    };

    return (
        <div className="controls">
            <div className="control-group">
                <label htmlFor="rom-input" className="file-input-label">
                    <span>📁 Load ROM</span>
                    <input
                        id="rom-input"
                        type="file"
                        accept=".sfc,.smc"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>

            <div className="control-group">
                <button
                    onClick={isRunning ? onPause : onStart}
                    disabled={!romLoaded}
                    className="control-btn primary"
                >
                    {isRunning ? '⏸ Pause' : '▶ Play'}
                </button>

                <button
                    onClick={onReset}
                    disabled={!romLoaded}
                    className="control-btn"
                >
                    🔄 Reset
                </button>
            </div>

            <div className="keyboard-guide">
                <h3>🎮 Keyboard Controls</h3>
                <div className="key-mapping">
                    <div className="key-group">
                        <span className="key-label">D-Pad:</span>
                        <span className="keys">Arrow Keys</span>
                    </div>
                    <div className="key-group">
                        <span className="key-label">A:</span>
                        <span className="keys">X</span>
                    </div>
                    <div className="key-group">
                        <span className="key-label">B:</span>
                        <span className="keys">Z</span>
                    </div>
                    <div className="key-group">
                        <span className="key-label">X:</span>
                        <span className="keys">S</span>
                    </div>
                    <div className="key-group">
                        <span className="key-label">Y:</span>
                        <span className="keys">A</span>
                    </div>
                    <div className="key-group">
                        <span className="key-label">L/R:</span>
                        <span className="keys">Q/W</span>
                    </div>
                    <div className="key-group">
                        <span className="key-label">Start:</span>
                        <span className="keys">Enter</span>
                    </div>
                    <div className="key-group">
                        <span className="key-label">Select:</span>
                        <span className="keys">Right Shift</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
