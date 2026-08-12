# 登录获取 token
$loginResp = Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"123123"}'
$token = $loginResp.token
Write-Host "Token: $($token.Substring(0,30))..."

# 测试 suggest-category
$catResp = Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/ai/suggest-category" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"name":"axtonliu/axton-obsidian-visual-skills","url":"https://github.com/axtonliu/axton-obsidian-visual-skills","description":"","categories":[{"id":"146","name":"域名","path":"域名"},{"id":"147","name":"VPS","path":"VPS(虚拟机)"},{"id":"148","name":"影视","path":"影视资源"},{"id":"149","name":"网络IP工具","path":"网络IP工具"}]}'
Write-Host "分类结果: success=$($catResp.success) categoryId=$($catResp.categoryId) reason=$($catResp.reason)"

# 测试 generate-description
$descResp = Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/ai/generate-description" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"name":"axtonliu/axton-obsidian-visual-skills","url":"https://github.com/axtonliu/axton-obsidian-visual-skills"}'
Write-Host "描述结果: success=$($descResp.success) description=$($descResp.description)"
