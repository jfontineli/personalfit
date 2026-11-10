# Desenvolvimento local

Use Node 24 e npm workspaces na raiz. Instale dependências com npm ci. O ambiente Supabase local usa Docker e npm run db:start. Preserve bancos locais com trabalho em andamento. Prepare reset e seed somente em instância descartável específica para testes.

Copie [.env.example](../../.env.example) para apps/web/.env.local. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY do projeto local. Service role nunca entra nas variáveis do frontend. Use npm run dev. Para verificar a PWA, gere o build e execute preview em apps/web com npx vite preview --host 127.0.0.1.

O seed contém identidades fictícias sem senha para RLS. O fluxo interativo começa com uma conta de teste preparada no ambiente isolado: superadmin convida personal, que cadastra e convida aluno. Preparação administrativa de fixtures e onboarding da aplicação têm responsabilidades distintas.

[Agente raiz](../../AGENTS.md) · [Testes e requisitos do alvo](TESTING.md) · [Ambientes](INFRASTRUCTURE.md)
