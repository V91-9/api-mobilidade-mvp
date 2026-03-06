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
        new Error("Dados obrigatórios faltando para solicitar a corrida."));
    }

    // Verifica se o usuário já tem uma corrida ativa como PASSAGEIRO
    const checkPassengerQuery = `
      SELECT
        id
      FROM
        rides
      WHERE
        user_id = ? AND status NOT IN ('completed', 'canceled')
    `;

    db.get(
      checkPassengerQuery,
      [userId],
      (err, activeRide) => {

      if (err) {
        return reject(
          new Error("Erro ao verificar status do passageiro."));
      }

      if (activeRide) {
        return reject(
          new Error("Você já possui uma corrida em andamento ou aguardando pagamento."));
      }

      // Verifica se o usuário tem uma corrida ativa como MOTORISTA
      const checkDriverQuery = `
        SELECT
          rides.id
        FROM
          rides 
        JOIN
          drivers ON rides.driver_id = drivers.id 
        WHERE
          drivers.user_id = ? AND rides.status NOT IN ('completed', 'canceled')
      `;

      db.get(
        checkDriverQuery,
        [userId],
        (err, activeDriving) => {

        if (err) {
          return reject(
            new Error("Erro ao verificar status do motorista."));
        }
        
        if (activeDriving) {
          return reject(
            new Error("Você não pode solicitar uma corrida enquanto estiver conduzindo um passageiro."));
        }

        const query = `
          INSERT INTO rides (
            user_id, ride_type, price, distance, 
                pickup_address, pickup_lat, pickup_lng, 
                dropoff_address, dropoff_lat, dropoff_lng,
                status
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment')
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

        db.run(
          query,
          params,
          function (err) {

          if (err) {

            if (err.message.includes("FOREIGN KEY")) {
              return reject(
                new Error("Usuário (Passageiro) não encontrado. Verifique o ID informado."));
            }

            return reject(
              new Error("Erro ao solicitar a corrida: " + err.message));
          }

          const newRideId = this.lastID;

          const logQuery = `
            INSERT INTO 
              ride_status_logs (ride_id, status)
            VALUES (?, 'awaiting_payment')
          `;

          db.run(
            logQuery,
            [newRideId],
            (errLog) => {

              if (errLog) {
                console.error("Erro ao gravar log de status:", errLog.message);
              }

              resolve({
                message:
                  "Corrida solicitada com sucesso! Aguardando confirmação de pagamento.",
                ride: {
                  id: newRideId,
                  userId: userId,
                  rideType: rideType,
                  price: price,
                  distance: distance,
                  pickupAddress: pickupAddress,
                  dropoffAddress: dropoffAddress,
                  status: "awaiting_payment",
                  createdAt: new Date().toISOString(),
                },
              });
            });
        });
      });
    });
  });
}

/**
 * Busca uma corrida pelo ID.
 */
function getRideById(rideId) {

  return new Promise((resolve, reject) => {

    const query = `
      SELECT
        *
      FROM
        rides
      WHERE
        id = ?
    `;

    db.get(
      query,
      [rideId],
      (err, ride) => {

      if (err) {
        return reject(
          new Error('Erro interno ao buscar os detalhes da corrida.'));
      }
      
      if (!ride) {
        return resolve(null);
      }

      resolve({
        message: "Detalhes da corrida recuperados com sucesso.",
        ride: ride
      });
    });
  });
}

/**
 * Cancela a corrida com regras específicas para Passageiro (estorno) e Motorista (retorno para a fila).
 */
function cancelRide(rideId, userId) {

  return new Promise((resolve, reject) => {

    if (!rideId || !userId) {
      return reject(
        new Error("ID da corrida e ID do usuário são obrigatórios."));
    }

    // 1. Busca a corrida para checar as regras de negócio
    const checkQuery = `
      SELECT
        r.status, r.user_id, r.driver_id, d.user_id AS driver_user_id 
      FROM 
        rides r 
      LEFT JOIN
        drivers d ON r.driver_id = d.id 
      WHERE 
        r.id = ?
    `;

    db.get(
      checkQuery,
      [rideId],
      (err, ride) => {

      if (err) {
        return reject(
          new Error("Erro ao buscar a corrida."));
      }

      if (!ride) {
        return reject(
          new Error("Corrida não encontrada."));
      }

      if (ride.status === "canceled") {
        return reject(
          new Error("Esta corrida já encontra-se cancelada."));
      }

      if (ride.status === "completed") {
        return reject(
          new Error("Não é possível cancelar uma corrida já concluída."));
      }

      const isPassenger = ride.user_id == userId;
      const isDriver = ride.driver_user_id == userId;

      if (!isPassenger && !isDriver) {
        return reject(
          new Error("Você não tem permissão para cancelar esta corrida."));
      }

      if (isPassenger) {

        if (ride.status === "in_progress") {
          return reject(
            new Error("Não é possível cancelar. A corrida já está em andamento."));
        }

        // 2. Atualiza o banco: muda o status e crava a hora do cancelamento
        const updateQuery = `
          UPDATE
            rides
          SET
            status = 'canceled'
          WHERE 
            id = ?
        `;

        db.run(
          updateQuery,
          [rideId],
          function (err) {

            if (err) {
              return reject(
                new Error("Erro ao cancelar a corrida pelo passageiro."));
            }

            const logQuery = `
              INSERT INTO
                ride_status_logs (ride_id, status)
              VALUES (?, 'canceled') 
            `;

            db.run(
              logQuery,
              [rideId],
            );

            resolve({
              message: "Corrida cancelada com sucesso.",
              rideId: rideId,
              status: "canceled",
              canceledBy: "passenger",
              timestamp: new Date().toISOString()
            });
          });

      } else if (isDriver) {

        // 4. Desvincula o motorista da corrida e volta ela para a fila ('requested')
        const driverCancelQuery = `
          UPDATE
            rides 
          SET
            status = 'requested', driver_id = NULL, vehicle_id = NULL 
          WHERE
            id = ?
        `;

        db.run(
          driverCancelQuery,
          [rideId],
          function (err) {

          if (err) {
            return reject(
              new Error("Erro ao cancelar a corrida pelo motorista."));
          }

          const query = `
            INSERT INTO
              ride_status_logs (ride_id, status)
            VALUES (?, 'requested')
          `;

          db.run(
            query,
            [rideId],
          );

          resolve({
            message:
              "Você cancelou a viagem. A corrida voltou para a lista de solicitações.",
            details: {
              rideId: rideId,
              status: "requested",
              canceledBy: "driver",
              timestamp: new Date().toISOString()
            }
          });
        });
      }
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
        new Error("ID da corrida, ID do motorista e ID do veículo são obrigatórios."));
    }

    const checkActiveDrivingQuery = `
      SELECT 
        id 
      FROM 
        rides 
      WHERE 
        driver_id = ? AND status NOT IN ('completed', 'canceled')
    `;

    db.get(
      checkActiveDrivingQuery,
      [driverId],
      (err, activeRide) => {

      if (err) {
        return reject(
          new Error("Erro ao verificar disponibilidade do motorista."));
      }

      if (activeRide) {
        return reject(
          new Error("Você já está realizando uma corrida. Finalize-a antes de aceitar outra."));
      }

      // 1. Verifica se a corrida existe e se ainda está aguardando motorista
      const checkRideQuery = `
        SELECT 
          status, pickup_lat, pickup_lng 
        FROM 
          rides 
        WHERE 
          id = ?
      `;

      db.get(
        checkRideQuery,
        [rideId],
        (err, ride) => {

          if (err) {
            return reject(
              new Error("Erro interno ao buscar a corrida."));
          }

          if (!ride) {
            return reject(
              new Error("Corrida não encontrada."));
          }

          if (ride.status !== "requested") {
            return reject(
              new Error("Esta corrida não está mais disponível (pode ter sido cancelada ou já aceita por outro motorista)."));
          }

          // 2. Atualiza a corrida com o motorista, o veículo e muda o status
          const query = `
            UPDATE
              rides 
            SET
              driver_id = ?, vehicle_id = ?, status = 'accepted'
            WHERE
              id = ?
          `;

          db.run(query, [driverId, vehicleId, rideId], function (err) {

            if (err) {

              if (err.message.includes("FOREIGN KEY")) {
                return reject(
                  new Error("Motorista ou Veículo não encontrado no sistema. Verifique os IDs informados."));
              }

              return reject(
                new Error("Erro ao aceitar a corrida: " + err.message));
            }

            const insertLogQuery = `
              INSERT INTO 
                ride_status_logs (ride_id, status) 
              VALUES (?, 'accepted')
            `;

            db.run(
              insertLogQuery,
              [rideId]
            );

            const rideQuery = `
              SELECT 
                * 
              FROM
                rides WHERE id = ?
            `;

            db.get(
              rideQuery, 
              [rideId], 
              (err, updatedRide) => {

              resolve({
                message:
                  "Corrida aceita com sucesso! Dirija-se ao local de embarque.",
                ride: updatedRide
              });
            });
          });
        });
    });
  });
}

/**
 * Atualiza o status de uma corrida.
 */
function updateRideStatus(rideId, status) {

  return new Promise((resolve, reject) => {

    const query = `
      UPDATE 
        rides 
      SET 
        status = ?
      WHERE 
        id = ?
    `;

    db.run(
      query,
      [status, rideId],
      function (err) {

        if (err) {
          return reject(
            new Error("Erro interno ao atualizar status."));

        }

        if (this.changes === 0) {
          return reject(
            new Error("Corrida não encontrada."));
        }

        // Salva o evento no histórico (É aqui que o "arrived_time" fica gravado!)
        const insertLogQuery = `
          INSERT INTO 
            ride_status_logs (ride_id, status) 
          VALUES (?, ?)
        `;

        db.run(
          insertLogQuery,
          [rideId, status],
          function (errLog) {

            if (errLog) {
              return reject(
                new Error("Erro ao salvar histórico de status."));
            }

            resolve({
              message: `Status da corrida atualizado com sucesso.`,
              updateDetails: {
                rideId: rideId,
                currentStatus: status,
                updatedAt: new Date().toISOString()
              }
            });
          });
      });
  });
}

/**
 * Busca o histórico de todas as corridas de um usuário (Passageiro).
 */
function getUserRideHistory(userId) {

  return new Promise((resolve, reject) => {

    if (!userId) {
      return reject(
        new Error('ID do usuário é obrigatório.'));
    }

    const query = `
      SELECT
        id, ride_type, pickup_address, dropoff_address, price, distance, status, created_at 
      FROM
        rides 
      WHERE
        user_id = ? 
      ORDER BY
        created_at DESC
    `;

    db.all(
      query,
      [userId],
      (err, rides) => {

      if (err) {
        return reject(
          new Error('Erro interno ao buscar o histórico de corridas.'));
      }

      resolve({
        message: "Histórico recuperado com sucesso.",
        summary: {
          userId: userId,
          totalRides: rides.length,
        },
        history: rides
      });
    });
  });
}

/**
 * Adiciona uma avaliação (nota e comentário) para uma corrida concluída.
 */
function rateDriver(rideId, userId, rating, comment = "") {

  return new Promise((resolve, reject) => {

    if (!rideId || !userId || !rating) {
      return reject(
        new Error("ID da corrida, ID do usuário e nota são obrigatórios."));
    }

    if (rating < 1 || rating > 5) {
      return reject(
        new Error("A nota de avaliação deve ser entre 1 e 5."));
    }

    // 1. Verifica se a corrida existe, se o usuário é o passageiro e se ela já acabou
    const checkQuery = `
      SELECT 
        status, user_id, driver_id 
      FROM 
        rides 
      WHERE 
        id = ?
    `;
        
    db.get(
      checkQuery,
      [rideId],
      (err, ride) => {

      if (err) {
        return reject(
          new Error("Erro ao buscar a corrida."));
      }

      if (!ride) {
        return reject(
          new Error("Corrida não encontrada."));
      }
            
      if (ride.user_id != userId) {
        return reject(
          new Error("Apenas o passageiro desta corrida pode avaliá-la."));
      }

      if (ride.status !== 'completed') {
        return reject(
          new Error("Apenas corridas concluídas podem ser avaliadas."));
      } 

      // 2. Insere a avaliação no banco
      const insertQuery = `
        INSERT INTO 
          reviews (ride_id, user_id, driver_id, rating, comment)
        VALUES (?, ?, ?, ?, ?)
      `;
            
      db.run(
        insertQuery,
        [rideId, userId, ride.driver_id, rating, comment],
        function (err) {

        if (err) {

          if (err.message.includes('UNIQUE')) {
            return reject(
              new Error("Esta corrida já foi avaliada."));
          }

          return reject(new Error("Erro ao salvar avaliação: " + err.message));
        }
                
        resolve({
          message:
            "Avaliação enviada com sucesso! Obrigado pelo feedback.",
          review: {
            reviewId: this.lastID,
            rideId: rideId,
            rating: rating,
            comment: comment,
            createdAt: new Date().toISOString()
          }
        });
      });
    });
  });
}

module.exports = {
  requestRide,
  getRideById,
  cancelRide,
  acceptRide,
  updateRideStatus,
  getUserRideHistory,
  rateDriver
};
