const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

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
    const { username, password } = req.body;
    const db = req.app.get('db');
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );
        // Create an uploads folder for the new user
        fs.mkdirSync(path.join('uploads', result.insertId.toString()), { recursive: true });
        res.redirect('/login');
    } catch (error) {
        console.error("Signup Error:", error);
        let errorMessage = 'An error occurred during registration.';
        if (error.code === 'ER_DUP_ENTRY') {
            errorMessage = 'That username is already taken. Please choose another.';
        }
        res.render('signup', { error: errorMessage });
    }
});

// Handle user login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = req.app.get('db');
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', { error: 'Incorrect username or password.', username });
        }
        // Create a session on successful login
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
            return res.redirect('/dashboard'); // Redirect to dashboard if error
        }
        res.clearCookie('drive_clone_session'); // Clear the session cookie
        res.redirect('/login');
    });
});

// --- Drive Functionality Routes (Protected) ---

// Display the dashboard with files and folders from the database
router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.get('db');
        const user = { username: req.session.username };
        const userId = req.session.userId;
        // Fetch root items (where parent_id is NULL) for the logged-in user
        const [items] = await db.query(
            'SELECT * FROM resources WHERE user_id = ? AND parent_id IS NULL ORDER BY type DESC, name ASC',
            [userId]
        );
        res.render('dashboard', { user, files: items });
    } catch (error) {
        console.error("Dashboard Error:", error);
        res.render('dashboard', { user: { username: req.session.username }, files: [] });
    }
});

router.post('/upload', isAuthenticated, upload.single('fileToUpload'), async (req, res) => {
    if (!req.file) {
        return res.redirect('/dashboard?error=NoFileUploaded');
    }
    try {
        const db = req.app.get('db');
        const { originalname, filename } = req.file;
        const userId = req.session.userId;
        await db.query(
            'INSERT INTO resources (user_id, type, name, storage_key) VALUES (?, ?, ?, ?)',
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
    if (!folderName || folderName.trim() === '') {
        return res.redirect('/dashboard?error=FolderNameRequired');
    }
    try {
        const db = req.app.get('db');
        await db.query(
            'INSERT INTO resources (user_id, type, name) VALUES (?, ?, ?)',
            [userId, 'folder', folderName.trim()]
        );
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Create Folder Error:", error);
        res.redirect('/dashboard?error=DatabaseError');
    }
});

router.post('/delete/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;
    try {
        const db = req.app.get('db');
        const [rows] = await db.query('SELECT * FROM resources WHERE id = ? AND user_id = ?', [id, userId]);

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

        await db.query('DELETE FROM resources WHERE id = ?', [id]);
        
        res.redirect('/dashboard');
    } catch (error) {
        console.error("Delete Error:", error);
        res.redirect('/dashboard?error=DeleteFailed');
    }
});

router.get('/download/:filename', isAuthenticated, (req, res) => {
    const { filename } = req.params;
    const filePath = path.join('uploads', req.session.userId.toString(), filename);
    res.download(filePath, (err) => {
        if (err) {
            console.error("File download error:", err);
            res.status(404).send('File not found or permission denied.');
        }
    });
});

module.exports = router;