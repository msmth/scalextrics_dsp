document.addEventListener("DOMContentLoaded", () => {
    const term = new Terminal({ cursorBlink: true, scrollback: 5000 });
    const fitAddon = new FitAddon.FitAddon();
    const socket = io.connect("/pty");
    const status = document.getElementById("status");

    // Initialize the terminal with the fit addon
    term.loadAddon(fitAddon);
    term.open(document.getElementById("terminal"));
    fitAddon.fit();

    // Set up event listeners
    socket.on("connect", () => {
        updateConnectionStatus(true);
    });

    socket.on("disconnect", () => {
        updateConnectionStatus(false);
    });

    socket.on("pty-output", (data) => {
        term.write(data.output);
    });

    term.onData((data) => {
        socket.emit("pty-input", { input: data });
    });

    // Helper function to update connection status
    function updateConnectionStatus(isConnected) {
        status.className = isConnected ? 'status-connected' : 'status-disconnected';
        status.innerHTML = isConnected ? 'connected' : 'disconnected';
    }
});
