const LRUMap = require('mnemonist/lru-map')

class Cache {
  #expireMs

  #cache

  /**
   * @param {number} capacity
   * @param {number} expireMs
   */
  constructor ({ capacity, expireMs }) {
    this.#expireMs = expireMs
    this.#cache = new LRUMap(capacity)
  }

  toString () {
    return JSON.stringify(this.#cache)
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
        dueDate: Date.now() + this.#expireMs
      }
    )
  }

  /**
   * @param {string} key
   * @returns {*}
   */
  find (key) {
    const value = this.#cache.get(key)
    if (value === undefined) {
      return
    }

    if (value.dueDate < Date.now()) {
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
