
import ExtendableError from 'es6-error'

import needle from '../promised/needle'
import urls from '../constants/urls'

import mkcooldown from './cooldown'
import mklog from './log'

const cooldown = mkcooldown(130)
const log = mklog('api')
const logger = new mklog.Logger({sinks: {console: !!process.env.LET_ME_IN}})
const opts = {logger}

// cf. https://github.com/itchio/itchio-app/issues/48
// basically, lua returns empty-object instead of empty-array
// because they're the same in lua (empty table). not in JSON though.
function ensure_array (v) {
  if (~~v.length === 0) {
    return []
  }
  return v
}

let self

class ApiError extends ExtendableError {
  constructor (errors) {
    super(errors.join(', '))
    this.errors = errors
  }

  toString () {
    return `API Error: ${this.errors.join(', ')}`
  }
}

/**
 * Wrapper for the itch.io API
 */
class Client {
  constructor () {
    this.root_url = `${urls.itchio_api}/api/1`
    this.lastRequest = 0
  }

  async request (method, path, data) {
    let t1 = Date.now()

    if (typeof data === 'undefined') {
      data = {}
    }
    let uri = `${this.root_url}${path}`

    await cooldown()
    let t2 = Date.now()

    let resp = await needle.requestAsync(method, uri, data)
    let body = resp.body
    let t3 = Date.now()

    let short_path = path.replace(/^\/[^\/]*\//, '')
    log(opts, `${t2 - t1}ms wait, ${t3 - t2}ms http, ${method} ${short_path} with ${JSON.stringify(data)}`)

    if (resp.statusCode !== 200) {
      throw new Error(`HTTP ${resp.statusCode}`)
    }

    if (body.errors) {
      throw new ApiError(body.errors)
    }
    return body
  }

  login_key (key) {
    return this.request('post', `/${key}/me`, {
      source: 'desktop'
    })
  }

  login_with_password (username, password) {
    return this.request('post', '/login', {
      username: username,
      password: password,
      source: 'desktop'
    })
  }
}

/**
 * A user, according to the itch.io API
 */
class User {
  constructor (client, key) {
    this.client = client
    this.key = key
  }

  request (method, path, data) {
    if (typeof data === 'undefined') {
      data = {}
    }

    let url = `/${this.key}${path}`
    return this.client.request(method, url, data)
  }

  // TODO: paging, for the prolific game dev.
  async my_games (data) {
    let res = await this.request('get', `/my-games`, data)
    res.games = self.ensure_array(res.games)
    return res
  }

  async my_owned_keys (data) {
    let res = await this.request('get', `/my-owned-keys`, data)
    res.owned_keys = self.ensure_array(res.owned_keys)
    return res
  }

  me () {
    return this.request('get', `/me`)
  }

  async my_collections () {
    let res = await this.request('get', `/my-collections`)
    res.collections = self.ensure_array(res.collections)
    return res
  }

  game (game) {
    return this.request('get', `/game/${game}`)
  }

  collection (collection_id) {
    return this.request('get', `/collection/${collection_id}`)
  }

  collection_games (collection_id, page) {
    if (typeof page === 'undefined') {
      page = 1
    }
    return this.request('get', `/collection/${collection_id}/games`, {page})
  }

  async search (query) {
    let res = await this.request('get', '/search/games', {query})
    res.games = self.ensure_array(res.games)
    return res
  }

  download_key_uploads (download_key_id) {
    return this.request('get', `/download-key/${download_key_id}/uploads`)
  }

  download_upload_with_key (download_key_id, upload_id) {
    return this.request('get', `/download-key/${download_key_id}/download/${upload_id}`)
  }

  async game_uploads (game) {
    let res = await this.request('get', `/game/${game}/uploads`)
    res.uploads = self.ensure_array(res.uploads)
    return res
  }

  download_upload (upload_id) {
    return this.request('get', `/upload/${upload_id}/download`)
  }
}

self = {
  Client,
  User,
  client: new Client(),
  ensure_array
}

export default self
