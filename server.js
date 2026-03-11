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
app.post('/register', async (req, res) => {

    const { name, email, cpf, phone, password, birthdate } = req.body;

    try {
        const newUser = await userController.createUser({
            name,
            email,
            cpf,
            phone,
            password,
            birthdate
        });

        res.status(201).json(newUser);

    } catch (error) {
        res.status(400).json({
            error: error.message || "Erro ao criar conta. Email ou CPF já existem?"
        });
    }
});

// 2. Rota para Login
app.post('/login', async (req, res) => {

    const { email, password } = req.body;

    try {
        const result = await userController.verifyUser(email, password);

        res.status(200).json(result);

    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// 3. Rota para Solicitar Redefinição de Senha (Gera Token)
app.post('/forgot-password', async (req, res) => {

    const { email } = req.body;

    try {
        const result = await userController.generateResetToken(email);
        
        console.log(`\n📧 [EMAIL SIMULADO]`);
        console.log(`Para redefinir a senha de ${result.email}, use o token:`);
        console.log(`${result.resetToken}`);

        res.status(200).json({ 
            message: "Se o email existir, um token de recuperação foi enviado (veja o terminal)." 
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 4. Rota para Efetivar a Redefinição de Senha
app.post('/reset-password', async (req, res) => {

    const { token, newPassword } = req.body;

    try {
        const result = await userController.resetPassword(token, newPassword);
        
        res.status(200).json(result);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

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
          message: newRide.message,
          ride: newRide.ride,
          tripDetails: {
            distanceKm: calculatedDistance,
            estimatedTimeMinutes: estimatedTime,
            priceBRL: calculatedPrice,
          },
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
        const result = await rideController.cancelRide(rideId, userId);

        let paymentMessage =
            "Nenhum estorno necessário (a corrida retornou para a lista de solicitações).";

        if (result.status === "canceled") {

            const refundResult = await paymentController.refundPaymentByRideId(rideId);
            paymentMessage = refundResult.message;
        }

        res.status(200).json({
            rideStatus: result,
            paymentStatus: paymentMessage
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 7. Rota para Cadastrar Condutor
app.post('/driver/register', async (req, res) => {

    const { userId, cnh } = req.body;

    try {
        const newDriver = await driverController.createDriver({ userId, cnh });
        
        res.status(201).json(newDriver);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 8. Rota para Cadastrar Veículo
app.post('/vehicle/add', async (req, res) => {

    const { driverId, plate, model, color } = req.body;

    try {
        const newVehicle = await driverController.addVehicle({ driverId, plate, model, color });
        
        res.status(201).json(newVehicle);

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
            return res.status(400).json({
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
                return res.status(400).json({
                    error: "A localização atual do motorista é obrigatória.",
                });
            }
        }

        // 1. Aceita a corrida no banco e pega as coordenadas do passageiro
        const result = await rideController.acceptRide(
            rideId,
            driverId,
            vehicleId
        );

        // 2. Extrai as coordenadas de embarque que vieram do banco de dados
        const pickupLat = result.ride.pickup_lat;
        const pickupLng = result.ride.pickup_lng;

        // 3. Calcula a distância entre o Motorista e o Passageiro
        const distanceToPickup = utils.calculateDistance(
            driverLat,
            driverLng,
            pickupLat,
            pickupLng,
        );

        // 4. Calcula o tempo estimado para o motorista chegar
        const timeToPickup = utils.estimateTime(distanceToPickup);

        // 5. Devolve o resultado final com a previsão!
        res.status(200).json({
            message: result.message,
            ride: result.ride,
            driverApproach: {
                distanceToPickupKm: parseFloat(distanceToPickup.toFixed(2)),
                estimatedArrivalMinutes: timeToPickup,
            },
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 10. Rota para Gerar Pagamento da Corrida
app.post('/payment/create', async (req, res) => {

    const { rideId, amount, paymentMethod } = req.body;

    try {
        const newPayment = await paymentController.createPayment({ rideId, amount, paymentMethod });
        
        res.status(201).json(newPayment);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 11. Rota para Confirmar/Atualizar Pagamento
app.post('/payment/update', async (req, res) => {

    const { paymentId, status, transactionId } = req.body;

    try {
        const result = await paymentController.updatePaymentStatus(paymentId, status, transactionId);
        
        res.status(200).json(result);

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
        
        res.status(200).json(result);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 13. Rota para Consultar uma Corrida Específica
app.get('/ride/:id', async (req, res) => {

    try {
        const ride = await rideController.getRideById(req.params.id);
        
        if (!ride) {
            return res.status(404).json({ error: "Corrida não encontrada." });
        }

        res.status(200).json(ride);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 14. Rota para Listar o Histórico de Corridas do Usuário (Passageiro)
app.get('/user/:userId/rides', async (req, res) => {

    const userId = req.params.userId;

    try {
        const history = await rideController.getUserRideHistory(userId);

        if (!result) {
            return res.status(404).json({ 
                error: "Usuário não encontrado no sistema."
            });
        }
        
        if (history.length === 0) {
            return res.status(200).json({ 
                message: "Você ainda não realizou nenhuma viagem.",
                rides: []
            });
        }

        res.status(200).json(history);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 15. Rota para Avaliar o Motorista (Fim da Corrida)
app.post('/ride/rate', async (req, res) => {

    const { rideId, userId, rating, comment } = req.body;

    try {
        const result = await rideController.rateDriver(rideId, userId, rating, comment);
        
        res.status(201).json(result);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 16. Rota para Consultar a Nota Média do Motorista
app.get('/driver/:driverId/rating', async (req, res) => {
    
    const driverId = req.params.driverId;

    try {
        const result = await driverController.getDriverRating(driverId);

        if (!result) {
            return res.status(404).json({
                error: "Motorista não encontrado no sistema."
            });
        }
        
        res.status(200).json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 17. Rota Simulada para o MVP - Suporta GPS Automático ou Endereço Manual
app.get('/simulation/nearby-drivers', async (req, res) => {

    let { lat, lng, address } = req.query;

    try {
        // Se NÃO tem GPS, mas TEM o endereço manual digitado
        if ((!lat || !lng) && address) {

            console.log(`[Simulador] Convertendo endereço manual para GPS: ${address}...`);
            const coords = await utils.geocodeAddress(address);
            lat = coords.lat;
            lng = coords.lng;

        } else if (!lat || !lng) {
            return res.status(400).json({ 
                error: "Validação: Envie a localização atual (lat/lng) ou um endereço de origem (address)." 
            });
        }

        console.log(`[Simulador] Buscando carros próximos à coordenada: ${lat}, ${lng}`);

        // Motoristas fictícios com tempos individuais
        const nearbyDrivers = [
            { id: 101, name: "Carlos S.", rating: 4.8, car: "Toyota Corolla - Prata", distanceKm: 1.2, etaMinutes: 3 },
            { id: 102, name: "Ana P.", rating: 4.9, car: "Hyundai HB20 - Branco", distanceKm: 2.5, etaMinutes: 5 },
            { id: 103, name: "Marcos T.", rating: 4.7, car: "Chevrolet Onix - Preto", distanceKm: 3.1, etaMinutes: 7 }
        ];

        const totalEta = nearbyDrivers.reduce((sum, driver) => sum + driver.etaMinutes, 0);
        const etaAverageMinutes = Math.round(totalEta / nearbyDrivers.length);

        res.status(200).json({
            message: "Motoristas próximos localizados.",
            etaAverageMinutes: etaAverageMinutes,
            nearbyDrivers: nearbyDrivers,
            referenceLocation: { lat, lng } 
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Liga o servidor na porta 3000
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor de Mobilidade rodando em http://localhost:${PORT}`);
});
