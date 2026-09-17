import { callOpenAI, getAIConfig } from './_shared.js'

export async function onRequestPost(context) {
  const { request, env } = context

  try {
  const { name, url, pageMeta } = await request.json()

  if (!name || !url) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing name or url'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const config = await getAIConfig(env)

  // 默认 Prompt（无 pageMeta）
  const defaultPrompt = `You are an assistant that generates concise and helpful descriptions for bookmarks/websites.

Given the following bookmark information:
Name: {name}
URL: {url}

Please write a specific 1-2 sentence description in Simplified Chinese that explains: what this website is, what it does, and who it is for. Aim for 40-100 characters (do not underwrite to sound "concise"; use the full budget). Never exceed 100 Chinese characters. Return only the description text, no quotes or formatting.`

  // 增强 Prompt（有 pageMeta 时使用页面元数据）
  const enhancedPrompt = `You are an expert assistant that generates concise and helpful descriptions for bookmarks/websites.

Given the following bookmark information:
Name: {name}
URL: {url}
{pageMetaContext}

Based on the above information, write a specific 1-2 sentence description in Simplified Chinese that explains: what this website is, what it does, and who it is for. Aim for 40-100 characters (do not underwrite to sound "concise"; use the full budget). Never exceed 100 Chinese characters. Return only the description text, no quotes or formatting.`

  // 获取自定义 Prompt 配置
  const settingsResults = await env.DB.prepare(
    'SELECT key, value FROM settings WHERE key IN (?, ?)'
  ).bind('ai_custom_prompt_description', 'ai_custom_prompt_description_enabled').all()

  const settings = {}
  settingsResults.results.forEach(row => {
    settings[row.key] = row.value
  })

  const customPromptEnabled = settings.ai_custom_prompt_description_enabled === 'true'
  const customPrompt = settings.ai_custom_prompt_description

  let promptTemplate
  if (customPromptEnabled && customPrompt && customPrompt.trim()) {
    promptTemplate = customPrompt
  } else if (pageMeta) {
    promptTemplate = enhancedPrompt
  } else {
    promptTemplate = defaultPrompt
  }

  // 构建页面元数据上下文
  const pageMetaContext = pageMeta
    ? [
        pageMeta.title ? `Page Title: ${pageMeta.title}` : null,
        pageMeta.metaDescription ? `Meta Description: ${pageMeta.metaDescription}` : null,
        pageMeta.ogDescription ? `OG Description: ${pageMeta.ogDescription}` : null,
        pageMeta.h1 ? `H1: ${pageMeta.h1}` : null,
        pageMeta.keywords ? `Keywords: ${pageMeta.keywords}` : null
      ].filter(Boolean).join('\n')
    : ''

  // 替换变量
  const prompt = promptTemplate
    .replace(/\{name\}/g, name)
    .replace(/\{url\}/g, url)
    .replace(/\{pageMetaContext\}/g, pageMetaContext)

    const response = await callOpenAI(env, {
      path: 'chat/completions',
      method: 'POST',
      body: {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You generate bookmark descriptions in Simplified Chinese. Aim for 40-100 characters (use the full budget); each description should be specific and informative rather than a generic tagline.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 400
      }
    })

    let data = await response.json()
    let choice = data.choices?.[0]
    console.log('[AI desc] finish_reason:', choice?.finish_reason, 'content:', JSON.stringify(choice?.message?.content)?.slice(0, 200))

    // 上游在限流窗口内可能返回畸形响应：finish_reason=length 但 content 完全为空。
    // 这种明显是网关错误而非真实截断（真实截断应有部分文本），立即重试一次可自愈。
    if (!choice?.message?.content?.trim() && choice?.finish_reason === 'length') {
      console.log('[AI desc] 畸形响应（length + 空 content），重试一次')
      const retryResponse = await callOpenAI(env, {
        path: 'chat/completions',
        method: 'POST',
        body: {
          model: config.model,
          messages: [
            {
              role: 'system',
              content: 'You generate bookmark descriptions in Simplified Chinese. Aim for 40-100 characters (use the full budget); each description should be specific and informative rather than a generic tagline.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 400
        }
      })
      data = await retryResponse.json()
      choice = data.choices?.[0]
      console.log('[AI desc] 重试后 finish_reason:', choice?.finish_reason, 'content:', JSON.stringify(choice?.message?.content)?.slice(0, 200))
    }

    const description = (choice?.message?.content?.trim() || '').slice(0, 100)

    if (!description) {
      const reason = choice?.finish_reason
      let errorMsg = 'AI 未返回有效描述'
      if (reason === 'content_filter') {
        errorMsg = '内容审核：生成结果触发了安全策略，请尝试简化描述或更换网址'
      } else if (reason) {
        errorMsg = `AI 生成中断：${reason}`
      }
      const rawContent = choice?.message?.content || ''
      errorMsg += ` · 诊断: finish_reason=${reason || '无'}, max_tokens=400, content长度=${rawContent.length}`
      const rawPreview = rawContent.slice(0, 150).replace(/\n/g, ' ')
      if (rawPreview && rawPreview !== description) {
        errorMsg += ` · AI 实际回复前150字: ${rawPreview}`
      }
      return new Response(JSON.stringify({
        success: false,
        error: errorMsg
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      description
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('AI generate description error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'AI 生成描述失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
