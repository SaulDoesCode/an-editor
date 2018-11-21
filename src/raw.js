const {component, emitter, $, run, dom} = rilti
const {div, span, section, article, pre, code} = dom

component('an-editor', {
  props: {
    state: () => {
      const state = emitter(List())
      return state
    }
  },
  methods: {
    newSeg(e, ops) {

    },
    removeSeg(e, ) {

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
        const {key} = e
        const Enter = key === 'Enter'
        const Backspace = key === 'Backspace'
        const ArrowUp = key === 'ArrowUp'
        const ArrowDown = key === 'ArrowDown'
        if (Enter || Backspace || ArrowUp || ArrowDown) {
          haltevt(e)

        }
      }
    })
  }
})

component('seg-ment', {
  methods: {
    select(s, start, end = start) {
      if (start == null) return selection(s)
      if (s.txt.length < end) end = s.txt.length
      selection(s, start, end)
      return s
    }
  },
  create(seg) {
    const editor = $(seg.parentElement)
    seg.on({
      click() {
        seg.focus()
        editor.active = seg
      },
      focus() {
        editor.active = seg
      }
    })
  }
})