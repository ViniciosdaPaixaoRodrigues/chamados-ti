# HelpDesk TI — Organização de Chamados

---

## Informações do Aluno

- **Nome:** Vinicios da Paixão Rodrigues
- **RA:** 141058
- **Curso:** Análise e Desenvolvimento de Sistemas
- **Instituição:** FECAF

---

## Descrição

Sistema web local para abertura, acompanhamento e organização de chamados de TI. O projeto foi re‑escrito para usar **Firebase Firestore** como banco de dados (admin SDK) em vez de **Sequelize/SQLite**, mantendo o padrão **MVC** com **Node.js, Express, EJS** e **CSS**.

> **Observação:** o ambiente de produção no **Render** ainda não foi concluído com sucesso; o projeto está pronto para ser rodado localmente.

---

## Tecnologias

- **Node.js** (v20+) & **Express**
- **EJS** – templates de view
- **Firebase Admin SDK** – Firestore (substitui Sequelize/SQLite)
- **CSS** – estilos simples
- **PowerShell** scripts (para desenvolvimento local)

---

## Como rodar

```bash
# Instalar dependências
npm install

# Variáveis de ambiente (exemplo)
# Crie um arquivo .env na raiz com:
# FIREBASE_SERVICE_ACCOUNT='<JSON da conta de serviço>'
# PORT=3000

# Iniciar o servidor
npm start        # http://localhost:3000
```

- `npm run dev` – reinicia automaticamente ao salvar arquivos (`node --watch`).
- `npm run seed` – **recria** o banco de dados com dados de exemplo (agora gera documentos no Firestore local de teste).

---

## Funcionalidades

- **Dashboard**: indicadores, fila prioritária, tickets por status/ prioridade, carga da equipe, distribuição por categoria e tempo médio de resolução.
- **Chamados**: CRUD completo, busca (título, solicitante, protocolo `CH‑00001`), filtros por status, prioridade, categoria e técnico.
- **Ações rápidas**: alterar status, prioridade e responsável com registro automático no histórico.
- **Comentários** e linha do tempo por chamado.
- **Técnicos** e **Categorias**: cadastro, edição e remoção.
- **Fallback JSON** – caso o Firestore falhe em produção, os controllers carregam arquivos estáticos em `utils/fallback/` para garantir que a UI continue funcional.

---

## Estrutura (MVC)

```
app.js                 # inicialização do Express e middlewares
config/                # constantes (status, prioridades, setores)
controllers/           # regras de cada recurso (Firebase + fallback)
models/                # referências a coleções Firestore (Category, Ticket, Technician, Comment, User)
routes/                # mapeamento de URLs → controllers
middlewares/           # variáveis globais para as views
views/                 # templates EJS (partials, tickets, technicians, categories)
public/                # CSS e JS estáticos
seeders/               # scripts de seed (criam documentos de exemplo)
utils/                 # helpers, fallback loader, etc.
fallback/              # arquivos JSON usados como fallback quando o Firestore falha
```

---

## Deploy (Render)

> O projeto ainda não foi implantado com sucesso no **Render**. Quando a implantação for concluída, adicione instruções de deploy (variáveis de ambiente, build steps, etc.) aqui.

---

## Licença

Este projeto está licenciado sob a licença MIT – veja o arquivo `LICENSE` para mais detalhes.
