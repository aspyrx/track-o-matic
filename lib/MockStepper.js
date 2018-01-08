'use strict';

/**
 * Simulates a stepper motor.
 *
 * @module MockStepper
 */

const MockGPIO = require('./MockGPIO');

const STEP_PINS = Object.freeze([
    [1, 0, 1, 0],
    [0, 1, 1, 0],
    [0, 1, 0, 1],
    [1, 0, 0, 1]
].map(Object.freeze));

/**
 * Represents a simulated stepper motor.
 *
 * @alias module:MockStepper
 */
class MockStepper {
    /**
     * Initializes the simulated motor.
     *
     * @param {number} totalSteps - The number of steps the motor has.
     */
    constructor(totalSteps) {
        Object.defineProperties(this,
            /** @lends module:MockStepper.prototype */
            {
                /**
                 * The number of steps the motor has.
                 *
                 * @readonly
                 * @type {number}
                 */
                totalSteps: { value: totalSteps },

                /**
                 * The number of pins the motor has.
                 *
                 * @readonly
                 * @type {number}
                 */
                length: { value: 4 },

                /**
                 * The motor's current step.
                 *
                 * @private
                 * @type {number}
                 */
                _currentStep: { value: 0, writable: true }
            }
        );

        const state = [0, 0, 0, 0];

        const tick = () => {
            if (state[0] === state[1] || state[2] === state[3]) {
                return;
            }

            let forward = this._currentStep + 1;
            if (forward >= this.totalSteps) {
                forward = 0;
            }

            const forwardPins = STEP_PINS[forward % 4];
            if (state.every((v, i) => v === forwardPins[i])) {
                this._currentStep = forward;
                return;
            }

            let backward = this._currentStep - 1;
            if (backward < 0) {
                backward = this.totalSteps - 1;
            }

            const backwardPins = STEP_PINS[backward % 4];
            if (state.every((v, i) => v === backwardPins[i])) {
                this._currentStep = backward;
            }
        };

        let tickTimer = null;
        const writeFn = (pin, val) => {
            state[pin] = val ? 1 : 0;

            if (tickTimer) {
                clearImmediate(tickTimer);
            }

            tickTimer = setImmediate(tick);
        };

        for (let i = 0; i < this.length; i++) {
            this[i] = new MockGPIO(i, writeFn);
        }
    }

    /**
     * The motor's current step.
     *
     * @readonly
     * @type {number}
     */
    get currentStep() {
        return this._currentStep;
    }
}

module.exports = MockStepper;

