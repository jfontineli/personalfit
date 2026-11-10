# Infraestrutura

O monorepo fica no GitHub. O ambiente local usa a CLI Supabase com Docker e o servidor Vite. O ambiente remoto de teste usa Cloudflare Pages para a PWA e Supabase Cloud para Auth, PostgreSQL, Data API e Storage. Produção está planejada com projeto Supabase separado.

Consulte [infraestrutura e operação](../docs/projeto/INFRASTRUCTURE.md) para evidência por ambiente, variáveis públicas, publicação, migrations, backups e recuperação. O [estado atual](../docs/projeto/CURRENT_STATE.md) identifica a base Git e as mudanças locais.
