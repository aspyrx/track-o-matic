'use strict';

/**
 * Library for interfacing with a stepper motor over GPIO.
 *
 * Inspired by the [Arduino "Stepper" library][Arduino].
 *
 * [Arduino]: https://github.com/arduino/Arduino/tree/d31826a/libraries/Stepper
 *
 * @module Stepper
 */

const { promisify } = require('util');

const { GPIO } = require('./GPIO');

/**
 * The number of nanoseconds in a second.
 *
 * @readonly
 * @type {number}
 */
const NS_PER_S = 1e9;

/**
 * The number of nanoseconds in a millisecond.
 *
 * @readonly
 * @type {number}
 */
const NS_PER_MS = 1e6;

const setTimeoutPromise = promisify(setTimeout);
const setImmediatePromise = promisify(setImmediate);

/**
 * Sets a timeout in nanoseconds, or falls back to `setImmediate`.
 *
 * @param {number} ns - The interval, in nanoseconds.
 * @param {*} [val] - The value to resolve with.
 */
async function setTimeoutNS(ns, val) {
    await (ns < NS_PER_MS
        ? setImmediatePromise(val)
        : setTimeoutPromise(ns / NS_PER_MS, val)
    );
}

/**
 * Number of pins.
 *
 * @readonly
 * @type {number}
 */
const NUM_PINS = 4;
/**
 * Pin values, indexed by step.
 *
 * @readonly
 * @type {number[][]}
 */
const STEP_PINS = Object.freeze([
    [1, 0, 1, 0],
    [0, 1, 1, 0],
    [0, 1, 0, 1],
    [1, 0, 0, 1]
].map(Object.freeze));

/**
 * Represents a stepper motor.
 *
 * @alias module:Stepper
 */
class Stepper {
    /**
     * Initializes the motor instance and its associated GPIO pins.
     *
     * @param {number} totalSteps - The number of steps the motor has.
     * @param {number[]|module:MockStepper} pins - The GPIO pins associated with
     * the motor, specified such that their corresponding motor coils are
     * consecutive around the motor's shaft (e.g., left, bottom, right, top). If
     * a [`MockStepper`]{@link module:MockStepper} is specified, it is used
     * instead.
     */
    constructor(totalSteps, pins) {
        if (pins.length !== NUM_PINS) {
            throw new Error(`Expected exactly ${NUM_PINS} pins, got ${pins}`);
        }

        let gpios;
        if (pins instanceof Array) {
            gpios = pins.map(pin => new GPIO(pin, GPIO.DIRECTIONS.LOW));
            Object.freeze(gpios);
        } else {
            // Mock stepper.
            gpios = pins;

            if (totalSteps !== gpios.totalSteps) {
                throw new Error(
                    `Got ${totalSteps} total steps, `
                    + `but mock stepper has ${gpios.totalSteps}`
                );
            }
        }

        Object.defineProperties(this,
            /** @lends module:Stepper.prototype */
            {
                /**
                 * The number of steps the motor has.
                 *
                 * @readonly
                 * @type {number}
                 */
                totalSteps: { value: totalSteps },

                /**
                 * The GPIO instances associated with each motor pin.
                 *
                 * @private
                 * @readonly
                 * @type {module:onoff.Gpio[]}
                 */
                gpios: { value: gpios },

                /**
                 * The latest command to be issued.
                 *
                 * @private
                 * @type {Promise}
                 */
                latestCommand: { value: Promise.resolve(), writable: true },

                /**
                 * Current step number. Ranges from 0 (inclusive) to
                 * `this.totalSteps` (exclusive).
                 *
                 * @private
                 * @type {number}
                 */
                _currentStep: { value: 0, writable: true }
            }
        );
    }

    /**
     * Current step number. Ranges from 0 (inclusive) to `this.totalSteps`
     * (exclusive).
     *
     * @type {number}
     */
    get currentStep() {
        return this._currentStep;
    }

    /**
     * Steps the motor according to the current step value.
     *
     * @private
     */
    stepMotor() {
        const pins = STEP_PINS[this._currentStep % NUM_PINS];
        for (let i = 0; i < NUM_PINS; i++) {
            this.gpios[i].writeSync(pins[i]);
        }
    }

    /**
     * Commands the motor to step the given number of steps.
     *
     * @param {number} steps - The number of steps. A negative value causes the
     * motor to step backwards.
     * @param {number} duration - The amount of time it should take for this
     * command to complete, in seconds.
     * @returns {Promise} Resolves when this command completes.
     */
    step(steps, duration) {
        // Direction to step.
        const direction = Math.sign(steps);

        // Total number of steps to perform.
        const total = Math.abs(steps);

        // Interval between steps, in nanoseconds.
        const dt = duration * NS_PER_S / total;

        const command = (async function queueCommand() {
            await this.latestCommand;
            this.latestCommand = command;

            for (
                let numSteps = 0, t = process.hrtime();
                numSteps < total;
                t = process.hrtime(), await setTimeoutNS(dt)
            ) {
                // Check if it's time yet.
                const [s, ns] = process.hrtime(t);
                const diff = s * NS_PER_S + ns;
                if (diff < dt) {
                    // Not time yet; wait.
                    await setTimeoutNS(diff);
                    continue;
                }

                numSteps++;
                this._currentStep += direction;
                if (this._currentStep >= this.totalSteps) {
                    this._currentStep = 0;
                } else if (this._currentStep < 0) {
                    this._currentStep = this.totalSteps - 1;
                }

                this.stepMotor();
            }
        }.bind(this)());

        return command;
    }
}

Object.freeze(Stepper);
module.exports = Stepper;

