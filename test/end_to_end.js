const assert = require('assert')
const config = require('config')
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis)

async function createConnection () {
  const client = redis.createClient(config.tcpServer.listen)
  return new Promise(resolve => {
    client.once('ready', () => resolve(client))
  })
}

const MAX_CLIENTS = 1000

describe('proxy', function () {
  this.timeout(20000)

  beforeEach(async function () {
    this.connections = []

    for (let i = 0; i < MAX_CLIENTS; i++) {
      const connection = await createConnection()
      this.connections.push(connection)
    }
  })

  afterEach(function () {
    this.connections.forEach((connection) => {
      connection.end(true)
    })
  })

  it('should get empty key', async function () {
    const res = await this.connections[0].getAsync('emptyKey')
    assert.strictEqual(res, null)
  })

  it('should set and get one key', async function () {
    await this.connections[0].setAsync('key', 'test')
    const res = await this.connections[0].getAsync('key')
    assert.strictEqual(res, 'test')
  })

  it('should work with concurrent clients with same keys', async function () {
    await this.connections[0].setAsync('key1', 'test')
    const promises = this.connections.map(connection => connection.getAsync('key1'))
    const res = await Promise.all(promises)
    assert.strictEqual(res.length, this.connections.length)
    assert(res.every(val => val === 'test'))
  })

  it('should work with concurrent clients with different keys', async function () {
    const promises = this.connections
      .map(async (connection, i) => {
        await connection.setAsync(`d_key${i}`, i)
        const res = await connection.getAsync(`d_key${i}`)
        assert.strictEqual(res, i.toString())
      })

    await Promise.all(promises)
  })
})
