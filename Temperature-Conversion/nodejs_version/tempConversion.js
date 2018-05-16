/*
 * *******************************************************************************
 *   Copyright (c) 2018 Edgeworx, Inc.
 *
 *   This program and the accompanying materials are made available under the
 *   terms of the Eclipse Public License v. 2.0 which is available at
 *   http://www.eclipse.org/legal/epl-2.0
 *
 *   SPDX-License-Identifier: EPL-2.0
 * *******************************************************************************
 */

var ioFogClient = require('@iofog/nodejs-sdk');

var currentConfig;

ioFogClient.init('iofog', 54321, null,
    function tempConversionMain() {
        // first thing first is to get config from ioFog
        fetchConfig();
        ioFogClient.wsControlConnection(
            {
                'onNewConfigSignal':
                    function onNewConfigSignal() {
                        // upon receiving signal about new config available -> go get it
                        fetchConfig();
                    },
                'onError':
                    function onControlSocketError(error) {
                        console.error('There was an error with Control WebSocket connection to ioFog: ', error);
                    }
            }
        );
        ioFogClient.wsMessageConnection(
            function(ioFogClient) { /* don't need to do anything on opened Message Socket */ },
            {
                'onMessages':
                    function onMessagesSocket(messages) {
                        if(messages) {
                            // when getting new messages we store newest and delete oldest corresponding to configured limit
                            for (var i = 0; i < messages.length; i++) {
                                var new_msg = buildMessage(messages[i]);
                                if(new_msg) {
                                    ioFogClient.wsSendMessage(new_msg);
                                } else {
                                    console.info('Message didn\'t pass transformation. Nothing to send.');
                                }
                            }
                        }
                    },
                'onMessageReceipt':
                    function(messageId, timestamp) { /*console.log('message Receipt');*/ },
                'onError':
                    function onMessageSocketError(error) {
                        console.error('There was an error with Message WebSocket connection to ioFog: ', error);
                    }
            }
        );
    }
);

function fetchConfig() {
    ioFogClient.getConfig(
        {
            'onBadRequest':
                function onConfigBadRequest(errorMsg) {
                    console.error('There was an error in request for getting config from the local API: ', errorMsg);
                },
            'onNewConfig':
                function onConfig(config) {
                    try {
                        if(config) {
                            if (JSON.stringify(config) !== JSON.stringify(currentConfig)) {
                                currentConfig = config;
                            }
                        }
                    } catch (error) {
                        console.error('Couldn\'t stringify Config JSON: ', error);
                    }
                },
            'onError':
                function onConfigError(error) {
                    console.error('There was an error getting config from the local API: ', error);
                }
        }
    );
}

function buildMessage(oldMsg) {
    var newMsg = null;
    if ((oldMsg.infoformat == "decimal/kelvin" || oldMsg.infoformat == "decimal/celsius" ||
        oldMsg.infoformat == "decimal/fahrenheit") && oldMsg.infotype == "temperature") {
        var format = oldMsg.infoformat.split("/")[1];
        if (currentConfig && currentConfig.outputformat && format != currentConfig.outputformat){
            newMsg = ioFogClient.ioMessage();
            newMsg.contentdata = convert(oldMsg.infoformat, currentConfig.outputformat, oldMsg.contentdata);
            newMsg.infoformat = "decimal/" + currentConfig.outputformat;
        }
    }
    return newMsg;
}

function convert(currentFormat, outputFormat, data) {
    try {
        var json = JSON.parse(data.toString());
        var value = json[Object.keys(json)[0]];
        if (currentFormat == 'decimal/kelvin' && outputFormat == 'fahrenheit') {
            value = (value * (9 / 5)) - 459.67;
        } else if (currentFormat == 'decimal/kelvin' && outputFormat == 'celsius' ) {
            value = value - 273.15;
        } else if (currentFormat == 'decimal/fahrenheit' && outputFormat == 'kelvin' ) {
            value = (value + 459.67) * (5 / 9);
        } else if (currentFormat == 'decimal/fahrenheit' && outputFormat == 'celsius') {
            value = (value - 32) * (5 / 9);
        } else if (currentFormat == 'decimal/celsius' && outputFormat == 'kelvin') {
            value = value + 273.15;
        } else if (currentFormat == 'decimal/celsius' && outputFormat == 'fahrenheit') {
            value = (value * (9 / 5)) + 32;
        } else {
            value = 0;
        }
        var buf = Buffer(32);
        buf.writeDoubleBE(value, 0);
        return buf;
    } catch (error) {
        console.error('Error converting temperature: ', error);
        return 'FAILED_TEMPERATURE_CONVERSION';
    }
}