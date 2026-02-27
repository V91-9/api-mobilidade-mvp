const db = require('../database/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Adiciona um novo usuário no banco local.
 * `name` e `birthdate` são obrigatórios; `email` e `password` também.
 * A senha é armazenada como hash para segurança.
 * Retorna uma Promise que resolve com o id do usuário recém-criado.
 */
function createUser({ name, birthdate, email, password, phone }) {
    return new Promise((resolve, reject) => {
      // 1. Validar campos obrigatórios (SCRUM-12)
        if (!name || !birthdate || !email || !password || !phone) {
            return reject(
            new Error(
                "name, birthdate, email, password e phone são obrigatórios",
            ));
        }

        // 2. Validação de Email (SCRUM-12) - Verifica se tem o formato texto@texto.texto
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return reject(new Error("Formato de e-mail inválido."));
        }

        // 3. Validação de Senha (SCRUM-12) - Regra mínima de segurança
        if (password.length < 6) {
            return reject(
                new Error('A senha deve ter pelo menos 6 caracteres.'));
        }

        // 4. Criptografia e salvamento
        bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
        if (err) return reject(
            new Error('Erro ao processar a senha.'));
        db.run(
          `INSERT INTO users (name, birthdate, email, password, phone) VALUES (?, ?, ?, ?, ?)`,
          [name, birthdate, email, hash, phone],
          function (err) {
            if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return reject(
                            new Error('Este e-mail já está cadastrado no sistema.'));
                    }
                    return reject(
                        new Error('Erro ao cadastrar usuário: ' + err.message));
                }

            resolve({ id: this.lastID, message: "Usuário cadastrado com sucesso!" });
          },
        );
      });
    });
}

/**
 * Obtém um usuário pelo email. Resolve com o objeto do usuário ou undefined.
 */
function getUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

/**
 * Verifica se email e senha correspondem a um usuário existente.
 * Retorna os dados do usuário em caso de sucesso.
 */
function verifyUser(email, password) {
    return getUserByEmail(email).then((user) => {
        if (!user) throw new Error('Usuário não encontrado');
        return bcrypt.compare(password, user.password).then((match) => {
            if (!match) throw new Error('Senha incorreta');
            return user;
        });
    });
}

/**
 * Redefine a senha do usuário utilizando o token de recuperação.
 */
function resetPassword(token, newPassword) {
    return new Promise((resolve, reject) => {
        if (!token || !newPassword) {
            return reject(new Error('Token e nova senha são obrigatórios.'));
        }

        // 1. Busca o usuário que tem esse token específico
        db.get(`SELECT * FROM users WHERE reset_token = ?`, [token], (err, user) => {
            if (err) return reject(err);
            if (!user) return reject(new Error('Token inválido ou já utilizado.'));

            // 2. Criptografa a nova senha
            bcrypt.hash(newPassword, SALT_ROUNDS, (err, hash) => {
                if (err) return reject(err);

                // 3. Atualiza a senha no banco e apaga o token (seta como NULL)
                db.run(
                    `UPDATE users SET password = ?, reset_token = NULL WHERE id = ?`,
                    [hash, user.id],
                    function (err) {
                        if (err) return reject(err);
                        resolve({ success: true });
                    }
                );
            });
        });
    });
}

module.exports = {
    createUser,
    getUserByEmail,
    verifyUser,
    resetPassword,
};
