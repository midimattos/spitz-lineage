# 🐕 SPITZ LINEAGE MANAGER v2.0 — Guia de Deploy

## Estrutura do Projeto

```
spitz-lineage/
├── index.html              ← Entrada principal + config Firebase
├── manifest.json           ← PWA manifest
├── vercel.json             ← Config Vercel (SPA routing)
├── firestore.rules         ← Regras de segurança do Firestore
├── public/
│   └── icons/icon.svg
└── src/
    ├── app.js              ← Roteador principal
    ├── firebase.js         ← Serviço Firebase (Auth + Firestore)
    ├── styles/main.css     ← Todos os estilos
    ├── utils/
    │   ├── genetics.js     ← Motor genético (9 Loci + Punnett)
    │   └── pdf.js          ← Gerador de certificado PDF
    └── pages/
        ├── login.js
        ├── dogs.js         ← Lista + Árvore genealógica
        ├── dog-form.js     ← Formulário com abas e autocomplete
        ├── simulator.js    ← Simulador + COI
        └── profile.js
```

---

## PASSO 1 — Criar o Projeto Firebase

1. Acesse https://console.firebase.google.com
2. Clique em **"Adicionar Projeto"** → dê um nome (ex: `spitz-lineage`)
3. Desative o Google Analytics (opcional) → **Criar Projeto**

### 1.1 Ativar Authentication
1. No menu lateral → **Authentication** → **Começar**
2. Em **Métodos de login** → ative **E-mail/senha**
3. **IMPORTANTE — Bloquear cadastro público:**
   - Vá em Authentication → **Settings** → **User Actions**
   - Desmarque **"Ativar criação de usuário"** (ou use Identity Platform se disponível)
   - Alternativa: crie usuários manualmente em **Authentication → Users → Add User**

### 1.2 Criar o Banco de Dados (Firestore)
1. Menu lateral → **Firestore Database** → **Criar banco de dados**
2. Selecione **Modo de produção** → escolha uma região próxima (ex: `us-east1`)
3. Após criar, vá em **Rules** e cole o conteúdo do arquivo `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/dogs/{dogId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Clique em **Publicar**

### 1.3 Obter as Credenciais
1. Menu lateral → ⚙️ **Configurações do projeto** (engrenagem)
2. Role até **Seus aplicativos** → clique em **"</>** (Web)
3. Registre o app com um nome qualquer
4. Copie o objeto `firebaseConfig` — você vai precisar dos valores

---

## PASSO 2 — Configurar o Código

Abra o arquivo `index.html` e localize este bloco:

```html
<script>
  window.__ENV__ = {
    FIREBASE_API_KEY:             "COLE_AQUI",
    FIREBASE_AUTH_DOMAIN:         "COLE_AQUI.firebaseapp.com",
    FIREBASE_PROJECT_ID:          "COLE_AQUI",
    FIREBASE_STORAGE_BUCKET:      "COLE_AQUI.appspot.com",
    FIREBASE_MESSAGING_SENDER_ID: "COLE_AQUI",
    FIREBASE_APP_ID:              "COLE_AQUI"
  };
</script>
```

Substitua cada `"COLE_AQUI"` com os valores do seu Firebase.

---

## PASSO 3 — Fazer Deploy na Vercel (Grátis)

### Opção A — Deploy via Interface (mais fácil)

1. Crie uma conta em https://github.com se não tiver
2. Crie um novo repositório público ou privado
3. Faça upload de todos os arquivos do projeto para o repositório
4. Acesse https://vercel.com → faça login com GitHub
5. Clique em **"Add New Project"** → selecione o repositório
6. Não altere nenhuma configuração → clique em **Deploy**
7. Após o deploy, seu app estará em `https://seu-projeto.vercel.app`

### Opção B — Deploy via Terminal

```bash
# Instalar Vercel CLI
npm install -g vercel

# Na pasta do projeto
cd spitz-lineage
vercel

# Siga o assistente, aceite os padrões
# Para produção:
vercel --prod
```

---

## PASSO 4 — Criar o Primeiro Usuário (Cliente)

Como o cadastro público está bloqueado, você cria clientes manualmente:

1. Firebase Console → **Authentication → Users**
2. Clique em **"Adicionar usuário"**
3. Digite o e-mail e a senha do cliente
4. Envie as credenciais ao cliente por WhatsApp/e-mail
5. O cliente acessa `https://seu-projeto.vercel.app` e faz login

Para **cancelar o acesso** de um cliente:
- Firebase Console → Authentication → Users → clique no usuário → **Desativar conta**
- O cliente será deslogado automaticamente na próxima requisição

---

## PASSO 5 — Instalar como PWA (App no Celular)

### iOS (iPhone/iPad)
1. Abra o Safari e acesse o link do sistema
2. Toque no botão de compartilhamento (ícone de seta para cima)
3. Selecione **"Adicionar à Tela de Início"**
4. Dê o nome "Spitz Lineage" → **Adicionar**

### Android
1. Abra o Chrome e acesse o link
2. Toque nos 3 pontos (menu) → **"Adicionar à tela inicial"**
3. Ou aguarde o banner automático aparecer

---

## Funcionalidades Implementadas

### ✅ Motor Genético
- **9 Loci** implementados: A, K, E, B, D, S, M, H, I
- Regras de dominância completas (Hierarquia de Alelos)
- Regra de Ouro em 3 níveis: Fenótipo → Pedigree → Histórico de Provas
- Detecção de Double Merle com alerta visual
- Simulador Punnett com 20-100 filhotes

### ✅ Gestão de Cães
- Cadastro com 4 abas (Ficha, Pais, Avós, DNA)
- Separação Meu Canil / Banco de Linhagem
- Autocomplete profundo com preenchimento automático de avós
- Atalhos de cor (Presets)
- Chips de cores produzidas (mobile-friendly)

### ✅ Árvore Genealógica
- Modal com diagrama visual (3 gerações)
- Detecção de referências circulares (anti Stack Overflow)

### ✅ Simulador
- Seleção de macho + fêmea
- Cálculo de COI (Consanguinidade)
- Alerta de ancestrais comuns
- Geração de Certificado PDF profissional

### ✅ SaaS / Segurança
- Login travado (sem cadastro público)
- Isolamento total de dados por usuário (Firestore Rules)
- PWA instalável no celular
- Perfil com nome do canil para o PDF

---

## Próximos Passos (Sprint 3+)

- [ ] Ícones PWA em PNG (192x192 e 512x512) para melhor aparência
- [ ] Exportar/importar banco de cães em JSON (backup)
- [ ] Histórico de simulações salvo no Firestore
- [ ] Compartilhamento de árvore por link público
- [ ] Painel admin para gerenciar clientes
