const db = require("../database/database");
const rideController = require('./rideController');
/**
 * Cria uma intenção de pagamento vinculada a uma corrida.
 */
function createPayment({ rideId, amount, paymentMethod }) {
  return new Promise((resolve, reject) => {
    if (!rideId || !amount || !paymentMethod) {
      return reject(
        new Error(
          "ID da corrida, valor e método de pagamento são obrigatórios.",
        ),
      );
    }

    db.run(
      `INSERT INTO payments (ride_id, amount, payment_method) VALUES (?, ?, ?)`,
      [rideId, amount, paymentMethod],
      function (err) {
        if (err) {
          if (err.message.includes("FOREIGN KEY")) {
            return reject(
              new Error(
                "Corrida não encontrada. Não é possível gerar pagamento para uma viagem inexistente.",
              ),
            );
          }
          return reject(new Error("Erro interno ao gerar o pagamento."));
        }
        resolve({ paymentId: this.lastID, status: "pending" });
      },
    );
  });
}

/**
 * Atualiza o status do pagamento (ex: de 'pending' para 'completed').
 */
function updatePaymentStatus(paymentId, status, transactionId = null) {
  return new Promise((resolve, reject) => {
    if (!paymentId || !status) {
      return reject(
        new Error("ID do pagamento e o novo status são obrigatórios."),
      );
    }

    const query = `
            UPDATE payments 
            SET status = ?, transaction_id = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? RETURNING ride_id
        `;

    db.run(query, [status, transactionId, paymentId], function (err) {
      if (err)
        return reject(new Error("Erro ao atualizar status do pagamento."));

      if (this.changes === 0) {
        return reject(new Error("Pagamento não encontrado no sistema."));
      }

      if (status === "completed") {
        db.get(
          `SELECT ride_id FROM payments WHERE id = ?`,
          [paymentId],
          async (err, row) => {
            if (!err && row) {
              try {
                // Chama o rideController (que você importou no topo) para liberar a corrida
                await rideController.updateRideStatus(row.ride_id, "requested");
              } catch (rideErr) {
                console.error(
                  "Erro ao liberar a corrida após pagamento:",
                  rideErr.message,
                );
              }
            }
          },
        );
      }

      resolve({
        message: `Pagamento atualizado para '${status}' com sucesso.`,
      });
    });
  });
}

/**
 * Estorna o pagamento caso a corrida seja cancelada.
 */
function refundPaymentByRideId(rideId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE payments 
            SET status = 'refunded', updated_at = CURRENT_TIMESTAMP 
            WHERE ride_id = ? AND status != 'refunded'
        `;

        db.run(query, [rideId], function (err) {
            if (err) return reject(new Error('Erro interno ao tentar estornar o pagamento.'));
            
            // this.changes indica quantas linhas foram alteradas
            if (this.changes === 0) {
                // Resolvemos com sucesso mesmo se não mudou nada, pois a corrida podia
                // não ter um pagamento gerado ainda (cancelamento muito rápido).
                return resolve({ message: 'Nenhum pagamento concluído precisou ser estornado.' });
            }
            resolve({ message: 'Pagamento estornado com sucesso.' });
        });
    });
}

module.exports = {
  createPayment,
  updatePaymentStatus,
  refundPaymentByRideId,
};
