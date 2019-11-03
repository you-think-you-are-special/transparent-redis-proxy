const net = require('net')
const { EventEmitter } = require('events')

class TcpServer extends EventEmitter {
  #connection
  #listenConfig
  #maxConnections
  #noDelay
  #keepAlive
  #keepAliveInitialDelay

  constructor ({ listen, maxConnections, noDelay = true, keepAlive = false, keepAliveInitialDelay = 0 }) {
    super()
    this.#listenConfig = listen
    this.#maxConnections = maxConnections
    this.#noDelay = noDelay
    this.#keepAlive = keepAlive
    this.#keepAliveInitialDelay = keepAliveInitialDelay
  }

  async close () {
    console.info('closing tcp server')
    return new Promise(resolve => this.#connection.close(resolve))
  }

  async listen () {
    return new Promise(resolve => {
      this.#connection = net
        .createServer(client => {
          console.info('client connected', client.address())
          client.setNoDelay(this.#noDelay)
          client.setKeepAlive(this.#keepAlive, this.#keepAliveInitialDelay)
          this.emit('client', client)
          client.once('close', () => console.info('client disconnected'))
        })

      this.#connection.maxConnections = this.#maxConnections

      this.#connection.on('error', console.error)

      this.#connection.listen(this.#listenConfig, () => {
        console.log('tcp server is listening for incoming connections', this.#listenConfig)
        console.info(`server maxConnections: ${this.#maxConnections}`)
        resolve()
      })
    })
  }
}

module.exports.TcpServer = TcpServer
