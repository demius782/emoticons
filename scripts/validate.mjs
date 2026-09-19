import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(import.meta.dirname, '..')
const errors = []

const fail = (file, message) => errors.push(`${path.relative(root, file)}: ${message}`)

function getOwnRepositoryPath(url) {
  const prefixes = [
    'https://raw.githubusercontent.com/demius782/emoticons/main/',
    'https://cdn.jsdelivr.net/gh/demius782/emoticons@main/',
  ]
  const prefix = prefixes.find((candidate) => url.startsWith(candidate))
  if (!prefix) return null

  const relativePath = decodeURIComponent(url.slice(prefix.length).split(/[?#]/, 1)[0])
  const resolved = path.resolve(root, relativePath)
  return resolved.startsWith(root + path.sep) ? resolved : null
}

async function validateOwnRepositoryUrl(file, url, location) {
  const localFile = getOwnRepositoryPath(url)
  if (!localFile) return

  try {
    await fs.access(localFile)
  } catch {
    fail(file, `${location} 引用了仓库中不存在的文件：${path.relative(root, localFile)}`)
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    fail(file, `JSON 无法解析：${error.message}`)
    return null
  }
}

async function walk(dir) {
  const result = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ['.git', 'node_modules'].includes(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) result.push(...(await walk(fullPath)))
    else result.push(fullPath)
  }
  return result
}

const allFiles = await walk(root)
const jsonFiles = allFiles.filter(
  (file) => file.endsWith('.json') && !file.includes(`${path.sep}node_modules${path.sep}`),
)

await Promise.all(jsonFiles.map(readJson))

const catalogFile = path.join(root, 'catalog.json')
const catalog = await readJson(catalogFile)
if (catalog) {
  if (catalog.schemaVersion !== 1) fail(catalogFile, 'schemaVersion 必须是 1')
  if (!Array.isArray(catalog.collections)) {
    fail(catalogFile, 'collections 必须是数组')
  } else {
    const ids = new Set()
    for (const collection of catalog.collections) {
      if (!collection?.id) fail(catalogFile, 'collection 缺少 id')
      else if (ids.has(collection.id)) fail(catalogFile, `collection id 重复：${collection.id}`)
      else ids.add(collection.id)

      if (!collection?.manifest) {
        fail(catalogFile, `collection ${collection?.id ?? '<unknown>'} 缺少 manifest`)
      } else {
        const manifestFile = path.join(root, collection.manifest)
        try {
          await fs.access(manifestFile)
        } catch {
          fail(catalogFile, `manifest 不存在：${collection.manifest}`)
        }
      }
    }
  }
}

const artalkPackDir = path.join(root, 'manifests', 'artalk', 'packs')
const artalkPackFiles = (await walk(artalkPackDir)).filter((file) => file.endsWith('.json'))
const usedKeys = new Map()
const allowedTypes = new Set(['image', 'emoji', 'emoticon'])

for (const file of artalkPackFiles) {
  const groups = await readJson(file)
  if (!Array.isArray(groups)) {
    fail(file, 'Artalk 清单根节点必须是数组')
    continue
  }

  for (const [groupIndex, group] of groups.entries()) {
    const location = `第 ${groupIndex + 1} 组`
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      fail(file, `${location} 必须是对象`)
      continue
    }
    if (typeof group.name !== 'string' || !group.name.trim()) fail(file, `${location} 缺少 name`)
    if (!allowedTypes.has(group.type)) fail(file, `${location} 的 type 无效：${group.type}`)
    if (!Array.isArray(group.items)) {
      fail(file, `${location} 的 items 必须是数组`)
      continue
    }

    for (const [itemIndex, item] of group.items.entries()) {
      const itemLocation = `${location}第 ${itemIndex + 1} 项`
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        fail(file, `${itemLocation} 必须是对象`)
        continue
      }
      if (typeof item.val !== 'string' || !item.val) fail(file, `${itemLocation} 缺少 val`)

      if (group.type === 'image') {
        if (typeof item.key !== 'string' || !item.key.trim()) {
          fail(file, `${itemLocation} 的图片表情必须有非空 key`)
        } else if (usedKeys.has(item.key)) {
          fail(file, `${itemLocation} 的 key “${item.key}” 已在 ${usedKeys.get(item.key)} 中使用`)
        } else {
          usedKeys.set(item.key, path.relative(root, file))
        }

        if (typeof item.val === 'string' && !item.val.startsWith('https://')) {
          fail(file, `${itemLocation} 的图片地址必须是完整 HTTPS URL`)
        } else if (typeof item.val === 'string') {
          await validateOwnRepositoryUrl(file, item.val, itemLocation)
        }
      }
    }
  }
}

const artalkIndexFile = path.join(root, 'manifests', 'artalk', 'index.json')
const artalkIndex = await readJson(artalkIndexFile)
if (!Array.isArray(artalkIndex)) {
  fail(artalkIndexFile, 'Artalk 入口必须是数组')
} else {
  for (const entry of artalkIndex) {
    if (typeof entry !== 'string' || !entry.startsWith('https://')) {
      fail(artalkIndexFile, '嵌套清单必须使用完整 HTTPS URL')
    } else {
      await validateOwnRepositoryUrl(artalkIndexFile, entry, 'Artalk 嵌套清单')
    }
  }
}

if (errors.length) {
  console.error(`校验失败（${errors.length} 项）：`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`校验通过：${jsonFiles.length} 个 JSON 文件，${artalkPackFiles.length} 个 Artalk 本地清单。`)
