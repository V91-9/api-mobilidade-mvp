const db = require("../database/database");

/**
 * Cadastra um novo motorista.
 */
function createDriver({ userId, cnh }) {

  return new Promise((resolve, reject) => {

    if (!userId || !cnh) {
      return reject(
        new Error("ID do usuário e CNH são obrigatórios."));
    }

    const userQuery = `
      SELECT
        id
      FROM
        users
      WHERE
        id = ?
    `;

    db.get(
      userQuery,
      [userId],
      (err, user) => {

      if (err) {
        return reject(
          new Error("Erro interno ao verificar usuário."));
      }

      if (!user) {
        return reject(
          new Error("Usuário não encontrado. Crie uma conta primeiro."));
      }

      const query = `
        INSERT INTO
          drivers (user_id, cnh)
        VALUES (?, ?)
      `;

      db.run(
        query,
        [userId, cnh],
        function (err) {

        if (err) {

          if (err.message.includes("UNIQUE")) {
            return reject(
              new Error("Este usuário já possui perfil de motorista ou a CNH já está em uso."));
          }

          return reject(
            new Error("Erro ao cadastrar motorista: " + err.message));
        }

        resolve({
          message: "Perfil de motorista ativado com sucesso!",
          driver: {
            id: this.lastID,
            userId: userId,
            cnh: cnh,
            createdAt: new Date().toISOString()
          }
        });
      });
    });
  });
}


/**
 * Cadastra um veículo para um motorista.
 */
function addVehicle({ driverId, plate, model, color }) {

  return new Promise((resolve, reject) => {

    if (!driverId || !plate || !model || !color) {
      return reject(
        new Error("Dados do veículo incompletos."));
    }

    const vehicleQuery = `
      INSERT INTO
        vehicles (driver_id, plate, model, color)
      VALUES (?, ?, ?, ?)
    `;

    db.run(
      vehicleQuery,
      [driverId, plate, model, color, category],
      function (err) {

        if (err) {

          if (err.message.includes("FOREIGN KEY")) {
            return reject(
              new Error("Motorista não encontrado. Verifique o ID do condutor."));
          }

          if (err.message.includes("UNIQUE")) {
            return reject(
              new Error("Esta placa já está cadastrada no sistema."));
          }

          return reject(new Error("Erro interno ao cadastrar veículo."));
        }

        resolve({
          message: "Veículo cadastrado com sucesso!",
          vehicle: {
            id: this.lastID,
            driverId: driverId,
            plate: plate,
            model: model,
            color: color,
            createdAt: new Date().toISOString()
          }
        });
    });
  });
}

/**
 * Calcula a nota média de um motorista com base nas avaliações recebidas.
 */
function getDriverRating(driverId) {

  return new Promise((resolve, reject) => {

    if (!driverId) {
      return reject(new Error("ID do motorista é obrigatório."));
    }

    const query = `
      SELECT 
        COUNT(*) as total_reviews, IFNULL(AVG(rating), 0) as average_rating 
      FROM
        reviews 
      WHERE
        driver_id = ?
    `;

    db.get(
      query,
      [driverId],
      (err, row) => {

      if (err) {
        return reject(
          new Error("Erro ao calcular a nota do motorista."));
      }

      resolve({
        message: "Avaliação do motorista recuperada com sucesso.",
        ratingDetails: {
          driverId: driverId,
          totalReviews: row.total_reviews,
          averageRating: parseFloat(row.average_rating.toFixed(2)),
        }
      });
    });
  });
}

module.exports = {
  createDriver,
  addVehicle,
  getDriverRating
};
