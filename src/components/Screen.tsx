// Screen React Component
// Renders the SNES screen output using Canvas
// FIXED: Properly converts RGB buffer to RGBA for Canvas

import { useEffect, useRef } from 'react';

interface ScreenProps {
    width: number;
    height: number;
    buffer: Uint8ClampedArray | null;
    scale?: number;
}

export function Screen({ width, height, buffer, scale = 2 }: ScreenProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageDataRef = useRef<ImageData | null>(null);

    // Initialize canvas and ImageData
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        ctx.imageSmoothingEnabled = false;

        imageDataRef.current = ctx.createImageData(width, height);
    }, [width, height]);

    // Draw frame
    useEffect(() => {
        if (!buffer || !imageDataRef.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const imageData = imageDataRef.current;
        const dest = imageData.data;

        // PPU provides RGBA buffer (width * height * 4)
        if (buffer.length === width * height * 4) {
            dest.set(buffer);
        }
        // RGB fallback (convert to RGBA)
        else if (buffer.length === width * height * 3) {
            let di = 0;
            for (let si = 0; si < buffer.length; si += 3) {
                dest[di++] = buffer[si];     // R
                dest[di++] = buffer[si + 1]; // G
                dest[di++] = buffer[si + 2]; // B
                dest[di++] = 255;            // A
            }
        }
        // Invalid buffer, clear screen safely
        else {
            console.warn(`Invalid buffer size: ${buffer.length}, expected ${width * height * 4} (RGBA) or ${width * height * 3} (RGB)`);
            dest.fill(0);
        }

        ctx.putImageData(imageData, 0, 0);
    }, [buffer, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                width: `${width * scale}px`,
                height: `${height * scale}px`,
                imageRendering: 'pixelated',
                backgroundColor: 'black',
                border: '2px solid rgba(147, 51, 234, 0.5)',
                borderRadius: '10px',
                boxShadow: '0 0 35px rgba(147, 51, 234, 0.35)'
            }}
        />
    );
}
