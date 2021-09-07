import { compile } from '@remix-project/remix-solidity'
import { CompileTabLogic, parseContracts } from '@remix-ui/solidity-compiler' // eslint-disable-line
import { ConfigurationSettings } from '@remix-project/remix-lib-ts'

export const CompilerApiMixin = (Base) => class extends Base {
  currentFile: string
  contractMap: {
    file: string
  } | Record<string, any>
  compileErrors: any
  compileTabLogic: CompileTabLogic
  contractsDetails: Record<string, any>

  configurationSettings: ConfigurationSettings

  onCurrentFileChanged: (fileName: string) => void
  onResetResults: () => void
  onSetWorkspace: (workspace: any) => void
  onNoFileSelected: () => void
  onCompilationFinished: (contractsDetails: any, contractMap: any) => void
  onSessionSwitched: () => void
  onContentChanged: () => void

  initCompilerApi () {
    this.configurationSettings = null

    this._view = {
      warnCompilationSlow: null,
      errorContainer: null,
      contractEl: null
    }
    
    this.contractsDetails = {}
    this.data = {
      eventHandlers: {},
      loading: false
    }

    this.contractMap = {}
    this.contractsDetails = {}

    this.compileErrors = {}
    this.compiledFileName = ''
    this.currentFile = ''
  }

  onActivation () {
    this.listenToEvents()    
  }

  onDeactivation () {}

  resolveContentAndSave (url) {
    return this.call('contentImport', 'resolveAndSave', url)
  }

  compileWithHardhat (configFile) {
    return this.call('hardhat', 'compile', configFile)
  }

  logToTerminal (content) {
    return this.call('terminal', 'log', content)
  }
  
  getCompilationResult () {
    return this.compileTabLogic.compiler.state.lastCompilationResult
  }

  getCompilerState () {
    return this.compileTabLogic.getCompilerState()
  }

  /**
   * compile using @arg fileName.
   * The module UI will be updated accordingly to the new compilation result.
   * This function is used by remix-plugin compiler API.
   * @param {string} fileName to compile
   */
  compile (fileName) {
    return this.compileTabLogic.compileFile(fileName)
  }

  compileFile (event) {
    if (event.path.length > 0) {
      this.compileTabLogic.compileFile(event.path[0])
    }
  }

  /**
   * compile using @arg compilationTargets and @arg settings
   * The module UI will *not* be updated, the compilation result is returned
   * This function is used by remix-plugin compiler API.
   * @param {object} map of source files.
   * @param {object} settings {evmVersion, optimize, runs, version, language}
   */
  async compileWithParameters (compilationTargets, settings) {
    const compilerState = this.getCompilerState()
    settings.version = settings.version || compilerState.currentVersion
    const res = await compile(compilationTargets, settings, (url, cb) => this.call('contentImport', 'resolveAndSave', url).then((result) => cb(null, result)).catch((error) => cb(error.message)))
    return res
  }

  // This function is used for passing the compiler configuration to 'remix-tests'
  getCurrentCompilerConfig () {
    const compilerState = this.getCompilerState()
    return {
      currentVersion: compilerState.currentVersion,
      evmVersion: compilerState.evmVersion,
      optimize: compilerState.optimize,
      runs: compilerState.runs
    }
  }

  /**
   * set the compiler configuration
   * This function is used by remix-plugin compiler API.
   * @param {object} settings {evmVersion, optimize, runs, version, language}
   */
  setCompilerConfig (settings) {
    this.configurationSettings = settings    
  }  

  getFileManagerMode () {
    return 'browser'
  }

  fileExists (fileName) {
    return this.call('fileManager', 'exists', fileName)
  }

  writeFile (fileName, content) {
    return this.call('fileManager', 'writeFile', fileName, content)
  }

  readFile (fileName) {
    return this.call('fileManager', 'readFile', fileName)
  }

  open (fileName) {
    return this.call('fileManager', 'open', fileName)
  }

  resetResults () {
    this.currentFile = ''
    this.contractsDetails = {}
    this.emit('statusChanged', { key: 'none' })
    if (this.onResetResults) this.onResetResults()
  }

  listenToEvents () {
    this.on('editor', 'contentChanged', () => {
      this.emit('statusChanged', { key: 'edited', title: 'the content has changed, needs recompilation', type: 'info' })
      if (this.onContentChanged) this.onContentChanged()
    })

    this.data.eventHandlers.onLoadingCompiler = () => {
      this.data.loading = true
      this.emit('statusChanged', { key: 'loading', title: 'loading compiler...', type: 'info' })
    }
    this.compiler.event.register('loadingCompiler', this.data.eventHandlers.onLoadingCompiler)

    this.data.eventHandlers.onCompilerLoaded = () => {
      this.data.loading = false
      this.emit('statusChanged', { key: 'none' })
    }
    this.compiler.event.register('compilerLoaded', this.data.eventHandlers.onCompilerLoaded)

    this.data.eventHandlers.onStartingCompilation = () => {
      this.emit('statusChanged', { key: 'loading', title: 'compiling...', type: 'info' })
    }

    this.data.eventHandlers.onRemoveAnnotations = () => {
      this.call('editor', 'clearAnnotations')
    }

    this.on('filePanel', 'setWorkspace', (workspace) => {
      this.resetResults()
      if (this.onSetWorkspace) this.onSetWorkspace(workspace.isLocalhost)
    })

    this.on('remixd', 'rootFolderChanged', () => {
      this.resetResults()
      if (this.onSetWorkspace) this.onSetWorkspace(true)
    })

    this.on('editor', 'sessionSwitched', () => {
      if (this.onSessionSwitched) this.onSessionSwitched()
    })    

    this.compileTabLogic.event.on('startingCompilation', this.data.eventHandlers.onStartingCompilation)
    this.compileTabLogic.event.on('removeAnnotations', this.data.eventHandlers.onRemoveAnnotations)

    this.data.eventHandlers.onCurrentFileChanged = (name) => {
      this.currentFile = name
      if (this.onCurrentFileChanged) this.onCurrentFileChanged(name)
    }
    this.on('fileManager', 'currentFileChanged', this.data.eventHandlers.onCurrentFileChanged)
    
    this.data.eventHandlers.onNoFileSelected = () => {
      this.currentFile = ''
      if (this.onNoFileSelected) this.onNoFileSelected()
    }
    this.on('fileManager', 'noFileSelected', this.data.eventHandlers.onNoFileSelected)
    
    this.data.eventHandlers.onCompilationFinished = (success, data, source) => {
      this.compileErrors = data
      if (success) {
        // forwarding the event to the appManager infra
        this.emit('compilationFinished', source.target, source, 'soljson', data)
        if (data.errors && data.errors.length > 0) {
          this.emit('statusChanged', {
            key: data.errors.length,
            title: `compilation finished successful with warning${data.errors.length > 1 ? 's' : ''}`,
            type: 'warning'
          })
        } else this.emit('statusChanged', { key: 'succeed', title: 'compilation successful', type: 'success' })
        // Store the contracts
        this.contractsDetails = {}
        this.compiler.visitContracts((contract) => {
          this.contractsDetails[contract.name] = parseContracts(
            contract.name,
            contract.object,
            this.compiler.getSource(contract.file)
          )
        })
      } else {
        const count = (data.errors ? data.errors.filter(error => error.severity === 'error').length : 0) + data.error ? 1 : 0
        this.emit('statusChanged', { key: count, title: `compilation failed with ${count} error${count > 1 ? 's' : ''}`, type: 'error' })
      }
      // Update contract Selection
      this.contractMap = {}
      if (success) this.compiler.visitContracts((contract) => { this.contractMap[contract.name] = contract })
      if (this.onCompilationFinished) this.onCompilationFinished(this.contractsDetails, this.contractMap)
    }
    this.compiler.event.register('compilationFinished', this.data.eventHandlers.onCompilationFinished)

    this.data.eventHandlers.onThemeChanged = (theme) => {
      const invert = theme.quality === 'dark' ? 1 : 0
      const img = document.getElementById('swarmLogo')
      if (img) {
        img.style.filter = `invert(${invert})`
      }
    }
    this.on('themeModule', 'themeChanged', this.data.eventHandlers.onThemeChanged)
    
    // Run the compiler instead of trying to save the website
    window.document.addEventListener('keydown', (e) => {
      // ctrl+s or command+s
      if ((e.metaKey || e.ctrlKey) && e.keyCode === 83) {
        e.preventDefault()
        this.compileTabLogic.runCompiler(this.getAppParameter('hardhat-compilation'))
      }
    })
  }
}