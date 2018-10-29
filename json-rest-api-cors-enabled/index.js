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

const http = require('http')
const ioFogClient = require('@iofog/nodejs-sdk')

const PORT = 80

let lastMessage = {}

ioFogClient.init('iofog', 54321, null, () => {
  ioFogClient.wsControlConnection(
    {
      'onNewConfigSignal': () => { },
      'onError': (error) => {
        console.error('There was an error with Control WebSocket connection to ioFog: ', error)
      },
    }
  )

  ioFogClient.wsMessageConnection(() => { }, {
    'onMessages': (messages) => {
      if (messages && messages.length) {
        lastMessage = messages[0]
      }
    },
    'onMessageReceipt': (messageId, timestamp) => { },
    'onError': (error) => {
      console.error('There was an error with Message WebSocket connection to ioFog: ', error)
    }
  })
})


const server = http.createServer((request, response) => {
  switch (request.method) {
    case 'OPTIONS': {
      response.writeHead(200, {
        'Access-Control-Allow-Credentials' : true,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers':'Accept,Authorization,Cache-Control,Content-Type,DNT,If-Modified-Since,Keep-Alive,Origin,User-Agent,X-Requested-With',
      })
      response.end()
      break
    }
    case 'GET': {
      let data = '{}'
      if (lastMessage && lastMessage.contentdata) {
        const base64 = lastMessage.contentdata
        data = (new Buffer(base64, 'base64')).toString('utf8')
      }
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      })
      response.end(data)
      break
    }
  }
})

server.listen(PORT, () => { })
