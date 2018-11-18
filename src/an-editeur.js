const {dom, component, emitter, $} = rilti
const {div, span, button, section, nav, article, html} = dom

const converter = new showdown.Converter()
const md2html = (src, plain) => plain ? converter.makeHtml(src) : html(converter.makeHtml(src))

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
    selectPreviousLine(el, line = el.activeLine, sel) {
      if (!line || !line.previousElementSibling) return
      if (!sel) sel = selection(line)
      else if (sel.end !== 0) return
      el.lastActive = line
      el.activeLine = $(el.lastActive.previousElementSibling)
      const len = el.activeLine.textContent.length
      if (len === 0 || len < sel.start) sel.end = sel.start = len
      selection(el.activeLine, sel)
      el.activeLine.focus()
    },
    selectNextLine(el, line = el.activeLine, sel) {
      if (!line || !line.nextElementSibling) return
      if (!sel) sel = selection(line)
      else if (sel.start !== line.textContent.length) return
      el.lastActive = line
      el.activeLine = $(el.lastActive.nextElementSibling)
      const len = el.activeLine.textContent.length
      if (len === 0 || len < sel.end) sel.end = sel.start = len
      selection(el.activeLine, sel)
      el.activeLine.focus()
    }
  },
  create(el) {
    const editor = el
    el.E = emitter()
    el.pad = section.pad({
      $: el,
      contentEditable: navigator.userAgent.includes('Chrome') ? 'plaintext-only' : true,
      onkeydown(e) {
        console.log(e)
        const Enter = e.key === 'Enter'
        if (
          Enter || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
          (e.key === 'Backspace' && !line.textContent.length)
        ) {
          e.preventDefault()
          e.stopPropagation()
        }
        if (Enter && editor.activeLine && editor.activeLine.nextElementSibling) {
          return el.selectNextLine()
        }

        editor.E.emit.input(e, editor.activeLine, Enter)
      }
    })
    el.line = lineMaker(el)
    el.lines = new Set()

    el.E.on.input((e, line = el.activeLine, newline) => {
      if (!line) return
      if (newline) {
        el.lastActive = el.activeLine
        el.activeLine = el.line()
        el.activeLine.focus()
        return
      }
      if (e.key === 'ArrowUp') return el.selectPreviousLine(line)
      else if (e.key === 'ArrowDown') return el.selectNextLine(line)
      else if (e.key === 'ArrowLeft' && line.previousElementSibling) {
        const len = line.previousElementSibling.textContent.length
        const sel = selection(line)
        if (sel.end === sel.start && sel.end === 0) {
          return el.selectPreviousLine(line, {start: len, end: len})
        }
      } else if (e.key === 'ArrowRight' && line.nextElementSibling) {
        const curlen = line.textContent.length
        const sel = selection(line)
        if (sel.end === sel.start && sel.end === curlen) {
          return el.selectNextLine(line, {start: 0, end: 0})
        }
      } else if (e.key === 'Backspace' && !line.textContent.length) {
        if (line.previousElementSibling) {
          el.activeLine = $(line.previousElementSibling)
          line.remove()
          const allen = el.activeLine.textContent.length
          if (allen) {
            selection(el.activeLine(), {start: allen, end: allen})
          }
        }
      }
      el.activeLine.focus()
    })

    el.activeLine = el.line('add some text')
    el.line('add some more text')

    rilti.run(() => el.activeLine.focus())
  }
})

const lineMaker = editor => (content = '') => div.line({
  $: editor.pad,
  onkeydown(e, line) {
    console.log(e)
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
    }
  },
  cycle: {mount: line => line.focus()}
}, line => {
  editor.lines.add(line)
  return content
})

const selection = (editable, sel) => {
  if (editable instanceof Function) editable = editable()

  if (sel == null) {
    const range = window.getSelection().getRangeAt(0)
    let preSelectionRange = range.cloneRange()
    preSelectionRange.selectNodeContents(editable)
    preSelectionRange.setEnd(range.startContainer, range.startOffset)
    const start = preSelectionRange.toString().length
    return {start, end: start + range.toString().length}
  }
  const {start, end} = sel

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


function setCaretPosition(editable, pos) {
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