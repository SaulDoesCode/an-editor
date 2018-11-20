const List = (...values) => {
  const list = {
    length: 0,
    each(fn, node = list.first, dir = 'next') {
      let l = list.length
      if (fn && node && l)
        while (l--) {
          if (fn(node.value, node, list) === false) break
          node = node[dir]
        }
      return list
    },
    loopback: (fn, node = list.last, dir = 'last') => list.each(fn, node, dir),
    *[Symbol.iterator]() {
      let node = list.first
      let l = list.length - 1
      if (l === 0) yield node
      else if (l > 0) {
        yield node
        while (l--) yield (node = node.next)
      }
    },
    get values() {
      const values = []
      let node = list.first
      while (values.push(node.value) !== list.length) node = node.next
      return values
    },
    map(fn, node = list.first) {
      const newlist = List()
      do {
        const newnode = newlist.push(node.value)
        const res = fn(node.value, newnode, newlist)
        if (res != null && !res.isNode) newnode.value = res
        node = node.next
      } while (newlist.length != list.length)
      return newlist
    },
    has(val, node = list.last, until = node) {
      while (node.value !== val) if ((node = node.last) === until) return false
      return true
    },
    find(val, node = list.last, until = node) {
      while (node.value !== val) if ((node = node.last) === until) return
      return node
    },
    delete(val) {
      const node = list.find(val)
      if (node) node.delete()
      return list
    },
    push(...vals) {
      let n
      if (vals.length)
        for (const val of vals) {
          n = List.Node(val, null, null, list)
          if (!list.last) list.last = n.move(list.first || n, n)
          if (!list.first) list.first = n.move(n, list.last)
          list.last = list.first.last = list.last.next = n.move(list.first, list.last)
        }
      return n
    },
    pop() {
      if (list.length) list.first.delete()
      return list
    },
    popLast() {
      if (list.length) list.last.delete()
      return list
    }
  }

  list.push(...values)
  return list
}

List.Node = (value, next, last, list) => {
  const N = {
    isNode: true,
    value,
    next,
    last,
    move(next, last) {
      N.next = next
      N.last = last
      return N
    },
    forward() {
      const n = N.next.after(N.value)
      N.delete()
      return n
    },
    backward() {
      const n = N.last.before(N.value)
      N.delete()
      return n
    },
    delete() {
      N.next.last = N.last
      N.last.next = N.next
      if (N === list.first) list.first = N.last
      else if (N === list.last) list.last = N.next
      list.length--
      N.value = list = null
    },
    after(val) {
      const n = (N.next.last = List.Node(val, N.next, N, list))
      if (N === list.last) list.last = n
      return N.next = n
    },
    before(val) {
      const n = (N.last.next = List.Node(val, N, N.last, list))
      if (N === list.first) list.first = n
      return N.last = n
    }
  }
  list.length++
  return N
}