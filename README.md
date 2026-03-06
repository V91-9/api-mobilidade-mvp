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

O servidor estará rodando em `http://localhost:3000`. O banco de dados (`database.sqlite`) será gerado automaticamente na primeira execução.

---

## 📖 Documentação da API (Endpoints)

**URL Base:** `http://localhost:3000`  
**Content-Type:** `application/json`

---

### 1. 👤 Autenticação e Gestão de Usuários

#### 1.1. Criar Conta (Passageiro)
* **Método:** `POST /register`
* **Descrição:** Cria um novo usuário padrão (Passageiro) no sistema.
* **Body (JSON):**
  ```json
  {
    "name": "João Silva",
    "email": "joao@email.com",
    "cpf": "12345678900",
    "phone": "11999999999",
    "password": "senha_segura",
    "birthdate": "1990-01-01"
  }
  ```

#### 1.2. Fazer Login (Unificado)
* **Método:** `POST /login`
* **Descrição:** Autentica o usuário e devolve seu perfil completo.
* **Body (JSON):**
  ```json
  {
    "email": "joao@email.com",
    "password": "senha_segura"
  }
  ```
* **Retorno de Sucesso (200 OK):**
  ```json
  {
    "message": "Login realizado com sucesso!",
    "user": {
      "id": 1,
      "name": "João Silva",
      "email": "joao@email.com",
      "isDriver": true,
      "driverDetails": { "driverId": 1, "cnh": "123456" } 
    }
  }
  ```

#### 1.3. Recuperação de Senha
* **Solicitar Token:** `POST /forgot-password` | Body: `{ "email": "joao@email.com" }`
* **Redefinir Senha:** `POST /reset-password` | Body: `{ "token": "TOKEN_RECEBIDO", "newPassword": "nova_senha" }`

---

### 2. 🚗 Perfil do Motorista e Veículo

#### 2.1. Ativar Perfil de Motorista
* **Método:** `POST /driver/register`
* **Descrição:** Transforma um passageiro existente em motorista.
* **Body:** `{ "userId": 1, "cnh": "123456789" }`

#### 2.2. Cadastrar Veículo
* **Método:** `POST /vehicle/add`
* **Descrição:** Vincula um carro ao perfil do motorista.
* **Body:** `{ "driverId": 1, "plate": "ABC-1234", "model": "Toyota Corolla", "color": "Prata" }`

#### 2.3. Consultar Avaliação do Motorista
* **Método:** `GET /driver/:driverId/rating`
* **Descrição:** Retorna a nota média e o total de avaliações do motorista.

---

### 3. 📍 Simulações para o App (MVP)

#### 3.1. Buscar Motoristas Próximos e Previsão de Tempo
* **Método:** `GET /simulation/nearby-drivers`
* **Query Params:**
  * Com GPS: `?lat=-23.55&lng=-46.63`
  * Endereço Manual: `?address=Avenida Paulista, 1000`
* **Retorno de Sucesso (200 OK):**
  ```json
  {
    "etaAverageMinutes": 4,
    "nearbyDrivers": [
      { "id": 101, "name": "Carlos S.", "rating": 4.8, "car": "Toyota Corolla", "distanceKm": 1.2 }
    ]
  }
  ```

---

### 4. 🗺️ Fluxo da Viagem (Corridas)

#### 4.1. Solicitar Corrida (Passageiro)
* **Método:** `POST /ride/request`
* **Descrição:** Calcula distância, preço e tempo, salvando o pedido como `awaiting_payment`.
* **Body:**
  ```json
  {
    "userId": 1,
    "rideType": "confort",
    "pickupAddress": "Avenida Paulista, 1000",
    "pickupLat": -23.561, 
    "pickupLng": -46.656,
    "dropoffAddress": "Parque Ibirapuera",
    "dropoffLat": -23.587,
    "dropoffLng": -46.658
  }
  ```

#### 4.2. Buscar Detalhes da Corrida (Tempo Real)
* **Método:** `GET /ride/:id`
* **Descrição:** Retorna o status atual da corrida. Se já foi aceita, inclui dados do Motorista e Veículo.

#### 4.3. Aceitar Corrida (Motorista)
* **Método:** `POST /ride/accept`
* **Descrição:** Vincula o motorista à corrida e calcula o tempo estimado de chegada até o passageiro.
* **Body:** ```json
  {
    "rideId": 1,
    "driverId": 1,
    "vehicleId": 1,
    "driverLat": -23.550,
    "driverLng": -46.633
  }
  ```

#### 4.4. Atualizar Status da Viagem (Motorista)
* **Método:** `POST /ride/status`
* **Descrição:** Avisa andamento: `arrived` (chegou), `in_progress` (embarcou), `completed` (finalizou).
* **Body:** `{ "rideId": 1, "status": "in_progress" }`

#### 4.5. Cancelar Corrida (Inteligente)
* **Método:** `POST /ride/cancel`
* **Descrição:** Se o passageiro cancelar, a corrida morre e ocorre estorno automático. Se o motorista cancelar, a corrida volta para a fila (`requested`).
* **Body:** `{ "rideId": 1, "userId": 1 }`

---

### 5. 💳 Pagamentos

#### 5.1. Iniciar Pagamento
* **Método:** `POST /payment/create`
* **Descrição:** Gera a intenção de pagamento.
* **Body:** `{ "rideId": 1, "amount": 25.50, "paymentMethod": "pix" }`

#### 5.2. Confirmar Pagamento
* **Método:** `POST /payment/update`
* **Descrição:** **Gatilho de liberação:** Ao enviar status `completed`, a corrida é liberada automaticamente para os motoristas na região.
* **Body:** `{ "paymentId": 1, "status": "completed", "transactionId": "pix_abc123" }`

---

### 6. ⭐ Avaliação e Histórico

#### 6.1. Avaliar Motorista
* **Método:** `POST /ride/rate`
* **Descrição:** Passageiro avalia a corrida finalizada.
* **Body:** `{ "rideId": 1, "userId": 1, "rating": 5, "comment": "Excelente!" }`

#### 6.2. Histórico de Viagens (Passageiro)
* **Método:** `GET /user/:userId/rides`
* **Descrição:** Lista todas as corridas já feitas pelo usuário.