const { Transform } = require('stream')
const Parser = require('redis-parser') // @todo: better parser
const zeroBuffer = Buffer.allocUnsafe(0)

class RedisCacheStream extends Transform {
  #pool
  #connection
  #requestParser
  #responseParser
  #cacheKey = ''
  #buffer = zeroBuffer
  #cmd = ''

  /**
   * @param {RedisPool} pool
   * @param {Cache} cache
   * @param {string} cmd todo: make array and move to config
   */
  constructor ({ pool, cache, cmd = 'get' }) {
    super()

    this.#cmd = Buffer.from(cmd)
    this.#pool = pool
    this.initResponseHandler({ cache })
    this.initRequestHandler({ cache })
  }

  /**
   * @param {Cache} cache
   * @private
   */
  initRequestHandler ({ cache }) {
    const self = this

    this.#requestParser = new Parser({
      returnReply (reply) {
        if (!reply[0].equals(self.#cmd) || reply.length !== 2) { // proxy other commands
          self.writeBufferToRedis(reply)
          return
        }

        const key = reply[1].toString()
        const res = cache.find(key)
        if (res !== undefined) {
          console.info('cache hit')
          console.info('answer to client from cache')
          self.push(res)
          console.info('emit done')
          self.emit('done')
          return
        }

        self.#cacheKey = key
        self.writeBufferToRedis(reply)
      },
      returnError (err) {
        console.error('returnError', err)
      },
      returnFatalError (err) {
        console.error('returnFatalError', err)
      },
      returnBuffers: true,
      stringNumbers: true
    })
  }

  /**
   * @param {Cache} cache
   * @private
   */
  initResponseHandler ({ cache }) {
    const self = this
    this.#responseParser = new Parser({
      returnReply () {
        console.debug('redis answered')
        self.releaseConnection()
          .catch(console.error)

        if (self.#cacheKey.length > 0) {
          console.info(`save key: ${self.#cacheKey} into cache`)
          cache.save(self.#cacheKey, self.#buffer)
          self.#cacheKey = ''
        }

        console.info('answer to client from redis')
        self.push(self.#buffer)
        self.#buffer = zeroBuffer
        self.emit('done')
      },
      returnError (err) {
        console.error('returnError', err)
      },
      returnFatalError (err) {
        console.error('returnFatalError', err)
      },
      returnBuffers: true,
      stringNumbers: true
    })
  }

  /**
   * @param {Buffer} chunk
   * @param {string} encoding
   * @param {function} callback
   * @private
   */
  _transform (chunk, encoding, callback) {
    this.once('done', () => callback())

    this.#buffer = Buffer.concat([this.#buffer, chunk])
    this.#requestParser.execute(chunk)
  }

  /**
   * @param {Array} reply
   * @private
   */
  writeBufferToRedis (reply) {
    this.acquireConnection()
      .then(connection => {
        console.debug('connection acquired')
        console.debug('send request to redis')
        connection.write(this.#buffer) // @todo: back pressure
        this.#buffer = zeroBuffer

        connection.on('data', chunk => {
          this.#buffer = Buffer.concat([this.#buffer, chunk])
          this.#responseParser.execute(chunk)
        })
      })
      .catch(console.error)
  }

  /**
   * @returns {Promise<Socket>}
   */
  async acquireConnection () {
    if (!this.#connection) {
      this.#connection = await this.#pool.acquire()
    }

    return this.#connection
  }

  /**
   * @returns {Promise<void>}
   */
  async releaseConnection () {
    this.#connection.removeAllListeners('data')
    await this.#pool.release(this.#connection)
    this.#connection = null
    console.debug('connection released')
  }
}

module.exports.RedisCacheStream = RedisCacheStream
