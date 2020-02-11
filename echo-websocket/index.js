const ioFogClient = require('@iofog/nodejs-sdk')
const WebSocketServer = require('ws').Server

let port, wss
ioFogClient.init('iofog', 54321, null, main)

async function fetchConfig() {
  const configRequest = () => new Promise((resolve, reject) => {
    ioFogClient.getConfig({
      'onBadRequest': reject,
      'onError': reject,
      'onNewConfig': resolve
    })
  })

  try {
    const config = await configRequest()
    newPort = config.port || 8080
    if (newPort !== port) {
      if (wss) {
        wss.clients.forEach(ws => ws.close())
      }

      port = newPort
      wss = new WebSocketServer({ port })

      console.log(`listening on port: ${port}`)

      wss.on('connection', (ws) => {
        console.log('new client connected!')
        ws.send('connected!')
        ws.on('message', (message) => {
          console.log(message)
          ws.send('echo: ' + message)
        })
      })

      wss.on('close', () => {
        console.log('disconnected');
      })
    }
  } catch (e) {
    console.error(e)
    process.exit(1)
  }

}

async function main() {
  await fetchConfig()

  ioFogClient.wsControlConnection({
    'onNewConfigSignal': async () => {
      await fetchConfig()
    },
    'onError': (error) => {
      console.error('There was an error with Control WebSocket connection to ioFog: ', error)
      process.exit(1)
    }
  })
}
