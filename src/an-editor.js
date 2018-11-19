const {dom, component, emitter, $, run} = rilti
const {div, span, button, section, nav, article, html} = dom

const converter = new showdown.Converter()
const md2html = (src, fancy) => !fancy ? converter.makeHtml(src) : html(converter.makeHtml(src))

const haltevt = e => {
  e.preventDefault()
  e.stopPropagation()
}

component('an-editor', {
  methods: {
    content(el) {
      if (el.segments.size === 1) return [...el.segments][0].textContent
      let content = ''
      for (const segment of el.segments) content += segment.textContent + '\n'
      return content
    },
    selectPreviousLine(el, segment = el.activeSeg , start, end = start) {
      if (!segment || !segment.previousElementSibling) return
      el.activeSeg = $(segment.previousElementSibling)
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
        if (data.includes('\n')) {
          for (const l of data.split('\n')) el.activeSeg = el.segment(l)
        } else {
          editor.activeSeg.textContent += data
          editor.activeSeg.selectEnd()
        }
      },
      onkeydown(e) {
        const is = key => key === e.key
        const Enter = is('Enter')
        const Save = is('s') && e.ctrlKey
        if (
          Enter ||
          (is('Backspace') && !editor.activeSeg.textContent.length) ||
          Save
        ) haltevt(e)
        if (Save) {
          editor.E.emit.Save(editor, e)
          return
        }
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
        if (segment.previousElementSibling) {
          el.activeSeg = $(segment.previousElementSibling)
          segment.remove()
          el.segments.delete(segment)
          const allen = segment.textContent.length
          if (allen) el.activeSeg.select(allen, allen)
          el.activeSeg.focus()
        }
      }
    })
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
    selectStart(segment) {
      selection(segment, 0, 0)
    },
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
