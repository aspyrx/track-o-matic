#!/usr/bin/env node

'use strict';

/**
 * Server entrypoint.
 *
 * @module track-o-matic
 */

if (module !== require.main) {
    return;
}

// const fs = require('fs');
const path = require('path');
const express = require('express');

// const BusTimeClient = require('./BusTime/Client');
const SplitFlap = require('./SplitFlap');
const Stepper = require('./Stepper');
const MockStepper = require('./MockStepper');

/**
 * Prints command-line usage.
 *
 * @private
 * @param {string[]} argv - Command-line arguments.
 */
function usage(argv) {
    const script = path.relative('.', argv[1]);
    console.log(`Usage: ${script} <port>`);
}

/**
 * Sets up the split flap displays.
 *
 * @private
 * @returns {module:SplitFlap[]} The split flap array.
 */
function setupSplitFlaps() {
    const totalFlaps = 32;
    const period = 7.0;

    const routes = ['69', '67', '61D', '61C', '61B', '61A'];
    const times = new Array(16);
    for (let i = 0; i < times.length; i++) {
        times[i] = (times.length - 1 - i).toString();
    }

    const steppers = new Array(4);
    steppers[0] = new Stepper(2048, [2, 3, 4, 14]);
    for (let i = 1; i < 4; i++) {
        steppers[i] = new Stepper(2048, new MockStepper(2048));
    }

    process.on('exit', function closeSteppers() {
        steppers.forEach(stepper => {
            stepper.close();
        });
    });

    const splitFlaps = [
        new SplitFlap(steppers[0], routes, totalFlaps, period),
        new SplitFlap(steppers[1], times, totalFlaps, period),
        new SplitFlap(steppers[2], routes, totalFlaps, period),
        new SplitFlap(steppers[3], times, totalFlaps, period)
    ];

    return splitFlaps;
}

/**
 * Command-line interface.
 *
 * @private
 * @param {string[]} argv - Command-line arguments.
 * @returns {Promise} Resolves with the split flap array, or rejects with an
 * error.
 */
async function cli(argv) {
    if (argv.length < 3) {
        usage(argv);
        throw new Error(`Invalid commandline: ${argv}`);
    }

    const port = argv[2];

    // TODO
    /*
    const cfgFile = argv[2];
    const cfg = JSON.parse(fs.readFileSync(cfgFile));
    const busTime = new BusTimeClient(cfg);
    void busTime;
    */

    const splitFlaps = setupSplitFlaps();

    const app = express();
    app.use(express.static(path.resolve(__dirname, '../www/')));
    app.use('/doc/', express.static(path.resolve(__dirname, '../doc/')));

    app.get('/status', function status(req, res) {
        res.writeHead(200, {
            'Content-Type': 'text/plain'
        });

        const listeners = new Array(splitFlaps.length);

        /**
         * Cleans up the connection, removing step listeners and ending the
         * response.
         */
        function cleanup() {
            res.end();
            splitFlaps.forEach((splitFlap, i) => {
                splitFlap.stepper.removeListener('step', listeners[i]);
            });
        }

        res.on('error', cleanup);
        res.on('close', cleanup);
        splitFlaps.forEach((splitFlap, i) => {
            const { stepper } = splitFlap;

            /**
             * Callback for step event.
             *
             * @param {number} step - The latest step.
             */
            function onStep(step) {
                res.write(`${i} ${step}\0`, 'utf-8');
            }

            listeners[i] = onStep;
            stepper.on('step', onStep);
            onStep(stepper.currentStep);
        });
    });

    app.listen(port, '0.0.0.0');

    return splitFlaps;
}

/**
 * Command-line interface for controlling the split flaps.
 *
 * @private
 * @param {module:SplitFlap[]} splitFlaps - The split flaps to control.
 * @param {ReadableStream} [stdin=process.stdin] - Standard input.
 * @param {WritableStream} [stdout=process.stdout] - Standard output.
 * @param {WritableStream} [stderr=process.stderr] - Standard error.
 */
function splitFlapCLI(
    splitFlaps,
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr
) {
    stdin.setEncoding('utf-8');
    stdout.setEncoding('utf-8');
    stderr.setEncoding('utf-8');

    stdout.write('> ');

    /**
     * Parses the input line into a command.
     *
     * @private
     * @param {string} line - The line.
     * @returns {Object?} The parsed command, or `null` if parsing failed.
     */
    function parseLine(line) {
        if (line.match(/^(quit|exit)\n$/)) {
            process.exit(0);    // eslint-disable-line no-process-exit
        }

        const matches = line.match(/^(.+?) (.+?)\n$/);
        if (!matches) {
            return null;
        }

        const i = Number.parseInt(matches[1], 10);
        if (Number.isNaN(i) || i < 0 || splitFlaps.length <= i) {
            return null;
        }

        const flap = matches[2];
        if (!flap) {
            return null;
        }

        return { i, flap };
    }

    stdin.on('data', async function(line) {
        stdin.pause();

        try {
            const cmd = parseLine(line);
            if (!cmd) {
                stdout.write(
                    `Expected index (0-${splitFlaps.length - 1}), `
                    + 'steps, and duration\n> '
                );
                return;
            }

            const { i, flap } = cmd;

            stdout.write(`${i}: flap "${flap}"`);
            const splitFlap = splitFlaps[i];
            await splitFlap.setFlap(flap);
            stdout.write(`-> "${splitFlap.flap}"\n> `);
        } catch (err) {
            stderr.write(
                `'${line.trim()}' failed:\n`
                + `${err.message}\n${err.stack}\n> `
            );
        } finally {
            stdin.resume();
        }
    });
}

cli(process.argv).then(splitFlapCLI).catch(err => {
    console.error(err);
    process.exit(-1);   // eslint-disable-line no-process-exit
});

