const db = require("../database/database");
const rideController = require('./rideController');
/**
 * Cria uma intenção de pagamento vinculada a uma corrida.
 */
function createPayment({ rideId, amount, paymentMethod }) {

  return new Promise((resolve, reject) => {

    if (!rideId || !amount || !paymentMethod) {
      return reject(
        new Error("ID da corrida, valor e método de pagamento são obrigatórios."));
    }

    // Restrição de métodos de pagamento
    const allowedMethods = ["pix", "cartao_credito"];
    const methodNormalized = paymentMethod.toLowerCase();

    if (!allowedMethods.includes(methodNormalized)) {
      return reject(
        new Error("Método de pagamento não permitido. Aceitamos apenas PIX ou Cartão de Crédito."));
    }

    const query = `
      INSERT INTO
        payments (ride_id, amount, payment_method, status)
      VALUES (?, ?, ?, 'pending')
    `;

    db.run(
      query,
      [rideId, amount, methodNormalized],
      function (err) {

      if (err) {

        if (err.message.includes("FOREIGN KEY")) {
          return reject(
            new Error("Corrida não encontrada. Não é possível gerar pagamento para uma viagem inexistente."));
        }

        return reject(
          new Error("Erro interno ao gerar o pagamento."));
      }

      resolve({
        message:
          "Pagamento iniciado com sucesso. Aguardando confirmação do banco/operadora.",
        payment: {
          id: this.lastID,
          rideId: rideId,
          amount: amount,
          method: methodNormalized,
          status: "pending",
          createdAt: new Date().toISOString()
         }
       });
    });
  });
}

/**
 * Atualiza o status do pagamento (ex: de 'pending' para 'completed').
 */
function updatePaymentStatus(paymentId, status, transactionId = null) {

  return new Promise((resolve, reject) => {

    if (!paymentId || !status) {
      return reject(
        new Error("ID do pagamento e o novo status são obrigatórios."));
    }

    const query = `
      UPDATE
        payments 
      SET
        status = ?, transaction_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE
        id = ?
    `;

    db.run(
      query,
      [status, transactionId, paymentId],
      function (err) {

      if (err) {
        return reject(
          new Error("Erro ao atualizar status do pagamento."));
      }

      if (this.changes === 0) {
        return reject(
          new Error("Pagamento não encontrado no sistema."));
      }

      if (status === "completed") {

        const queryRide = `
          SELECT
            ride_id 
          FROM
            payments
          WHERE
            id = ?
        `;

        db.get(
          queryRide,
          [paymentId],
          async (err, row) => {

          if (!err && row) {

            try {
              await rideController.updateRideStatus(row.ride_id, "requested");

            } catch (rideErr) {
              console.error(
                "Erro ao liberar a corrida após pagamento:", rideErr.message);
            }
          }
        });
      }

      resolve({
        message: `Status financeiro atualizado para: ${status}`,
        updateDetails: {
          paymentId: paymentId,
          newStatus: status,
          transactionId: transactionId,
          rideReleased: status === "completed",
          updatedAt: new Date().toISOString()
        }
      });
    });
  });
}

/**
 * Estorna o pagamento caso a corrida seja cancelada.
 */
function refundPaymentByRideId(rideId) {

  return new Promise((resolve, reject) => {

    if (!rideId) {
      return reject(
        new Error("Erro de validação: O ID da corrida é obrigatório para o estorno."));
    }

    const query = `
      UPDATE
        payments 
      SET
        status = 'refunded', updated_at = CURRENT_TIMESTAMP 
      WHERE
        ride_id = ? AND status != 'refunded'
    `;

    db.run(
      query,
      [rideId],
      function (err) {

      if (err) {
        return reject(
          new Error('Erro interno ao tentar estornar o pagamento.'));
      }

      const paymentUpdated = this.changes > 0;

      resolve({
        message: paymentUpdated
          ? "Pagamento estornado com sucesso."
          : "Nenhum pagamento concluído precisou ser estornado.",
        refundDetails: {
          rideId: rideId,
          paymentUpdated: paymentUpdated,
          status: paymentUpdated ? "refunded" : "unchanged",
          timestamp: new Date().toISOString()
        }
      });
    });
  });
}

module.exports = {
  createPayment,
  updatePaymentStatus,
  refundPaymentByRideId
};
