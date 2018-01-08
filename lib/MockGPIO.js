'use strict';

/**
 * Simulates a GPIO pin.
 *
 * @module MockGPIO
 */

/**
 * Represents a simulated GPIO pin.
 */
class MockGPIO {
    /**
     * Initializes the simulated GPIO pin.
     *
     * @param {number} pin - The pin number.
     * @param {Function} writeFn - The function call on writes.
     */
    constructor(pin, writeFn) {
        Object.defineProperties(this,
            /** @lends module:MockGPIO.prototype */
            {
                /**
                 * The pin number.
                 *
                 * @readonly
                 * @type {number}
                 */
                pin: { value: pin },

                /**
                 * The function to call on writes. Called with the pin number
                 * and the value.
                 *
                 * @readonly
                 * @type {Function}
                 */
                writeFn: { value: writeFn }
            }
        );
    }

    /**
     * Simulates a synchronous write to the pin.
     *
     * @param {boolean} val - The value to write.
     */
    writeSync(val) {
        this.writeFn(this.pin, val);
    }
}

module.exports = MockGPIO;

