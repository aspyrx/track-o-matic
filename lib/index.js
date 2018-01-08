#!/usr/bin/env node

'use strict';

/**
 * Server entrypoint.
 *
 * @module track-o-matic
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

const BusTimeClient = require('./BusTime/Client');
const Stepper = require('./Stepper');
const MockStepper = require('./MockStepper');

/**
 * Prints command-line usage.
 *
 * @param {string[]} argv - Command-line arguments.
 */
function usage(argv) {
    const script = path.relative('.', argv[1]);
    console.log(`Usage: ${script} <config file> <port>`);
}

/**
 * Sets up the steppers.
 *
 * @returns {Object} The stepper and motor arrays.
 */
function setupSteppers() {
    const motors = new Array(4);
    const steppers = new Array(4);
    for (let i = 0; i < 4; i++) {
        motors[i] = new MockStepper(2048);
        steppers[i] = new Stepper(2048, motors[i]);
    }

    return { motors, steppers };
}

/**
 * Command-line interface.
 *
 * @param {string[]} argv - Command-line arguments.
 * @returns {Promise} Resolves with the stepper and motor arrays, or rejects
 * with an error.
 */
async function cli(argv) {
    if (argv.length < 4) {
        usage(argv);
        throw new Error(`Invalid commandline: ${argv}`);
    }

    const cfgFile = argv[2];
    const port = argv[3];

    const cfg = JSON.parse(fs.readFileSync(cfgFile));
    const busTime = new BusTimeClient(cfg);
    void busTime;   // TODO

    const { motors, steppers } = setupSteppers();

    const app = express();
    app.use(express.static(path.resolve(__dirname, '../www/')));
    app.get('/status', function status(req, res) {
        const { remoteAddress, remotePort } = req.socket;
        console.log(`connected ${remoteAddress}:${remotePort}`);

        res.writeHead(200, {
            'Content-Type': 'text/plain'
        });

        const listeners = new Array(steppers.length);

        /**
         * Cleans up the connection, removing step listeners and ending the
         * response.
         */
        function cleanup() {
            res.end();
            steppers.forEach((stepper, i) => {
                stepper.removeListener('step', listeners[i]);
            });
            console.log(`disconnected ${remoteAddress}:${remotePort}`);
        }

        res.on('error', cleanup);
        res.on('close', cleanup);
        steppers.forEach((stepper, i) => {
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

    return { motors, steppers };
}

if (module !== require.main) {
    return;
}

cli(process.argv).then(async function({ motors, steppers }) {
    const cmds = [
        { i: 0, s: 400, t: 2 },
        { i: 2, s: -100, t: 0.5 },
        { i: 1, s: 350, t: 2 },
        { i: 0, s: -150, t: 0.5 },
        { i: 3, s: 2048, t: 5 }
    ];

    // eslint-disable-next-line no-constant-condition
    for (let idx = 0; true; idx = (idx + 1) % cmds.length) {
        let { i, s, t } = cmds[idx];
        const stepper = steppers[i];

        console.log(`${i}: step: ${s}, duration ${t}`);
        await stepper.step(s, t);

        const mStep = motors[i].currentStep;
        const sStep = stepper.currentStep;
        console.log(`\t${i}: ${mStep} ${sStep}\n`);
    }
}).catch(err => {
    console.error(err);
    process.exit(-1);   // eslint-disable-line no-process-exit
});

