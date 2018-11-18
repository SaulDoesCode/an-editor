const {dom, component, emitter, $, run} = rilti
const {div, span, button, section, nav, article, html} = dom

const converter = new showdown.Converter()
const md2html = (src, fancy) => !fancy ? converter.makeHtml(src) : html(converter.makeHtml(src))

const haltevt = e => {
  e.preventDefault()
  e.stopPropagation()
}

component('an-editeur', {
  methods: {
    content(el) {
      if (el.lines.size === 1) return [...el.lines][0].textContent.trimEnd()
      let content = ''
      for (const line of el.lines) {
        content += line.textContent.trimEnd() + '  \n'
      }
      return content
    },
    selectPreviousLine(el, line = el.activeLine , start, end = start) {
      if (!line || !line.previousElementSibling) return
      el.activeLine = $(line.previousElementSibling)
      start != null ? el.activeLine.select(start, end) : el.activeLine.selectEnd()
      el.activeLine.focus()
      return el.activeLine
    },
    selectNextLine(el, line = el.activeLine , start, end = start) {
      if (!line || !line.nextElementSibling) return
      el.activeLine = $(line.nextElementSibling)
      start != null ? el.activeLine.select(start, end) : el.activeLine.selectStart()
      el.activeLine.focus()
      return el.activeLine
    }
  },
  create(el) {
    const editor = el
    el.E = emitter()
    el.pad = section.pad({
      $: el,
      contentEditable: navigator.userAgent.includes('Chrome') ? 'plaintext-only' : true,
      onkeydown(e) {
        const is = key => key === e.key
        const Enter = is('Enter')
        if (
          Enter ||
          (is('Backspace') && !editor.activeLine.textContent.length)
          ) haltevt(e)
        editor.E.emit.input(e, editor.activeLine, Enter)
      }
    })
    el.line = lineMaker(el)
    el.lines = new Set()

    el.E.on.input((e, line = el.activeLine , newline) => {
      if (!line) return
      if (newline && !line.nextElementSibling) {
        el.activeLine = el.line()
      } else if (e.key === 'Backspace' && !line.textContent.length) {
        if (line.previousElementSibling) {
          el.activeLine = $(line.previousElementSibling)
          line.remove()
          el.lines.delete(line)
          const allen = line.textContent.length
          if (allen) el.activeLine.select(allen, allen)
          el.activeLine.focus()
        }
      }
    })
  },
  mount(el) {
    el.activeLine = el.line('add some text')
    el.line('add some more text')

    run(() => el.activeLine.focus())
  }
})

const lineMaker = editor => (content = '') => div.line({
  $: editor.pad,
  methods: {
    makeActiveLine(line) {
      editor.activeLine = line
    },
    caretAtEnd(line) {
      const [start, end] = selection(line)
      const len = line.textContent.length
      return start === end && end === len
    },
    caretAtStart(line) {
      const [start, end] = selection(line)
      return start === end && start === 0
    },
    caretAt(line, start, end = start) {
      const [s, e] = selection(line)
      return start === s && end === e
    },
    selectEnd(line) {
      const len = line.textContent.length
      selection(line, len, len)
    },
    selectStart(line) {
      selection(line, 0, 0)
    },
    select(line, start, end = start) {
      const len = line.textContent.length
      if (end > len) {
        if (end === start) start = len
        end = len
      }
      selection(line, start, end)
    },
  selection},
  cycle: {
    create(line) {
      line.on({ focus: line.makeActiveLine, click: line.makeActiveLine })
    },
    mount(line) {
      editor.lines.add(line)
      line.activeLine = line
      line.focus()
      line.select(0)
    },
    unmount(line) {
      editor.lines.delete(line)
    }
  },
  onkeydown(e, line) {
    if (e.key === 'Enter') {
      haltevt(e)
      line.blur()
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

  console.log(`start: ${start}, end: ${end}`)

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

function setCaretPosition (editable, pos) {
  if (editable instanceof Function) editable = editable()
  if (editable.createTextRange) {
    const range = editable.createTextRange()
    range.move('character', pos)
    range.select()
  } else {
    if (editable.selectionStart) {
      editable.focus()
      editable.setSelectionRange(pos, pos)
    } else {
      editable.focus()
    }
  }
}
