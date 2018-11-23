import http from 'http'
import koa from 'koa'
import send from 'koa-send'
import chokidar from 'chokidar'
import childproc from 'child_process'
import websocket from 'websocket'

const exec = cmd => new Promise((resolve, reject) => childproc.exec(cmd,
  (err, stdout) => err ? reject(err) : resolve(stdout)
))

const infinify = (fn, reflect) => new Proxy(fn, {
  get: reflect === true ?
    (fn, key) => key in fn ? Reflect.get(fn, key) : fn.bind(null, key) : (fn, key) => fn.bind(null, key)
})

const emitter = (host = Object.create(null), listeners = new Map()) => Object.assign(host, {
  emit: infinify((event, ...data) => setImmediate(() => {
    if (listeners.has(event)) {
      for (const h of listeners.get(event)) h.apply(null, data)
    }
  })),
  on: infinify((event, handler) => {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(handler)
    const manager = () => host.off(event, handler)
    manager.off = manager
    manager.on = () => {
      manager()
      return host.on(event, handler)
    }
    manager.once = () => {
      manager()
      return host.once(event, handler)
    }
    return manager
  }),
  once: infinify((event, handler) => host.on(event, function h() {
    handler(...arguments)
    host.off(event, h)
  })),
  off: infinify((event, handler) => {
    if (listeners.has(event)) {
      const ls = listeners.get(event)
      ls.delete(handler)
      if (!ls.size) listeners.delete(event)
    }
  })
})

const manager = emitter()

const watcher = chokidar.watch('./src')

watcher.on('change', manager.emit.reload)

const app = new koa()
const sendOptions = {root: './'}

app.use(async ctx => {
  console.log(ctx.path)
  const filepath = ctx.path === '/' ? '/src/index.html' :
    ctx.path.includes('rilti.min.js') ? '/node_modules/rilti/dist/rilti.min.js' :
    ctx.path.includes('rilti.js') ? '/node_modules/rilti/dist/rilti.js' :
    ctx.path.includes('showdown.min.js') ? '/node_modules/showdown/dist/showdown.min.js' :
    ctx.path.replace('/', '/src/')

  try {
    await send(ctx, filepath, sendOptions)
  } catch(er) {
    if (er.code === 'ENOENT' && er.status === 404) send404(ctx)
    else sendErr(ctx, er.status || 500, err.code)
  }
})

const sendErr = (ctx, code, content) => {
  ctx.status = code
  ctx.type = 'text/html'
  ctx.body = `<h1 style="color: red; font-family: sans-serif; text-align: center; margin: 2em auto;">${code}: ${content}</h1>`
}

const send404 = ctx => sendErr(ctx, 404, send404.content)
send404.content = `Nothing to see here`

const httpServer = http.createServer(app.callback())

const wss = new websocket.server({httpServer})

wss.on('request', req => {
  if (!req.origin.includes('localhost')) {
    req.reject();
    return
  }
  const conn = req.accept('echo-protocol', req.origin)
  const ln = manager.once('reload', () => {
    conn.sendUTF('reload')
  })
  conn.on('close', () => {
    ln.off()
  })
})

httpServer.listen(2018)