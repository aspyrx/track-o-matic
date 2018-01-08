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
                _currentStep: { value: 0, writable: true },

                /**
                 * The motor's pin states.
                 *
                 * Note: the array members are mutable.
                 *
                 * @private
                 * @readonly
                 * @type {number[]}
                 */
                pinStates: { value: [0, 0, 0, 0] }
            }
        );

        this.tick = this.tick.bind(this);

        let tickTimer = null;
        const writeFn = (pin, val) => {
            this.pinStates[pin] = val ? 1 : 0;

            const [a, b, c, d] = this.pinStates;
            if (a === b || c === d) {
                return;
            }

            if (tickTimer) {
                clearImmediate(tickTimer);
            }

            tickTimer = setImmediate(this.tick);
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

    /**
     * Checks if the current pin state caused a step in the given direction.
     *
     * @param {number} delta - The change in steps.
     * @returns {number?} The new position, or `null` if no change occurred.
     */
    check(delta) {
        let nextStep = this._currentStep + delta;
        if (nextStep >= this.totalSteps) {
            nextStep = 0;
        } else if (nextStep < 0) {
            nextStep = this.totalSteps - 1;
        }

        const nextPins = STEP_PINS[nextStep % 4];
        return this.pinStates.every((v, i) => v === nextPins[i])
            ? nextStep
            : null;
    }

    /**
     * Updates the motor position according to the pin state.
     *
     * @emits module:MockStepper#step
     */
    tick() {
        let nextStep = this.check(1);
        if (nextStep === null) {
            nextStep = this.check(-1);
            if (nextStep === null) {
                return;
            }
        }

        this._currentStep = nextStep;
    }
}

module.exports = MockStepper;

