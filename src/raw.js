const {emitter, $, run, dom} = rilti
const {div, span, article, pre, code} = dom

const editor = api => {
  const editor = emitter()
  const state = editor.state = List()
  const segments = editor.segments = List()

  const change = c => {
    state.push(c)
    editor.emit.change(c)
  }
  Object.assign(change, {
    Write: 'write',
    Delete: 'delete',
    Enter: 'enter',
    Paste: 'paste'
  })

  const write = (txt, ops) => {
    const seg = {txt, ...ops}
    segments.push(seg)
    if (api.render) api.render(segments)
    change({
      type: change.Write,
      seg
    })
  }

  return Object.assign(editor, {write})
}

const ED = $('an-editor')
ED.css('white-space', 'pre')

const TE = editor({
  render(segments) {
    ED.textContent = ''
    console.log(segments)
    for (const {value: {txt}} of segments) {
      console.log(txt)
      ED.innerHTML += txt + '</br>'
    }
  }
})

TE.write(`# This is the first line`)
TE.write(`this is the second line in this text`)