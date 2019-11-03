const { Transform } = require('stream')
const Parser = require('redis-parser') // @todo: extend parser for better memory consumption
const zeroBuffer = Buffer.allocUnsafe(0)
const { EventEmitter } = require('events')

const events = new EventEmitter()
events.setMaxListeners(0)

const alreadyRequestedKeysMap = new Map() // @todo: add expire for keys

const parserCommonParams = {
  returnError (err) {
    console.error('returnError', err)
  },
  returnFatalError (err) {
    console.error('returnFatalError', err)
  },
  returnBuffers: true,
  stringNumbers: true
}

class RedisCacheStream extends Transform {
  #pool
  #connection
  #requestParser
  #responseParser
  #cacheKey = ''
  #buffer = zeroBuffer
  #cmd = ''
  #cacheSubscriptionKey = ''

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
        // @todo: move criteria to config
        if (!reply[0].equals(self.#cmd) || reply.length !== 2) {
          self.writeBufferToRedis(reply) // proxy other commands
          return
        }

        const key = reply[1].toString()
        const res = cache.find(key)
        if (res !== undefined) {
          self.responseFromCache(res)
          return
        }

        if (alreadyRequestedKeysMap.has(key)) {
          self.#cacheSubscriptionKey = `key_ready_${key}`
          events.once(self.#cacheSubscriptionKey, self.responseFromCache.bind(self))
          return
        }

        alreadyRequestedKeysMap.set(key, [])
        self.#cacheKey = key
        self.writeBufferToRedis(reply)
      },
      ...parserCommonParams
    })
  }

  /**
   * @param {Buffer} buffer
   * @private
   */
  responseFromCache (buffer) {
    if (this.#cacheSubscriptionKey.length > 0) {
      alreadyRequestedKeysMap.delete(this.#cacheSubscriptionKey)
      this.#cacheSubscriptionKey = ''
    }

    console.info('cache hit')
    console.info('answer to client from cache')
    this.push(buffer)
    this.emit('done')
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
          events.emit(`key_ready_${self.#cacheKey}`, self.#buffer)
          alreadyRequestedKeysMap.delete(self.#cacheKey)
          self.#cacheKey = ''
        }

        console.info('answer to client from redis')
        self.push(self.#buffer)
        self.#buffer = zeroBuffer
        self.emit('done')
      },
      ...parserCommonParams
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
   * @private
   */
  _final (callback) {
    if (this.#cacheSubscriptionKey) {
      events.removeListener(this.#cacheSubscriptionKey, this.responseFromCache)
      alreadyRequestedKeysMap.delete(this.#cacheSubscriptionKey)
    }
    callback()
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
        connection.write(this.#buffer) // @todo: respect back pressure
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
