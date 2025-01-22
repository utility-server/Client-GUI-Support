const { spawn, exec } = require('child_process');
const psTree = require('ps-tree');

const UTILITY_CLIENT_PATH = '/Users/rmaurya/Working/GitHub/UtilityServer/botview-client/macOS/dev/utility-client-mac_V4.20';

// Utility function to kill processes matching a pattern
const killMatchingProcesses = (pattern, callback = () => {}) => {
    const command = `ps aux | grep ${pattern} | grep -v grep`;

    console.log(`Executing command: ${command}`);
    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error executing command: ${err.message}`);
            callback(err);
            return;
        }

        if (stderr) {
            console.error(`Command error: ${stderr}`);
            callback(new Error(stderr));
            return;
        }

        // Parse the output to extract PIDs
        const rows = stdout.split('\n').filter((line) => line.trim() !== '');
        const pids = rows.map((row) => row.split(/\s+/)[1]); // PID is in the second column

        if (pids.length === 0) {
            console.log(`No processes found matching pattern: ${pattern}`);
            callback();
            return;
        }

        console.log(`Found PIDs to kill: ${pids.join(', ')}`);

        // Loop through each PID and kill the process
        pids.forEach((pid) => {
            try {
                process.kill(pid, 'SIGKILL');
                console.log(`Killed process with PID: ${pid}`);
            } catch (ex) {
                console.error(`Failed to kill process with PID: ${pid}, Error: ${ex.message}`);
            }
        });

        callback();
    });
};

// Main fetchLiveLogs function
function fetchLiveLogs(io) {
    io.on('connection', (socket) => {
        console.log('A client connected');

        let clientId = null;
        let fetchLogsProcess = null; // Reference to the fetch logs process
        let whoamiProcess = null;    // Reference to the whoami process

        // Utility to extract client ID from the `whoami` output
        const extractClientId = (output) => {
            const match = output.match(/Client:\s*(.+)/);
            return match ? match[1].trim() : null;
        };

        // Start the `whoami` process
        whoamiProcess = spawn(UTILITY_CLIENT_PATH, ['-whoami'], {
            env: process.env,
            shell: true,
        });

        whoamiProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[WHOAMI]: ${output}`);

            // Extract and send client ID
            if (!clientId) {
                clientId = extractClientId(output);
                if (clientId) {
                    socket.emit('clientId', clientId);
                }
            }

            // Start the `-fetchLiveLogs` process
            fetchLogsProcess = spawn(UTILITY_CLIENT_PATH, ['-fetchLiveLogs'], {
                env: process.env,
                shell: true,
            });

            console.log(`-fetchLiveLogs process started with PID: ${fetchLogsProcess.pid}`);

            fetchLogsProcess.stdout.on('data', (logData) => {
                const logOutput = logData.toString();
                console.log(`[LOGS]: ${logOutput}`);

                // Emit logs to the client
                logOutput.split('\n').forEach((line) => {
                    if (line.trim()) {
                        socket.emit('log', { log: line, clientId: clientId || '-' });
                    }
                });
            });

            fetchLogsProcess.stderr.on('data', (error) => {
                console.error(`[LOGS STDERR]: ${error}`);
            });

            fetchLogsProcess.on('close', (code) => {
                console.log(`fetchLiveLogs process exited with code: ${code}`);
                fetchLogsProcess = null;
            });
        });

        whoamiProcess.stderr.on('data', (error) => {
            console.error(`[WHOAMI STDERR]: ${error}`);
        });

        whoamiProcess.on('close', (code) => {
            console.log(`whoami process exited with code: ${code}`);
            whoamiProcess = null;
        });

        // Handle client disconnection
        socket.on('disconnect', async () => {
            console.log('A client disconnected');
            killMatchingProcesses('utility-client-mac_', () => {
                console.log('All matching processes have been terminated.');
            });
            fetchLogsProcess = null;
            whoamiProcess = null;
        });
    });
}

module.exports = fetchLiveLogs;