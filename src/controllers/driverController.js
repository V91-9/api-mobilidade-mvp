const bcrypt = require("bcrypt");
const db = require("../database/database");

const SALT_ROUNDS = 10;

/**
 * Cadastra um novo motorista.
 */
function createDriver({ name, email, password, cnh }) {
  return new Promise((resolve, reject) => {
    if (!name || !email || !password || !cnh) {
      return reject(new Error("Todos os campos são obrigatórios."));
    }
    bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
      if (err) return reject(err);
      db.run(
        `INSERT INTO drivers (name, email, password, cnh) VALUES (?, ?, ?, ?)`,
        [name, email, hash, cnh],
        function (err) {
          if (err)
            return reject(
              new Error(
                "Erro ao cadastrar motorista. Email ou CNH já existem.",
              ),
            );
          resolve({ id: this.lastID });
        },
      );
    });
  });
}

/**
 * Cadastra um veículo para um motorista.
 */
function addVehicle({ driverId, plate, model, color, category }) {
    return new Promise((resolve, reject) => {
        if (!driverId || !plate || !model || !category) {
            return reject(new Error('Dados do veículo incompletos.'));
        }
        db.run(
            `INSERT INTO vehicles (driver_id, plate, model, color, category) VALUES (?, ?, ?, ?, ?)`,
            [driverId, plate, model, color, category],
            function (err) {
                if (err) {
                    // Intercepta os erros do SQLite e traduz para português
                    if (err.message.includes('FOREIGN KEY')) {
                        return reject(new Error('Motorista não encontrado. Verifique o ID do condutor.'));
                    }
                    if (err.message.includes('UNIQUE')) {
                        return reject(new Error('Esta placa já está cadastrada no sistema.'));
                    }
                    return reject(new Error('Erro interno ao cadastrar veículo.'));
                }
                resolve({ id: this.lastID });
            }
        );
    });
}

module.exports = {
  createDriver,
  addVehicle,
};
