# What the code does
Proxy opens a tcp connection on specified port and waits for incoming connections. 
After a connection established with a redis client, all requests from it will be directed at the redis.
A GET request is exception. Proxy returns the value of the specified key from the proxy’s local cache if the local
cache contains a value for that key. If the local cache does not contain a value for the specified key, it fetches
the value from the backing Redis instance, using the Redis GET command, and stores it in the local cache, 
associated with the specified key. Multiple clients are able to concurrently connect to the proxy.
When multiple clients make concurrent requests to the proxy, it will execute a number of these requests in parallel.

# High-level architecture overview
* TcpServer for handling client queries
* RedisPool for handling client queries concurrently
* Cache abstraction for postponing decision about LRU algorithm
* RedisCacheStream for checking cache and proxying query into a redis

# Requirements
* internet connection
* docker v19.03.4 
* docker-compose v1.24.1

# Run
* `docker-compose up`

# Run tests
* `docker exec -it proxy npm test`

# Algorithmic complexity of the cache operations
* find O(1)
* save O(1)

# Dependencies
* Node.js v12.13.0 LTS
* [mnemonist](https://github.com/yomguithereal/mnemonist) as LRU implementation
* [config](https://github.com/lorenwest/node-config) for app [configuration](https://12factor.net/config)
* [generic-pool](https://www.npmjs.com/package/generic-pool) for redis connection pool
* [redis-parser](https://github.com/NodeRedis/node-redis-parser) for redis RESP parsing. [Hiredis](https://github.com/redis/hiredis-node/) doesn't work with LTS version of Node.js
* Docker and docker-compose for run

# Future work
* Extend RESP parser for better memory consumption
* Choose the best LRU implementation based on real data
* Modify back pressure mechanism where relevant
* Max key and space size 
* Liveness and readiness probes for cloud environment
* Graceful restart
* Whitelist of commands (all blocking commands should be prohibited)
* More tests (init, end-to-end, benchmarks)
* Rate limit
* [Better logging](https://12factor.net/logs)

# Some helpful articles which I used
* [LRU benchmarks](https://github.com/dominictarr/bench-lru)
* [Page replacement algorithms](https://en.wikipedia.org/wiki/Page_replacement_algorithm)
* [Cache replacement policies](https://en.wikipedia.org/wiki/Cache_replacement_policies)
* [Golang lru implementation](https://github.com/hashicorp/golang-lru)
* [Redis lru cache](https://redis.io/topics/lru-cache)
* [2Q: A Low Overhead High Performance Buffer Management Replacement Algorithm ](http://www.vldb.org/conf/1994/P439.PDF)
* [Expiring records: Redis ttl, guava cache](https://yesteapea.com/2016/06/02/Expiring-Records.html)
* [Redis protocol](https://redis.io/topics/protocol)
* [Back pressuring in streams](https://nodejs.org/es/docs/guides/backpressuring-in-streams/)
