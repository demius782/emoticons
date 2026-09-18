import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sourcePage = 'https://blog.xrbk.cn/message/'
const sourceManifest = 'https://blog.xrbk.cn/plugins/owo/twikoo.json'
const sourceAssetPrefix = 'https://blog.xrbk.cn/plugins/owo/'
const targetAssetDir = path.join(root, 'assets', 'xrbk')
const targetManifest = path.join(root, 'manifests', 'artalk', 'packs', 'xrbk.json')
const cdnAssetPrefix = 'https://cdn.jsdelivr.net/gh/demius782/emoticons@main/assets/xrbk/'

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

for (const [name, group] of Object.entries(owo)) {
  if (group?.type !== 'image' || !Array.isArray(group.container)) {
    throw new Error(`不支持的 OwO 分组：${name}`)
  }

  const items = group.container.map((item) => {
    const match = /<img\s+[^>]*src=["']([^"']+)["']/i.exec(item.icon)
    if (!match) throw new Error(`${name}/${item.text} 没有可识别的图片地址`)

    const sourceUrl = new URL(match[1], sourceManifest)
    if (!sourceUrl.href.startsWith(sourceAssetPrefix)) {
      throw new Error(`${name}/${item.text} 的图片不在允许的源目录：${sourceUrl.href}`)
    }

    const relativePath = decodeURIComponent(sourceUrl.href.slice(sourceAssetPrefix.length))
    const pathSegments = relativePath.split('/').filter(Boolean)
    if (!pathSegments.length || pathSegments.some((segment) => segment === '..')) {
      throw new Error(`非法素材路径：${relativePath}`)
    }

    const localPath = path.join(targetAssetDir, ...pathSegments)
    const cdnUrl = cdnAssetPrefix + pathSegments.map(encodeURIComponent).join('/')
    downloads.push({ sourceUrl: sourceUrl.href, localPath })

    return {
      key: item.text,
      val: cdnUrl,
    }
  })

  artalkGroups.push({ name, type: 'image', items })
}

async function download({ sourceUrl, localPath }) {
  const assetResponse = await fetch(sourceUrl, {
    headers: {
      Referer: sourcePage,
      'User-Agent': 'demius782/emoticons importer',
    },
  })
  if (!assetResponse.ok) throw new Error(`${sourceUrl} 下载失败：HTTP ${assetResponse.status}`)

  const bytes = Buffer.from(await assetResponse.arrayBuffer())
  if (!bytes.length) throw new Error(`${sourceUrl} 返回了空文件`)

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

console.log(
  `导入完成：${artalkGroups.length} 组、${downloads.length} 个表情；新增 ${downloaded}，未变化 ${unchanged}。`,
)
console.log(`Artalk 清单：${path.relative(root, targetManifest)}`)
