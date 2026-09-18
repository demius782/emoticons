import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sourcePage = 'https://blog.ybyq.wang/archives/1846.html'
const sourceManifest = 'https://static.blog.ybyq.wang/usr/themes/handsome/usr/OwO.json'
const sourceAssetPrefix =
  'https://static.blog.ybyq.wang/usr/themes/handsome/assets/img/emotion/'
const targetAssetDir = path.join(root, 'assets', 'ybyq')
const targetManifest = path.join(root, 'manifests', 'artalk', 'packs', 'demius.json')
const cdnAssetPrefix = 'https://cdn.jsdelivr.net/gh/demius782/emoticons@main/assets/ybyq/'
const selectedGroups = [
  { name: '颜文字' },
  // 源站以 .png 路径提供，但文件内容实际为 GIF89a 动图。
  { name: '哔哩哔哩', assetDirectory: 'bilibili', outputExtension: 'gif' },
  { name: '阿鲁', assetDirectory: 'aru', outputExtension: 'png' },
]

const response = await fetch(sourceManifest, {
  headers: {
    Referer: sourcePage,
    'User-Agent': 'demius782/emoticons importer',
  },
})
if (!response.ok) throw new Error(`表情清单下载失败：HTTP ${response.status}`)

const owo = await response.json()
const downloads = []
const artalkGroups = []

for (const selectedGroup of selectedGroups) {
  const groupName = selectedGroup.name
  const group = owo[groupName]
  if (!group || !Array.isArray(group.container)) throw new Error(`找不到 OwO 分组：${groupName}`)

  if (group.type === 'emoticon') {
    artalkGroups.push({
      name: groupName,
      type: 'emoticon',
      items: group.container.map((item) => ({
        key: item.text,
        val: item.icon,
      })),
    })
    continue
  }

  if (group.type !== 'image') throw new Error(`不支持的 OwO 分组类型：${groupName}/${group.type}`)
  if (group.name !== selectedGroup.assetDirectory) {
    throw new Error(`${groupName} 的素材目录发生变化：${group.name}`)
  }

  const items = group.container.map((item) => {
    if (!/^[a-z0-9_-]+$/i.test(item.icon)) {
      throw new Error(`${groupName}/${item.text} 的素材文件名不安全：${item.icon}`)
    }

    const sourceRelativePath = `${group.name}/${item.icon}.png`
    const targetRelativePath = `${group.name}/${item.icon}.${selectedGroup.outputExtension}`
    downloads.push({
      sourceUrl: new URL(sourceRelativePath, sourceAssetPrefix).href,
      localPath: path.join(targetAssetDir, targetRelativePath),
      expectedFormat: selectedGroup.outputExtension,
    })

    return {
      key: `${groupName}-${item.text}`,
      val: cdnAssetPrefix + targetRelativePath,
    }
  })

  artalkGroups.push({ name: groupName, type: 'image', items })
}

function hasExpectedSignature(bytes, format) {
  if (format === 'png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    )
  }
  if (format === 'gif') {
    return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))
  }
  return false
}

async function download({ sourceUrl, localPath, expectedFormat }) {
  const assetResponse = await fetch(sourceUrl, {
    headers: {
      Referer: sourcePage,
      'User-Agent': 'demius782/emoticons importer',
    },
  })
  if (!assetResponse.ok) throw new Error(`${sourceUrl} 下载失败：HTTP ${assetResponse.status}`)

  const bytes = Buffer.from(await assetResponse.arrayBuffer())
  if (!bytes.length) throw new Error(`${sourceUrl} 返回了空文件`)
  if (!hasExpectedSignature(bytes, expectedFormat)) {
    throw new Error(`${sourceUrl} 的文件内容不是预期的 ${expectedFormat.toUpperCase()} 格式`)
  }

  await fs.mkdir(path.dirname(localPath), { recursive: true })
  try {
    const existing = await fs.readFile(localPath)
    const digest = (value) => createHash('sha256').update(value).digest('hex')
    if (digest(existing) !== digest(bytes)) {
      throw new Error(`已有素材内容发生变化，拒绝覆盖：${path.relative(root, localPath)}`)
    }
    return 'unchanged'
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  await fs.writeFile(localPath, bytes)
  return 'downloaded'
}

let nextIndex = 0
let downloaded = 0
let unchanged = 0
const workers = Array.from({ length: 8 }, async () => {
  while (nextIndex < downloads.length) {
    const item = downloads[nextIndex++]
    const result = await download(item)
    if (result === 'downloaded') downloaded += 1
    else unchanged += 1
  }
})
await Promise.all(workers)

await fs.writeFile(targetManifest, `${JSON.stringify(artalkGroups, null, 2)}\n`, 'utf8')

const itemCount = artalkGroups.reduce((total, group) => total + group.items.length, 0)
console.log(
  `导入完成：${artalkGroups.length} 组、${itemCount} 个表情；图片新增 ${downloaded}，未变化 ${unchanged}。`,
)
console.log(`Artalk 清单：${path.relative(root, targetManifest)}`)
