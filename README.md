# Emoticons

个人表情资源与多程序清单仓库。图片资源只保存一份，不同系统使用彼此独立的 JSON 清单，避免修改 Artalk 配置时影响其他程序。

## 目录

```text
assets/                         表情图片原文件
  <pack-id>/                    每套表情一个目录
manifests/
  artalk/
    index.json                  Artalk 的稳定入口
    packs/demius.json           当前使用的 Artalk 表情包
  generic/
    index.json                  供未来程序转换或读取的通用索引
templates/                      新建清单时复制的模板
scripts/validate.mjs            本地和 CI 共用的检查脚本
catalog.json                    仓库内所有入口的目录
ATTRIBUTIONS.md                 素材来源和授权记录
```

## Artalk 使用地址

开发/自动更新入口：

```text
https://raw.githubusercontent.com/demius782/emoticons/main/manifests/artalk/index.json
```

Artalk 配置：

```yaml
frontend:
  emoticons: https://raw.githubusercontent.com/demius782/emoticons/main/manifests/artalk/index.json
```

`manifests/artalk/index.json` 是唯一需要填入 Artalk 的地址，当前仅加载 `manifests/artalk/packs/demius.json`。

当前收录：

| 清单 | 用途 | 分组/数量 |
|---|---|---|
| `packs/demius.json` | 从 Xuan's blog 评论区选择并转换为 Artalk 格式 | 3 组 / 110 个 |

## 添加一套 Artalk 表情

1. 在 `assets/<pack-id>/` 放入经过授权的 WebP、PNG、GIF 或 SVG 文件。
2. 复制 `templates/artalk-pack.json` 到 `manifests/artalk/packs/<pack-id>.json`。
3. 图片 URL 使用完整 CDN 地址，例如：

   ```text
   https://cdn.jsdelivr.net/gh/demius782/emoticons@main/assets/<pack-id>/happy.webp
   ```

4. 把新清单的完整 CDN 地址加入 `manifests/artalk/index.json`。
5. 在提交前运行 `npm test`。

## 维护约定

- 每个 Artalk 图片表情的 `key` 在所有 Artalk 清单中必须唯一，而且发布后不重命名、不复用。
- 删除已使用的 `key` 会让历史评论显示原始的 `:[key]` 文本；停用表情时保留旧条目和图片。
- 图片文件发布后不要原地替换。内容变化时使用新文件名，推荐加入短哈希或版本号。
- JSON 内使用绝对 URL。Artalk 不会以 JSON 文件所在目录为基准解析相对图片地址。
- 动态 JSON 清单使用 `raw.githubusercontent.com` 的 `main` 分支，避免 jsDelivr 对已更新分支内容长时间缓存；图片等稳定静态文件仍使用 jsDelivr。需要不可变版本时创建 Git tag。
- 新增外部素材时同步更新 `ATTRIBUTIONS.md`，记录来源、作者和许可证。
- 不同程序的清单放在 `manifests/<target>/`，不要让某个程序专用字段进入其他清单。

## 更新采集来源包

```shell
npm run import:ybyq
npm test
```

导入脚本会重新读取源站清单、下载新增素材并生成 Artalk 清单。对于仓库内已经存在但源站内容发生变化的同名文件，脚本会停止并拒绝覆盖，以保护历史评论的显示结果。

## 通用清单

`manifests/generic/index.json` 是本仓库自己的中立格式，用于尚未确定目标系统的表情。等某个程序确定后，可以从通用清单生成或手工维护对应的专用 JSON。

字段说明：

- `id`：稳定、唯一、适合程序读取的标识。
- `label`：显示名称。
- `kind`：`image`、`unicode` 或 `text`。
- `value`：完整图片 URL、Unicode 字符或文本表情。
- `tags`：可选的搜索标签数组。
