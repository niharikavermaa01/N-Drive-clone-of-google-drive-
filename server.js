const express = require('express');
const session = require('express-session');
const path = require('path');
const routes = require('./routes/index');
const mysql = require('mysql2');
const MySQLStore = require('express-mysql-session')(session);

const app = express();
const PORT = 3000;

// --- IMPORTANT: Update with your MySQL credentials ---
const dbOptions = {
    host: 'localhost',
    user: 'root',
    password: 'nike01vk.$', // Your MySQL password (often empty for local setups)
    database: 'drive_clone'
};

// Create a connection pool for the database
const pool = mysql.createPool(dbOptions).promise();

// Make the database pool available to all routes
app.set('db', pool);

// --- Session Configuration ---
const sessionStore = new MySQLStore({}, pool);

app.use(session({
    key: 'drive_clone_session',
    secret: 'myloveisonlyhimandnoonecanreplacehim', // Replace with a long random string
    store: sessionStore,
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
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});