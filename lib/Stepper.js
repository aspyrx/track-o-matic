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
const EventEmitter = require('events');

const { GPIO } = require('./GPIO');

/**
 * The number of nanoseconds in a second.
 *
 * @private
 * @readonly
 * @type {number}
 */
const NS_PER_S = 1e9;

/**
 * The number of nanoseconds in a millisecond.
 *
 * @private
 * @readonly
 * @type {number}
 */
const NS_PER_MS = 1e6;

/**
 * The number of milliseconds between each `step` event.
 *
 * @private
 * @readonly
 * @type {number}
 */
const MS_PER_STEP_EVT = 10;

const setTimeoutPromise = promisify(setTimeout);
const setImmediatePromise = promisify(setImmediate);

/**
 * Sets a timeout in nanoseconds.
 *
 * @private
 * @param {number} ns - The interval, in nanoseconds.
 * @param {*} [val] - The value to resolve with.
 */
async function setTimeoutNS(ns, val) {
    if (ns > NS_PER_MS) {
        // Wait milliseconds.
        await setTimeoutPromise(ns / NS_PER_MS, val);
        ns %= NS_PER_MS;
    }

    // Wait nanoseconds (approximate).
    for (
        let t = process.hrtime();
        ns > 1e4;
        await setImmediatePromise()
    ) {
        const [s, n] = process.hrtime(t);
        const diff = s * NS_PER_S + n;
        ns -= diff;
    }
}

/**
 * Steps in the given direction with the specified modulus.
 *
 * @private
 * @param {number} x - The number to add to.
 * @param {number} direction - The direction to step.
 * @param {number} mod - The modulus.
 * @returns {number} The new value, modulo `mod`.
 */
function stepMod(x, direction, mod) {
    if (direction > 0) {
        x++;
        return x > mod ? 0 : x;
    }

    if (direction < 0) {
        return (x === 0 ? mod : x) - 1;
    }

    return x;
}

/**
 * Number of pins.
 *
 * @private
 * @readonly
 * @type {number}
 */
const NUM_PINS = 4;

/**
 * Pin values, indexed by step.
 *
 * @private
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
class Stepper extends EventEmitter {
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
        super();

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
     * @readonly
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
     * @emits module:Stepper#step
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
                let numSteps = 0, tStep = Date.now();
                numSteps < total;
                await setTimeoutNS(dt)
            ) {
                numSteps++;
                this._currentStep = stepMod(
                    this._currentStep,
                    direction,
                    this.totalSteps
                );

                this.stepMotor();

                // Check if it's time to emit an event yet.
                if (Date.now() - tStep > MS_PER_STEP_EVT) {
                    this.emit('step', this._currentStep);
                    tStep = Date.now();
                }

            }

            // Emit the final event.
            this.emit('step', this._currentStep);
        }.bind(this)());

        return command;
    }
}

/**
 * Step position change event.
 *
 * @event module:Stepper#step
 * @type {number}
 */

Object.freeze(Stepper);
module.exports = Stepper;

