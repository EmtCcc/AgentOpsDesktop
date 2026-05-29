import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AgentOps Desktop',
  description: 'Local-first desktop application for orchestrating multiple AI agents',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'AgentOps Docs',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'API', link: '/api/reference' },
      {
        text: 'Extend',
        items: [
          { text: 'Adapter Guide', link: '/adapters/guide' },
          { text: 'Skill Guide', link: '/skills/guide' },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Contributing', link: '/guide/contributing' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'IPC Reference', link: '/api/reference' },
          ],
        },
      ],
      '/adapters/': [
        {
          text: 'Adapters',
          items: [
            { text: 'Adapter Guide', link: '/adapters/guide' },
          ],
        },
      ],
      '/skills/': [
        {
          text: 'Skills',
          items: [
            { text: 'Skill Guide', link: '/skills/guide' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/EmtCcc/AgentOpsDesktop' },
    ],
    footer: {
      message: 'Released under the Proprietary License.',
      copyright: 'Copyright © 2026 AgentOps',
    },
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/EmtCcc/AgentOpsDesktop/edit/main/docs-site/:path',
    },
  },
})
