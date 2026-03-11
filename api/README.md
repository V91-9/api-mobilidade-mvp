# 🚗 API de Mobilidade Urbana (MVP)

Uma API RESTful robusta desenvolvida em Node.js para simular o backend de um aplicativo de mobilidade urbana (estilo Uber/99). O sistema gerencia passageiros, motoristas, cálculo automático de rotas e fluxo completo de pagamentos.

## 🚀 Principais Funcionalidades

- **Gestão de Usuários e Condutores:** Cadastro e autenticação com senhas criptografadas (Bcrypt).
- **Match Inteligente:** O sistema gerencia o ciclo de vida completo da corrida (`awaiting_payment`, `requested`, `accepted`, `arrived`, `in_progress`, `completed`, `canceled`).
- **Geocoding Integrado:** Conversão automática de endereços em texto para coordenadas geográficas usando a API do OpenStreetMap (Nominatim).
- **Precificação Automática:** Cálculo matemático de distância em linha reta (Fórmula de Haversine) rodando direto no servidor para evitar fraudes.
- **Fluxo de Pagamentos:** Integração lógica de pagamento simulado (PIX). A corrida só é liberada para os motoristas após a confirmação.
- **Auditoria de Dados:** Arquitetura *Append-Only* para o histórico de status das corridas, mantendo uma linha do tempo imutável de todos os eventos.

## 🛠️ Tecnologias Utilizadas

- **Node.js** & **Express:** Estrutura base da API e rotas.
- **SQLite3:** Banco de dados relacional leve e ágil.
- **Bcrypt:** Hashing de senhas para segurança.
- **Arquitetura MVC:** Separação clara de responsabilidades entre Controladores, Banco e Rotas, com camada de Serviços isolada.

## 📖 Documentação Completa (Endpoints)

Toda a documentação detalhada da API, incluindo exemplos de requisições (body), parâmetros e respostas (JSON), está organizada na nossa Wiki.

👉 **[Acesse a Documentação da API na Wiki](https://github.com/V91-1/api-mobilidade-mvp/wiki)**

## 📦 Como Rodar o Projeto Localmente

1. Clone este repositório:
   ```bash
   git clone [https://github.com/V91-1/api-mobilidade-mvp.git](https://github.com/V91-1/api-mobilidade-mvp.git)
   ```

2. Acesse a pasta do projeto:
   ```bash
   cd api-mobilidade-mvp
   ```

3. Instale as dependências necessárias:
   ```bash
   npm install
   ```

4. Inicie o servidor:
   ```bash
   node src/server.js
   ```

O servidor estará rodando em `http://localhost:3000`. O banco de dados (`database.sqlite`) será gerado automaticamente na primeira execução com todas as tabelas necessárias.