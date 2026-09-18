# Artalk 清单

`index.json` 是 Artalk 的固定入口，`packs/` 中每个 JSON 保存一套或一组独立表情。

Artalk 图片表情格式：

```json
[
  {
    "name": "示例",
    "type": "image",
    "items": [
      {
        "key": "示例-开心",
        "val": "https://cdn.example.com/happy.webp"
      }
    ]
  }
]
```

支持的组类型：

- `image`：点击后插入 `:[key]`，渲染时根据当前清单替换为图片。
- `emoji`：直接插入 Unicode Emoji。
- `emoticon`：直接插入文本表情。

因为图片表情的历史评论依赖 `key`，务必保持其唯一且永久稳定。

