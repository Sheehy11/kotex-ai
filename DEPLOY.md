# A³ 品牌内容工具部署

## 0. 部署前本地验收

直接打开 `index.html`，输入网页访问密码后，点击右上角“GPT-5.6 Terra · 配置验收”。填写管理员自己的 A3 Key 并保存，即可在 `file://` 页面真实调用 GPT-5.6 Terra，验证爆文拆解、文案生成、审核和回流流程。

本地验收 Key 只写入这台电脑当前浏览器的 `localStorage`，首次保存后无需重复填写；不会写入 HTML、部署包或正式分享页面。可在本地 AI 验收设置中随时点击“清除本机 Key”。正式用户仍不需要填写 Key。

## 1. 部署 Worker

将 `wrangler.toml.example` 复制为 `wrangler.toml`，把 `ALLOWED_ORIGINS` 改成最终网页 HTTPS 域名。正式环境保持 `ALLOW_LOCAL_FILE = "false"`。

```bash
npx wrangler secret put A3_API_KEY
npx wrangler secret put ACCESS_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```

- `A3_API_KEY`：你的 A3 Key。
- `ACCESS_PASSWORD`：分享给内部使用者的网页访问密码。
- `SESSION_SECRET`：随机长字符串，建议至少 32 字节。

Key 与密码只保存在 Cloudflare Secret 中，不在 HTML、浏览器存储或请求正文里。登录成功后浏览器只保存 8 小时签名会话令牌。

## 2. 配置网页

`index.html` 的 `a3-service-url` 已预设为：

`https://a3-brand-content-api.qusiyu0311.workers.dev`

如果实际 Worker 地址不同，只修改 HTML 顶部这一项。本仓库的正式网页由 GitHub Pages 发布：

`https://sheehy11.github.io/a3-brand-tools/`

Worker 的 `ALLOWED_ORIGINS` 应填写网页来源 `https://sheehy11.github.io`（来源不包含仓库路径）。

## 3. 上线检查

1. 打开 HTTPS 网页，输入 `ACCESS_PASSWORD`。
2. 点击右上角“GPT-5.6 Terra · 共享服务”，检测服务。
3. 依次测试爆文拆解、文案生成、文案审核与数据回流。
4. 在好奇中分别测试“素人AO文”和“舆情文”，确认历史记录互不串用。

生产环境建议在 Cloudflare 控制台为 `/api/session` 和 `/api/chat` 增加 Rate Limiting 规则，并开启日志/用量告警。
