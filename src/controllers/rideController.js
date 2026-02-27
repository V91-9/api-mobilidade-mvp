const db = require("../database/database");

/**
 * Solicita uma nova corrida.
 * Retorna uma Promise com o ID da corrida recém-criada.
 */
function requestRide({
  userId,
  rideType,
  price,
  distance,
  pickupAddress,
  pickupLat,
  pickupLng,
  dropoffAddress,
  dropoffLat,
  dropoffLng,
}) {
  return new Promise((resolve, reject) => {
    // Validação básica
    if (!userId || !pickupAddress || !dropoffAddress || !rideType) {
      return reject(
        new Error("Dados obrigatórios faltando para solicitar a corrida."),
      );
    }

    const query = `
            INSERT INTO rides (
                user_id, ride_type, price, distance, 
                pickup_address, pickup_lat, pickup_lng, 
                dropoff_address, dropoff_lat, dropoff_lng,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment')
        `;

    const params = [
      userId,
      rideType,
      price,
      distance,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
    ];

    db.run(query, params, function (err) {
      if (err) {
        if (err.message.includes("FOREIGN KEY")) {
          return reject(
            new Error(
              "Usuário (Passageiro) não encontrado. Verifique o ID informado.",
            ),
          );
        }
        return reject(new Error("Erro ao solicitar a corrida: " + err.message));
      }

      const newRideId = this.lastID;
            
      // Grava o primeiro log no histórico
      db.run(
        `INSERT INTO ride_status_logs (ride_id, status) VALUES (?, 'awaiting_payment')`,
        [newRideId],
        (errLog) => {
          if (errLog)
            console.error("Erro ao gravar log de status:", errLog.message);
          resolve({ rideId: newRideId, status: "awaiting_payment" });
        },
      );
    });
  });
}

/**
 * Busca uma corrida pelo ID.
 */
function getRideById(rideId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM rides WHERE id = ?`, [rideId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Cancela uma corrida caso ela ainda não tenha sido concluída ou cancelada.
 */
function cancelRide(rideId, userId) {
    return new Promise((resolve, reject) => {
        if (!rideId || !userId) {
            return reject(new Error('ID da corrida e ID do usuário são obrigatórios.'));
        }

        // 1. Busca a corrida para checar as regras de negócio
        db.get(`SELECT status, user_id FROM rides WHERE id = ?`, [rideId], (err, ride) => {
            if (err) return reject(err);
            if (!ride) return reject(new Error('Corrida não encontrada.'));
            
            // Regra de segurança: só o dono da corrida pode cancelar
            if (ride.user_id !== userId) {
                return reject(new Error('Você não tem permissão para cancelar esta corrida.'));
            }

            // Regra de negócio: não pode cancelar o que já terminou ou já foi cancelado
            if (ride.status === 'canceled') return reject(new Error('Esta corrida já encontra-se cancelada.'));
            if (ride.status === 'completed') return reject(new Error('Não é possível cancelar uma corrida já concluída.'));

            // 2. Atualiza o banco: muda o status e crava a hora do cancelamento
            const query = `UPDATE rides SET status = 'canceled' WHERE id = ?`;
            
            db.run(query, [rideId], function (err) {
                if (err) return reject(err);

                db.run(
                  `INSERT INTO ride_status_logs (ride_id, status) VALUES (?, 'canceled')`,
                  [rideId],
                );
                
                resolve({ message: "Corrida cancelada com sucesso.", rideId: rideId, status: 'canceled' });
            });
        });
    });
}

/**
 * Motorista aceita uma corrida solicitada.
 */
function acceptRide(rideId, driverId, vehicleId) {
    return new Promise((resolve, reject) => {
        if (!rideId || !driverId || !vehicleId) {
            return reject(
              new Error(
                "ID da corrida, ID do motorista e ID do veículo são obrigatórios."
              ));
        }

        // 1. Verifica se a corrida existe e se ainda está aguardando motorista
        db.get(
          `SELECT status, pickup_lat, pickup_lng FROM rides WHERE id = ?`,
          [rideId],
          (err, ride) => {
            if (err) return reject(err);
            if (!ride) return reject(
              new Error("Corrida não encontrada."));

            if (ride.status !== "requested") {
              return reject(
                new Error(
                  "Esta corrida não está mais disponível (pode ter sido cancelada ou já aceita por outro motorista).",
                ));
            }

            // 2. Atualiza a corrida com o motorista, o veículo e muda o status
            const query = `
                UPDATE rides 
                SET driver_id = ?, 
                    vehicle_id = ?, 
                    status = 'accepted'
                WHERE id = ?
            `;

            db.run(query, [driverId, vehicleId, rideId], function (err) {
              if (err) {
                if (err.message.includes("FOREIGN KEY")) {
                  return reject(
                    new Error(
                      "Motorista ou Veículo não encontrado no sistema. Verifique os IDs informados.",
                    ));
                }
                return reject(
                  new Error("Erro ao aceitar a corrida: " + err.message),
                );
              }

              db.run(
                `INSERT INTO ride_status_logs (ride_id, status) VALUES (?, 'accepted')`,
                [rideId],
              );

              resolve({
                message: "Corrida aceita com sucesso!",
                rideId: rideId,
                driverId: driverId,
                vehicleId: vehicleId,
                status: "accepted",
                pickupLat: ride.pickup_lat,
                pickupLng: ride.pickup_lng
              });
            });
          },
        );
    });
}

/**
 * Atualiza o status de uma corrida.
 */
function updateRideStatus(rideId, status) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE rides SET status = ? WHERE id = ?`,
      [status, rideId],
      function (err) {
        if (err) return reject(new Error("Erro interno ao atualizar status."));
        if (this.changes === 0)
          return reject(new Error("Corrida não encontrada."));

        // Salva o evento no histórico (É aqui que o "arrived_time" fica gravado!)
        db.run(
          `INSERT INTO ride_status_logs (ride_id, status) VALUES (?, ?)`,
          [rideId, status],
          function (errLog) {
            if (errLog)
              return reject(new Error("Erro ao salvar histórico de status."));
            resolve({
              message: `Status da corrida atualizado para '${status}'.`,
              rideId,
              status,
            });
          },
        );
      },
    );
  });
}

/**
 * Busca o histórico de todas as corridas de um usuário (Passageiro).
 */
function getUserRideHistory(userId) {
    return new Promise((resolve, reject) => {
        if (!userId) {
            return reject(new Error('ID do usuário é obrigatório.'));
        }

        const query = `
            SELECT id, ride_type, pickup_address, dropoff_address, price, distance, status, created_at 
            FROM rides 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `;

        db.all(query, [userId], (err, rows) => {
            if (err) return reject(new Error('Erro interno ao buscar o histórico de corridas.'));
            
            // Retorna a lista vazia [] se ele não tiver nenhuma corrida, ou a lista preenchida
            resolve(rows);
        });
    });
}

module.exports = {
  requestRide,
  getRideById,
  cancelRide,
  acceptRide,
  updateRideStatus,
  getUserRideHistory
};
