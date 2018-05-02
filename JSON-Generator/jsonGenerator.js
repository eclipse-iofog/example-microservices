var ioFogClient = require('@iotracks/container-sdk-nodejs');

var frequency = 1000;
var currentConfig;
var sendIntervalFunction;

ioFogClient.init('iofog', 54321, null,
    function jsonGeneratorMain() {
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
                    function onMessagesSocket(messages) { /* don't need to do anything on opened Message Socket */ },
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
                                clearInterval(sendIntervalFunction);
                                if (config.frequency && config.frequency > 1000) {
                                    frequency = config.frequency;
                                }
                                sendGeneratedMessage();
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

function sendGeneratedMessage() {
    sendIntervalFunction = setInterval(
        function sendMessage() {
            var jsonContentData = buildComplexJSON();
            var ioMessage = ioFogClient.ioMessage({
                'tag': generateString('tag'),
                'groupid': generateString('groupid'),
                'sequencenumber': generateNumber(),
                'sequencetotal': generateNumber(),
                'priority': generateNumber(),
                'authid': generateString('authid'),
                'authgroup': generateString('authgroup'),
                'chainposition': generateNumber(),
                'hash': generateString('hash'),
                'previoushash': generateString('previoushash'),
                'nonce': generateString('nonce'),
                'difficultytarget': generateNumber(),
                'infotype': 'infotype/gen',
                'infoformat': 'infoformat/gen',
                'contextdata': generateString('contextdata', 30),
                'contentdata' : jsonContentData
            });
            ioFogClient.wsSendMessage(ioMessage);
        }, frequency);
}

function buildComplexJSON() {
    var new_json = {
        coord : {
            lon : generateFloat(true),
            lat : generateFloat(true)
        },
        weather :[{
                id : generateNumber(),
                main : generateString('main'),
                description : generateString('description')
            }],
        main : {
            temp : generateFloat(),
            pressure : generateNumber(),
            humidity : generateNumber(),
            temp_min : generateFloat(),
            temp_max : generateFloat()
            },
        visibility : generateNumber(),
        wind : {
            speed : generateFloat(),
            deg : generateFloat()
            },
        id : generateNumber(),
        name : generateString('NAME')
    };
    return JSON.stringify(new_json);
}

function generateString(rootString, length) {
    const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    var result = '';
    if(!length) {
        length = 10;
    }
    for (var i = 0; i < length; i++) {
        result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    }
    if (rootString) {
        result = rootString + '_' + result;
    }
    return result;
}

function generateNumber() {
    return Math.floor(Math.random() * (10) + 1);
}

function generateFloat(negative) {
    if(negative) {
        return (Math.random() * (100.0000 + 100.000) - 100.000).toFixed(4);
    }
    return (Math.random() * (300.0000)).toFixed(4);
}