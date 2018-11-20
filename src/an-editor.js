const {dom, component, emitter, $, run} = rilti
const {div, span, button, section, nav, article, html} = dom

const converter = new showdown.Converter()
const md2html = (src, fancy) => !fancy ? converter.makeHtml(src) : html(converter.makeHtml(src))

const haltevt = e => {
  e.preventDefault()
  e.stopPropagation()
}

component('an-editor', {
  props: {
    sourcing: el => {
      const sourcing = {
        levels: 15,
        mutations: [],
        add(state) {
          if (sourcing.mutations.includes(state)) return
          sourcing.mutations.push(state)
          if (sourcing.mutations.length > sourcing.levels) {
            sourcing.mutations.shift()
          }
        },
        del(state) {
          const i = sourcing.mutations.indexOf(state)
          if (i !== -1) sourcing.mutations.splice(i, 1)
        },
        get last() {
          return sourcing.mutations[sourcing.mutations.length - 1]
        },
        get lastIndex() {
          return sourcing.mutations.length - 1
        },
        popLast() {
          const last = sourcing.last
          sourcing.del(last)
          return last
        }
      }
      return sourcing
    },
    accessors: {
      content: {
        get(el) {
          if (el.segments.size === 1) return [...el.segments][0].textContent
          let content = ''
          for (const segment of el.segments) content += segment.textContent + '\n'
          return content
        },
        set(el, content) {
          if (content.includes('\n')) {
            for (const seg of content.split('\n')) {
              el.activeLine = el.segment(seg)
            }
          } else {
            el.activeLine = el.segment(content)
          }
        }
      },
      renderedMD: (el, fancy) => md2html(el.content, fancy)
    }
  },
  methods: {
    clearEditor(el) {
      el.segments.clear()
      el.pad.textContent = ''
    },
    selectPreviousLine(el, segment = el.activeSeg , start, end = start) {
      if (!segment || !segment.preiousElementSibling) return
      el.activeSeg = $(segment.preiousElementSibling)
      start != null ? el.activeSeg.select(start, end) : el.activeSeg.selectEnd()
      el.activeSeg.focus()
      return el.activeSeg
    },
    selectNextLine(el, segment = el.activeSeg , start, end = start) {
      if (!segment || !segment.nextElementSibling) return
      el.activeSeg = $(segment.nextElementSibling)
      start != null ? el.activeSeg.select(start, end) : el.activeSeg.selectStart()
      el.activeSeg.focus()
      return el.activeSeg
    },
    mutate(el, fn) {
      el.sourcing.add(el.captureState())
      fn(el.activeSeg, el.segments, el)
    },
    undo(el) {
      if (!el.sourcing.mutations.length) return
      if (el.undoLevel == null) el.undoLevel = 0
      const state = el.sourcing.mutations[el.sourcing.lastIndex - el.undoLevel]
      if (!state) return
      el.sourcing.add(el.captureState())
      el.restoreState(state)
      el.undoLevel = 1
    },
    redo(el) {
      if (!el.sourcing.mutations.length) return
      if (el.undoLevel == null) return
      const state = el.sourcing.mutations[el.sourcing.lastIndex - el.undoLevel]
      if (!state) return
      el.restoreState(state)
      el.undoLevel--
      if (el.undoLevel === 0) el.undoLevel = null
    },
    captureState(el) {
      const state = {
        active: el.activeSeg.textContent,
        activeSelection: el.activeSeg.selection(),
        segments: []
      }
      for (const s of el.segments) state.segments.push(s.textContent)
      return state
    },
    restoreState(el, {active, activeSelection, segments}) {
      if (segments.length !== el.segments.size) {
        el.clearEditor()
        for (const s of segments) {
          el.activeSeg = el.segment(s)
          if (s === active) {
            run(() => el.activeSeg.select(...activeSelection))
          }
        }
      } else {
        let i = 0
        for (const seg of el.segments) {
          (el.activeSeg = seg).textContent = segments[i]
          if (segments[0] === active) el.activeSeg.select(...activeSelection)
          i++
        }
      }
    }
  },
  create(el) {
    const editor = el
    el.E = emitter()
    el.pad = section.pad({
      $: el,
      contentEditable: navigator.userAgent.includes('Chrome') ? 'plaintext-only' : true,
      onpaste(e) {
        if (!e.clipboardData || !e.clipboardData.getData) return
        let data = e.clipboardData.getData('text/plain')
        haltevt(e)
        if (!data.length) return
        editor.mutate(seg => {
          if (data.includes('\n')) {
            for (const l of data.split('\n')) el.activeSeg = el.segment(l)
          } else {
            const [start, end] = seg.selection()
            if (start === seg.textContent.length) {
              seg.textContent += data
              seg.selectEnd()
            } else {
              if (start !== end) {
                const old = seg.textContent.substring(start, end)
                seg.textContent = seg.textContent.replace(old, data)
              } else {
                seg.textContent = putAtpos(seg.textContent, end, data)
              }
              seg.select(start + data.length)
            }
          }
        })
      },
      onkeydown(e) {
        const is = key => key === e.key
        const Enter = is('Enter')
        if (e.ctrlKey) {
          const Save = is('s')
          const Undo = is('z')
          const Redo = is('y')
          if (Save || Undo || Redo) {
            haltevt(e)
            if (Save) return editor.E.emit.save(editor, e)
            if (Undo) return editor.E.emit.undo(editor, e)
            if (Redo) return editor.E.emit.redo(editor, e)
          }
        } else if (
          Enter ||
          (is('Backspace') && !editor.activeSeg.textContent.length)
        ) haltevt(e)

        editor.E.emit.input(e, editor.activeSeg, Enter)
      }
    })
    el.segment = segmentMaker(el)
    el.segments = new Set()

    el.E.on.input((e, segment = el.activeSeg , newsegment) => {
      if (!segment) return
      if (newsegment && !segment.nextElementSibling) {
        el.mutate(() => {
          el.activeSeg = el.segment()
        })
      } else if (e.key === 'Backspace' && !segment.textContent.length) {
        if (segment.preiousElementSibling) {
          el.mutate(() => {
            el.activeSeg = $(segment.preiousElementSibling)
            segment.remove()
            el.segments.delete(segment)
            const allen = segment.textContent.length
            if (allen) el.activeSeg.select(allen, allen)
            el.activeSeg.focus()
          })
        }
      }
    })

    el.E.on.undo(() => editor.undo())
    el.E.on.redo(() => editor.redo())
  },
  mount(el) {
    el.activeSeg = el.segment('add some text')
    el.segment('add some more text')

    run(() => el.activeSeg.focus())
  }
})

