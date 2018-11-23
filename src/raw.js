const {component, emitter, flatten, merge, prime, $, run, dom, isStr, isArr, isObj} = rilti
const {div, span, section, article, pre, code} = dom

const SegMent = dom['seg-ment']

const EditorDataManager = editor => {
  const e = emitter(List())
  const {pad} = editor

  new MutationObserver(muts => {
    for (const mut of muts) {
      if (mut.type === 'childList') {
      } else if (mut.type === 'characterData') {
        // console.log(mut.type, mut.target, mut.oldValue)
      }
    }
  }).observe(pad(), {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: true,
  })

  e.defaults = (ops = {}) => merge({
    render: pad,
    methods: {
      caret(seg, start, end = start) {
        if (start == null) return selection(seg)
        if (end > seg.len) end = seg.len
        selection(seg, start, end)
        if (e.active !== seg) {
          seg.focus()
          e.active = seg
        }
      },
      caretPos(seg) {
        return selection(seg)[0]
      },
      caretStart(seg) { seg.caret(0) },
      caretEnd(seg) { seg.caret(seg.length) },
      caretChar(seg) {
        try {
          const [start, end] = seg.caret()
          if (start === end && seg.textContent[end - 1] != null) return seg.textContent[end - 1]
        } catch(e) {}
        return ''
      },
      dataAt(seg, start, len = 1) {
        return seg.textContent.slice(start, start + len)
      }
    },
    props: {
      accessors: {
        len: {get: seg => seg.textContent.length},
        last: {
          get(seg) {
            if (seg.previousElementSibling) return $(seg.previousElementSibling)
          }
        },
        next: {
          get(seg) {
            if (seg.nextElementSibling) return $(seg.nextElementSibling)
          }
        }
      }
    },
    onfocus(e, seg) {
      editor.active = seg
    },
    onclick(e, seg) {
      seg.focus()
      editor.active = seg
    },
    cycle: {
      mount(seg) {
        seg.focus()
      }
    }
  }, ops)

  e.segment = (content, {modifiers, wrapper} = {}) => {
    const el = SegMent(e.defaults({attr: {mark: uid()}}))
    
    if (isStr(wrapper)) {
      wrapper = dom(wrapper, content)
    } else if (isObj(wrapper) && isStr(wrapper.tag)) {
      wrapper = dom(wrapper.tag, wrapper, content)
    }

    const hasWrapper = wrapper instanceof Function
    el.append(hasWrapper ? el.wrapper = wrapper : content)

    if (isStr(modifiers)) el.class(modifiers.split(' ').map(m => 'is-' + m))

    return el
  }

  return e
}

const typingDetector = editor => {
  const unPassable = 'Enter ArrowLeft ArrowRight ArrowUp ArrowDown'.split(' ')
  const t = editor.typingDetector = {
    keyup(e) {
      if (e.ctrlKey || unPassable.includes(e.key)) {
        if (t.to) clearTimeout(t.to)
        t.to = t.backspace = t.last = null
        return
      }
      t.backspace = e.key == 'Backspace'
      const now = Date.now()
      if (!t.last) t.last = now

      if (now - t.last < 500) {
        t.last = now
        if (!t.data || !t.last) {
          t.data = ''
        }
        const charPos = editor.active.caretPos()
        console.log(now - t.last, 'ms', 'charpos: ', charPos)
        if (!t.charPos || charPos !== t.charPos) {
          t.charPos = charPos
          if (t.backspace) {
            t.data = editor.active.dataAt(charPos, -1)
          } else {
            t.data += editor.active.dataAt(charPos)
          }
        } else {
          return
        }
        console.log(t.data)
        if (t.to) {
          clearTimeout(t.to)
        }
        t.to = setTimeout(() => {
          if (t.last !== now) return
          if (t.backspace) {
            editor.M.emit.Backspaced(t.data)
          } else {
            editor.M.emit.typed(t.data)
          }
          console.log(t.data)
          t.data = ''
          t.backspace = t.last = null
        }, 500)
      }
    }
  }
  return t
}

component('an-editor', {
  methods: {},
  create(editor) {
    const t = typingDetector(editor)

    editor.pad = section.pad({
      $: editor,
      contentEditable: true,
      onpaste(e) {
        if (!e.clipboardData || !e.clipboardData.getData) return
        let data = e.clipboardData.getData('text/plain')
        if (!data.length) return
        haltevt(e)
      // ...
      },
      onkeyup(e) {
        t.keyup(e)
      },
      onkeydown(e) {
        if (!editor.active) return
        const seg = editor.active
        const {key} = e
        const Enter = key === 'Enter'
        const Backspace = key === 'Backspace'
        const ArrowLeft = key === 'ArrowLeft'
        const ArrowRight = key === 'ArrowRight'
        if (ArrowLeft && seg.last) {
          const [start, end] = seg.caret()
          if (end !== 0) return
          haltevt(e)
          seg.last.caretEnd()
        } else if (ArrowRight && start === seg.len && seg.next) {
          haltevt(e)
          seg.next.caretStart()
        } else if (Enter || Backspace) {
          const [start, end] = seg.caret()

          if (Enter && val.length !== 0) {
            if (end !== 0 && end !== val.length) {
              const [remain, next] = splitAt(val, end)
              seg.content = remain
              M.segment(next)
            } else {
              M.segment('')
            }
          } else if (Backspace) {
            if (start !== end || end !== 0) return
          }
          haltevt(e)
        }
      }
    })

    const M = editor.M = EditorDataManager(editor)

    M.segment('write something...')
    M.segment('add a new line or something...')
  }
})