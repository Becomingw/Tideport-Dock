# 连接与配置

Tideport Dock 使用个人 S3 profile。第一次启动时，将示例 endpoint 改为实际可访问的 S3 入口；它应是 HTTP(S) origin，不带网页路径、查询参数或内嵌凭据。

| 配置 | 用途 |
|---|---|
| endpoint / region | S3 服务入口与区域 |
| profile | 执行主机上的个人 AWS profile，默认 osslab |
| allowedBuckets | 插件允许操作的桶列表；空列表表示凭据可见的桶 |
| allowWrites / allowDeletes | 插件操作开关，默认关闭，不替代服务端权限 |
| caBundle | 可选 CA 路径；留空使用系统信任 |
| insecureTLS | 显式开启时跳过该客户端的 TLS 校验，默认关闭 |
| downloadsDir | 本机下载目录 |

## 配置位置

- 个人凭据：`~/.aws/credentials`，使用 `[osslab]` 或你选定的 profile，文件权限 0600。
- DSH 设置：`~/.dsh/osslab/settings.json`。
- 非秘密兼容配置：`~/.config/osslab/config.json`，可提供 endpoint、region、ca_bundle。

设置页只显示凭据状态，不返回已有密钥。更新密钥时同时填写两项；留空则保留原值。保存使用版本检查以避免覆盖另一窗口的修改。

已有 `id: osslab` 的安装应更新原注册项，并保留原设置与凭据。不要重复注册同一组工具和路由。

## 检查连接

连接检查分别报告个人凭据、rclone 列桶与 SDK 目录读取的状态。列桶成功不等于目录读取成功，也不代表拥有写入权限。网络、TLS、身份与权限问题应分别检查。

远程脚本使用目标服务器上的个人 profile。本机设置中的 CA 文件路径不能直接当作服务器路径；应在远端确认有效配置后执行。
