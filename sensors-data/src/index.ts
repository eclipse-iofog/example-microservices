import * as fs from 'fs'
import * as parse from 'csv-parse'
import * as path from 'path'

import * as ioFogClient from '@iofog/nodejs-sdk'

let time = 69000
debugger

function read(client): Promise<void> {
  return new Promise((resolve, reject) => {
    const parser = parse({
      delimiter: ','
    })

    parser.on('readable', async () => {
      let data = parser.read()
      while (data) {
        await sleep(1000)

        time = (data[0] * 1000)
        const json = {
          time: Date.now(),
          speed: data[1] * 2.23694,
          acceleration: data[4],
          rpm: data[5],
        }

        const ioMessage = client.ioMessage()
        ioMessage.contentdata = Buffer.from(JSON.stringify(json)).toString('base64')
        ioMessage.infotype = 'application/json'
        ioMessage.infoformat = 'text/utf-8'
        client.sendNewMessage(ioMessage, {
          onMessageReceipt: () => { },
          onBadRequest: (error) => { console.log('Error sending message', error) },
          onError: (error) => { console.log('Error sending message', error) },
        })

        data = parser.read()
      }
    }).on('end', () => resolve())

    fs.createReadStream(path.resolve(__dirname, '../data/trip-data.csv'))
      .pipe(parser)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

ioFogClient.init('iofog', 54321, null, async () => {
  while (true) {
    await read(ioFogClient)
  }
})
