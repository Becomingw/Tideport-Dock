# 共享申请服务（可选）

插件默认采用原有人工交付流程：在「申请单」填写、保存、复制，然后通过团队约定的私密渠道交给管理员。该功能不需要本服务、requests.json、SSH 或新账号。以下内容仅用于希望额外启用多人在线审批的部署。

实现状态：本地已实现并测试申请提交、审批、办理状态、交付记录与回读。**尚未部署到实验室服务器，也未实现自动执行 SeaweedFS 变更。** SeaweedFS Admin 的网页登录、S3 AK/SK 与本服务身份彼此独立。

DSH 的「申请中心」提供普通用户与审批管理员两种视图。管理员由服务端登记，插件设置的 `role` 不授予审批权限。普通用户仅能列出本人记录、提交申请和撤回待审批申请；管理员可查看全部记录并审批。数据保存在服务端 SQLite，跨 DSH 共享。

## 与现有 OSS Web 的关系

现有 `https://admin.example.invalid/oss/` 是 SeaweedFS Admin，不能直接填写为本服务 API。可以在同一管理服务器部署独立轻量进程，由现有 HTTPS 入口代理，例如 `/oss-requests/`。无需新服务器或另建用户网站，前端在 DSH 内。该路径只是部署建议，当前没有配置。

部署前必须核实 SSH 管理路径、反向代理位置、业务影响及运维 skill。该仓库不自带服务器凭据，不修改 SeaweedFS 服务、不开放 Master/Filer 端口。

## 运行与身份登记

服务建议使用 Node.js 24 LTS（使用内置 `node:sqlite`）；DSH 插件本身不导入 SQLite。服务只绑定本机，放在受保护的 HTTPS 反向代理后。服务目录、数据库和凭据包仅服务账户或指定用户可访问。

```sh
node service/cli.js serve --db /srv/osslab-requests/requests.db --host 127.0.0.1 --port 8767
```

数据库所在目录需预先由运维配置为服务账户可写。身份登记是具有该数据库访问权限的运维动作，不能提供公共注册或自行选择管理员的端点：

```sh
node service/cli.js enroll --db /srv/osslab-requests/requests.db --id MEMBER_ID --role user --url https://YOUR_GATEWAY/oss-requests --out /PRIVATE_DIR/member-requests.json
```

审批管理员使用 `--role admin`，仅为获授权人员登记。凭据包不会打印到终端，文件权限 0600，拒绝覆盖已有输出文件；对同一身份再次登记会轮换令牌，使旧令牌立即失效。数据库只保存令牌摘要。使用私密通路把包交付对应成员，放到其 DSH 主机的 `~/.config/osslab/requests.json`，权限 0600。不要粘贴到聊天或提交 Git。首次接入不依赖 S3 密钥。

URL 与令牌绑定在同一个私有文件；UI 不接受任意上游 URL，不返回令牌。客户端拒绝重定向、带密码的 URL 和非本机明文 HTTP。TLS 使用系统信任库；本服务不沿用 S3 的跳过校验开关。入口必须提供客户端能信任的 HTTPS 连接。

同机反向代理路径示意（部署时由运维核实，不能直接套用到未确认的代理节点）：

```nginx
location /oss-requests/ {
    client_max_body_size 16k;
    proxy_pass http://127.0.0.1:8767/;
    proxy_set_header Authorization $http_authorization;
    proxy_read_timeout 15s;
}
```

不要将申请 API 重定向到原生 Admin 登录，不记录 Authorization 或请求正文。普通访问日志仅记录路径和状态。服务建议配置进程守护、单个服务实例、数据库受限备份与访问审计；在线备份使用 SQLite backup API 或停服务复制，不能在写入中直接复制数据库文件。当前没有公共 Web UI、通知系统、自动过期撤权或 SSO。

## 状态与真实执行

`submitted → approved → processing → delivered`；另有 rejected、cancelled、failed，可从 failed 重新办理。

- 审批通过只批准申请，不调用 S3 或 SSH，不代表已建桶或授权。
- 管理员通过现有原生 Admin / 经核验的 Orca 运维通路执行变更。
- 确认交付需填写实际 Owner、配额、节点/磁盘、成员/前缀/权限、S3 地址及回读/验收证据。前端显示“管理员已确认交付”；这是管理员提交的验收记录，不是本服务自动验真。
- 每次状态更新带记录版本，冲突返回 409。提交使用申请人 + clientId 幂等键，避免网络重试产生重复申请。
- Write 包含 DeleteObject；权限申请不支持 Admin。有效期记录的是申请意图，实际撤权目前需要管理员执行。
- 每个服务实例代表一个 OSS 集群；不要把同一个服务作为多个无关集群的申请队列。

## 接口与验证

全部为带个人 Bearer 令牌的 POST：`/v1/session`、`/v1/requests/list`、`/v1/requests/submit`、`/v1/requests/change`。DSH 通过自身已鉴权的 `requests/*` 路由代理请求。列表分页最多 100 条，默认 50；详情和历史包含在每条记录中。

`npm test` 验证隔离、越权、伪造字段、幂等性、并发版本、持久化、令牌轮换和 HTTP 客户端。`npm run test:ui` 使用临时真实申请服务，依次验证普通用户提交、另一管理员身份审批、交付记录和用户回读；所有数据合成，不连接实际 OSS。

更新插件后需要重启 DSH 加载后端路由。如果旧进程只加载了新前端，会出现 HTTP 404；这与 OSS 存储是否在线无关。
