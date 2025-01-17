export const extractNameFromKey = (key: string): string => {
  if (!key) return
  const keyPath = key.split('/')

  return keyPath[keyPath.length - 1]
}

export const extractParentFromKey = (key: string):string => {
  if (!key) return
  const keyPath = key.split('/')
  keyPath.pop()

  return keyPath.join('/')
}

export const checkSpecialChars = (name: string) => {
  return name.match(/[:*?"<>\\'|]/) != null
}

export const checkSlash = (name: string) => {
  return name.match(/\//) != null
}

export const createNonClashingNameAsync = async (name: string, fileManager, prefix = '') => {
  if (!name) name = 'Undefined'
  let _counter
  let ext = 'sol'
  const reg = /(.*)\.([^.]+)/g
  const split = reg.exec(name)
  if (split) {
    name = split[1]
    ext = split[2]
  }
  let exist = true

  do {
    const isDuplicate = await fileManager.exists(name + _counter + prefix + '.' + ext)

    if (isDuplicate) _counter = (_counter | 0) + 1
    else exist = false
  } while (exist)
  const counter = _counter || ''

  return name + counter + prefix + '.' + ext
}

export const joinPath = (...paths) => {
  paths = paths.filter((value) => value !== '').map((path) => path.replace(/^\/|\/$/g, '')) // remove first and last slash)
  if (paths.length === 1) return paths[0]
  return paths.join('/')
}

export const getPathIcon = (path: string) => {
  return path.endsWith('.txt')
    ? 'far fa-file-alt' : path.endsWith('.md')
      ? 'far fa-file-alt' : path.endsWith('.sol')
        ? 'fak fa-solidity-mono' : path.endsWith('.js')
          ? 'fab fa-js' : path.endsWith('.json')
            ? 'fas fa-brackets-curly' : path.endsWith('.vy')
              ? 'fak fa-vyper-mono' : path.endsWith('.lex')
                ? 'fak fa-lexon' : path.endsWith('.contract')
                  ? 'fab fa-ethereum' : 'far fa-file'
}
