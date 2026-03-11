const db = require('../database/database');
const bcrypt = require('bcrypt');
const crypto = require("crypto");

const SALT_ROUNDS = 10;

/**
 * Adiciona um novo usuário no banco local.
 * A senha é armazenada como hash para segurança.
 */
function createUser({ name, email, cpf, phone, password, birthdate }) {
  
  return new Promise((resolve, reject) => {

    // 1. Validar campos obrigatórios
    if (!name || !email || !cpf || !phone || !password || !birthdate) {
      return reject(
        new Error("name, email, cpf, phone, password e birthdate são obrigatórios"));
    }

    // 2. Validação de Email - Verifica se tem o formato texto@texto.texto
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return reject(
        new Error("Formato de e-mail inválido."));
    }

    // 3. Validação de Senha - Regra mínima de segurança
    if (password.length < 6) {
      return reject(
        new Error("A senha deve ter pelo menos 6 caracteres."));
    }

    // 4. Criptografia e salvamento
    bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {

      if (err) {
        return reject(
          new Error("Erro ao processar a senha."));
      }

      const query = `
        INSERT INTO
          users (name, email, cpf, phone, password, birthdate)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(
        query,
        [name, email, cpf, phone, hash, birthdate],
        function (err) {

        if (err) {

          if (err.message.includes("UNIQUE")) {
            return reject(
              new Error("E-mail ou CPF já cadastrado no sistema."));
          }

          return reject(
            new Error("Erro ao cadastrar usuário: " + err.message));
        }

        resolve({
          message: "Usuário cadastrado com sucesso!",
          user: {
            id: this.lastID,
            name: name,
            email: email,
            phone: phone,
            isDriver: false
           }
         });
      });
    });
  });
}

/**
 * Obtém um usuário pelo email. Resolve com o objeto do usuário ou undefined.
 */
function getUserByEmail(email) {

  return new Promise((resolve, reject) => {

    const query = `
      SELECT
        *
      FROM
        users
      WHERE
        email = ?
    `;

    db.get(
      query,
      [email],
      (err, user) => {

      if (err) {
        return reject(
          new Error("Erro interno no banco de dados ao buscar usuário."));
      }

      resolve(user);
    });
  });
}

/**
 * Verifica se email e senha correspondem a um usuário existente.
 * Retorna os dados do usuário em caso de sucesso.
 */
function verifyUser(email, password) {

  return new Promise(async (resolve, reject) => {

    try {
      const user = await getUserByEmail(email);

      if (!user) {
        return reject(
          new Error("Usário não encontrado. Verifique o e-mail ou cadastre-se."));
      }

      bcrypt.compare(password, user.password, (err, isMatch) => {

        if (err) {
          return reject(
            new Error("Erro ao verificar a senha."));
        }

        if (!isMatch) {
          return reject(
            new Error("E-mail ou senha incorretos."));
        }

        const query = `
          SELECT 
            d.id,
            d.cnh,
            v.id AS vehicle_id,
            v.plate AS vehicle_plate,
            v.model AS vehicle_model,
            v.color AS vehicle_color
          FROM 
            drivers d
          LEFT JOIN
            vehicles v ON v.driver_id = d.id
          WHERE
            d.user_id = ?
          ORDER BY
            v.id DESC
        `;

        db.get(
          query,
          [user.id],
          (err, driver) => {

          if (err) {
            return reject(
              new Error("Erro ao verificar permissões de motorista."));
          }

          resolve({
            message: "Login realizado com sucesso!",
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              isDriver: !!driver,
              driverDetails: driver
                ? {
                    driverId: driver.id,
                    cnh: driver.cnh,
                    vehicleId: driver.vehicle_id || null,
                    vehicle: driver.vehicle_id
                      ? {
                          id: driver.vehicle_id,
                          plate: driver.vehicle_plate,
                          model: driver.vehicle_model,
                          color: driver.vehicle_color,
                        }
                      : null,
                  }
                : null
            }
          });
        });
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Gera o token quando o usuário clica em "Esqueci a senha"
 */
function generateResetToken(email) {

  return new Promise((resolve, reject) => {

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000).toISOString();
    const query = `
      UPDATE 
        users
      SET
        reset_token = ?, reset_token_expires = ?
      WHERE
        email = ?
    `;
        
    db.run(
      query,
      [token, expires, email],
      function (err) {

      if (err) {
        return reject(
          new Error('Erro ao gerar token de recuperação.'));
      }

      if (this.changes === 0) {
        return reject(
          new Error('E-mail não encontrado no sistema.'));
      }
            
      resolve({
        message: "Token de recuperação gerado com sucesso.",
        resetDetails: {
          email: email,
          resetToken: token,
          expiresAt: expiresISO,
          expiresInMinutes: 60
        }
      });
    });
  });
}

/**
 * Redefine a senha do usuário utilizando o token de recuperação.
 */
function resetPassword(token, newPassword) {

  return new Promise((resolve, reject) => {

    if (!token || !newPassword) {
      return reject(
        new Error('Token e nova senha são obrigatórios.'));
    }

    if (newPassword.length < 6) {
      return reject(
        new Error("A nova senha deve ter pelo menos 6 caracteres."));
    }

    // 1. Busca o usuário que tem esse token específico
    const query = `
      SELECT
        * 
      FROM
        users
      WHERE
        reset_token = ? AND reset_token_expires > CURRENT_TIMESTAMP
    `;

    db.get(
      query,
      [token],
      (err, user) => {

      if (err) {
        return reject(
          new Error("Erro ao validar o token."));
      }

      if (!user) {
        return reject(
          new Error("Token inválido ou já utilizado."));
      }

      // 2. Criptografa a nova senha
      bcrypt.hash(newPassword, SALT_ROUNDS, (err, hash) => {

        if (err) {
          return reject(
            new Error("Erro interno ao processar a nova senha."));
        }

        // 3. Atualiza a senha no banco e apaga o token (seta como NULL)
        const queryUpdate = `
          UPDATE
            users 
          SET
            password = ?, reset_token = NULL, reset_token_expires = NULL 
          WHERE
            id = ?
        `;

        db.run(
          queryUpdate,
          [hash, user.id],
          function (err) {

          if (err) {
            return reject(
              new Error("Erro ao atualizar a senha."));
          }

          resolve({
            message:
              "Senha redefinida com sucesso! Você já pode fazer login.",
            details: {
              userId: user.id,
              email: user.email,
              status: "password_updated",
              updatedAt: new Date().toISOString()
            }
          });
        });
      });
    });
  });
}

module.exports = {
    createUser,
    getUserByEmail,
    verifyUser,
    generateResetToken,
    resetPassword
};
