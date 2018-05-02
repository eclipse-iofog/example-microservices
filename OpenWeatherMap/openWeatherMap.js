var request = require('request');
var ioFogClient = require('@iotracks/container-sdk-nodejs');

var frequency = 1000;
var timeout = 10000;
var httpRequestsLimit = 3;
var openHttpRequestsCounter = 0;
var currentConfig;
var openWeatherIntervalFunction;

ioFogClient.init('iofog', 54321, null,
    function openWeatherMapMain(){
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
                        console.error('There was an error with WebSocket connection to ioFog: ', error);
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
                function onNewConfig(config) {
                    try {
                        if(config) {
                            if (JSON.stringify(config) !== JSON.stringify(currentConfig)) {
                                currentConfig = config;
                                clearInterval(openWeatherIntervalFunction);
                                if (config.frequency && config.frequency > 1000) {
                                    frequency = config.frequency;
                                }
                                getOWMdata();
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

function getOWMdata() {
    openWeatherIntervalFunction = setInterval(
        function getAndPostMessage() {
            if (currentConfig && currentConfig.citycode && currentConfig.apikey) {
                var url = 'http://api.openweathermap.org/data/2.5/weather?id=' + currentConfig.citycode + '&APPID=' + currentConfig.apikey;
                if (openHttpRequestsCounter <= httpRequestsLimit) {
                    openHttpRequestsCounter++;
                    request(
                        {
                            uri: url,
                            method: 'GET',
                            timeout: timeout
                        },
                        function handleOWMResponse(error, response, body) {
                            openHttpRequestsCounter--;
                            if (!error && response.statusCode === 200) {
                                var weatherResponse = body;

                                var ioMsg = ioFogClient.ioMessage(
                                    {
                                        'tag': '',
                                        'groupid': '',
                                        'sequencenumber': 1,
                                        'sequencetotal': 1,
                                        'priority': 0,
                                        'authid': '',
                                        'authgroup': '',
                                        'chainposition': 0,
                                        'hash': '',
                                        'previoushash': '',
                                        'nonce': '',
                                        'difficultytarget': 0,
                                        'infotype': 'weather/mixed/open-weather-map',
                                        'infoformat': 'text/json',
                                        'contextdata': Buffer(0),
                                        'contentdata': Buffer(weatherResponse)
                                    }
                                );

                                ioFogClient.sendNewMessage(
                                    ioMsg,
                                    {
                                        'onBadRequest': function onSendMsgBadRequest(errorMsg) {
                                            console.error('There was an error in request for posting new message to the local API: ', errorMsg);
                                        },
                                        'onMessageReceipt': function onMessageReceipt(messageId, timestamp) {
                                            /*console.log('Message was posted successfully: ID = ' + messageId + ' and time ' + new Date(timestamp));*/
                                        },
                                        'onError': function onSendMsgError(error) {
                                            console.error('There was an error posting OpenWeatherMap new message to local API: ', error);
                                        }
                                    }
                                );
                            } else {
                                if (error) {
                                    console.error('Got an error requesting data from OpenWeatherMap : ', error);
                                }
                                if (response) {
                                    console.error('Response status code from OpenWeatherMap : ', response.statusCode);
                                }
                            }
                        }
                    );
                } else {
                    console.warn('Sorry, the limit of open HTTP requests is exceeded.');
                }
            }
        }, frequency);
}