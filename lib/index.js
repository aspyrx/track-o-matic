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

const fs = require('fs');
const path = require('path');
const express = require('express');

const BusTimeClient = require('./BusTime/Client');
const SplitFlap = require('./SplitFlap');
const Stepper = require('./Stepper');

/**
 * Prints command-line usage.
 *
 * @private
 * @param {string[]} argv - Command-line arguments.
 */
function usage(argv) {
    const script = path.relative('.', argv[1]);
    console.log(`Usage: ${script} <cfgFile> <port> [initFlaps...]`);
}

/**
 * Sets up the steppers.
 *
 * @private
 * @returns {module:Stepper[]} The stepper array.
 */
function setupSteppers() {
    const steppers = new Array(4);
    steppers[0] = new Stepper(2038, [2, 3, 4, 14]);
    steppers[1] = new Stepper(2048, [26, 21, 20, 16]);
    steppers[2] = new Stepper(2042, [15, 17, 18, 27]);
    steppers[3] = new Stepper(2048, [19, 13, 12, 6]);

    process.on('exit', function closeSteppers() {
        steppers.forEach(stepper => {
            stepper.close();
        });
    });

    return steppers;
}

/**
 * Sets up the split flap displays.
 *
 * @private
 * @param {string[]} [initFlaps] - The initial flaps, if any.
 * @returns {module:SplitFlap[]} The split flap array.
 */
function setupSplitFlaps(initFlaps) {
    const totalFlaps = 32;
    const period = 5.0;

    const routes = ['93', '64', '61D', '61C', '61B', '61A', '_'];
    const times = new Array(17);
    times[16] = '_';
    for (let i = 0; i < 16; i++) {
        times[i] = (15 - i).toString();
    }

    const steppers = setupSteppers();

    const splitFlaps = [
        new SplitFlap(steppers[0], times, totalFlaps, period),
        new SplitFlap(steppers[1], routes, totalFlaps, period),
        new SplitFlap(steppers[2], times, totalFlaps, period),
        new SplitFlap(steppers[3], routes, totalFlaps, period)
    ];

    if (initFlaps) {
        splitFlaps.forEach((splitFlap, i) => {
            if (i in initFlaps) {
                splitFlap.setFlap(initFlaps[i], true);
            }
        });
    }

    return splitFlaps;
}

/**
 * Sets up the BusTime client.
 *
 * @param {Object} cfg - BusTime configuration.
 * @param {module:SplitFlap[]} splitFlaps - The split-flap displays.
 * @returns {Timeout} Interval timeout for bus time updater.
 */
function setupBusTime(cfg, splitFlaps) {
    const { stpid, interval } = cfg;
    const bustime = new BusTimeClient(cfg);

    const rows = [{
        time: splitFlaps[0],
        route: splitFlaps[1]
    }, {
        time: splitFlaps[2],
        route: splitFlaps[3]
    }];

    /**
     * Updates the bus times, setting the flaps as appropriate.
     *
     * @returns {Promise} Resolves when the flaps have been updated.
     */
    async function updateBusTimes() {
        try {
            const prds = await bustime.getStopPredictions(stpid, 2);

            await Promise.all(rows.map((row, i) => {
                const { time, route } = rows[i];
                const prd = prds[i];

                let tm;
                let rt;
                if (prd) {
                    tm = Math.min(prd.prdctdn, 15).toString();
                    rt = prd.rt;
                } else {
                    // Blank if not present
                    tm = '_';
                    rt = '_';
                }

                return Promise.all([
                    time.setFlap(tm),
                    route.setFlap(rt)
                ]);
            }));
        } catch (err) {
            console.error('Bus time update failed', err);

            // Blank on error
            splitFlaps.forEach(splitFlap => {
                splitFlap.setFlap('_');
            });
        }

        return void null;
    }

    let queue = updateBusTimes();

    return setInterval(() => {
        queue = queue.then(updateBusTimes);
    }, interval);
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
    if (argv.length < 4) {
        usage(argv);
        throw new Error(`Invalid commandline: ${argv}`);
    }
    const cfgFile = argv[2];
    const port = argv[3];
    const initFlaps = argv.slice(4);

    const splitFlaps = setupSplitFlaps(initFlaps);

    const cfg = JSON.parse(fs.readFileSync(cfgFile));
    setupBusTime(cfg, splitFlaps);

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

            stdout.write(`${i}: flap "${flap}" `);
            const splitFlap = splitFlaps[i];
            await splitFlap.setFlap(flap);

            const {
                currentFlap, stepper: { currentStep }
            } = splitFlap;
            stdout.write(`-> "${currentFlap}", ${currentStep}\n> `);
        } catch (err) {
            stderr.write(
                `\n'${line.trim()}' failed:\n`
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

