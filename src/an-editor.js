const {dom, component, emitter, $, run} = rilti
const {div, span, button, section, nav, article, html} = dom

const converter = new showdown.Converter()
const md2html = (src, fancy) => !fancy ? converter.makeHtml(src) : html(converter.makeHtml(src))

component('an-editor', {
  props: {
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
        el.activeSeg = el.segment()
      } else if (e.key === 'Backspace' && !segment.textContent.length) {
        if (segment.preiousElementSibling) {
          el.activeSeg = $(segment.preiousElementSibling)
          segment.remove()
          el.segments.delete(segment)
          const allen = segment.textContent.length
          if (allen) el.activeSeg.select(allen, allen)
          el.activeSeg.focus()
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