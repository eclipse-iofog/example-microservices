var ioFogClient = require('@iofog/nodejs-sdk');

var currentConfig;

ioFogClient.init('iofog', 54321, null,
    function jsonSubselectMain() {
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
    if (currentConfig && currentConfig.selections) {
        var selections = currentConfig.selections;
        for(var index = 0; index < selections.length; index++) {
            var subSelectionConfig = selections[index];
            if(oldMsg.infotype === subSelectionConfig.inputtype && oldMsg.infoformat === subSelectionConfig.inputformat) {
                newMsg = ioFogClient.ioMessage();
                newMsg.contentdata = buildJson(oldMsg.contentdata, subSelectionConfig);
                newMsg.infotype = subSelectionConfig.outputtype;
                newMsg.infoformat = subSelectionConfig.outputformat;
            }
        }
    }
    return newMsg;
}

function buildJson(contentdata, subSelectionConfig) {
    var new_json = {};
    try {
        var contentdataJson = JSON.parse(contentdata.toString());
        if (subSelectionConfig.outputs) {
            var outputs = subSelectionConfig.outputs;
            for(var i=0; i < outputs.length; i++) {
                var outputConfig = outputs[i];
                var subselection, subselections, value = null;
                if (outputConfig.subselection) {
                    subselection = outputConfig.subselection;
                    subselections = subselection.split('.');
                }
                if (subselection in contentdataJson) {
                    value = contentdataJson[subselection];
                } else if (subselections.length > 1) {
                    var sub_json = contentdataJson;
                    for (var index=0; index < subselections.length; index++) {
                        if (subselections[index] in sub_json) {
                            sub_json = sub_json[subselections[index]];
                            continue;
                        }
                    }
                    if(JSON.stringify(sub_json) != JSON.stringify(contentdataJson)) {
                        value = sub_json;
                    }
                }
                if (outputConfig.fieldname) {
                    new_json[outputConfig.fieldname] = getOutputValue(value, outputConfig);
                } else {
                    new_json[subselection] = getOutputValue(value, outputConfig);
                }
            }
        }
    } catch (error) {
        console.error('Error building new json message:', error);
    }
    return JSON.stringify(new_json);
}

function getOutputValue(value, config){
    var output_value;
    if (config.outputjsonarray) {
        if (value) {
            if (value instanceof Array) {
                output_value = value;
            } else {
                output_value = [value];
            }
        } else {
            output_value = [];
        }
    } else {
        output_value = value;
    }
    return output_value;
}