# 服务器单文件传输

`osslab_transfer_recipe` 根据方向、桶、精确对象 key 和服务器绝对路径生成可检查的传输包。它只返回文件内容，不执行远程命令，也不复制凭据。

```json
{
  "direction": "upload",
  "bucket": "archive",
  "key": "exports/report.zip",
  "local_path": "/srv/export/report.zip"
}
```

## 使用步骤

1. 通过 Orca 或已有授权的远程执行工具确认主机、路径与个人 S3 profile。
2. 将返回的五个文件放入目标服务器的工作目录，检查配置及传输范围。
3. 在目标项目的 Python 环境安装 `requirements-transfer.txt` 中的依赖。
4. 运行计划命令，核对方向、大小与操作开关。
5. 在任务已获授权的范围内显式执行，检查退出码及校验结果。

```sh
python remote_transfer.py --config transfer-config.json --spec transfer-spec.json
python -u remote_transfer.py --config transfer-config.json --spec transfer-spec.json --execute
```

## 校验与限制

下载固定对象版本，在目标目录创建临时文件；完成后原子发布，已有目标文件不会被覆盖。可传入独立获知的 SHA-256 来验证内容。

上传使用 `IfNoneMatch: *` 条件创建，并再次完整读取对象核对 SHA-256。因此完整校验会增加一次 GET 的网络流量。若服务不支持条件写，应停止并核实兼容性，不能退化为无条件覆盖。

当前为单文件操作，不提供递归同步、自动断点续传或删除。上传是否成功不明确时应先检查对象，不自动重试覆盖。服务端真实授权仍然生效。
