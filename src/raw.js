const {component, emitter, prime, $, run, dom, isArr, isObj} = rilti
const {div, span, section, article, pre, code} = dom
const SegMent = dom['seg-ment']

component('an-editor', {
  props: {
    state: () => {
      const state = emitter(List())
      return state
    }
  },
  methods: {
    segGen(e, content = '', ops = {}) {
      const seg = SegMent({
        methods: {
          caret(seg, start, end = start) {
            if (start == null) return selection(seg)
            const len = seg.textContent.length
            if (end > len) end = len
            selection(seg, start, end)
            if (e.active !== seg) {
              seg.focus()
              e.active = seg
            }
          },
          caretStart(seg) {
            seg.caret(0)
          },
          caretEnd(seg) {
            seg.caret(seg.textContent.length)
          }
        },
        props: {
          accesors: {
            last: {
              get(seg) {
                if (seg.previousElementSibling) {
                  return $(seg.previousElementSibling)
                }
              }
            },
            next: {
              get(seg) {
                if (seg.nextElementSibling) {
                  return $(seg.nextElementSibling)
                }
              }
            }
          }
        },
        onfocus(e, seg) {
          e.active = seg
        },
        onclick(e, seg) {
          seg.focus()
          e.active = seg
        },
        cycle: {
          create(seg) {
            const initHandler = e.on.segGen(s => {
              if (s === seg) {
                s.caretStart()
                initHandler.off()
              }
            })
          },
          mount(seg) {
            seg.focus()
          }
        }
      })
      ops.seg = seg
      ops.content = content
      const mut = e.state.push(ops)
      mut.revoke = () => {
        mut.revoked = true
        ops.seg.remove()
        const last = mut.last.invoke()
        if (ops.revokers) for (const r of ops.revokers) r(last, mut, seg, ops)
        return mut
      }
      mut.invoke = () => {
        if (mut.revoked) {
          mut.forward()
          mut.revoked = false
        }
        if (ops.invokers) for (const i of ops.invokers) i(seg, ops, mut)
        ops.seg.html = content
        ops.seg.appendTo(e.pad)
        e.state.emit.segGen(e.active = ops.seg, ops, mut)
        return mut
      }
      seg.genMut = mut
      seg.editor = e
      mut.invoke()
    },
    removeSeg(e, seg) {
      if (!seg.genMut) throw new Error('invalid cannot revoke segment')
      seg.genMut.revoke()
    }
  },
  create(editor) {
    const {state} = editor

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
      onkeydown(e) {
        if (!editor.active) return
        const seg = editor.active
        const {key} = e
        const Enter = key === 'Enter'
        const Backspace = key === 'Backspace'
        const ArrowUp = key === 'ArrowUp'
        const ArrowDown = key === 'ArrowDown'
        if (Enter || Backspace || ArrowUp || ArrowDown) {
          if (Enter) editor.segGen()
          else if (Backspace) {
            const [start, end] = seg.caret()
            if (start !== end || end !== 0) return
            editor.removeSeg(seg)
          }

          haltevt(e)
        }
      }
    })

    editor.segGen('write something...')

  }
})