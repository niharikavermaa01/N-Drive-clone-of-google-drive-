const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// !!! WARNING: THIS FILE STORAGE METHOD IS NOT COMPATIBLE WITH RENDER !!!
// The local 'uploads' folder will be deleted when the server restarts.
// You MUST replace this with a cloud storage service like Amazon S3.
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userUploadsPath = path.join('uploads', req.session.userId.toString());
        fs.mkdirSync(userUploadsPath, { recursive: true });
        cb(null, userUploadsPath);
    },
    filename: (req, file, cb) => {
        const uniqueFilename = Date.now() + '-' + file.originalname;
        cb(null, uniqueFilename);
    }
});
const upload = multer({ storage: storage });

// --- General & Authentication Routes ---
router.get('/', (req, res) => res.redirect('/login'));
router.get('/signup', (req, res) => res.render('signup'));
router.get('/login', (req, res) => res.render('login'));
router.get('/about', (req, res) => res.render('about'));

// Handle new user registration
router.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;
    const db = req.app.get('db');
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // CORRECTED: Changed query to use PostgreSQL placeholders ($1, $2, $3)
        const result = await db.query(
            'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, email]
        );
        const newUserId = result.rows[0].id;

        // WARNING: This creates a local folder that will be deleted on Render.
        fs.mkdirSync(path.join('uploads', newUserId.toString()), { recursive: true });
        res.redirect('/login');
    } catch (error) {
        console.error("Signup Error:", error);
        let errorMessage = 'An error occurred during registration.';
        // CORRECTED: Changed error code for PostgreSQL unique violation
        if (error.code === '23505') {
            errorMessage = 'That username or email is already taken.';
        }
        res.render('signup', { error: errorMessage });
    }
});

// Handle user login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = req.app.get('db');
    try {
        // CORRECTED: Changed query to use PostgreSQL placeholder ($1)
        const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', { error: 'Incorrect username or password.', username });
        }
        req.session.userId = user.id;
        req.session.username = user.username;
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Login Error:", error);
        res.render('login', { error: 'An error occurred. Please try again.', username });
    }
});

// Handle user logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid'); // Default cookie name for express-session
        res.redirect('/login');
    });
});

// --- Drive Functionality Routes (Protected) ---

// Display the dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.get('db');
        const userId = req.session.userId;
        // CORRECTED: Changed query to use PostgreSQL placeholder ($1)
        const { rows } = await db.query(
            'SELECT * FROM resources WHERE user_id = $1 AND parent_id IS NULL ORDER BY type DESC, name ASC',
            [userId]
        );
        res.render('dashboard', { user: { username: req.session.username }, files: rows });
    } catch (error) {
        console.error("Dashboard Error:", error);
        res.render('dashboard', { user: { username: req.session.username }, files: [] });
    }
});

// Handle file upload
router.post('/upload', isAuthenticated, upload.single('fileToUpload'), async (req, res) => {
    // WARNING: This whole function relies on the local filesystem.
    if (!req.file) {
        return res.redirect('/dashboard?error=NoFileUploaded');
    }
    try {
        const db = req.app.get('db');
        const { originalname, filename } = req.file;
        const userId = req.session.userId;
        // CORRECTED: Changed query to use PostgreSQL placeholders
        await db.query(
            'INSERT INTO resources (user_id, type, name, storage_key) VALUES ($1, $2, $3, $4)',
            [userId, 'file', originalname, filename]
        );
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Upload Error:", error);
        res.redirect('/dashboard?error=DatabaseError');
    }
});

// Handle folder creation
router.post('/create-folder', isAuthenticated, async (req, res) => {
    const { folderName } = req.body;
    const userId = req.session.userId;
    if (!folderName || !folderName.trim()) {
        return res.redirect('/dashboard?error=FolderNameRequired');
    }
    try {
        const db = req.app.get('db');
        // CORRECTED: Changed query to use PostgreSQL placeholders
        await db.query(
            'INSERT INTO resources (user_id, type, name) VALUES ($1, $2, $3)',
            [userId, 'folder', folderName.trim()]
        );
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Create Folder Error:", error);
        res.redirect('/dashboard?error=DatabaseError');
    }
});

// Handle item deletion
router.post('/delete/:id', isAuthenticated, async (req, res) => {
    // WARNING: This function relies on the local filesystem.
    const { id } = req.params;
    const userId = req.session.userId;
    try {
        const db = req.app.get('db');
        // CORRECTED: Changed query to use PostgreSQL placeholders
        const { rows } = await db.query('SELECT * FROM resources WHERE id = $1 AND user_id = $2', [id, userId]);

        if (rows.length === 0) {
            return res.status(404).send('Item not found or permission denied.');
        }
        const itemToDelete = rows[0];

        if (itemToDelete.type === 'file') {
            const filePath = path.join('uploads', userId.toString(), itemToDelete.storage_key);
            fs.unlink(filePath, (err) => {
                if (err) console.error("Error deleting physical file:", err);
            });
        }

        // CORRECTED: Changed query to use PostgreSQL placeholder
        await db.query('DELETE FROM resources WHERE id = $1', [id]);
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Delete Error:", error);
        res.redirect('/dashboard?error=DeleteFailed');
    }
});

// Handle file download
router.get('/download/:filename', isAuthenticated, (req, res) => {
    // WARNING: This function relies on the local filesystem.
    const { filename } = req.params;
    const filePath = path.join('uploads', req.session.userId.toString(), filename);
    res.download(filePath, (err) => {
        if (err) {
            console.error("File download error:", err);
            res.status(404).send('File not found.');
        }
    });
});

module.exports = router;