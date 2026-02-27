const sqlite3 = require('sqlite3').verbose();

// Cria o arquivo do banco de dados na pasta do projeto
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
      console.error("Erro ao conectar ao banco:", err.message);
    } else {
      console.log("✅ Conectado ao banco de dados SQLite local.");

      // Verificação de integridade referencial!
      db.run("PRAGMA foreign_keys = ON;", (err) => {
        if (err) console.error("Erro ao ativar foreign keys:", err.message);
        else console.log("🔒 Proteção de Chaves Estrangeiras ATIVADA.");
      });
    }
});


db.serialize(() => {
  // 1. Cria a tabela de usuários (Users)
  db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            birthdate TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT NOT NULL,
            reset_token TEXT
        )
    `);

  // 2. Tabela de Condutores (Drivers)
  db.run(`
        CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            cnh TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL
        )
    `);

  // 3. Tabela de Veículos (Vehicles)
  db.run(`
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id INTEGER NOT NULL,
            plate TEXT UNIQUE NOT NULL,
            model TEXT NOT NULL,
            color TEXT NOT NULL,
            category TEXT NOT NULL,
            FOREIGN KEY (driver_id) REFERENCES drivers(id)
        )
    `);

  // 4. Tabela de Corridas (Rides)
  db.run(`
        CREATE TABLE IF NOT EXISTS rides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            driver_id INTEGER,
            vehicle_id INTEGER,
            ride_type TEXT NOT NULL,
            price REAL,
            distance REAL,
            pickup_address TEXT NOT NULL,
            pickup_lat REAL NOT NULL,
            pickup_lng REAL NOT NULL,
            dropoff_address TEXT NOT NULL,
            dropoff_lat REAL NOT NULL,
            dropoff_lng REAL NOT NULL,
            status TEXT DEFAULT 'awaiting_details',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (driver_id) REFERENCES drivers(id),
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        )
    `);

  // 5. Tabela de Pagamentos (Payments)
  db.run(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ride_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            transaction_id TEXT, -- Para salvar o recibo do gateway no futuro
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ride_id) REFERENCES rides(id)
        )
    `);

  // 6. Tabela de Histórico de Status da Corrida (ride_status_logs)
  db.run(`
        CREATE TABLE IF NOT EXISTS ride_status_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ride_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ride_id) REFERENCES rides(id)
        )
    `);
});

module.exports = db;