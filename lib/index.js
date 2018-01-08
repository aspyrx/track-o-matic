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
 * Command-line interface.
 *
 * @param {string[]} argv - Command-line arguments.
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

    const motor = new MockStepper(2048);
    const stepper = new Stepper(2048, motor);

    for (
        let { s, t } of [
            { s: 200, t: 1 },
            { s: -50, t: 0.5 },
            { s: 75, t: 2 }
        ]
    ) {
        console.log(`step: ${s}, duration ${t}`);
        await stepper.step(s, t);
        console.log(`${motor.currentStep} ${stepper.currentStep}`);
    }

    const app = express();
    app.use(express.static(path.resolve(__dirname, '../www/')));
    app.listen(port, '0.0.0.0');
}

if (module === require.main) {
    cli(process.argv).catch(err => {
        console.error(err);
        process.exit(-1);   // eslint-disable-line no-process-exit
    });
}

