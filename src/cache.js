const LRUMap = require('mnemonist/lru-map')

class Cache {
  #expire

  #cache

  /**
   * @param {number} capacity
   * @param {number} expire
   */
  constructor ({ capacity, expire }) {
    this.#expire = expire
    this.#cache = new LRUMap(capacity)
  }

  /**
   * @param {string} key
   * @param value
   */
  save (key, value) {
    this.#cache.set(
      key,
      {
        value,
        createdAt: Date.now()
      }
    )
  }

  /**
   * @param {string} key
   * @returns {*}
   */
  find (key) {
    const value = this.#cache.get(key)
    if (value === undefined || value.createdAt >= Date.now()) {
      this.splayOnBottom(key)
      return
    }

    return value.value
  }

  /**
   * @private
   * @param {string} key
   */
  splayOnBottom (key) {
    const cache = this.#cache
    const pointer = cache.items[key]
    if (cache.tail === pointer) {
      return
    }

    const oldTail = cache.tail

    const previous = cache.backward[pointer],
      next = cache.forward[pointer]

    cache.backward[next] = previous
    cache.forward[previous] = next

    cache.backward[pointer] = oldTail
    cache.tail = pointer
    cache.forward[oldTail] = pointer
  }
}

module.exports.Cache = Cache
