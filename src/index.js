const config = require('config')
const { TcpServer } = require('./tcp_server')
const { Cache } = require('./cache')
const { RedisPool } = require('./redis_pool')
const { RedisCacheStream } = require('./redis_cache_stream');

(async () => {
  const server = new TcpServer(config.tcpServer)
  const cache = new Cache(config.cache)
  const pool = new RedisPool(config.redis)

  server.on('client', client => {
    const cacheStream = new RedisCacheStream({ pool, cache })

    cacheStream.once('error', (err) => {
      console.error('cacheStream error', err)
      client.end()
    })

    client.once('error', err => {
      console.error('Client connection error', err)
      client.end()
    })

    client.pipe(cacheStream)
    cacheStream.pipe(client)
  })

  const exitHandler = signal => {
    console.info(`interrupted by signal: ${signal}`)

    server.close()
      .then(() => pool.destroy())
      .catch(console.error)
  }

  process.on('SIGINT', exitHandler)
  process.on('SIGTERM', exitHandler)
  process.on('SIGHUP', exitHandler)
  process.on('SIGBREAK', exitHandler)

  await server.listen()
})()
  .catch(console.error)
