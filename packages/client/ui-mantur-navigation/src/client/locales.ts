/** Copy owned by Mantur marketplace navigation and its empty pages. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  'section.features': '功能',
  'skills.title': '技能广场',
  'skills.description': '发现适合漫剧创作的技能，让重复步骤自动完成。',
  'skills.empty': '技能正在陆续上架，稍后从这里探索。',
  'recipes.title': '配方广场',
  'recipes.description': '把成熟的创作流程装进配方，一次交给漫途执行。',
  'recipes.empty': '配方正在准备中，稍后从这里开始创作。',
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
  'recipes.description': 'Package proven creative workflows into recipes Mantur can run for you.',
  'recipes.empty': 'Recipes are being prepared. Start creating from here soon.',
  'projects': 'Projects',
  'backToConversation': 'Back to conversation',
} satisfies Record<ManturNavigationKey, string>
