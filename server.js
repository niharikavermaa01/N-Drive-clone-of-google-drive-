const express = require('express');
const session = require('express-session');
const path = require('path');
const routes = require('./routes/index');
const { Pool } = require('pg'); // Use the 'pg' library for PostgreSQL
const pgSession = require('connect-pg-simple')(session); // Use the PostgreSQL session store

const app = express();
// Use the PORT environment variable provided by Render
const PORT = process.env.PORT || 3000;

// --- Database Connection ---
// This will automatically use the DATABASE_URL you set in Render's environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for connecting to Render's database
  }
});

// Make the database pool available to all your routes
app.set('db', pool);

// --- Session Configuration ---
// Use the new PostgreSQL-compatible session store
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions' // Name for the session table in your database
    }),
    secret: process.env.SESSION_SECRET || 'a-very-strong-secret-for-development', // Best practice: use an environment variable
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // Cookie expires in 24 hours
    }
}));

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// --- View Engine (EJS) ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Routes ---
app.use('/', routes);

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});