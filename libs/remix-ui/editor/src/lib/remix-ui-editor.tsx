import React, { useState, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'

import './remix-ui-editor.css'

type cursorPosition = {
  startLineNumber: number,
  startColumn: number,
  endLineNumber: number,
  endColumn: number
}

type sourceAnnotation = {
  row: number,
  column: number,
  text: string,
  type: 'error' | 'warning' | 'info'
  hide: boolean
  from: string // plugin name
}

type sourceMarker = {
  position: {
    start: {
      line: number
      column: number
    },
    end: {
      line: number
      column: number
    }
  },
  from: string // plugin name
  hide: boolean
}

type sourceAnnotationMap = {
  [key: string]: [sourceAnnotation];
}

type sourceMarkerMap = {
  [key: string]: [sourceMarker];
}

/* eslint-disable-next-line */
export interface EditorUIProps {
  theme: string
  currentFile: string
  sourceAnnotationsPerFile: sourceAnnotationMap
  markerPerFile: sourceMarkerMap
  onBreakPointAdded: (file: string, line: number) => void
  onBreakPointCleared: (file: string, line: number) => void
  onDidChangeContent: (file: string) => void
  editorAPI:{
    findMatches: (uri: string, value: string) => any
    addModel: (value: string, language: string, uri: string, readOnly: boolean) => void
    disposeModel: (uri: string) => void,

    getValue: (uri: string) => string
    getCursorPosition: () => cursorPosition
    revealLine: (line: number, column: number) => void
    focus: () => void
    setWordWrap: (wrap: boolean) => void
    setValue: (uri: string, value: string) => void
  }
}

export const EditorUI = (props: EditorUIProps) => {
  const [models, setModels] = useState({})
  const [, setCurrentBreakpoints] = useState({})
  const [currentAnnotations, setCurrentAnnotations] = useState({})
  const [currentMarkers, setCurrentMarkers] = useState({})
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const currentFileRef = useRef('')

  useEffect(() => {
    if (!monacoRef.current) return
    monacoRef.current.editor.setTheme(props.theme)
  }, [props.theme])

  const setAnnotationsbyFile = (file) => {
    if (props.sourceAnnotationsPerFile[file]) {
      const model = editorRef.current.getModel(monacoRef.current.Uri.parse(file))
      const newAnnotations = []
      for (const annotation of props.sourceAnnotationsPerFile[file]) {
        if (!annotation.hide) {
          newAnnotations.push({
            range: new monacoRef.current.Range(annotation.row, 1, annotation.row, 1),
            options: {
              isWholeLine: false,
              glyphMarginHoverMessage: annotation.text,
              glyphMarginClassName: 'fal fa-exclamation-square text-danger'
            }
          })
        }
      }
      setCurrentAnnotations(prevState => {
        prevState[file] = model.deltaDecorations(currentAnnotations[file] || [], newAnnotations)
        return prevState
      })
    }
  }

  const setMarkerbyFile = (file) => {
    if (props.markerPerFile[file]) {
      const model = editorRef.current.getModel(monacoRef.current.Uri.parse(file))
      const newMarkers = []
      for (const marker of props.markerPerFile[file]) {
        if (!marker.hide) {
          newMarkers.push({
            range: new monacoRef.current.Range(marker.position.start.line, marker.position.start.column, marker.position.end.line, marker.position.end.column),
            options: {
              isWholeLine: false,
              inlineClassName: 'text-warning'
            }
          })
        }
      }
      setCurrentMarkers(prevState => {
        prevState[file] = model.deltaDecorations(currentMarkers[file] || [], newMarkers)
        return prevState
      })
    }
  }

  useEffect(() => {
    if (!editorRef.current) return
    currentFileRef.current = props.currentFile
    editorRef.current.updateOptions({ readOnly: models[props.currentFile].readOnly })
    setAnnotationsbyFile(props.currentFile)
    setMarkerbyFile(props.currentFile)
  }, [props.currentFile])

  useEffect(() => {
    setAnnotationsbyFile(props.currentFile)
  }, [JSON.stringify(props.sourceAnnotationsPerFile)])

  useEffect(() => {
    setMarkerbyFile(props.currentFile)
  }, [JSON.stringify(props.markerPerFile)])

  props.editorAPI.findMatches = (uri: string, value: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) return model.findMatches(value)
  }

  props.editorAPI.addModel = (value: string, language: string, uri: string, readOnly: boolean) => {
    console.log('adding model', uri)
    const model = monacoRef.current.editor.createModel(value, language, monacoRef.current.Uri.parse(uri))
    model.onDidChangeContent(() => props.onDidChangeContent(uri))
    setModels(prevState => {
      prevState[uri] = { value, language, uri, readOnly }
      return prevState
    })
  }

  props.editorAPI.disposeModel = (uri: string) => {
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    model.dispose()
    setModels(prevState => {
      delete prevState[uri]
      return prevState
    })
  }

  props.editorAPI.getValue = (uri: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      return model.getValue()
    }
  }

  props.editorAPI.setValue = (uri: string, value: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      model.setValue(value)
    }
  }

  props.editorAPI.getCursorPosition = () => {
    if (!monacoRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(props.currentFile))
    if (model) {
      console.log(model.getOffsetAt(editorRef.current.getPosition()))
      return model.getOffsetAt(editorRef.current.getPosition())
    }
  }

  props.editorAPI.revealLine = (line: number, column: number) => {
    if (!editorRef.current) return
    editorRef.current.revealLine(line)
    editorRef.current.setPosition({ column, lineNumber: line })
  }

  props.editorAPI.focus = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
  }

  props.editorAPI.setWordWrap = (wrap: boolean) => {
    if (!editorRef.current) return
    editorRef.current.updateOptions({ wordWrap: wrap ? 'on' : 'off' })
  }

  function handleEditorDidMount (editor) {
    editorRef.current = editor
    monacoRef.current.editor.setTheme(props.theme)
    editor.onMouseUp((e) => {
      if (e && e.target && e.target.toString().startsWith('GUTTER')) {
        const currentFile = currentFileRef.current
        const model = editorRef.current.getModel(monacoRef.current.Uri.parse(currentFile))
        if (model) {
          setCurrentBreakpoints(prevState => {
            if (!prevState[currentFile]) prevState[currentFile] = {}
            const decoration = Object.keys(prevState[currentFile]).filter((line) => parseInt(line) === e.target.position.lineNumber)
            if (decoration.length) {
              props.onBreakPointCleared(currentFile, e.target.position.lineNumber)
              model.deltaDecorations([prevState[currentFile][e.target.position.lineNumber]], [])
              delete prevState[currentFile][e.target.position.lineNumber]
            } else {
              props.onBreakPointAdded(currentFile, e.target.position.lineNumber)
              const decorationIds = model.deltaDecorations([], [{
                range: new monacoRef.current.Range(e.target.position.lineNumber, 1, e.target.position.lineNumber, 1),
                options: {
                  isWholeLine: false,
                  glyphMarginClassName: 'fad fa-bug'
                }
              }])
              prevState[currentFile][e.target.position.lineNumber] = decorationIds[0]
            }
            return prevState
          })
        }
      }
    })
  }

  function handleEditorWillMount (monaco) {
    monacoRef.current = monaco
    const backgroundColor = window.getComputedStyle(document.documentElement).getPropertyValue('--light').trim()
    monaco.editor.defineTheme('remix-dark', {
      base: 'vs-dark',
      inherit: true, // can also be false to completely replace the builtin rules
      rules: [{ background: backgroundColor.replace('#', '') }],
      colors: {
        'editor.background': backgroundColor
      }
    })
  }

  let value = ''
  if (editorRef.current && props.currentFile && editorRef.current.getModel(monacoRef.current.Uri.parse(props.currentFile))) {
    value = editorRef.current.getModel(monacoRef.current.Uri.parse(props.currentFile)).getValue()
  }

  return (
    <Editor
      width="100%"
      height="100%"
      path={props.currentFile}
      language={models[props.currentFile] ? models[props.currentFile].language : 'text'}
      value={value}
      onMount={handleEditorDidMount}
      beforeMount={handleEditorWillMount}
      options= { { glyphMargin: true } }
    />
  )
}

export default EditorUI
