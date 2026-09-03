/** Copy owned by Mantur marketplace navigation and its empty pages. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  'section.features': '功能',
  'skills.title': '技能广场',
  'skills.description': '发现适合漫剧创作的技能，让重复步骤自动完成。',
  'skills.empty': '技能正在陆续上架，稍后从这里探索。',
  'recipes.title': '配方广场',
  'recipes.description': '从经过验证的优秀案例出发，替换成你的内容，让漫途复刻同款效果。',
  'recipes.empty': '每份配方包含效果样片、提示词模板、可复现算子参数、模型与算子信息和预计复刻成本。配方本身免费；使用配方复刻时按算子实时报价，并在开始前请你确认。',
  'projects': '项目',
  'backToConversation': '返回对话',
} satisfies Record<string, string>

/** Mantur navigation dictionary key union. */
export type ManturNavigationKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  'section.features': 'Features',
  'skills.title': 'Skill Marketplace',
  'skills.description': 'Discover skills for drama creation and automate repetitive steps.',
  'skills.empty': 'Skills are on their way. Explore them here soon.',
  'recipes.title': 'Recipe Marketplace',
  'recipes.description': 'Start from a proven creative example, replace it with your content, and let Mantur recreate the result.',
  'recipes.empty': 'Each recipe includes a sample, prompt template, reproducible operator parameters, model and operator details, and an estimated recreation cost. The recipe itself is free; recreation is quoted in real time by operator and starts after you confirm the price.',
  'projects': 'Projects',
  'backToConversation': 'Back to conversation',
} satisfies Record<ManturNavigationKey, string>
