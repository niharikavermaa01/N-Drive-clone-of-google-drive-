Welcome to N-Drive, a full-stack web application that functions as a personal cloud storage service, inspired by Google Drive. This project allows you to securely upload, store, organize, and manage your files and folders in a clean, modern interface.

✨ Core Features
🔐 User Authentication: Secure sign-up and login system with password hashing (bcrypt).

⬆️ File & Folder Management: Easily upload files and create new folders to organize your data.

🗂️ Nested Structure: Create folders inside other folders and navigate through your directory with breadcrumb links.

💾 User-Specific Storage: Each user gets a private, dedicated storage space on the server.

⬇️ Download & Delete: Download your files or delete files and folders (with a confirmation prompt). Deleting a folder recursively removes all its contents.

🖼️ Application Preview
Here's a look at the N-Drive dashboard, where you can manage all your files and folders.

💻 Technology Stack
This project is built with a robust and scalable tech stack:

Backend: Node.js with the Express.js framework.

Database: MySQL for storing user data and file/folder metadata.

Frontend: EJS (Embedded JavaScript) for dynamic server-side rendering.

Authentication: bcrypt for password hashing and express-session for session management.

File Handling: Multer for managing file uploads.

🚀 Getting Started
Follow these instructions to get a local copy of the project up and running.

Prerequisites
You need to have Node.js, npm, and a MySQL server installed on your machine.

Installation & Setup
Clone the repository:

Bash

git clone https://github.com/niharikavermaa01/N-Drive-clone-of-google-drive-.git
cd N-Drive-clone-of-google-drive-
Install NPM packages:

Bash

npm install
Set up the Database:

Log in to your MySQL server and create a new database.

SQL

CREATE DATABASE drive_clone;
Run the following SQL queries to create the necessary tables (users and resources):

SQL

USE drive_clone;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  parent_id INT NULL,
  type ENUM('folder', 'file') NOT NULL,
  name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(255) NULL, -- Only for files
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES resources(id) ON DELETE CASCADE
);
Configure Database Credentials:

Open the server.js file.

Find the dbOptions object and update it with your MySQL credentials (user, password, and database name).

JavaScript

const dbOptions = {
    host: 'localhost',
    user: 'YOUR_MYSQL_USER',      // e.g., 'root'
    password: 'YOUR_MYSQL_PASSWORD',
    database: 'drive_clone'
};
Run the application:

Bash

node server.js
The server will start on http://localhost:3000. Open your browser and navigate to this address to use the application! 🎉

📄 License
This project is licensed under the MIT License. See the LICENSE file for details.

