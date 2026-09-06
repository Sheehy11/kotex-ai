# A3 Brand Tools

最新版 AI 品牌内容工具。

- 在线页面：<https://sheehy11.github.io/a3-brand-tools/>
- AI 模型：`gpt-5.6-terra`
- 前端入口：`index.html`
- Cloudflare Worker：`worker/src/index.js`
- 完整与实际调用知识库：`knowledge/`

## 发布结构

前端由 GitHub Pages 从 `main` 分支根目录发布。AI 请求由 Cloudflare Worker 转发；正式使用者只输入网页访问密码，不接触 A3 Key。

部署细节见 [DEPLOY.md](DEPLOY.md)。
