document.addEventListener("DOMContentLoaded", () => {
    // Create a new xterm.js terminal instance with blinking cursor and increased scrollback buffer
    const term = new Terminal({ cursorBlink: true, scrollback: 5000 });

    // Add FitAddon to resize terminal to container size
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    // Establish WebSocket connection to the PTY namespace
    const socket = io.connect("/pty");

    // Grab status element to reflect connection state
    const status = document.getElementById("status");

    // Mount the terminal to the DOM and fit it to container size
    term.open(document.getElementById("terminal"));
    fitAddon.fit();

    // Filter toggle flag (false = no filter, true = apply filter)
    let isFilterEnabled = false;

    // Handle WebSocket connection established
    socket.on("connect", () => {
        updateConnectionStatus(true);
    });

    // Handle WebSocket disconnection
    socket.on("disconnect", () => {
        updateConnectionStatus(false);
    });

    // Display data received from the server in the terminal
    socket.on("pty-output", (data) => {
        const rawOutput = data.output;
    
        if (isFilterEnabled) {
            const filtered = filterOutput(rawOutput);
    
            // If filtered output is meaningfully different, show it + prompt
            if (filtered.trim() !== rawOutput.trim()) {
                const prompt = '\r\nUWECyber@filtered-shell:~$ ';
                term.write(filtered + prompt);
            } else {
                // Otherwise, fallback to original so terminal still feels alive
                term.write(rawOutput);
            }
        } else {
            term.write(rawOutput);
        }
    });
    
    

    // Emit user input to the server when typed into the terminal
    term.onData((data) => {
        socket.emit("pty-input", { input: data });
    });

    
    const toggleCheckbox = document.getElementById("toggle-filter");

    toggleCheckbox.addEventListener("change", () => {
        isFilterEnabled = toggleCheckbox.checked;
        console.log(`Filter is now ${isFilterEnabled ? "enabled" : "disabled"}`);
    });

    /**
     * Updates the connection status indicator
     * @param {boolean} isConnected - true if connected, false otherwise
     */
    function updateConnectionStatus(isConnected) {
        status.className = isConnected ? "status-connected" : "status-disconnected";
        status.textContent = isConnected ? "connected" : "disconnected";
    }

    /**
     * Filters terminal output to extract only relevant information like IPs, URLs, etc.
     * @param {string} output - The raw output from the server
     * @returns {string} - The filtered output containing only key data
     */

    function filterOutput(output) {
        const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
        const allIPs = output.match(ipRegex) || [];
    
        if (allIPs.length === 0) return output;
    
        // Map to objects with context labels
        const results = allIPs.map(ip => {
            if (ip.startsWith("127.")) return { label: "loopback", value: ip };
            if (ip.endsWith(".255")) return { label: "broadcast", value: ip };
            if (["255.255.0.0", "255.0.0.0", "255.255.255.0"].includes(ip)) return { label: "netmask", value: ip };
            return { label: "inet", value: ip };
        });
    
        // Get consistent label width
        const maxLabelLength = Math.max(...results.map(r => r.label.length));
    
        // Format each line cleanly
        const formatted = results
            .map(r => `${r.label.padEnd(maxLabelLength)}: ${r.value}`)
            .join('\r\n'); // <- Force proper newlines in xterm.js
    
        return '\r\n' + formatted + '\r\n';
    }
    
});
