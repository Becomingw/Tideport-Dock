/** Native DSH panel: bucket browser + visual settings for the OSS Lab storage. */
window.__ModuleLoader__.load({
  id: 'dsh-tideport-dock',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef, useMemo } = React

    const zh = {
      panel: 'Tideport Dock', guide: '浏览授权桶与前缀，配置个人凭据',
      settings: 'Tideport 存储配置', buckets: '桶', refresh: '刷新', loading: '读取中…',
      empty: '没有可见的桶', error: '出错', up: '上一级', root: '根目录',
      files: '文件', dirs: '目录', size: '大小', etag: 'ETag',
      settingsIntro: '个人凭据写入 ~/.aws/credentials，密钥不会回显。',
      endpoint: '服务地址 (baseurl)', region: '区域', profile: 'AWS profile',
      accessKey: 'Access Key', secretKey: 'Secret Key', caBundle: 'CA 证书路径',
      allowedBuckets: '允许的桶（逗号分隔，空=全部）', downloads: '下载目录',
      role: '角色', allowWrites: '允许上传', allowDeletes: '允许删除',
      save: '保存设置', saving: '保存中…', saved: '已保存',
      credentials: '凭据状态', configured: '已配置', notConfigured: '未配置',
      paths: '路径', insecure: '跳过 TLS 校验（仅临时）', keepSecret: '留空表示不修改密钥',
      reload: '重新读取',
    }
    const en = {
      panel: 'Tideport Dock Storage', guide: 'Browse approved buckets and prefixes, configure personal credentials',
      settings: 'Tideport settings', buckets: 'Buckets', refresh: 'Refresh', loading: 'Loading…',
      empty: 'No visible buckets', error: 'Error', up: 'Up', root: 'root',
      files: 'files', dirs: 'dirs', size: 'size', etag: 'ETag',
      settingsIntro: 'Credentials are written to ~/.aws/credentials; secrets are never echoed back.',
      endpoint: 'Endpoint (baseurl)', region: 'Region', profile: 'AWS profile',
      accessKey: 'Access Key', secretKey: 'Secret Key', caBundle: 'CA bundle path',
      allowedBuckets: 'Allowed buckets (comma separated, empty = all)', downloads: 'Download directory',
      role: 'Role', allowWrites: 'Allow uploads', allowDeletes: 'Allow deletes',
      save: 'Save settings', saving: 'Saving…', saved: 'Saved',
      credentials: 'Credentials', configured: 'configured', notConfigured: 'not configured',
      paths: 'Paths', insecure: 'Skip TLS verification (temporary only)', keepSecret: 'Leave empty to keep the current key',
      reload: 'Reload',
    }

    Object.assign(zh, {"copy": "复制", "copied": "已复制", "copyFailed": "复制失败，请手动复制", "doctor": "连接自检", "reachable": "可列桶", "unreachable": "列桶失败（连接或权限）", "browserHint": "使用当前个人身份浏览。上传、下载与删除通过 agent 工具执行。", "prefix": "输入完整前缀", "go": "打开", "filter": "筛选当前页名称", "emptyPrefix": "当前页没有匹配对象", "pageEntries": "条（当前页）", "previous": "上一页", "next": "下一页", "details": "对象详情", "close": "关闭", "etagHint": "ETag 是版本条件，不保证是文件 MD5。", "notFound": "对象不存在", "retry": "重试", "dirty": "有未保存的更改", "pairRequired": "Access Key 与 Secret Key 必须同时填写", "adminHint": "当前版本提供个人数据能力；管理入口尚未接入，角色选择不会授予权限。", "running": "执行中", "failed": "失败", "done": "已返回", "plan": "计划 / 预览", "openPanel": "打开 OSS 存储"})
    Object.assign(en, {"copy": "Copy", "copied": "Copied", "copyFailed": "Copy failed; copy manually", "doctor": "Check connection", "reachable": "Bucket listing available", "unreachable": "Listing failed (connection or permissions)", "browserHint": "Browse with your personal identity. Ask the agent to upload, download or delete.", "prefix": "Full prefix", "go": "Open", "filter": "Filter names on this page", "emptyPrefix": "No matching entries on this page", "pageEntries": "entries (this page)", "previous": "Previous", "next": "Next", "details": "Object details", "close": "Close", "etagHint": "ETag is a version condition, not necessarily an MD5 checksum.", "notFound": "Object not found", "retry": "Retry", "dirty": "Unsaved changes", "pairRequired": "Provide both Access Key and Secret Key", "adminHint": "This version provides personal data access. Administration is not connected; role selection grants no permissions.", "running": "Running", "failed": "Failed", "done": "Returned", "plan": "Plan / preview", "openPanel": "Open OSS Storage"})

    Object.assign(zh, {"subtitle": "对象存储工作区", "connectionTitle": "存储连接", "settingsSubtitle": "管理连接、个人凭据与工具操作限制", "credentialReady": "个人凭据已就绪", "credentialMissing": "个人凭据待配置", "doctor": "检查连接", "checking": "正在检查连接…", "checkFailed": "检查未完成", "browse": "文件浏览", "navigation": "存储位置", "bucketCount": "个可见桶", "bucketSearch": "搜索可见桶", "typeFilter": "类型筛选", "all": "全部", "name": "名称", "sortName": "按名称排序（当前页）", "sortSize": "按大小降序（当前页）", "noMatches": "没有匹配的项目", "tryFilter": "尝试其他关键词或选择全部类型。", "noBucketsHelp": "检查个人凭据与桶的访问权限。", "emptyPrefix": "此位置暂无对象", "emptyPrefixHelp": "返回上一级，或输入其他前缀。", "currentPage": "当前页", "items": "项", "shown": "显示", "page": "页码", "modified": "修改时间", "metadata": "高级元数据", "contentType": "内容类型", "version": "版本 ID", "copyUri": "复制 S3 路径", "connectionInfo": "连接信息", "connectionHelp": "设置对象存储入口与当前使用的个人身份配置。", "endpointHelp": "使用已授权的 S3 兼容服务地址。", "profileHelp": "使用 DSH 主机上的个人 AWS profile。", "personalCredentials": "个人凭据", "credentialHelp": "两项同时填写以更新密钥；留空则保留现有凭据。", "operationPolicy": "工具操作限制", "policyHelp": "仅限制本插件工具，不会修改服务端桶与用户权限。", "writeHelp": "允许工具执行上传，仍检查目标与覆盖条件。", "deleteHelp": "仅允许精确对象删除，仍需校验对象版本。", "advanced": "高级设置", "caHelp": "可留空使用系统信任库。", "downloadHelp": "指 DSH 主机上的默认目录，不是算力服务器路径。", "tlsHelp": "仅对该连接生效，不修改系统 TLS 设置。", "upToDate": "配置已同步", "discardQuestion": "放弃未保存的更改并重新读取？", "discard": "放弃更改", "continueEditing": "继续编辑", "dirs": "文件夹", "tool_doctor": "连接检查", "tool_buckets": "查看存储桶", "tool_ls": "浏览文件", "tool_stat": "对象详情", "tool_get": "下载对象", "tool_put": "上传对象", "tool_put_new": "上传新对象", "tool_delete": "删除对象", "tool_request": "访问申请"})
    Object.assign(en, {"subtitle": "Laboratory data storage", "connectionTitle": "Storage connection", "settingsSubtitle": "Manage connections, credentials and tool restrictions", "credentialReady": "Personal credentials ready", "credentialMissing": "Credentials need attention", "doctor": "Check connection", "checking": "Checking connection…", "checkFailed": "Check incomplete", "browse": "Files", "navigation": "Storage location", "bucketCount": "visible buckets", "bucketSearch": "Find a bucket", "typeFilter": "Filter by type", "all": "All", "name": "Name", "sortName": "Sort this page by name", "sortSize": "Sort this page by size", "noMatches": "No matching items", "tryFilter": "Try another search or show all types.", "noBucketsHelp": "Check your credentials and bucket access.", "emptyPrefix": "No objects here", "emptyPrefixHelp": "Choose another prefix or go back.", "currentPage": "This page", "items": "items", "shown": "shown", "page": "Page", "modified": "Modified", "metadata": "Advanced metadata", "contentType": "Content type", "version": "Version ID", "copyUri": "Copy S3 URI", "connectionInfo": "Connection", "connectionHelp": "Choose the storage endpoint and personal profile.", "endpointHelp": "Use your approved S3-compatible endpoint.", "profileHelp": "Uses a personal AWS profile on the DSH host.", "personalCredentials": "Personal credentials", "credentialHelp": "Fill both fields to replace credentials; leave empty to keep them.", "operationPolicy": "Tool restrictions", "policyHelp": "These switches restrict plugin tools only; they do not grant server-side permissions.", "writeHelp": "Allow tool uploads with destination and overwrite checks.", "deleteHelp": "Allow exact-object deletion with version checks.", "advanced": "Advanced settings", "caHelp": "Leave empty to use the system trust store.", "downloadHelp": "Default directory on the DSH host, not a compute server.", "tlsHelp": "Applies only to this connection.", "upToDate": "Settings up to date", "discardQuestion": "Discard unsaved changes and reload?", "discard": "Discard changes", "continueEditing": "Keep editing", "dirs": "Folders", "tool_doctor": "Connection check", "tool_buckets": "List buckets", "tool_ls": "Browse files", "tool_stat": "Object details", "tool_get": "Download object", "tool_put": "Upload object", "tool_put_new": "Upload new object", "tool_delete": "Delete object", "tool_request": "Access request"})

    const CSS = `
.osslab-root{--oss-text:var(--dsw-alias-label-primary,#1f2329);--oss-muted:var(--dsw-alias-label-secondary,#667085);--oss-surface:var(--dsw-alias-bg-base,#fff);--oss-soft:var(--dsw-alias-bg-layer-2,#f5f6fa);--oss-line:var(--dsw-alias-border-l3,#e4e7ee);--oss-accent:#4d6bfe;--oss-primary:#4d6bfe;--oss-tint:color-mix(in srgb,var(--oss-accent) 8%,var(--oss-surface));--oss-danger:var(--dsw-alias-state-error-primary,#b42318);color:var(--oss-text);font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);font-size:13px;line-height:1.6;box-sizing:border-box;container-type:inline-size}
.osslab-root *{box-sizing:border-box}.osslab-root button,.osslab-root input,.osslab-root select{font-family:inherit;font-size:inherit;color:inherit}.osslab-root button{cursor:pointer}.osslab-root button:disabled{opacity:.4;cursor:not-allowed}.osslab-root button:focus-visible,.osslab-root input:focus-visible,.osslab-root select:focus-visible,.osslab-root summary:focus-visible{outline:2px solid var(--oss-accent);outline-offset:3px}.osslab-root h3,.osslab-root h4,.osslab-root p{margin:0}.osslab-root button,.osslab-root input,.osslab-root select{transition:background .16s,border-color .16s,box-shadow .16s}.oss-icon{width:18px;height:18px;flex-shrink:0;vertical-align:middle}.oss-brand .oss-icon{width:29px;height:29px}.oss-brand{display:flex;align-items:center;gap:12px;min-width:0}.oss-brand>svg{color:var(--oss-accent)}.oss-brand-mark{width:40px;height:40px;flex-shrink:0}.oss-header>.oss-icon{color:var(--oss-accent)}.oss-brand h3{font-size:19px;line-height:1.4;font-weight:650;letter-spacing:-.4px}.oss-brand p{color:var(--oss-muted);font-size:12px;margin-top:3px}.oss-panel{height:100%;overflow:auto;padding:24px 20px 20px;background:var(--oss-surface)}.oss-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.oss-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:6px 11px;border:1px solid var(--oss-line);border-radius:7px;background:var(--oss-surface);font-size:12px!important;font-weight:500;line-height:1.4;white-space:nowrap}.oss-btn:hover:not(:disabled){border-color:color-mix(in srgb,var(--oss-accent) 40%,var(--oss-line));background:var(--oss-tint)}.oss-btn.primary{background:var(--oss-primary);border-color:var(--oss-primary);color:#fff}.oss-btn.primary:hover:not(:disabled){background:color-mix(in srgb,var(--oss-primary) 88%,#000)}.oss-btn.quiet{border-color:transparent;background:transparent}.oss-btn.icon-only{width:32px;padding:6px}.oss-btn .oss-icon{width:16px;height:16px}.oss-muted{color:var(--oss-muted);font-size:12px}.oss-mono{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:11px}.oss-path{overflow-wrap:anywhere;min-width:0}.oss-state{display:flex;align-items:center;gap:9px;padding:11px 12px;background:var(--oss-soft);border:1px solid var(--oss-line);border-radius:9px;font-size:12px}.oss-state.good{background:var(--oss-tint);border-color:transparent}.oss-state.good>svg{color:var(--oss-accent)}.oss-state.error>svg{color:var(--oss-danger)}.oss-state>span{flex:1;min-width:0}.oss-state .oss-btn{background:transparent;min-height:28px;padding:4px 8px}.oss-connection{margin:20px 0}.oss-diagnostic{margin-top:8px;padding:10px 12px;border-left:2px solid var(--oss-line);font-size:12px}.oss-diagnostic dl{margin:0}.oss-section-label{font-size:13px;font-weight:600}.oss-content{border-top:1px solid var(--oss-line);padding-top:18px}.oss-crumb{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:12px 0;color:var(--oss-muted);font-size:12px}.oss-crumb button{border:0;background:none;color:var(--oss-accent);padding:2px;max-width:100%;overflow-wrap:anywhere;text-align:left}.oss-crumb .oss-icon{width:16px;height:16px}.oss-crumb .separator{width:12px;height:12px;color:var(--oss-muted)}.oss-crumb [aria-current]{color:var(--oss-text);font-weight:500}.oss-address{display:flex;align-items:center;gap:8px;margin:12px 0}.oss-address-field{display:flex;align-items:center;flex:1;min-width:0;border:1px solid var(--oss-line);border-radius:7px;overflow:hidden}.oss-address-field:focus-within{border-color:var(--oss-accent);box-shadow:0 0 0 2px var(--oss-tint)}.oss-address-field input{border:0;border-radius:0;min-width:0;width:100%;outline:none!important;box-shadow:none!important}.oss-address-field button{border:0;border-left:1px solid var(--oss-line);border-radius:0;color:var(--oss-accent)}.oss-input{width:100%;min-width:0;padding:8px 10px;background:var(--oss-surface);border:1px solid var(--oss-line);border-radius:7px;line-height:1.5}.oss-search-row{display:flex;align-items:center;gap:8px;margin:12px 0}.oss-search{position:relative;flex:1;min-width:0}.oss-search>svg{position:absolute;left:10px;top:11px;color:var(--oss-muted);width:16px;height:16px}.oss-search input{padding-left:34px}.oss-select{max-width:110px;border:1px solid var(--oss-line);border-radius:7px;background:var(--oss-surface);padding:8px 9px;min-height:38px}.oss-list-head{display:flex;align-items:center;justify-content:space-between;border-radius:6px;background:var(--oss-soft);color:var(--oss-muted);padding:7px 10px;font-size:11px}.oss-list-head button{padding:0;border:0;background:transparent;display:flex;align-items:center;gap:5px;color:inherit}.oss-list-head svg{width:13px;height:13px}.oss-list{margin-top:3px}.oss-row{display:flex;align-items:center;gap:10px;padding:11px 10px;min-height:48px;width:100%;background:transparent;border:0;border-bottom:1px solid var(--oss-line);color:inherit;text-align:left;font:inherit;border-radius:0}.oss-row:hover{background:var(--oss-soft)}.oss-row.selected{background:var(--oss-tint);border-radius:7px;border-bottom-color:transparent}.oss-file-icon{color:var(--oss-accent);width:20px;height:20px}.oss-file-icon.folder{color:#b88731}.oss-row .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.oss-row .meta{color:var(--oss-muted);font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums}.oss-row>svg:last-child:not(:first-child){width:14px;height:14px;color:var(--oss-muted)}.oss-bucket-row{padding:15px 10px;gap:12px}.oss-bucket-symbol{display:grid;place-items:center;width:36px;height:36px;border-radius:9px;background:var(--oss-tint);color:var(--oss-accent);flex-shrink:0}.oss-bucket-row .name>strong{display:block;font-size:13px;font-weight:550}.oss-bucket-row .name>small{display:block;color:var(--oss-muted);font-size:11px;margin-top:2px}.oss-pagination{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:14px 0 18px}.oss-pagination-actions{display:flex;align-items:center;gap:5px}.oss-page-index{min-width:25px;text-align:center;font-variant-numeric:tabular-nums;font-size:12px}.oss-inspector{border:1px solid var(--oss-line);border-radius:10px;overflow:hidden;margin-top:16px}.oss-inspector-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--oss-line)}.oss-inspector-head>svg{color:var(--oss-accent)}.oss-inspector-head>strong{min-width:0;overflow-wrap:anywhere;flex:1;font-size:13px;font-weight:600}.oss-inspector-body{padding:14px}.oss-properties{display:grid;grid-template-columns:85px minmax(0,1fr);gap:8px 12px;margin:0 0 14px;font-size:12px}.oss-properties dt{color:var(--oss-muted)}.oss-properties dd{margin:0;min-width:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.oss-uri{display:flex;align-items:center;gap:6px;background:var(--oss-soft);padding:7px 8px;border-radius:6px}.oss-uri>.oss-path{flex:1;min-width:0}.oss-uri>.oss-copy{flex:0 0 auto;max-width:110px;justify-content:flex-end}.oss-disclosure{margin-top:14px}.oss-disclosure>summary{display:flex;align-items:center;gap:7px;list-style:none;cursor:pointer;font-size:12px;font-weight:500;padding:5px 0}.oss-disclosure>summary::-webkit-details-marker{display:none}.oss-disclosure>summary svg{width:14px;height:14px;transition:transform .15s}.oss-disclosure[open]>summary svg{transform:rotate(90deg)}.oss-disclosure>div{margin-top:10px}.oss-empty{padding:38px 16px;text-align:center;color:var(--oss-muted)}.oss-empty>svg{width:34px;height:34px;color:color-mix(in srgb,var(--oss-muted) 60%,var(--oss-surface));margin-bottom:12px}.oss-empty strong{display:block;color:var(--oss-text);font-size:13px;font-weight:550}.oss-empty p{font-size:12px;margin:5px auto 0;max-width:250px}.oss-error{display:flex;align-items:flex-start;gap:9px;border:1px solid color-mix(in srgb,var(--oss-danger) 25%,var(--oss-line));border-radius:8px;padding:11px 12px;margin-top:12px;color:var(--oss-danger);font-size:12px;overflow-wrap:anywhere}.oss-error>span{flex:1;min-width:0;white-space:pre-wrap}.oss-skeleton{height:48px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--oss-line)}.oss-skeleton span{height:10px;width:55%;border-radius:4px;background:var(--oss-soft);animation:oss-pulse 1.5s ease-in-out infinite}.oss-skeleton span:first-child{height:20px;width:20px;margin-left:10px}.oss-skeleton span:last-child{width:38px;margin-left:auto;margin-right:10px}.oss-spin{animation:oss-spin 1s linear infinite}.oss-toast{font-size:11px;color:var(--oss-accent)}.oss-copy{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap}.oss-pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto;background:var(--oss-soft);border-radius:7px;padding:12px;font:12px/1.65 var(--dsw-font-mono,ui-monospace,monospace)}
.osslab-settings{max-width:760px;padding:12px 4px 24px;background:var(--oss-surface)}.oss-settings-heading{padding:0 0 20px;border-bottom:1px solid var(--oss-line)}.oss-form-section{margin-top:24px}.oss-section-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:15px}.oss-section-number{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--oss-tint);color:var(--oss-accent);font-size:12px;font-weight:600;flex-shrink:0}.oss-section-heading h4{font-size:14px;font-weight:600}.oss-section-heading p{font-size:12px;color:var(--oss-muted);margin-top:3px}.osslab-root fieldset{border:0;padding:0;margin:0;min-width:0}.oss-grid{display:grid;grid-template-columns:minmax(130px,.8fr) minmax(0,1.4fr);gap:16px 20px;align-items:start}.oss-grid>label{font-size:12px;padding-top:9px}.oss-grid .oss-input{font-size:13px}.oss-field-help{color:var(--oss-muted);font-size:11px;margin-top:5px!important}.oss-field-group{border:1px solid var(--oss-line);border-radius:9px;padding:18px}.oss-credential-state{margin-bottom:16px}.oss-toggle{display:flex;align-items:center;gap:10px;padding:11px 0;cursor:pointer}.oss-toggle+.oss-toggle{border-top:1px solid var(--oss-line)}.oss-toggle input{appearance:none;position:relative;width:16px;height:16px;margin:0;border:1px solid var(--oss-line);border-radius:4px;background:var(--oss-surface);flex-shrink:0;cursor:pointer}.oss-toggle input:checked{background:var(--oss-accent);border-color:var(--oss-accent)}.oss-toggle input:checked:after{content:'';position:absolute;left:4px;top:1px;width:4px;height:8px;border:solid white;border-width:0 2px 2px 0;transform:rotate(45deg)}.oss-toggle>span{min-width:0}.oss-toggle strong{font-size:12px;font-weight:550}.oss-toggle small{display:block;font-size:11px;color:var(--oss-muted);margin-top:2px}.oss-advanced{border:1px solid var(--oss-line);border-radius:9px;padding:12px 16px;margin-top:20px}.oss-advanced>summary{font-size:13px}.oss-advanced>div{padding-top:8px}.oss-settings-footer{position:sticky;bottom:0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:24px;border-top:1px solid var(--oss-line);padding:14px 0;background:var(--oss-surface);z-index:1}.oss-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.oss-save-status{display:flex;align-items:center;gap:6px;color:var(--oss-muted);font-size:12px}.oss-save-status.dirty{color:#a46a24}.oss-save-status.saved{color:var(--oss-accent)}.oss-path-note{font-size:11px;color:var(--oss-muted);overflow-wrap:anywhere;margin-top:16px!important}.oss-confirm{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;background:var(--oss-soft);border-radius:8px;font-size:12px}.oss-tool{border:1px solid var(--oss-line);border-radius:10px;overflow:hidden;margin:8px 0}.oss-tool-toggle{display:flex;align-items:center;gap:10px;padding:12px;width:100%;background:var(--oss-surface);border:0;text-align:left}.oss-tool-symbol{width:32px;height:32px;display:grid;place-items:center;flex-shrink:0;border-radius:8px;background:var(--oss-tint);color:var(--oss-accent)}.oss-tool-info{min-width:0;flex:1}.oss-tool-info strong{display:block;font-size:13px;font-weight:550}.oss-tool-info small{display:block;font-size:11px;color:var(--oss-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}.oss-tool-status{font-size:11px;color:var(--oss-muted);white-space:nowrap}.oss-tool-status.error{color:var(--oss-danger)}.oss-tool-body{padding:0 12px 12px;border-top:1px solid var(--oss-line)}.oss-tool-body>.oss-actions{padding-top:10px}.oss-header{min-height:28px!important;font-size:12px!important;padding:4px 8px!important}
@container(max-width:460px){.oss-grid{grid-template-columns:1fr;gap:6px}.oss-grid>label{padding-top:8px}.oss-grid>div{margin-bottom:6px}.oss-field-group{padding:12px}.oss-section-heading p{max-width:100%}.oss-settings-footer{gap:10px}.oss-properties{grid-template-columns:72px minmax(0,1fr)}}
@container(max-width:300px){.oss-brand h3{font-size:17px}.oss-brand{gap:8px}.oss-brand p{font-size:11px}.oss-state{flex-wrap:wrap}.oss-state>span{flex-basis:70%}.oss-select{max-width:90px;padding:8px 5px}.oss-properties{grid-template-columns:1fr;gap:3px}.oss-properties dd{margin-bottom:8px}.oss-pagination{flex-wrap:wrap}}

.oss-request-tabs{display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--oss-line)}.oss-request-tabs button{border:0;background:none;padding:10px 14px;color:var(--oss-muted);border-bottom:2px solid transparent}.oss-request-tabs button[aria-selected=true]{color:var(--oss-accent);border-bottom-color:var(--oss-accent);font-weight:600}.oss-request-guide{background:var(--oss-tint);border:1px solid var(--oss-line);padding:16px 20px;border-radius:10px;margin-bottom:24px;font-size:12px}.oss-request-guide p{color:var(--oss-muted);margin:6px 0}.oss-request-guide a{color:var(--oss-accent)}.oss-application-text{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--oss-soft);padding:16px;border-radius:8px;font-size:12px;line-height:1.8;margin:16px 0}
.oss-request-status{font-size:11px;color:var(--oss-accent);background:var(--oss-tint);border-radius:20px;padding:5px 10px;white-space:nowrap}.oss-request-event{border-left:2px solid var(--oss-line);padding:4px 0 18px 16px;overflow-wrap:anywhere}.oss-request-event small{display:block;margin:4px 0}.oss-request-event p{margin:8px 0}.oss-request-event .oss-properties{margin-top:14px}
.oss-admin-dialog{width:min(1160px,calc(100vw - 40px));max-width:none;height:min(800px,calc(100dvh - 48px));max-height:none;padding:0;border:1px solid var(--dsw-alias-border-l3,#e4e7ee);border-radius:12px;background:var(--dsw-alias-bg-base,#fff);box-shadow:0 24px 80px #11183333}.oss-admin-dialog::backdrop{background:#11182766}.oss-admin{height:100%;display:flex;flex-direction:column;background:var(--oss-surface)}.oss-admin-header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:20px 24px;border-bottom:1px solid var(--oss-line)}.oss-admin-layout{display:grid;grid-template-columns:180px minmax(0,1fr);flex:1;min-height:0}.oss-admin-nav{padding:24px 12px;border-right:1px solid var(--oss-line);display:flex;flex-direction:column;gap:8px}.oss-admin-nav button{display:flex;gap:10px;align-items:center;padding:12px;border:0;border-radius:7px;background:transparent;text-align:left;color:var(--oss-muted)}.oss-admin-nav button:hover{background:var(--oss-soft)}.oss-admin-nav button.active{background:var(--oss-tint);color:var(--oss-accent);font-weight:600}.oss-admin-main{overflow:auto;padding:28px 32px}.oss-admin-main h3{font-size:22px;font-weight:650;margin-bottom:6px}.oss-admin-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.oss-admin-notice{margin:20px 0;background:var(--oss-tint);border-color:color-mix(in srgb,var(--oss-accent) 20%,var(--oss-line));align-items:flex-start}.oss-admin-notice>svg{color:var(--oss-accent)}.oss-admin-notice p{margin-top:4px;color:var(--oss-muted)}.oss-admin-table-wrap{overflow:auto;border:1px solid var(--oss-line);border-radius:8px;margin:18px 0 10px}.oss-admin-table{border-collapse:collapse;width:100%;text-align:left;white-space:nowrap}.oss-admin-table th{font-weight:500;color:var(--oss-muted);background:var(--oss-soft)}.oss-admin-table th,.oss-admin-table td{padding:14px 16px;border-bottom:1px solid var(--oss-line);font-size:12px}.oss-admin-table tr:last-child td{border-bottom:0}.oss-admin-table tr.selected{background:var(--oss-tint)}.oss-admin-detail{margin-top:24px;padding:20px;border:1px solid var(--oss-line);border-radius:8px}.oss-admin-detail h3{font-size:17px;margin-bottom:14px;overflow-wrap:anywhere}.oss-admin-detail h4{margin-bottom:16px}.oss-admin-actions{display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;margin-top:20px}.oss-admin-metrics{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--oss-line);margin:28px 0}.oss-admin-metrics>div{padding:0 16px 24px 0}.oss-admin-metrics strong{display:block;font-size:28px;margin-top:4px;font-weight:600}.oss-admin-connection{margin-top:20px;grid-template-columns:140px minmax(0,1fr)}.oss-draft-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:24px}.oss-draft-field{display:flex;flex-direction:column;gap:7px;font-size:12px}.oss-admin .oss-empty p{max-width:420px}.oss-admin .oss-row .meta{font-size:11px}
@media(max-width:650px){.oss-admin-dialog{width:calc(100vw - 16px);height:calc(100dvh - 16px)}.oss-admin-header{padding:16px;flex-wrap:wrap}.oss-admin-layout{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.oss-admin-nav{padding:8px;flex-direction:row;overflow:auto;border-right:0;border-bottom:1px solid var(--oss-line);gap:2px}.oss-admin-nav button{white-space:nowrap;padding:8px;font-size:12px}.oss-admin-nav svg{display:none}.oss-admin-main{padding:20px 16px}.oss-admin-main h3{font-size:20px}.oss-admin-heading{align-items:flex-start}.oss-draft-grid{grid-template-columns:1fr}.oss-admin-connection{grid-template-columns:90px minmax(0,1fr)}.oss-admin .oss-row{flex-wrap:wrap}.oss-admin .oss-row .meta{width:100%;padding-left:28px}.oss-admin-detail{padding:14px}}

@keyframes oss-spin{to{transform:rotate(360deg)}}@keyframes oss-pulse{50%{opacity:.45}}@media(prefers-reduced-motion:reduce){.osslab-root *{transition:none!important;animation:none!important}}
`

    async function api(path, body = {}, signal) {
      const response = await fetch(`api/dsh-osslab/${path}`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal,
      })
      if (response.status === 404) throw new Error('OSS 插件接口未加载（HTTP 404）。请退出并重开 DSH，以加载最新后端；这不代表 OSS 存储离线。')
      let result
      try {
        result = await response.json()
      } catch {
        throw new Error(`HTTP ${response.status}`)
      }
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : `HTTP ${response.status}`)
      return result
    }

    function fmtBytes(bytes) {
      const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
      let value = Number(bytes) || 0
      let unit = 0
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024
        unit += 1
      }
      return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
    }

    const iconPaths = {
      database: ['M4 6c0-4 16-4 16 0s-16 4-16 0Z','M4 6v12c0 4 16 4 16 0V6','M4 12c0 4 16 4 16 0'],
      folder: ['M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11H3Z'],
      file: ['M5 3h9l5 5v13H5Z','M14 3v6h5'],
      refresh: ['M20 7V3l-3 3a8 8 0 1 0 2 11','M20 7h-5'],
      search: ['M15 15l6 6','M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0'],
      home: ['M3 10l9-7 9 7','M5 9v12h5v-7h4v7h5V9'],
      right: ['M9 5l7 7-7 7'], left: ['M15 5l-7 7 7 7'], down: ['M6 9l6 6 6-6'],
      arrow: ['M4 12h16','M14 6l6 6-6 6'], copy: ['M9 8h11v13H9Z','M15 8V3H4v13h5'],
      check: ['M5 12l4 4L19 6'], close: ['M6 6l12 12','M18 6 6 18'],
      alert: ['M12 3 2 21h20Z','M12 9v5','M12 17v.1'], shield: ['M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6Z','M8 12l3 3 5-6'],
      settings: ['M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z','M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
      clock: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0','M12 7v5l3 2'],
      upload: ['M12 16V3','M7 8l5-5 5 5','M4 16v5h16v-5'],
      download: ['M12 3v13','M7 11l5 5 5-5','M4 16v5h16v-5'],
      trash: ['M4 6h16','M9 6V3h6v3','M6 6l1 15h10l1-15','M10 10v7','M14 10v7'],
    }
    // Keep the standalone package icons and this inline mark visually aligned.
    // Inline SVG also works in host slots without fetching plugin asset URLs.
    function StorageMark({ settings = false, compact = false, className = '' }) {
      const paths = settings ? [
        ['m2 5 7-3.5L16 5 9 8.5Z', 1], ['m2 8 7 3.5L16 8v3L9 14.5 2 11Z', .8],
        ['m2 14 7 3.5 4-2v3l-4 2-7-3.5Z', .55],
      ] : [
        ['M12 4 21 8.5 12 13 3 8.5Z', 1], ['m3 12 9 4.5 9-4.5v3L12 19.5 3 15Z', .82],
        ['m3 17 9 4.5 9-4.5v2.5L12 24 3 19.5Z', .55],
      ]
      return h('svg', { className: `${compact ? 'oss-icon' : 'oss-brand-mark'} ${className}`, width: compact ? 18 : 40, height: compact ? 18 : 40, viewBox: compact ? '0 0 24 26' : '0 0 40 40', fill: 'none', 'aria-hidden': true, focusable: false },
        !compact && h('rect', { width: 40, height: 40, rx: 11, fill: '#4d6bfe' }),
        !compact && h('path', { d: 'M0 27c12-7 28 8 40-2v4a11 11 0 0 1-11 11H11A11 11 0 0 1 0 29Z', fill: '#3654e9', opacity: .45 }),
        h('g', { transform: compact ? undefined : 'translate(8 6)', fill: compact ? 'currentColor' : '#fff' },
          ...paths.map(([d, opacity], key) => h('path', { d, opacity, key })),
          settings && h('path', { d: 'M17 13v10m5-13v13', stroke: compact ? 'currentColor' : '#fff', strokeWidth: 1.8, strokeLinecap: 'round' }),
          settings && h('path', { d: 'M15 16h4m1 4h4', stroke: compact ? 'currentColor' : '#fff', strokeWidth: 2.8, strokeLinecap: 'round' })))
    }
    function Icon({ name, className = '' }) {
      if (name === 'storage') return h(StorageMark, { compact: true, className })
      return h('svg', { className: `oss-icon ${className}`, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        (iconPaths[name] ?? iconPaths.file).map((d, i) => h('path', { d, key: i })))
    }
    function Button({ icon, children, className = '', label, spinning, ...props }) {
      return h('button', { type: 'button', ...props, className: `oss-btn ${className}${!children ? ' icon-only' : ''}`, 'aria-label': label, title: label },
        icon ? h(Icon, { name: icon, className: spinning ? 'oss-spin' : '' }) : null, children)
    }
    function Brand({ title, subtitle, icon = 'storage' }) {
      return h('div', { className: 'oss-brand' }, h(StorageMark, { settings: icon === 'settings' }), h('div', null, h('h3', null, title), h('p', null, subtitle)))
    }
    function Copy({ text, t, label, compact = false }) {
      const [message, setMessage] = useState('')
      useEffect(() => { setMessage('') }, [text])
      return h('span', { className: 'oss-copy' }, h(Button, { icon: message === t('copied') ? 'check' : 'copy', label: label ?? t('copy'), onClick: async () => {
        try { await navigator.clipboard.writeText(text); setMessage(t('copied')) }
        catch { setMessage(t('copyFailed')) }
      } }, compact ? null : (label ?? t('copy'))), message ? h('span', { className: 'oss-toast', role: 'status' }, message) : null)
    }
    function ErrorNotice({ message, retry, t }) {
      return message ? h('div', { className: 'oss-error', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, message), retry ? h(Button, { onClick: retry }, t('retry')) : null) : null
    }
    function Empty({ title, message, icon = 'folder' }) {
      return h('div', { className: 'oss-empty' }, h(Icon, { name: icon }), h('strong', null, title), message ? h('p', null, message) : null)
    }
    function Loading({ t }) {
      return h('div', { role: 'status', 'aria-label': t('loading') }, [0, 1, 2].map(i => h('div', { className: 'oss-skeleton', key: i, 'aria-hidden': true }, h('span'), h('span'), h('span'))))
    }
    function dateText(value) {
      if (!value) return '—'
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    }
    function ObjectDetails({ bucket, objectKey, t, onClose }) {
      const [detail, setDetail] = useState(null), [error, setError] = useState(null), [revision, setRevision] = useState(0)
      useEffect(() => {
        const controller = new AbortController(); setDetail(null); setError(null)
        api('stat', { bucket, key: objectKey }, controller.signal)
          .then(data => { if (!controller.signal.aborted) setDetail(data) })
          .catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
        return () => controller.abort()
      }, [bucket, objectKey, revision])
      const object = detail?.object
      return h('section', { className: 'oss-inspector', 'aria-label': t('details') },
        h('div', { className: 'oss-inspector-head' }, h(Icon, { name: 'file' }), h('strong', null, objectKey.split('/').pop()), h(Button, { className: 'quiet', icon: 'close', label: t('close'), onClick: onClose })),
        h('div', { className: 'oss-inspector-body' },
          error ? h(ErrorNotice, { message: error, retry: () => setRevision(n => n + 1), t }) : !detail ? h('p', { className: 'oss-muted', role: 'status' }, t('loading')) : !detail.found ? h(Empty, { title: t('notFound'), icon: 'file' }) :
            h(React.Fragment, null, h('dl', { className: 'oss-properties' }, h('dt', null, t('size')), h('dd', null, `${fmtBytes(object.size)} · ${object.size.toLocaleString()} B`), h('dt', null, t('modified')), h('dd', null, dateText(object.modTime))),
              h('div', { className: 'oss-uri' }, h('span', { className: 'oss-path oss-mono' }, `s3://${bucket}/${objectKey}`), h(Copy, { text: `s3://${bucket}/${objectKey}`, t, compact: true, label: t('copyUri') })),
              h('details', { className: 'oss-disclosure' }, h('summary', null, h(Icon, { name: 'right' }), t('metadata')),
                h('div', null, h('dl', { className: 'oss-properties' }, h('dt', null, 'ETag'), h('dd', { className: 'oss-mono' }, object.etag || '—'), h('dt', null, t('contentType')), h('dd', null, object.contentType || '—'), h('dt', null, t('version')), h('dd', { className: 'oss-mono' }, object.versionId || '—')), h('p', { className: 'oss-muted' }, t('etagHint')))))))
    }

    const adminZh = { manageShort:'管理', adminPlacement:'放置', adminActions:'操作', admin:'管理工作区', adminSub:'存储配置与交付准备', overview:'总览', bucketAdmin:'存储桶', users:'用户与授权', nodes:'节点与容量', activity:'变更记录', backFiles:'返回文件', prepare:'准备建桶', personalScope:'仅显示当前身份可访问的桶', unverified:'未核验', notConnected:'管理通路尚未接入', adminNotice:'负责人、配额与放置状态待核验。当前可浏览个人可见桶、保存建桶草稿。', owner:'负责人', quota:'配额', placement:'放置偏好', inspect:'查看详情', browseFiles:'浏览文件', connection:'当前连接', sampled:'读取时间', draftCount:'本地草稿', draftsOnly:'本地交付草稿 · 尚未执行集群变更', noDrafts:'还没有建桶草稿', draftHint:'先整理桶的用途、负责人、容量与共享范围。', purpose:'用途', estimated:'预计数据量 (GiB)', quotaGiB:'桶配额 (GiB)', members:'共享成员 / 范围', placementHint:'填写节点与磁盘偏好，或明确填写“委托管理员选择”', draftWarning:'保存草稿不会建桶、预留容量或授予访问权限。', reviewDraft:'预览草稿', saveDraft:'保存草稿', editDraft:'继续编辑', draftSaved:'草稿已保存，等待管理通路接入与权限核验', backList:'返回列表', capacity:'实际可用容量', unknown:'暂无数据', capability:'管理能力', localOnly:'个人清单 / 本地草稿', userUnavailable:'尚未取得 S3 身份与授权清单', userHelp:'个人 profile 不是已核验的管理员身份。接入管理通路后，可查看成员、授权范围及密钥状态。', nodeUnavailable:'尚未取得节点与磁盘清单', nodeHelp:'连接地址不能证明数据落点；容量与物理放置需由获授权的管理通路读取。', sourceNote:'数据范围：当前连接；不是全局管理清单。', noVisible:'没有可见桶', invalidSize:'预计数据量不能超过配额', steps:'后续交付步骤', stepsText:'核验权限与容量 → 创建桶 → 配置放置与配额 → 验证物理落点 → 交付授权', created:'保存时间', exportDraft:'复制草稿 JSON', draft:'草稿', localIdentity:'个人 profile', keysNote:'此页面不显示任何访问密钥。' }
    Object.assign(zh, adminZh)
    Object.assign(en, { manageShort:'Manage', adminPlacement:'Placement', adminActions:'Actions', admin:'Management workspace', adminSub:'Storage configuration and delivery preparation', overview:'Overview', bucketAdmin:'Buckets', users:'Users & access', nodes:'Nodes & capacity', activity:'Change records', backFiles:'Back to files', prepare:'Prepare bucket', personalScope:'Buckets visible to the current identity only', unverified:'Unverified', notConnected:'Management connection not integrated', adminNotice:'Owner, quota and placement are unverified. Browse personal inventory and save local bucket drafts.', owner:'Owner', quota:'Quota', placement:'Placement preference', inspect:'View details', browseFiles:'Browse files', connection:'Current connection', sampled:'Read at', draftCount:'Local drafts', draftsOnly:'Local delivery drafts · no cluster changes executed', noDrafts:'No bucket drafts yet', draftHint:'Prepare ownership, purpose, capacity and sharing scope.', purpose:'Purpose', estimated:'Estimated size (GiB)', quotaGiB:'Bucket quota (GiB)', members:'Sharing members / scope', placementHint:'Specify node and disk preference, or explicitly delegate selection to an administrator', draftWarning:'Saving a draft does not create a bucket, reserve space or grant access.', reviewDraft:'Review draft', saveDraft:'Save draft', editDraft:'Keep editing', draftSaved:'Draft saved; management integration and authorization remain pending', backList:'Back to list', capacity:'Available physical capacity', unknown:'Unavailable', capability:'Management capability', localOnly:'Personal inventory / local drafts', userUnavailable:'S3 identities and grants are unavailable', userHelp:'A personal profile does not verify administrator identity. Connect management access to view members, grants and key status.', nodeUnavailable:'Node and disk inventory is unavailable', nodeHelp:'An endpoint does not prove physical placement. Capacity and placement require authorized management access.', sourceNote:'Scope: current connection, not global inventory.', noVisible:'No visible buckets', invalidSize:'Estimated size exceeds quota', steps:'Delivery steps to follow', stepsText:'Verify rights and capacity → Create bucket → Set placement and quota → Verify location → Deliver access', created:'Saved at', exportDraft:'Copy draft JSON', draft:'Draft', localIdentity:'Personal profile', keysNote:'Access keys are never displayed here.' })

    function BucketDraft({ t, onSaved, onBack }) {
      const [form, setForm] = useState({ bucket:'', owner:'', purpose:'', estimatedGiB:'', quotaGiB:'', placement:'', members:'' })
      const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(null)
      const field = (key, label, type = 'text', required = true) => h('label', { className:'oss-draft-field', key }, h('span', null, label), h('input', { className:'oss-input', type, required, value:form[key], min:type === 'number' ? '.001' : undefined, max:type === 'number' ? '1000000000' : undefined, step:type === 'number' ? 'any' : undefined, maxLength:1000, pattern:key === 'bucket' ? '[a-z0-9][a-z0-9.\\-]{1,61}[a-z0-9]' : undefined, onChange:e => setForm({ ...form, [key]:e.target.value }) }))
      const body = { ...form, estimatedGiB:Number(form.estimatedGiB), quotaGiB:Number(form.quotaGiB) }
      return h('section', null, h('h3', null, t('prepare')), h('p', { className:'oss-muted' }, t('draftWarning')),
        h('form', { onSubmit:async e => { e.preventDefault(); setError(null); if (body.estimatedGiB > body.quotaGiB) { setError(t('invalidSize')); return } if (!review) { setReview(true); return } setBusy(true); try { onSaved(await api('admin/drafts/create', body)) } catch(cause) { setError(cause.message) } finally { setBusy(false) } } },
          review ? h('div', { className:'oss-admin-detail' }, h('h4', null, form.bucket), h('dl', { className:'oss-properties' }, ...['owner','purpose','placement','members'].flatMap(k => [h('dt',{key:k+'l'},t(k)),h('dd',{key:k},form[k] || '—')]), h('dt',null,t('estimated')), h('dd',null,`${body.estimatedGiB} GiB`),h('dt',null,t('quota')),h('dd',null,`${body.quotaGiB} GiB`)), h('p',{className:'oss-muted'},t('stepsText'))) : h('div', { className:'oss-draft-grid' }, field('bucket',t('bucketAdmin')), field('owner',t('owner')), field('purpose',t('purpose')), field('placement',t('placement')), field('estimatedGiB',t('estimated'),'number'),field('quotaGiB',t('quotaGiB'),'number'),field('members',t('members'),'text',false),h('p',{className:'oss-muted'},t('placementHint'))),
          h(ErrorNotice,{message:error,t}), h('div',{className:'oss-admin-actions'},h(Button,{disabled:busy,onClick:review ? () => setReview(false) : onBack}, t(review ? 'editDraft' : 'backList')), h(Button,{className:'primary',type:'submit',disabled:busy},busy ? t('saving') : t(review ? 'saveDraft' : 'reviewDraft')))))
    }

    function AdminWorkspace({ t, onClose, onBrowse, onRequests }) {
      const dialog = useRef(null)
      const [page,setPage] = useState('overview'), [revision,setRevision] = useState(0)
      const [state,setState] = useState(null),[drafts,setDrafts] = useState([]),[buckets,setBuckets] = useState(null)
      const [error,setError] = useState(null),[bucketError,setBucketError] = useState(null)
      const [query,setQuery] = useState(''),[selected,setSelected] = useState(null),[creating,setCreating] = useState(false),[saved,setSaved] = useState(false)
      useEffect(() => { dialog.current.showModal(); const changed = () => setRevision(n=>n+1); window.addEventListener('osslab-settings-changed',changed); return () => window.removeEventListener('osslab-settings-changed',changed) },[])
      useEffect(() => {
        const controller = new AbortController(); setState(null);setError(null);setBucketError(null);setBuckets(null);setSelected(null)
        Promise.all([api('admin/status',{},controller.signal),api('admin/drafts',{},controller.signal)]).then(([s,d])=>{if(!controller.signal.aborted){setState(s);setDrafts(d.drafts)}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)})
        api('buckets',{},controller.signal).then(d=>{if(!controller.signal.aborted)setBuckets(d.buckets)}).catch(e=>{if(!controller.signal.aborted)setBucketError(e.message)})
        return ()=>controller.abort()
      },[revision])
      const pages = [['overview','home'],['bucketAdmin','database'],['users','shield'],['nodes','database'],['activity','clock']]
      const filtered = (buckets || []).filter(b=>b.name.toLowerCase().includes(query.toLowerCase()))
      const choose = p => {setPage(p);setSelected(null);setCreating(false);setSaved(false)}
      const notice = h('div',{className:'oss-state oss-admin-notice'},h(Icon,{name:'shield'}),h('span',null,h('strong',null,t('notConnected')),h('p',null,t('adminNotice'))))
      let content
      if (creating) content = h(BucketDraft,{t,onBack:()=>setCreating(false),onSaved:d=>{setDrafts(rows=>[d,...rows]);setCreating(false);setPage('activity');setSelected(d);setSaved(true)}})
      else if (page === 'overview') content = h(React.Fragment,null,
        h('div',{className:'oss-admin-heading'},h('div',null,h('h3',null,t('overview')),h('p',{className:'oss-muted'},t('sourceNote'))),h(Button,{className:'primary',onClick:()=>setCreating(true)},t('prepare'))),notice,
        h('div',{className:'oss-admin-metrics'},...[[t('bucketAdmin'),buckets ? buckets.length : '—'],[t('draftCount'),drafts.length],[t('capacity'),'—']].map(([label,value])=>h('div',{key:label},h('span',{className:'oss-muted'},label),h('strong',null,value)))),
        h('h4',null,t('connection')), h('dl',{className:'oss-properties oss-admin-connection'},h('dt',null,t('endpoint')),h('dd',null,state?.connection.endpoint),h('dt',null,t('localIdentity')),h('dd',null,state?.connection.profile),h('dt',null,t('credentials')),h('dd',null,t(state?.connection.credentialsReady ? 'credentialReady' : 'credentialMissing')),h('dt',null,t('capability')),h('dd',null,t('localOnly')),h('dt',null,t('sampled')),h('dd',null,dateText(state?.checkedAt))),h(ErrorNotice,{message:bucketError,retry:()=>setRevision(n=>n+1),t}),
        h('div',{className:'oss-admin-actions'},h(Button,{icon:'database',onClick:()=>choose('bucketAdmin')},t('bucketAdmin')),h(Button,{icon:'clock',onClick:()=>choose('activity')},t('activity'))))
      else if (page === 'bucketAdmin') content = h(React.Fragment,null,
        h('div',{className:'oss-admin-heading'},h('div',null,h('h3',null,t('bucketAdmin')),h('p',{className:'oss-muted'},t('personalScope'))),h(Button,{className:'primary',onClick:()=>setCreating(true)},t('prepare'))),notice,
        h('div',{className:'oss-search-row'},h('div',{className:'oss-search'},h(Icon,{name:'search'}),h('input',{className:'oss-input',value:query,'aria-label':t('bucketSearch'),placeholder:t('bucketSearch'),onChange:e=>setQuery(e.target.value)}))),
        bucketError ? h(ErrorNotice,{message:bucketError,retry:()=>setRevision(n=>n+1),t}) : !buckets ? h(Loading,{t}) : !filtered.length ? h(Empty,{title:query ? t('noMatches') : t('noVisible'),icon:'database'}) : h('div',{className:'oss-admin-table-wrap'},h('table',{className:'oss-admin-table'},h('thead',null,h('tr',null,...['name','owner','quota','adminPlacement','adminActions'].map(k=>h('th',{key:k},t(k))))),h('tbody',null,...filtered.map(b=>h('tr',{key:b.name,className:selected?.name===b.name ? 'selected' : ''},h('td',null,h('strong',null,b.name)),...['owner','quota','placement'].map(k=>h('td',{key:k,className:'oss-muted'},t('unverified'))),h('td',null,h(Button,{onClick:()=>setSelected(b),label:`${t('inspect')} ${b.name}`},t('inspect')))))))),
        buckets ? h('p',{className:'oss-muted'},`${buckets.length} ${t('bucketCount')}`) : null,
        selected ? h('section',{className:'oss-admin-detail'},h('h3',null,selected.name),h('div',{className:'oss-uri'},h('span',{className:'oss-path oss-mono'},`s3://${selected.name}`),h(Copy,{text:`s3://${selected.name}`,t,compact:true})),h('div',{className:'oss-admin-actions'},h(Button,{icon:'folder',onClick:()=>onBrowse(selected.name)},t('browseFiles')))) : null)
      else if (page === 'users' || page === 'nodes') content = h(React.Fragment,null,h('h3',null,t(page)),notice,h(Empty,{icon:page==='users' ? 'shield' : 'database',title:t(page==='users'?'userUnavailable':'nodeUnavailable'),message:t(page==='users'?'userHelp':'nodeHelp')}),h('p',{className:'oss-muted'},t('keysNote')))
      else content = h(React.Fragment,null,h('h3',null,t('activity')),h('p',{className:'oss-muted'},t('draftsOnly')),saved ? h('p',{className:'oss-state good',role:'status'},t('draftSaved')):null,
        !drafts.length ? h(Empty,{icon:'clock',title:t('noDrafts'),message:t('draftHint')}) : h('div',{className:'oss-list'},...drafts.map(d=>h('button',{className:`oss-row ${selected?.id===d.id?'selected':''}`,key:d.id,onClick:()=>setSelected(d)},h(Icon,{name:'file'}),h('span',{className:'name'},d.bucket),h('span',{className:'meta'},`${t('draft')} · ${dateText(d.createdAt)}`)))),
        selected ? h('section',{className:'oss-admin-detail'},h('h3',null,selected.bucket),h('dl',{className:'oss-properties'},...['owner','purpose','placement','members'].flatMap(k=>[h('dt',{key:k+'l'},t(k)),h('dd',{key:k},selected[k]||'—')]),h('dt',null,t('quota')),h('dd',null,`${selected.quotaGiB} GiB`)),h('p',{className:'oss-muted'},t('draftWarning')),h(Copy,{text:JSON.stringify(selected,null,2),label:t('exportDraft'),t})) : null,
        h('div',{className:'oss-admin-actions'},h(Button,{className:'primary',onClick:()=>setCreating(true)},t('prepare'))))
      return h('dialog',{ref:dialog,className:'oss-admin-dialog',onCancel:onClose,'aria-label':t('admin')},h('div',{className:'osslab-root oss-admin'},
        h('header',{className:'oss-admin-header'},h(Brand,{title:t('admin'),subtitle:t('adminSub')}),h('div',{className:'oss-actions'},h(Button,{icon:'clock',onClick:onRequests},'申请中心'),h(Button,{icon:'left',onClick:onClose},t('backFiles')),h(Button,{icon:'refresh',label:t('refresh'),onClick:()=>setRevision(n=>n+1)}))),
        h('div',{className:'oss-admin-layout'},h('nav',{'aria-label':t('admin'),className:'oss-admin-nav'},...pages.map(([id,icon])=>h('button',{key:id,type:'button',className:page===id ? 'active' : '',onClick:()=>choose(id),'aria-current':page===id?'page':undefined},h(Icon,{name:icon}),t(id)))),h('main',{className:'oss-admin-main'},error ? h(ErrorNotice,{message:error,retry:()=>setRevision(n=>n+1),t}) : !state ? h(Loading,{t}) : content))))
    }

    const requestLabels={draft:'申请单 · 待发送',local_saved:'保存申请单',submitted:'待审批',approved:'已批准 · 待办理',processing:'办理中',delivered:'管理员已确认交付',failed:'办理失败',rejected:'已驳回',cancelled:'已撤回',bucket:'新建桶',access:'权限申请',quota:'配额调整',approve:'批准',reject:'驳回',start:'开始办理',fail:'记录失败',retry:'重新办理',deliver:'确认交付',cancel:'撤回申请'}
    function RequestWorkspace({t,onClose}) {
      const dialog=useRef(null),[session,setSession]=useState(null),[rows,setRows]=useState([]),[cursor,setCursor]=useState(null)
      const [mode,setMode]=useState('manual'),[applicant,setApplicant]=useState('')
      const [error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(null),[creating,setCreating]=useState(false),[revision,setRevision]=useState(0)
      const [note,setNote]=useState(''),[deliveryOpen,setDeliveryOpen]=useState(false),[delivery,setDelivery]=useState({})
      const initial=()=>({kind:'bucket',bucket:'',purpose:'',quotaGiB:'',placement:'',prefix:'',permissions:['Read','List'],validUntil:'',sharing:'',clientId:crypto.randomUUID()})
      const [form,setForm]=useState(initial)
      useEffect(()=>{dialog.current.showModal()},[])
      useEffect(()=>{
        const abort=new AbortController();setBusy(true);setError('')
        const load=mode==='manual'?api('requests/drafts',{},abort.signal).then(data=>[null,data]):Promise.all([api('requests/session',{},abort.signal),api('requests/list',{},abort.signal)])
        load.then(([s,data])=>{if(!abort.signal.aborted){setSession(s);setRows(data.requests);setCursor(data.nextCursor);setSelected(old=>old ? data.requests.find(r=>r.id===old.id) ?? null:null)}}).catch(e=>{if(!abort.signal.aborted)setError(e.message)}).finally(()=>{if(!abort.signal.aborted)setBusy(false)})
        return()=>abort.abort()
      },[revision,mode])
      const choose=row=>{setSelected(row);setCreating(false);setNote('');setDeliveryOpen(false);setDelivery({});setError('')}
      const change=async action=>{
        setBusy(true);setError('')
        try {const row=await api('requests/change',{id:selected.id,version:selected.version,action,note,...(action==='deliver'?{delivery:{...delivery,quotaGiB:Number(delivery.quotaGiB),verified:delivery.verified===true}}:{})});setRows(items=>items.map(r=>r.id===row.id?row:r));choose(row)}
        catch(e){setError(e.message)}finally{setBusy(false)}
      }
      const submit=async e=>{
        e.preventDefault();setBusy(true);setError('')
        try{const row=await api(mode==='manual'?'requests/drafts/create':'requests/submit',{...form,...(mode==='manual'?{applicant}:{}),quotaGiB:form.kind==='access'?null:Number(form.quotaGiB)});setRows(items=>[row,...items.filter(r=>r.id!==row.id)]);choose(row);setForm(initial())}
        catch(e){setError(e.message)}finally{setBusy(false)}
      }
      const field=(label,key,values,setValues,type='text',required=true)=>h('label',{className:'oss-draft-field',key},label,h('input',{className:'oss-input',type,required,value:values[key]??'',maxLength:1000,min:type==='number'?1:undefined,onChange:e=>setValues({...values,[key]:e.target.value})}))
      const actions=selected && !selected.local ? session?.user.role==='admin' ? ({submitted:['approve','reject'],approved:['start'],processing:['deliver','fail'],failed:['retry']}[selected.status]??[]) : [] : []
      if(selected?.status==='submitted' && selected.applicant===session?.user.id) actions.push('cancel')
      const newRequest=()=>{setCreating(true);setSelected(null);setError('')}
      let content
      if(creating) content=h('form',{onSubmit:submit},h('h3',null,'新建申请'),h('p',{className:'oss-muted'},mode==='manual'?'填写后生成申请单，复制并通过团队约定的私密渠道交给管理员。':`申请身份：${session.user.id}。由管理员审批后办理。`),h('fieldset',{disabled:busy},h('div',{className:'oss-draft-grid'},
        h('label',{className:'oss-draft-field'},'申请类型',h('select',{className:'oss-select',value:form.kind,onChange:e=>setForm({...form,kind:e.target.value})},...['bucket','access','quota'].map(k=>h('option',{key:k,value:k},requestLabels[k])))),
        mode==='manual'?field('JMS 用户名（供人工核对）','applicant',{applicant},v=>setApplicant(v.applicant)):null,field('桶名称','bucket',form,setForm),field('用途与理由','purpose',form,setForm),form.kind!=='access'?field('申请配额 (GiB)','quotaGiB',form,setForm,'number'):null,
        form.kind==='bucket'?field('放置偏好（可填写委托管理员选择）','placement',form,setForm):null,field('授权前缀（空为整桶）','prefix',form,setForm,'text',false),field('有效期或结束条件','validUntil',form,setForm),field('共享与删除负责人（可选）','sharing',form,setForm,'text',false)),
        h('h4',{style:{marginTop:24}},'申请权限'),...['Read','List','Write'].map(p=>h('label',{className:'oss-toggle',key:p},h('input',{type:'checkbox',checked:form.permissions.includes(p),onChange:e=>setForm({...form,permissions:e.target.checked?[...form.permissions,p]:form.permissions.filter(v=>v!==p)})}),h('span',null,p,p==='Write'?h('small',null,'SeaweedFS 的 Write 同时包含删除对象权限'):null))),
        h('div',{className:'oss-admin-actions'},h(Button,{type:'submit',className:'primary',disabled:busy||!form.permissions.length},mode==='manual'?'保存并生成申请单':'提交申请'),h(Button,{onClick:()=>setCreating(false)},'返回列表'))))
      else if(selected) content=h(React.Fragment,null,h(Button,{icon:'left',onClick:()=>setSelected(null)},'返回列表'),h('div',{className:'oss-admin-heading',style:{marginTop:20}},h('div',null,h('h3',null,selected.payload.bucket),h('p',{className:'oss-muted'},`${requestLabels[selected.payload.kind]} · ${selected.applicant}`)),h('span',{className:'oss-request-status'},requestLabels[selected.status])),
        h('dl',{className:'oss-properties'},...Object.entries({'用途':selected.payload.purpose,'配额':selected.payload.quotaGiB?`${selected.payload.quotaGiB} GiB`:'—','放置偏好':selected.payload.placement||'—','前缀':selected.payload.prefix||'整桶','权限':selected.payload.permissions.join(', '),'有效期':selected.payload.validUntil,'共享对象':selected.payload.sharing||'—'}).flatMap(([k,v])=>[h('dt',{key:k},k),h('dd',{key:k+'v'},v)])),
        selected.local?h('section',{className:'oss-admin-detail'},h('h4',null,'交给管理员'),h('p',{className:'oss-muted'},'申请单已保存在本机，尚未发送。复制后通过团队约定的私密渠道发送给管理员；办理结果以管理员交付和个人访问验收为准。'),h('pre',{className:'oss-application-text'},selected.text),h(Copy,{text:selected.text,label:'复制申请单',t})):null,
        h('section',{className:'oss-admin-detail'},h('h4',null,'处理记录'),...selected.events.map((event,i)=>h('div',{className:'oss-request-event',key:i},h('strong',null,requestLabels[event.action]||event.action),h('small',{className:'oss-muted'},`${event.actor} · ${dateText(event.at)}`),event.note?h('p',null,event.note):null,event.delivery?h('dl',{className:'oss-properties'},...Object.entries(event.delivery).filter(([k])=>k!=='verified').flatMap(([k,v])=>[h('dt',{key:k},({evidence:'验收证据',endpoint:'S3 地址',owner:'Owner',placement:'节点 / 磁盘',quotaGiB:'配额 GiB',permissions:'实际授权'})[k]||k),h('dd',{key:k+'v'},String(v))])):null))),
        actions.length?h('section',{className:'oss-admin-detail'},h('h4',null,'处理申请'),h('p',{className:'oss-muted'},'批准后仍需管理员在 OSS 执行变更；完成验收后才能确认交付。'),h('fieldset',{disabled:busy},field('处理说明','note',{note},v=>setNote(v.note)),deliveryOpen?h('div',{className:'oss-draft-grid'},...Object.entries({owner:'实际 Owner',placement:'实际节点 / 磁盘',endpoint:'S3 地址',quotaGiB:'实际配额 (GiB)',permissions:'实际成员 / 前缀 / 权限',evidence:'规则回读与验收证据（不含密钥）'}).map(([key,label])=>field(label,key,delivery,setDelivery,key==='quotaGiB'?'number':'text')),h('label',{className:'oss-toggle'},h('input',{type:'checkbox',checked:delivery.verified===true,onChange:e=>setDelivery({...delivery,verified:e.target.checked})}),h('span',null,'已核实实际配置与访问验收'))):null,
        h('div',{className:'oss-admin-actions'},...actions.map(action=>h(Button,{key:action,disabled:busy||(action!=='cancel'&&!note.trim())||(action==='deliver'&&deliveryOpen&&!delivery.verified),className:action==='approve'||action==='deliver'?'primary':'',onClick:()=>action==='deliver'&&!deliveryOpen?setDeliveryOpen(true):change(action)},action==='deliver'&&deliveryOpen?'提交交付记录':requestLabels[action]))))):null)
      else content=h(React.Fragment,null,h('div',{className:'oss-admin-heading'},h('div',null,h('h3',null,session?.user.role==='admin'?'申请审批':'我的申请'),h('p',{className:'oss-muted'},mode==='manual'?'准备申请材料，交由管理员在现有 OSS 管理端办理。':'桶、访问权限与配额，集中提交并跟踪办理进度。')),h(Button,{className:'primary',onClick:newRequest,disabled:busy||mode==='online'&&!session},'新建申请')),
        !rows.length?h(Empty,{icon:'clock',title:mode==='manual'?'暂无申请单':session?'暂无申请':'在线审批未连接',message:mode==='manual'?'新建桶、调整配额或申请访问权限，从填写申请单开始。':session?'提交后可在这里查看审批与交付记录。':'在线审批为可选功能；可返回申请单，按现有流程交给管理员。'}):h('div',{className:'oss-list'},...rows.map(row=>h('button',{key:row.id,className:'oss-row',onClick:()=>choose(row)},h(Icon,{name:row.payload.kind==='access'?'shield':'database'}),h('span',{className:'name'},h('strong',null,row.payload.bucket),h('small',{className:'oss-muted',style:{display:'block'}},`${requestLabels[row.payload.kind]} · ${row.applicant} · ${dateText(row.created_at)}`)),h('span',{className:'oss-request-status'},requestLabels[row.status])))),
        cursor?h(Button,{disabled:busy,onClick:async()=>{setBusy(true);setError('');try{const data=await api('requests/list',{before:cursor});setRows(old=>[...old,...data.requests]);setCursor(data.nextCursor)}catch(e){setError(e.message)}finally{setBusy(false)}}},'加载更多'):null)
      return h('dialog',{ref:dialog,className:'oss-admin-dialog',onCancel:()=>{if(!busy)onClose()},onKeyDown:e=>{if(e.key==='Escape'&&busy)e.preventDefault()},'aria-label':'申请中心'},h('div',{className:'osslab-root oss-admin'},
        h('header',{className:'oss-admin-header'},h(Brand,{title:'申请中心',subtitle:mode==='manual'?'申请单 · 本机保存':session?`${session.user.id} · ${session.user.role==='admin'?'审批管理员':'普通用户'}`:'在线审批 · 可选'}),h('div',{className:'oss-actions'},h(Button,{icon:'refresh',label:'刷新申请',disabled:busy,onClick:()=>setRevision(v=>v+1)}),h(Button,{icon:'close',label:'关闭申请中心',disabled:busy,onClick:onClose}))),
        h('main',{className:'oss-admin-main'},h('div',{className:'oss-request-tabs',role:'tablist','aria-label':'申请方式'},...['manual','online'].map(key=>h('button',{key,role:'tab','aria-selected':mode===key,disabled:busy,onClick:()=>{setMode(key);setSession(null);setRows([]);setSelected(null);setCreating(false);setCursor(null);setError('')}},key==='manual'?'申请单':'在线审批（可选）'))),mode==='manual'?h('div',{className:'oss-request-guide'},h('strong',null,'填写申请 → 交给管理员 → 配置与验收 → 开始使用'),h('p',null,'沿用实验室现有流程。管理员核对身份、容量与权限，办理后交付实际配置及验收结果。'),h('span',{className:'oss-muted'},'OSS 管理端地址由管理员提供。')):null,h(ErrorNotice,{message:error,t}),busy?h('p',{className:'oss-muted',role:'status'},mode==='manual'?'正在读取申请单…':'正在同步申请…'):null,content)))
    }

    function Browser({ t }) {
      const [requestsOpen,setRequestsOpen] = useState(false)
      const [adminOpen, setAdminOpen] = useState(false)
      const [bucket, setBucket] = useState(null), [prefix, setPrefix] = useState('')
      const [cursor, setCursor] = useState(null), [history, setHistory] = useState([])
      const [result, setResult] = useState(null), [busy, setBusy] = useState(false)
      const [error, setError] = useState(null), [refresh, setRefresh] = useState(0)
      const [query, setQuery] = useState(''), [pathInput, setPathInput] = useState('')
      const [kind, setKind] = useState('all'), [sort, setSort] = useState('name')
      const [selected, setSelected] = useState(null), [settings, setSettings] = useState(null)
      const [health, setHealth] = useState(null), [checking, setChecking] = useState(false)
      const [settingsError, setSettingsError] = useState(null)
      const checkRef = useRef(null)
      useEffect(() => {
        const changed = () => { checkRef.current?.abort(); setChecking(false); setSettings(null); setHealth(null); setRefresh(n => n + 1); setCursor(null); setHistory([]) }
        window.addEventListener('osslab-settings-changed', changed)
        return () => { window.removeEventListener('osslab-settings-changed', changed); checkRef.current?.abort() }
      }, [])
      useEffect(() => {
        const controller = new AbortController(); setSettingsError(null)
        api('settings/get', {}, controller.signal).then(data => { if (!controller.signal.aborted) setSettings(data) })
          .catch(cause => { if (!controller.signal.aborted) setSettingsError(cause.message) })
        return () => controller.abort()
      }, [refresh])
      useEffect(() => {
        const controller = new AbortController()
        setBusy(true); setError(null); setResult(null); setSelected(null)
        api(bucket ? 'ls' : 'buckets', bucket ? { bucket, prefix, cursor, limit: 200 } : {}, controller.signal)
          .then(data => { if (!controller.signal.aborted) setResult(data) })
          .catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
          .finally(() => { if (!controller.signal.aborted) setBusy(false) })
        return () => controller.abort()
      }, [bucket, prefix, cursor, refresh])
      const navigate = (nextBucket, nextPrefix = '') => {
        setBucket(nextBucket); setPrefix(nextPrefix); setPathInput(nextPrefix)
        setCursor(null); setHistory([]); setSelected(null); setResult(null); setQuery(''); setKind('all')
      }
      const check = async () => {
        checkRef.current?.abort()
        const controller = new AbortController(); checkRef.current = controller
        setChecking(true); setHealth(null)
        try { const data = await api('doctor', bucket?{bucket,prefix}:{}, controller.signal); if (!controller.signal.aborted) setHealth(data) }
        catch (cause) { if (!controller.signal.aborted) setHealth({ error: cause.message }) }
        finally { if (!controller.signal.aborted) setChecking(false) }
      }
      const entries = useMemo(() => (result?.entries ?? []).filter(e => e.name.toLowerCase().includes(query.toLowerCase()) && (kind === 'all' || (kind === 'dirs' ? e.dir : !e.dir)))
        .slice().sort((a, b) => Number(b.dir) - Number(a.dir) || (sort === 'size' ? b.size - a.size : a.name.localeCompare(b.name))), [result, query, kind, sort])
      const buckets = (result?.buckets ?? []).filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
      const crumbs = [h('button', { key: 'home', 'aria-label': t('buckets'), title: t('buckets'), onClick: () => navigate(null) }, h(Icon, { name: 'home' }))]
      if (bucket) {
        crumbs.push(h(Icon, { name: 'right', className: 'separator', key: 'slash' }), h('button', { key: 'bucket', 'aria-current': !prefix ? 'location' : undefined, onClick: () => navigate(bucket) }, bucket))
        prefix.replace(/\/$/, '').split('/').filter(Boolean).forEach((part, index, parts) => {
          crumbs.push(h(Icon, { name: 'right', className: 'separator', key: `slash${index}` }), h('button', { key: index, 'aria-current': index === parts.length - 1 ? 'location' : undefined, onClick: () => navigate(bucket, parts.slice(0, index + 1).join('/') + '/') }, part))
        })
      }
      const connectionLabel = checking ? t('checking') : health?.error ? t('checkFailed') : health ? (health.metadata?.ok===false ? '目录访问失败（列桶状态见详情）' : health.metadata?.ok===true ? '目录访问正常' : health.endpointReachable ? t('reachable') : t('unreachable')) : settings?.credentials.ok ? t('credentialReady') : settings ? t('credentialMissing') : settingsError ? t('checkFailed') : t('loading')
      const connectionGood = health ? health.endpointReachable && health.metadata?.ok!==false : settings?.credentials.ok
      return h('div', { className: 'osslab-root oss-panel' },
        h('div', { className: 'oss-title' }, h(Brand, { title: t('panel'), subtitle: t('subtitle') }), h('div', { className:'oss-actions' }, h(Button,{icon:'clock',label:'申请中心',onClick:()=>setRequestsOpen(true)},'申请'), h(Button,{icon:'shield',label:t('admin'),onClick:()=>setAdminOpen(true)},t('manageShort')), h(Button, { icon: 'refresh', spinning: busy, label: t('refresh'), disabled: busy, onClick: () => setRefresh(n => n + 1) }))),
        h('div', { className: 'oss-connection' }, h('div', { className: `oss-state ${connectionGood ? 'good' : health?.error || health?.metadata?.ok===false || settingsError ? 'error' : ''}`, role: 'status' },
          h(Icon, { name: checking ? 'refresh' : connectionGood ? 'check' : 'shield', className: checking ? 'oss-spin' : '' }), h('span', null, connectionLabel), h(Button, { disabled: checking, onClick: check }, t('doctor'))),
          health || settingsError || (settings && !settings.credentials.ok) ? h('div', { className: 'oss-diagnostic' }, h('p', { className: 'oss-path' }, health?.error || settingsError || settings?.credentials.problem),
            health && !health.error ? h('dl', { className: 'oss-properties' }, h('dt', null, t('credentials')), h('dd', null, health.credentials?.ok ? t('configured') : health.credentials?.problem), h('dt', null, 'rclone'), h('dd', null, health.rclone),h('dt',null,'SDK 目录'),h('dd',null,health.metadata?.ok===true?'可读取':health.metadata?.error||'未探测（没有可用目标桶）')) : null) : null),
        h('section', { className: 'oss-content', 'aria-label': t('browse') },
          h('div', { className: 'oss-title' }, h('h4', { className: 'oss-section-label' }, bucket ? t('browse') : t('buckets')), !bucket && result ? h('span', { className: 'oss-muted' }, `${result.buckets?.length ?? 0} ${t('bucketCount')}`) : null),
          bucket ? h('nav', { className: 'oss-crumb', 'aria-label': t('navigation') }, ...crumbs) : null,
          bucket ? h('form', { className: 'oss-address', onSubmit: e => { e.preventDefault(); navigate(bucket, pathInput && !pathInput.endsWith('/') ? pathInput + '/' : pathInput) } },
            h('div', { className: 'oss-address-field' }, h('input', { className: 'oss-input', 'aria-label': t('prefix'), value: pathInput, placeholder: t('root'), onChange: e => setPathInput(e.target.value) }), h(Button, { type: 'submit', icon: 'arrow', label: t('go') })),
            h(Copy, { text: `s3://${bucket}/${prefix}`, t, compact: true, label: t('copyUri') })) : null,
          h('div', { className: 'oss-search-row' }, h('div', { className: 'oss-search' }, h(Icon, { name: 'search' }), h('input', { className: 'oss-input', value: query, onChange: e => setQuery(e.target.value), 'aria-label': bucket ? t('filter') : t('bucketSearch'), placeholder: bucket ? t('filter') : t('bucketSearch') })),
            bucket ? h('select', { className: 'oss-select', 'aria-label': t('typeFilter'), value: kind, onChange: e => setKind(e.target.value) }, h('option', { value: 'all' }, t('all')), h('option', { value: 'dirs' }, t('dirs')), h('option', { value: 'files' }, t('files'))) : null),
          bucket ? h('div', { className: 'oss-list-head' }, h('button', { type: 'button', onClick: () => setSort('name'), 'aria-label': t('sortName') }, t('name'), sort === 'name' ? h(Icon, { name: 'down' }) : null), h('button', { type: 'button', onClick: () => setSort('size'), 'aria-label': t('sortSize') }, t('size'), sort === 'size' ? h(Icon, { name: 'down' }) : null)) : null,
          busy ? h(Loading, { t }) : error ? h(ErrorNotice, { message: error, retry: () => setRefresh(n => n + 1), t }) :
            h('div', { className: 'oss-list', 'aria-label': t('browse') }, !bucket ? buckets.length ? buckets.map(item => h('button', { key: item.name, className: 'oss-row oss-bucket-row', 'aria-label': item.name, onClick: () => navigate(item.name) },
              h('span', { className: 'oss-bucket-symbol' }, h(Icon, { name: 'database' })), h('span', { className: 'name' }, h('strong', null, item.name), h('small', { className: 'oss-mono' }, `s3://${item.name}`)), h(Icon, { name: 'right' }))) : h(Empty, { title: query ? t('noMatches') : t('empty'), message: query ? t('tryFilter') : t('noBucketsHelp'), icon: 'database' })
              : entries.length ? entries.map(entry => h('button', { key: entry.path, className: `oss-row ${selected === entry.path ? 'selected' : ''}`, 'aria-label': entry.name, 'aria-pressed': entry.dir ? undefined : selected === entry.path,
                onClick: () => entry.dir ? navigate(bucket, entry.path) : setSelected(entry.path), title: entry.path }, h(Icon, { name: entry.dir ? 'folder' : 'file', className: `oss-file-icon ${entry.dir ? 'folder' : ''}` }), h('span', { className: 'name' }, entry.name), h('span', { className: 'meta' }, entry.dir ? '—' : fmtBytes(entry.size)), entry.dir ? h(Icon, { name: 'right' }) : null))
                : h(Empty, { title: query || kind !== 'all' ? t('noMatches') : t('emptyPrefix'), message: query || kind !== 'all' ? t('tryFilter') : t('emptyPrefixHelp') })),
          bucket && result && !busy ? h('div', { className: 'oss-pagination' }, h('span', { className: 'oss-muted' }, `${t('currentPage')} ${result.entries.length} ${t('items')}${query || kind !== 'all' ? ` · ${t('shown')} ${entries.length}` : ''}`),
            h('div', { className: 'oss-pagination-actions' }, h(Button, { icon: 'left', label: t('previous'), disabled: !history.length, onClick: () => { setCursor(history.at(-1)); setHistory(history.slice(0, -1)) } }), h('span', { className: 'oss-page-index', 'aria-label': t('page') }, history.length + 1), h(Button, { icon: 'right', label: t('next'), disabled: !result.nextCursor, onClick: () => { setHistory([...history, cursor]); setCursor(result.nextCursor) } }))) : null),
        requestsOpen ? h(RequestWorkspace,{t,onClose:()=>setRequestsOpen(false)}) : null,
        adminOpen ? h(AdminWorkspace,{t,onRequests:()=>{setAdminOpen(false);setRequestsOpen(true)},onClose:()=>setAdminOpen(false),onBrowse:name=>{navigate(name);setAdminOpen(false)}}) : null,
        selected ? h(ObjectDetails, { key: `${bucket}/${selected}`, bucket, objectKey: selected, t, onClose: () => setSelected(null) }) : null)
    }

    function Settings({ t }) {
      const [state, setState] = useState(null)
      const [form, setForm] = useState(null)
      const [keys, setKeys] = useState({ accessKey: '', secretKey: '' })
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [saved, setSaved] = useState(false)
      const [baseline, setBaseline] = useState('')
      const [discard, setDiscard] = useState(false)
      const loadRef = useRef(null)

      const accept = data => {
        setState(data)
        const nextForm = {
          endpoint: data.settings.endpoint,
          region: data.settings.region,
          profile: data.settings.profile,
          caBundle: data.settings.caBundle ?? '',
          allowedBuckets: (data.settings.allowedBuckets ?? []).join(', '),
          downloadsDir: data.settings.downloadsDir,
          role: data.settings.role ?? 'user',
          allowWrites: Boolean(data.settings.allowWrites),
          allowDeletes: Boolean(data.settings.allowDeletes),
          insecureTLS: Boolean(data.settings.insecureTLS),
        }
        setForm(nextForm); setBaseline(JSON.stringify(nextForm))
      }

      const load = useCallback(async () => {
        loadRef.current?.abort()
        const controller = new AbortController(); loadRef.current = controller
        setBusy(true); setError(null); setSaved(false)
        try {
          const data = await api('settings/get', {}, controller.signal)
          if (!controller.signal.aborted) accept(data)
        } catch (cause) {
          if (!controller.signal.aborted) setError(cause.message)
        } finally {
          if (!controller.signal.aborted) setBusy(false)
        }
      }, [])

      useEffect(() => { load(); return () => loadRef.current?.abort() }, [load])

      const save = async () => {
        if (Boolean(keys.accessKey.trim()) !== Boolean(keys.secretKey.trim())) { setError(t('pairRequired')); return }
        setBusy(true); setError(null); setSaved(false); setDiscard(false)
        try {
          const body = {
            revision: state.revision,
            settings: {
              endpoint: form.endpoint.trim(),
              region: form.region.trim(),
              profile: form.profile.trim(),
              caBundle: form.caBundle.trim(),
              allowedBuckets: form.allowedBuckets.split(',').map(s => s.trim()).filter(Boolean),
              downloadsDir: form.downloadsDir.trim(),
              role: form.role,
              allowWrites: form.allowWrites,
              allowDeletes: form.allowDeletes,
              insecureTLS: form.insecureTLS,
            },
          }
          if (keys.accessKey && keys.secretKey) {
            body.accessKey = keys.accessKey
            body.secretKey = keys.secretKey
          }
          accept(await api('settings/save', body))
          setKeys({ accessKey: '', secretKey: '' })
          setSaved(true)
          window.dispatchEvent(new Event('osslab-settings-changed'))
        } catch (cause) {
          setError(cause.message)
        } finally {
          setBusy(false)
        }
      }

      if (!state || !form) {
        return h('div', { className: 'osslab-root osslab-settings' },
          h('p', { className: 'oss-muted' }, busy ? t('loading') : (error ?? '')),
          error ? h('button', { className: 'oss-btn', onClick: load }, t('reload')) : null)
      }

      const dirty = JSON.stringify(form) !== baseline || Boolean(keys.accessKey || keys.secretKey)
      const field = (label, key, hint = '') => h(React.Fragment, { key }, h('label', { htmlFor: `oss-${key}` }, label),
        h('div', null, h('input', { id: `oss-${key}`, className: 'oss-input', type: 'text', value: form[key] ?? '', onChange: event => setForm({ ...form, [key]: event.target.value }) }), hint ? h('p', { className: 'oss-field-help' }, hint) : null))
      const sectionHeading = (number, title, caption) => h('div', { className: 'oss-section-heading' }, h('span', { className: 'oss-section-number', 'aria-hidden': true }, number), h('div', null, h('h4', null, title), h('p', null, caption)))
      const toggle = (key, title, caption) => h('label', { className: 'oss-toggle' }, h('input', { type: 'checkbox', checked: form[key], onChange: e => setForm({ ...form, [key]: e.target.checked }) }), h('span', null, h('strong', null, title), h('small', null, caption)))
      const credentialReady = state.credentials.ok
      return h('div', { className: 'osslab-root osslab-settings' },
        h('div', { className: 'oss-settings-heading' }, h(Brand, { title: t('connectionTitle'), subtitle: t('settingsSubtitle'), icon: 'settings' })),
        h('fieldset', { disabled: busy },
          h('section', { className: 'oss-form-section' }, sectionHeading('01', t('connectionInfo'), t('connectionHelp')),
            h('div', { className: 'oss-field-group oss-grid' }, field(t('endpoint'), 'endpoint', t('endpointHelp')), field(t('profile'), 'profile', t('profileHelp')))),
          h('section', { className: 'oss-form-section' }, sectionHeading('02', t('personalCredentials'), t('credentialHelp')),
            h('div', { className: `oss-state oss-credential-state ${credentialReady ? 'good' : ''}` }, h(Icon, { name: credentialReady ? 'check' : 'shield' }), h('span', null, credentialReady ? t('credentialReady') : `${t('credentialMissing')} · ${state.credentials.problem ?? ''}`)),
            h('div', { className: 'oss-grid' },
              h('label', { htmlFor: 'oss-accessKey' }, t('accessKey')), h('div', null, h('input', { id: 'oss-accessKey', className: 'oss-input', type: 'password', autoComplete: 'off', value: keys.accessKey, placeholder: t('keepSecret'), onChange: e => setKeys({ ...keys, accessKey: e.target.value }) })),
              h('label', { htmlFor: 'oss-secretKey' }, t('secretKey')), h('div', null, h('input', { id: 'oss-secretKey', className: 'oss-input', type: 'password', autoComplete: 'new-password', value: keys.secretKey, placeholder: t('keepSecret'), onChange: e => setKeys({ ...keys, secretKey: e.target.value }) })))),
          h('section', { className: 'oss-form-section' }, sectionHeading('03', t('operationPolicy'), t('policyHelp')),
            toggle('allowWrites', t('allowWrites'), t('writeHelp')), toggle('allowDeletes', t('allowDeletes'), t('deleteHelp'))),
          h('details', { className: 'oss-disclosure oss-advanced' }, h('summary', null, h(Icon, { name: 'right' }), t('advanced')),
            h('div', null, h('div', { className: 'oss-grid' }, field(t('region'), 'region'), field(t('caBundle'), 'caBundle', t('caHelp')), field(t('allowedBuckets'), 'allowedBuckets'), field(t('downloads'), 'downloadsDir', t('downloadHelp'))),
              toggle('insecureTLS', t('insecure'), t('tlsHelp')),
              h('p', { className: 'oss-path-note' }, `${t('credentials')}: ${state.credentials.path}`), h('p', { className: 'oss-path-note' }, `${t('paths')}: ${state.paths.settings || ''}`)))),
        h(ErrorNotice, { message: error, t }),
        discard ? h('div', { className: 'oss-confirm' }, h('span', null, t('discardQuestion')), h(Button, { onClick: () => { setDiscard(false); setKeys({ accessKey: '', secretKey: '' }); load() } }, t('discard')), h(Button, { onClick: () => setDiscard(false) }, t('continueEditing'))) : null,
        h('div', { className: 'oss-settings-footer' },
          h('span', { className: `oss-save-status ${dirty ? 'dirty' : saved ? 'saved' : ''}`, role: 'status' }, h(Icon, { name: dirty ? 'clock' : 'check' }), dirty ? t('dirty') : saved ? t('saved') : t('upToDate')),
          h('div', { className: 'oss-actions' }, h(Button, { className: 'primary', disabled: busy || !dirty, onClick: save }, busy ? t('saving') : t('save')), h(Button, { disabled: busy, onClick: () => dirty ? setDiscard(true) : load() }, t('reload')))))
    }

    function ToolCard({ block, toolName, t }) {
      const done = 'kind' in block
      const text = done ? (Array.isArray(block.content) ? block.content.filter(c => c.type === 'text').map(c => c.text).join('\n') : String(block.content ?? '')) : ''
      const meta = block.meta?.version === 1 && block.meta.tool === toolName ? block.meta : null
      const [expanded, setExpanded] = useState(null)
      const open = expanded ?? Boolean(block.isError)
      const status = !done ? t('running') : block.isError ? t('failed') : meta?.preview ? t('plan') : t('done')
      const operation = toolName.replace(/^osslab_/, '')
      const icon = ({ doctor: 'shield', buckets: 'database', ls: 'folder', stat: 'file', get: 'download', put: 'upload', put_new: 'upload', delete: 'trash', request: 'file' })[operation]
      return h('article', { className: 'osslab-root oss-tool' },
        h('button', { className: 'oss-tool-toggle', 'aria-expanded': open, onClick: () => setExpanded(!open) },
          h('span', { className: 'oss-tool-symbol' }, h(Icon, { name: icon })), h('span', { className: 'oss-tool-info' }, h('strong', null, t(`tool_${operation}`)), h('small', { className: 'oss-mono' }, meta?.bucket ? `s3://${meta.bucket}/${meta.key ?? ''}` : toolName)),
          h('span', { className: `oss-tool-status ${block.isError ? 'error' : ''}` }, status), h(Icon, { name: !done ? 'refresh' : open ? 'down' : 'right', className: !done ? 'oss-spin' : '' })),
        open ? h('div', { className: 'oss-tool-body' }, h('pre', { className: 'oss-pre' }, text || status), done ? h('div', { className: 'oss-actions' }, h(Copy, { text, t })) : null) : null)
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('osslab', { zh, en }))
        const t = ctx.locale.bind('osslab')
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.pluginCss = 'dsh-osslab'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        })
        const register = (name, options, Component) =>
          ctx.slots.inject(name, () => ctx.slots.register({ name, locale: 'osslab', ...options }, props => h(Component, { ...props, t })))
        for (const name of ['doctor', 'buckets', 'ls', 'stat', 'get', 'put', 'put_new', 'delete', 'request']) {
          register('tool.call.toolview', { key: `osslab_${name}` }, ToolCard)
        }
        register('conversation.session.header.actions', { id: 'osslab-browser', order: 26 }, () =>
          h('span', { className: 'osslab-root' }, h(Button, { className: 'quiet oss-header', icon: 'storage', label: t('openPanel'), onClick: () => ctx.get('sidebarRight')?.openTab('dsh-osslab') }, 'OSS')))
        register('settings.section', { id: 'osslab', order: 130, label: () => t('settings') }, Settings)
        ctx.inject(['sidebarRightTabs', 'sidebarRight'], scope => {
          scope.effect(() => scope.get('sidebarRightTabs').register({
            id: 'dsh-osslab', kind: 'dsh-osslab', title: () => t('panel'), keepMounted: true,
            guide: [{ id: 'osslab-browse', order: 40, title: () => t('panel'), description: () => t('guide') }],
          }))
          scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register(
            { name: 'sidebar.right.pane.tab', key: 'dsh-osslab', locale: 'osslab' },
            props => h(Browser, { ...props, t })))
        })
      },
    }
  },
})
