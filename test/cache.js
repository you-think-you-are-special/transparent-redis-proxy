const assert = require('assert')
const sinon = require('sinon')
const { Cache } = require('../src/cache')

describe('cache', function () {
  beforeEach(function () {
    this.clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    this.clock.restore()
  })

  it('should expire with time', function () {
    const cache = new Cache({ capacity: 1, expireMs: 2 })
    cache.save('key', 'value')
    this.clock.tick(3)
    const res = cache.find('key')
    assert.strictEqual(res, undefined, 'Key should expire')
  })

  it('should expire if no space', function () {
    const cache = new Cache({ capacity: 1, expireMs: 2 })
    cache.save('key', 'value')
    cache.save('key1', 'value1')
    const res = cache.find('key')
    assert.strictEqual(res, undefined, 'Key should expire')
  })
})
