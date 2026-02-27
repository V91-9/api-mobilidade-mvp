const express = require("express");
const crypto = require("crypto");
const db = require("./src/database/database");
const userController = require("./src/controllers/userController");
const rideController = require("./src/controllers/rideController");
const driverController = require("./src/controllers/driverController");
const paymentController = require("./src/controllers/paymentController");
const utils = require("./src/utils/utils");

const app = express();
app.use(express.json());

// 1. Rota para Criar Conta (Cadastro)
app.post("/register", async (req, res) => {
  const { name, birthdate, email, password, phone } = req.body;

  try {
    const newUser = await userController.createUser({
      name,
      birthdate,
      email,
      password,
      phone,
    });
    res
      .status(201)
      .json({ message: "Conta criada com sucesso!", userId: newUser.id });
  } catch (error) {
    res
      .status(400)
      .json({
        error: error.message || "Erro ao criar conta. Email já existe?",
      });
  }
});

// 2. Rota para Login (Aproveitando a função extra da IA!)
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await userController.verifyUser(email, password);
    res.json({ message: "Login realizado com sucesso!", userName: user.name });
  } catch (error) {
    // Se a senha estiver errada ou usuário não existir, cai aqui
    res.status(401).json({ error: error.message });
  }
});

// 3. Rota para Solicitar Redefinição de Senha
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userController.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");

    // Atualiza o token direto no banco
    db.run(
      `UPDATE users SET reset_token = ? WHERE email = ?`,
      [resetToken, email],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Erro ao gerar token." });
        }

        console.log(`\n📧 [EMAIL SIMULADO]`);
        console.log(
          `Para redefinir a senha de ${email}, use o token: ${resetToken}\n`,
        );

        res.json({
          message:
            "Se o email existir, um token de recuperação foi enviado (veja o terminal).",
        });
      },
    );
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// 4. Rota para Efetivar a Redefinição de Senha
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        await userController.resetPassword(token, newPassword);
        res.json({ message: "Senha redefinida com sucesso! Você já pode fazer login com a nova senha." });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/*
// 5. Rota para Solicitar Corrida
app.post('/ride/request', async (req, res) => {
    // Extrai todos os dados que o aplicativo vai enviar no JSON
    const {
      userId,
      rideType,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
    } = req.body;

    try {
      // Calcula a distância matemática entre os pontos
      const calculatedDistance = utils.calculateDistance(
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
      );

      // Calcula o preço com base na distância e na categoria do carro
      const calculatedPrice = utils.calculatePrice(
        calculatedDistance,
        rideType,
      );

      // Envia para o controller processar e salvar no banco
      const newRide = await rideController.requestRide({
        userId,
        rideType,
        price: calculatedPrice,
        distance: calculatedDistance,
        pickupAddress,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
      });

      res.status(201).json({
        message: "Corrida solicitada com sucesso!",
        ride: newRide,
        distanceKm: calculatedDistance,
        priceBRL: calculatedPrice,
      });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
*/

