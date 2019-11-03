const net = require('net')
const genericPool = require('generic-pool')
const { EventEmitter } = require('events')

class RedisPool extends EventEmitter {
  #genericPool
  #connectionConfig
  #noDelay
  #keepAlive
  #keepAliveInitialDelay

  constructor ({ connection, pool: poolConfig, noDelay = true, keepAlive = false, keepAliveInitialDelay = 0 }) {
    super()

    this.#connectionConfig = connection
    this.#noDelay = noDelay
    this.#keepAlive = keepAlive
    this.#keepAliveInitialDelay = keepAliveInitialDelay

    this.#genericPool = genericPool.createPool(
      {
        create: this.createConnection.bind(this),
        destroy: this.destroyConnection.bind(this),
        validate: this.validateConnection.bind(this)
      },
      poolConfig
    )
  }

  /**
   * @returns {Promise<Socket>}
   */
  async acquire () {
    console.debug('acquire new connection')
    const mayBeConnection = await this.#genericPool.acquire()
    if (mayBeConnection instanceof Error) {
      console.error(mayBeConnection)
    }

    return mayBeConnection
  }

  /**
   * @param {Socket} connection
   * @returns {Promise<*>}
   */
  async release (connection) {
    connection.removeAllListeners('data')
    connection.removeAllListeners('error')
    try {
      await this.#genericPool.release(connection)
    } catch (e) {
      console.error(e)
    }
  }

  /**
   * @private
   */
  createConnection () {
    console.debug('new connection with redis is establishing', this.#connectionConfig)
    return new Promise((resolve, reject) => {
      const conn = net.createConnection(this.#connectionConfig, () => {
        console.info('connection with redis established', this.#connectionConfig)
        conn.removeListener('error', reject)
        resolve(conn)
      })

      conn.setKeepAlive(this.#keepAlive, this.#keepAliveInitialDelay)
      conn.setNoDelay(this.#noDelay)
      conn.once('error', reject)
      conn.on('error', console.error)
    })
  }

  /**
   * @param {Socket} connection
   * @private
   */
  async destroyConnection (connection) {
    console.debug('redis connection destroying')
    connection.end()
    connection.removeAllListeners('data')
  }

  /**
   * @param connection
   * @private
   * @returns {Promise<boolean>}
   */
  async validateConnection (connection) {
    return !connection.destroyed
  }

  /**
   * @returns {Promise<void>}
   */
  async destroy () {
    console.info('destroy connection pool with redis')
    await this.#genericPool.drain()
    await this.#genericPool.clear()
  }
}

module.exports.RedisPool = RedisPool
