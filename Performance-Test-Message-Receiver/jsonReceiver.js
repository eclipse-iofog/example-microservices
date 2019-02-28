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

var messageLimit = 1;
var msgsBuffer = [];
var currentConfig = {};

ioFogClient.init('iofog', 54321, null,
  function jsonRestApiMain() {
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
                if (msgsBuffer.length > (messageLimit - 1)) {
                  msgsBuffer.splice(0, (msgsBuffer.length - (messageLimit - 1)));
                }
                msgsBuffer.push(messages[i]);
                const messageLogMultiplicity = currentConfig.messageLogMultiplicity || 10;
                const contentData = messages[i].contentdata;
                if (contentData) {
                  const json = JSON.parse(contentData.toString('utf8'));
                  if (json.messageNumber % messageLogMultiplicity === 0) {
                    const name = currentConfig.name || 'Unknown microservice';
                    console.log(name + ' received ' + json.messageNumber + '\'th message from ' + json.name);
                  }
                }
              }
            }
          },
        'onMessageReceipt':
          function(messageId, timestamp) { /* we received the receipt for posted msg */ },
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
                if(currentConfig.buffersize) {
                  messageLimit = currentConfig.buffersize;
                } else {
                  messageLimit = 1;
                }
                if (msgsBuffer.length > messageLimit) {
                  msgsBuffer.splice(0, (msgsBuffer.length - messageLimit));
                }
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