const segmentMaker = editor => (content = '') => div.segment({
  $: editor.pad,
  methods: {
    setActiveSeg(segment) {
      editor.activeSeg = segment
    },
    caretAtEnd(segment) {
      const [start, end] = selection(segment)
      const len = segment.textContent.length
      return start === end && end === len
    },
    caretAtStart(segment) {
      const [start, end] = selection(segment)
      return start === end && start === 0
    },
    caretAt(segment, start, end = start) {
      const [s, e] = selection(segment)
      return start === s && end === e
    },
    selectEnd(segment) {
      const len = segment.textContent.length
      selection(segment, len, len)
    },
    selectStart: seg => seg.selection(0, 0),
    select(segment, start, end = start) {
      const len = segment.textContent.length
      if (end > len) {
        if (end === start) start = len
        end = len
      }
      selection(segment, start, end)
    },
  selection},
  cycle: {
    create(segment) {
      segment.on({ focus: segment.setActiveSeg, click: segment.setActiveSeg })
    },
    mount(segment) {
      editor.segments.add(segment)
      segment.activeSeg = segment
      segment.focus()
      segment.select(0)
    },
    unmount(segment) {
      editor.segments.delete(segment)
    }
  }
}, content)

const selection = (editable, start, end = start) => {
  if (editable instanceof Function) editable = editable()

  if (start == null) {
    const range = window.getSelection().getRangeAt(0)
    let preSelectionRange = range.cloneRange()
    preSelectionRange.selectNodeContents(editable)
    preSelectionRange.setEnd(range.startContainer, range.startOffset)
    const start = preSelectionRange.toString().length
    return [start, start + range.toString().length]
  }
  let charIndex = 0
  let range = document.createRange()
  range.setStart(editable, 0)
  range.collapse(true)

  let nodeStack = [editable]
  let node
  let foundStart = false
  let stop = false

  while (!stop && (node = nodeStack.pop())) {
    if (node.nodeType == 3) {
      let nextCharIndex = charIndex + node.length
      if (!foundStart && start >= charIndex && start <= nextCharIndex) {
        range.setStart(node, start - charIndex)
        foundStart = true
      }
      if (foundStart && end >= charIndex && end <= nextCharIndex) {
        range.setEnd(node, end - charIndex)
        stop = true
      }
      charIndex = nextCharIndex
    } else {
      let i = node.childNodes.length
      while (i--) nodeStack.push(node.childNodes[i])
    }
  }

  const currentSel = window.getSelection()
  currentSel.removeAllRanges()
  currentSel.addRange(range)
}

const putAtpos = (host, pos, str) => [host.slice(0, pos), str, host.slice(pos)].join('')

const List = () => {
  const list = {
    length: 0,
    each(fn, node = list.first, until = node, dir = 'next') {
      let l = list.length
      if (!fn || !node || !l) return
      while(l--) {
        if (fn(node.value, node, list) === false) break
        node = node[dir]
      }
      return list
    },
    loopback: (fn, node = list.last, until = node, dir = 'last') => list.each(fn, node, until, dir),
    [Symbol.iterator]() {
      let value = list.first
      const until = value
      return {
        next: () => ({value, done: (value = value.next) === until})
      }
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
      const includes = list.has(val)
      if (includes) includes.node.delete()
      return list
    },
    push(...vals) {
      let n
      if (vals.length) for (const val of vals) {
        n = new List.Node(val, null, null, list)
        if (!list.last) list.last = n.move(list.first || n, n)
        if (!list.first) list.first = n.move(n, list.last)

        list.last = (list.first.last = list.last.next = n.move(list.first, list.last))
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

  return list
}

List.Node = class {
  constructor(value, next, last, list) {
    this.value = value
    this.next = next
    this.last = last;
    (this.list = list).length++
  }
  move(next, last) {
    this.next = next
    this.last = last
    return this
  }
  transfer(list, dupe) {
    let i = 0
    this.list.each((_, n) => {
      if (n === this) return false
      i++
    })
    if (i > list.length) return list.push(this.value)
    let x = 0
    list.each((_, n) => {
      if (x === i - 1) n.after(this.value)
      x++
    })
    if (!dupe) this.delete()
  }
  delete() {
    this.next.last = this.last
    this.last.next = this.next
    if (this === this.list.first) this.list.first = this.last
    else if (this === this.list.last) this.list.last = this.next
    this.value = null
    this.list.length--
    return this
  }
  after(val) {
    const n = (this.next.last = new List.Node(val, this.next, this, this.list))
    if (this === this.list.last) this.list.last = n
    return this.next = n
  }
  before(val) {
    const n = (this.last.next = new List.Node(val, this, this.last, this.list))
    if (this === this.list.first) this.list.first = n
    return this.last = n
  }
}