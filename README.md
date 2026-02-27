# 🚗 API de Mobilidade Urbana (MVP)

Uma API RESTful robusta desenvolvida em Node.js para simular o backend de um aplicativo de mobilidade urbana (estilo Uber/99). O sistema gerencia passageiros, motoristas, cálculo automático de rotas e fluxo completo de pagamentos.

## 🚀 Principais Funcionalidades

- **Gestão de Usuários e Condutores:** Cadastro e autenticação com senhas criptografadas (Bcrypt).
- **Match Inteligente:** O sistema gerencia o ciclo de vida completo da corrida (`awaiting_payment`, `requested`, `accepted`, `arrived`, `in_progress`, `completed`, `canceled`).
- **Geocoding Integrado:** Conversão automática de endereços em texto para coordenadas geográficas usando a API do OpenStreetMap (Nominatim).
- **Precificação Automática:** Cálculo matemático de distância em linha reta (Fórmula de Haversine) rodando direto no servidor para evitar fraudes no frontend.
- **Fluxo de Pagamentos:** Integração lógica de pagamento simulado (PIX). A corrida só é liberada para os motoristas após a confirmação do pagamento, com suporte a estorno automático em caso de cancelamento.
- **Auditoria de Dados:** Arquitetura *Append-Only* para o histórico de status das corridas, mantendo uma linha do tempo imutável de todos os eventos.

## 🛠️ Tecnologias Utilizadas

- **Node.js** & **Express:** Estrutura base da API e rotas.
- **SQLite3:** Banco de dados relacional leve e ágil.
- **Bcrypt:** Hashing de senhas para segurança.
- **Arquitetura MVC (simplificada):** Separação clara de responsabilidades entre Controladores, Banco e Rotas.

## 📦 Como Rodar o Projeto Localmente

1. Clone este repositório:
   ```bash
   git clone [https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git](https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git)