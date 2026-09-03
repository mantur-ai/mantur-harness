## Catalog

- main "技能广场":
  - button "返回对话":
    - img
    - text: 返回对话
  - heading "技能广场" [level=1]
  - paragraph: 发现适合漫剧创作的技能，让重复步骤自动完成。
  - text: 已安装 0 个
  - img
  - textbox:
    - /placeholder: 搜索技能名称、用途或触发词
  - button "全部"
  - button "漫剧创作"
  - article:
    - button "故事导演 把完整剧本整理成可执行的漫剧制作方案。":
      - strong: 故事导演
      - text: 把完整剧本整理成可执行的漫剧制作方案。
    - text: 漫剧创作
    - button "查看"

## Detail

- dialog "故事导演":
  - heading "故事导演" [level=2]
  - button "关闭":
    - img
  - paragraph: 把完整剧本整理成可执行的漫剧制作方案。
  - text: 漫剧创作 版本 1.2.3
  - paragraph: 从剧本分析开始，自动组织角色、场景和分镜。
  - button "登录后安装"

## Login gate

- dialog "故事导演":
  - heading "故事导演" [level=2]
  - button "关闭":
    - img
  - paragraph: 把完整剧本整理成可执行的漫剧制作方案。
  - text: 漫剧创作 版本 1.2.3
  - paragraph: 从剧本分析开始，自动组织角色、场景和分镜。
  - text: 在 ManturHub 登录页输入授权码
  - strong: MANTUR-1234
  - link "打开 ManturHub 登录页":
    - /url: {{manturHubUrl}}/verify
  - button "取消登录"
  - button "登录后安装" [disabled]

## Install failure

- dialog "故事导演":
  - heading "故事导演" [level=2]
  - button "关闭":
    - img
  - paragraph: 把完整剧本整理成可执行的漫剧制作方案。
  - text: 漫剧创作 版本 1.2.3
  - paragraph: 从剧本分析开始，自动组织角色、场景和分镜。
  - alert: 技能安装失败，原有文件没有被覆盖。请稍后重试。
  - button "安装技能"