// 5. Rota para Solicitar Corrida
app.post('/ride/request', async (req, res) => {
    let { 
        userId, rideType, 
        pickupAddress, pickupLat, pickupLng, 
        dropoffAddress, dropoffLat, dropoffLng 
    } = req.body; 

    try {
      // SE NÃO ENVIOU AS COORDENADAS DE ORIGEM, DESCOBRE PELO NOME!
      if (!pickupLat || !pickupLng) {
        console.log(`Buscando coordenadas para origem: ${pickupAddress}...`);
        const pickupCoords = await utils.geocodeAddress(pickupAddress);
        pickupLat = pickupCoords.lat;
        pickupLng = pickupCoords.lng;
      }

      // SE NÃO ENVIOU AS COORDENADAS DE DESTINO, DESCOBRE PELO NOME!
      if (!dropoffLat || !dropoffLng) {
        console.log(`Buscando coordenadas para destino: ${dropoffAddress}...`);
        const dropoffCoords = await utils.geocodeAddress(dropoffAddress);
        dropoffLat = dropoffCoords.lat;
        dropoffLng = dropoffCoords.lng;
      }

      // 1. Calcula a distância matemática entre os pontos
      const calculatedDistance = utils.calculateDistance(
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng
      );

      // 2. Estima o tempo da viagem
      const estimatedTime = utils.estimateTime(calculatedDistance);

      // 3. Calcula o preço com base na distância e na categoria da corrida
      const calculatedPrice = utils.calculatePrice(
        calculatedDistance,
        estimatedTime,
        rideType
      );

      // 4. Salva no banco de dados
      const newRide = await rideController.requestRide({
        userId,
        rideType,
        price: calculatedPrice,
        distance: calculatedDistance,
        pickupAddress,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffLat,
        dropoffLng
      });

      res.status(201).json({
        message: "Corrida solicitada com sucesso! Aguardando PIX.",
        ride: newRide,
        distanceKm: calculatedDistance,
        priceBRL: calculatedPrice,
        estimatedTimeMinutes: estimatedTime,
        debugCoords: {
          pickup: { lat: pickupLat, lng: pickupLng },
          dropoff: { lat: dropoffLat, lng: dropoffLng },
        },
      });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 6. Rota para Cancelar Corrida
app.post('/ride/cancel', async (req, res) => {
    const { rideId, userId } = req.body;

    try {
        const result = 
          await rideController.cancelRide(rideId, userId);
        const refundResult =
          await paymentController.refundPaymentByRideId(rideId);
        res.json({
          rideStatus: result,
          paymentStatus: refundResult.message });
    } catch (error) {
        // Retorna erro 400 (Bad Request) se esbarrar em alguma regra de negócio
        res.status(400).json({ error: error.message });
    }
});

// 7. Rota para Cadastrar Condutor
app.post('/driver/register', async (req, res) => {
    const { name, email, password, cnh, phone } = req.body;
    try {
        const newDriver = await driverController.createDriver({ name, email, password, cnh, phone });
        res.status(201).json({ message: "Motorista cadastrado com sucesso!", driverId: newDriver.id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 8. Rota para Cadastrar Veículo
app.post('/vehicle/add', async (req, res) => {
    const { driverId, plate, model, color, category } = req.body;
    try {
        const newVehicle = await driverController.addVehicle({ driverId, plate, model, color, category });
        res.status(201).json({ message: "Veículo cadastrado com sucesso!", vehicleId: newVehicle.id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 9. Rota para Motorista Aceitar a Corrida
app.post('/ride/accept', async (req, res) => {
    let { rideId, driverId, vehicleId, driverLat, driverLng, driverAddress } = req.body;


    
    try {
      // Validação inicial
      if (!rideId || !driverId || !vehicleId) {
        return res
          .status(400)
          .json({
            error: "IDs da corrida, motorista e veículo são obrigatórios.",
          });
      }
      if (!driverLat || !driverLng) {
        if (driverAddress) {
          console.log(`Buscando GPS do motorista em: ${driverAddress}...`);
          const coords = await utils.geocodeAddress(driverAddress);
          driverLat = coords.lat;
          driverLng = coords.lng;
        } else {
          return res
            .status(400)
            .json({ error: "A localização atual do motorista é obrigatória." });
        }
      }

      // 1. Aceita a corrida no banco e pega as coordenadas do passageiro
      const result = await rideController.acceptRide(
        rideId,
        driverId,
        vehicleId,
      );

      // 2. Calcula a distância entre o Motorista e o Passageiro
      const distanceToPickup = utils.calculateDistance(
        driverLat,
        driverLng,
        result.pickupLat,
        result.pickupLng,
      );

      // 3. Calcula o tempo estimado para o motorista chegar
      const timeToPickup = utils.estimateTime(distanceToPickup);

      delete result.pickupLat;
      delete result.pickupLng;

      // 4. Devolve o resultado final com a previsão!
      res.json({
        ...result,
        distanceToPickupKm: distanceToPickup,
        estimatedArrivalMinutes: timeToPickup,
      });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 10. Rota para Gerar Pagamento da Corrida
app.post('/payment/create', async (req, res) => {
    const { rideId, amount, paymentMethod } = req.body;
    try {
        const payment = await paymentController.createPayment({ rideId, amount, paymentMethod });
        res.status(201).json({ message: "Pagamento gerado com sucesso!", payment });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 11. Rota para Confirmar/Atualizar Pagamento
app.post('/payment/update', async (req, res) => {
    const { paymentId, status, transactionId } = req.body;
    try {
        const result = await paymentController.updatePaymentStatus(paymentId, status, transactionId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 12. Rota para Atualizar Status da Corrida (Chegou, Em Andamento, Concluída, Cancelada)
app.post('/ride/status', async (req, res) => {
    const { rideId, status } = req.body;

    // Regra de segurança básica: só aceitar status válidos
    const validStatuses = ['arrived', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
    }

    try {
        const result = await rideController.updateRideStatus(rideId, status);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 13. Rota para Consultar uma Corrida Específica
app.get('/ride/:id', async (req, res) => {
    try {
        const ride = await rideController.getRideById(req.params.id);
        if (!ride) return res.status(404).json({ error: "Corrida não encontrada." });
        res.json(ride);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 14. Rota para Listar o Histórico de Corridas do Usuário (Passageiro)
app.get('/user/:userId/rides', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const history = await rideController.getUserRideHistory(userId);
        
        if (history.length === 0) {
            return res.status(200).json({ message: "Você ainda não realizou nenhuma viagem.", rides: [] });
        }

        res.status(200).json({ totalRides: history.length, rides: history });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Liga o servidor na porta 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor de Mobilidade rodando em http://localhost:${PORT}`);
});
