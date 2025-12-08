const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  database: 'postgres', // Connect to default database first
});

client.connect()
  .then(() => {
    console.log('✅ Connected to PostgreSQL successfully!');
    return client.query('SELECT version();');
  })
  .then((result) => {
    console.log('PostgreSQL version:', result.rows[0].version);
    return client.query("SELECT datname FROM pg_database WHERE datname = 'retail_pos_db';");
  })
  .then((result) => {
    if (result.rows.length > 0) {
      console.log('✅ Database retail_pos_db exists');
    } else {
      console.log('❌ Database retail_pos_db does NOT exist');
    }
    return client.end();
  })
  .catch((err) => {
    console.error('❌ Connection error:', err.message);
    process.exit(1);
  });
