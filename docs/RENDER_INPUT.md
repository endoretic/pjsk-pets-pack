# 渲染输入

公开工具从预先转换好的 JSON 模型、PNG 贴图和采样动画开始工作。输入目录为 `build/web`，不会进入 Git 或用户主题 ZIP。

## 目录布局

```text
build/web/
  catalog.json
  source-provenance.json
  characters/<角色目录>/scene.json
  characters/<角色目录>/<贴图>.png
  animations/<片段名>.json
  props/chair.json
  props/<椅子贴图>.png
```

模型实际路径由 `catalog.json` 中的 `scene` 指定，纹理路径相对模型目录。动画序列中的片段名对应 `animations/<片段名>.json`。所有输入应为已完成转换的数据；本仓库不提供上游资源获取或转换工具。

## 数据约定

| 文件 | 渲染器读取的主要字段 |
|---|---|
| `catalog.json` | `region`、`assetVersion`、`characters`、`eyePatterns`、`mouthPatterns` |
| 人物目录项 | `id`、`characterId`、`unitId`、`model`、`displayName`、`scene`、`states` |
| `scene.json` | `nodes`、`meshes`、可选 `humanoid`，以及预览使用的 `head`、`spine` 节点索引 |
| 动画 JSON | `name`、`duration`（秒）、`fps`、`samples`、`tracks`，可选 `humanoid` 采样通道 |
| `chair.json` | `model`、`texture`、`characterAnchor`、`positions`、`uv`、`indices` |
| `source-provenance.json` | 随输入提供的来源记录，打包时原样复制到发行包；不要包含个人路径、账户或凭据 |

`nodes` 使用父节点索引 `parent`（根节点为 -1）、局部 `position`、四元数 `rotation`（x/y/z/w）、`scale` 及用于动画匹配的 `hash`。`meshes` 包含顶点 `positions`、`normals`、`uv`、四维蒙皮 `joints`/`weights`、骨骼节点索引 `bones`、列主序 `inverseBindMatrices`、`submeshes` 索引和 `materials`（`texture`、`face`）。

`states` 将动作名映射到 `sequence` 片段名数组，可附加 `eye`、`mouth`、`yaw`（弧度）和 `prop: "chair"`。普通轨道使用 `path` 匹配骨骼 hash，`attribute` 为 1/2/3 时分别表示位移/旋转/缩放，`values` 是按帧排列的向量。`samples` 与轨道数组长度应一致，渲染时在相邻采样之间插值。

表情索引由 `eyePatterns` 的 `PatternName`、`OpenEyeIndex`、`CloseEyeIndex`、`BlinkEnabled`、`TextureIndex` 及 `mouthPatterns` 的 `Name`、`OpenLipSyncIndex`、`MiddleLipSyncIndex`、`CloseLipSyncIndex` 指定。使用 Humanoid 采样的模型还需提供已经转换好的绑定参数和通道数组；播放实现见 `web/humanoid.mjs`，不读取原始模型容器。

当前主题打包器和校验器面向本包的 26 个身份、31 个模型及其动作集合，并不是通用模型导入器。字段的实际消费方式见 `web/viewer.mjs` 和 `scripts/package_clawd.py`。

## 渲染与打包

1. 将转换后的输入放入上述目录。
2. 运行 `python scripts/preview_server.py --port 8766`，打开 `http://127.0.0.1:8766/`，检查人物并导出高清帧。
3. 运行 `python scripts/package_clawd.py`，将 `build/renders` 中的帧压缩为 Clawd 主题。
4. 准备锁定宿主后运行 `npm run validate` 和 `npm test`。
5. 运行 `python scripts/build_release.py` 生成资源 ZIP 与 SHA-256。

宿主渲染器预览另需先运行 `npm run preview:prepare`，然后打开 `/app/host-preview.html`。单纯安装、校验现成主题包不需要模型输入。
