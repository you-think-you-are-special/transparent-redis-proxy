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

  describe('expire', function () {
    it('should expire if only one element in cache', function () {
      const cache = new Cache({ capacity: 1, expireMs: 2 })
      cache.save('key', 'value')
      this.clock.tick(3)
      const res = cache.find('key')
      assert.strictEqual(res, undefined, 'Key should expire')
    })

    it('should expire one element if several elements in cache', function () {
      const cache = new Cache({ capacity: 3, expireMs: 2 })
      cache.save('key', 'value')
      this.clock.tick(1)
      cache.save('key1', 'value')
      cache.save('key2', 'value')
      this.clock.tick(2)
      const res = cache.find('key')
      assert.strictEqual(res, undefined, 'Key should expire')
    })
  })

  describe('capacity', function () {
    it('should expire if no space', function () {
      const cache = new Cache({ capacity: 1, expireMs: 2 })
      cache.save('key', 'value')
      cache.save('key1', 'value1')
      const res = cache.find('key')
      assert.strictEqual(res, undefined, 'Key should expire')
    })
  })
})
