// Main Emulator Component - FIXED VERSION
// Integrates all components with proper initialization

import { useEffect, useRef, useState } from 'react';
import { SNES } from '../core/SNES';
import { ROMParser } from '../utils/ROMParser';
import { Screen } from './Screen';
import { Controls } from './Controls';
import { DebugPanel } from './DebugPanel';
import type { CPU65816Registers, CPU65816Flags } from '../core/CPU65816';

export function Emulator() {
    const snesRef = useRef<SNES | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [romLoaded, setRomLoaded] = useState(false);
    const [screenBuffer, setScreenBuffer] = useState<Uint8ClampedArray | null>(null);
    const [fps, setFps] = useState(60);
    const [romInfo, setRomInfo] = useState<{ name: string; type: string } | null>(null);
    const [cpuRegisters, setCpuRegisters] = useState<CPU65816Registers | null>(null);
    const [cpuFlags, setCpuFlags] = useState<CPU65816Flags | null>(null);

    const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });

    useEffect(() => {
        console.log('🎮 Initializing SNES emulator...');

        // Initialize SNES emulator
        const snes = new SNES();
        snes.init();

        // Set frame callback
        snes.setFrameCallback((buffer) => {
            // Update screen buffer (create new array to trigger React update)
            setScreenBuffer(new Uint8ClampedArray(buffer));

            // Update FPS counter
            const counter = fpsCounterRef.current;
            counter.frames++;
            const now = performance.now();
            const elapsed = now - counter.lastTime;

            if (elapsed >= 1000) {
                setFps(Math.round(counter.frames / (elapsed / 1000)));
                counter.frames = 0;
                counter.lastTime = now;
            }

            // Update CPU state for debug panel
            setCpuRegisters(snes.getCPU().getRegisters());
            setCpuFlags(snes.getCPU().getFlags());
        });

        snesRef.current = snes;

        return () => {
            console.log('🛑 Cleaning up SNES emulator...');
            snes.stop();
        };
    }, []);

    const handleLoadROM = async (file: File) => {
        const snes = snesRef.current;
        if (!snes) return;

        try {
            console.log(`📦 Loading ROM: ${file.name}`);

            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);

            // Parse ROM info
            const info = ROMParser.parse(data);
            console.log('📋 ROM Info:', info);

            setRomInfo({
                name: info.name || file.name,
                type: info.type
            });

            // Load ROM into emulator
            snes.loadROM(data);
            setRomLoaded(true);

            console.log('✅ ROM loaded successfully');
            console.log('💡 Click Play to start emulation');

        } catch (error) {
            console.error('❌ Failed to load ROM:', error);
            alert('Failed to load ROM file. Please check the console for details.');
        }
    };

    const handleStart = () => {
        const snes = snesRef.current;
        if (!snes || !romLoaded) return;

        if (isRunning) {
            console.log('⏸️  Pausing emulation...');
            snes.pause();
            setIsRunning(false);
        } else {
            console.log('▶️  Starting emulation...');
            snes.resume();
            setIsRunning(true);
        }
    };

    const handlePause = () => {
        const snes = snesRef.current;
        if (!snes) return;

        console.log('⏸️  Pausing emulation...');
        snes.pause();
        setIsRunning(false);
    };

    const handleReset = () => {
        const snes = snesRef.current;
        if (!snes || !romLoaded) return;

        console.log('🔄 Resetting emulator...');
        snes.reset();

        // If it was running, restart it
        if (isRunning) {
            snes.resume();
        }
    };

    return (
        <div className="emulator-container">
            <header className="emulator-header">
                <h1>🎮 SNES Emulator</h1>
                <p className="subtitle">Super Nintendo Entertainment System Emulator</p>
            </header>

            <div className="emulator-main">
                <div className="screen-container">
                    <Screen
                        width={256}
                        height={224}
                        buffer={screenBuffer}
                        scale={2}
                    />

                    {!romLoaded && (
                        <div className="screen-overlay">
                            <div className="welcome-message">
                                <h2>👋 Welcome!</h2>
                                <p>Load a SNES ROM file (.sfc or .smc) to begin</p>
                                <p className="note">
                                    ⚠️ Only use ROM files you legally own
                                </p>
                            </div>
                        </div>
                    )}

                    {romLoaded && !isRunning && (
                        <div className="screen-overlay">
                            <div className="paused-message">
                                <h2>⏸️ Paused</h2>
                                <p>Click Play to start</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="sidebar">
                    <Controls
                        onLoadROM={handleLoadROM}
                        onStart={handleStart}
                        onPause={handlePause}
                        onReset={handleReset}
                        isRunning={isRunning}
                        romLoaded={romLoaded}
                    />

                    <DebugPanel
                        registers={cpuRegisters}
                        flags={cpuFlags}
                        fps={fps}
                        romInfo={romInfo}
                    />
                </div>
            </div>

            <div className="info-panel">
                <h3>ℹ️ Emulator Status</h3>
                <div className="status-grid">
                    <div className="status-item">
                        <span className="status-label">ROM:</span>
                        <span className={romLoaded ? 'status-ok' : 'status-warn'}>
                            {romLoaded ? '✓ Loaded' : '✗ Not Loaded'}
                        </span>
                    </div>
                    <div className="status-item">
                        <span className="status-label">Status:</span>
                        <span className={isRunning ? 'status-ok' : 'status-warn'}>
                            {isRunning ? '▶️ Running' : '⏸️ Paused'}
                        </span>
                    </div>
                    <div className="status-item">
                        <span className="status-label">FPS:</span>
                        <span className={fps > 55 ? 'status-ok' : 'status-warn'}>
                            {fps.toFixed(1)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="tips-panel">
                <h3>💡 Tips</h3>
                <ul>
                    <li>📺 Black screen is normal - the SNES starts with the screen blanked</li>
                    <li>🎨 The game will turn on the display when it's ready</li>
                    <li>🐛 Check the browser console (F12) for detailed logs</li>
                    <li>⚡ Low FPS? The CPU is still incomplete, some games won't run well yet</li>
                </ul>
            </div>
        </div>
    );
}