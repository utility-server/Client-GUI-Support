const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fetchLiveLogs = require('./fetch-live-logs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve files dynamically based on the URL
app.get('/:fileName', (req, res) => {
    const fileName = req.params.fileName;

    // Check if the requested file has an extension
    const filePath = fileName.includes('.')
        ? path.join(__dirname, 'public', fileName) // Serve the file as-is
        : path.join(__dirname, 'public', `${fileName}.html`); // Append .html for HTML files

    // Check if the file exists and serve it, or send a 404 error
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`File not found: ${filePath}`);
            res.status(404).send('404: File Not Found');
        } else if (fileName == 'fetch-live-logs') {
            fetchLiveLogs(io);
        } else {
            // Do nothing
        }
    });
});

app.use(express.static('public')); // Serve static files (e.g., index.html)

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});