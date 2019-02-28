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

var frequency = 1000;
var messageNumber = 0;
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
      function (ioFogClient) { /* don't need to do anything on opened Message Socket */
      },
      {
        'onMessages':
          function onMessagesSocket(messages) { /* don't need to do anything on opened Message Socket */
          },
        'onMessageReceipt':
          function (messageId, timestamp) { /*console.log('message Receipt');*/
          },
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
            if (config) {
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
      var contentData = buildContentData();
      var ioMessage = ioFogClient.ioMessage(
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
          'infotype': 'infotype/gen',
          'infoformat': 'text/json',
          'contextdata': Buffer(0),
          'contentdata': Buffer(JSON.stringify(contentData))
        }
      );

      ioFogClient.wsSendMessage(ioMessage);

      const messageLogMultiplicity = currentConfig.messageLogMultiplicity || 10;
      if (messageNumber % messageLogMultiplicity === 0) {
        console.log(contentData.name + ' sent ' + contentData.messageNumber + ' messages.')
      }
    }, frequency);
}

function buildContentData() {
  const msName = currentConfig.name || 'unknown microservice';
  return {
    name: msName,
    messageNumber: ++messageNumber
  };
}