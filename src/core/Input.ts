// SNES Input Controller Emulation

export enum SNESButton {
    B = 0x8000,
    Y = 0x4000,
    SELECT = 0x2000,
    START = 0x1000,
    UP = 0x0800,
    DOWN = 0x0400,
    LEFT = 0x0200,
    RIGHT = 0x0100,
    A = 0x0080,
    X = 0x0040,
    L = 0x0020,
    R = 0x0010
}

export class Input {
    private controller1State: number = 0xFFFF; // All buttons released (active low)
    private controller2State: number = 0xFFFF;

    private controller1Latch: number = 0;
    private controller2Latch: number = 0;

    private controller1Index: number = 0;
    private controller2Index: number = 0;

    // Keyboard mapping
    private keyMap: Map<string, SNESButton> = new Map([
        ['ArrowUp', SNESButton.UP],
        ['ArrowDown', SNESButton.DOWN],
        ['ArrowLeft', SNESButton.LEFT],
        ['ArrowRight', SNESButton.RIGHT],
        ['KeyZ', SNESButton.B],
        ['KeyX', SNESButton.A],
        ['KeyA', SNESButton.Y],
        ['KeyS', SNESButton.X],
        ['KeyQ', SNESButton.L],
        ['KeyW', SNESButton.R],
        ['Enter', SNESButton.START],
        ['ShiftRight', SNESButton.SELECT]
    ]);

    constructor() {
        this.setupKeyboardListeners();
    }

    private setupKeyboardListeners(): void {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (event) => {
            const button = this.keyMap.get(event.code);
            if (button !== undefined) {
                event.preventDefault();
                this.pressButton(1, button);
            }
        });

        window.addEventListener('keyup', (event) => {
            const button = this.keyMap.get(event.code);
            if (button !== undefined) {
                event.preventDefault();
                this.releaseButton(1, button);
            }
        });
    }

    pressButton(controller: number, button: SNESButton): void {
        if (controller === 1) {
            this.controller1State &= ~button; // Active low
        } else if (controller === 2) {
            this.controller2State &= ~button;
        }
    }

    releaseButton(controller: number, button: SNESButton): void {
        if (controller === 1) {
            this.controller1State |= button;
        } else if (controller === 2) {
            this.controller2State |= button;
        }
    }

    setButtonState(controller: number, button: SNESButton, pressed: boolean): void {
        if (pressed) {
            this.pressButton(controller, button);
        } else {
            this.releaseButton(controller, button);
        }
    }

    // Called when $4016 is written to
    latchControllers(): void {
        this.controller1Latch = this.controller1State;
        this.controller2Latch = this.controller2State;
        this.controller1Index = 0;
        this.controller2Index = 0;
    }

    // Read controller state (called when reading $4016/$4017)
    readController(controller: number): number {
        if (controller === 1) {
            const bit = (this.controller1Latch >> (15 - this.controller1Index)) & 1;
            this.controller1Index = (this.controller1Index + 1) % 16;
            return bit;
        } else if (controller === 2) {
            const bit = (this.controller2Latch >> (15 - this.controller2Index)) & 1;
            this.controller2Index = (this.controller2Index + 1) % 16;
            return bit;
        }
        return 1;
    }

    getController1State(): number {
        return this.controller1State;
    }

    getController2State(): number {
        return this.controller2State;
    }

    setKeyMapping(key: string, button: SNESButton): void {
        this.keyMap.set(key, button);
    }

    getKeyMapping(): Map<string, SNESButton> {
        return new Map(this.keyMap);
    }
}
