const term = new Terminal({ cursorBlink: true, scrollback: 5000 });
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById("terminal"));
fitAddon.fit();

const socket = io.connect("/pty");
const status = document.getElementById("status");

// Handle terminal input/output
term.onData((data) => {
    socket.emit("pty-input", { input: data });
});

socket.on("pty-output", function (data) {
    term.write(data.output);
    lastOutput = data.output;  // Store latest output for answer checking
});

socket.on("connect", () => {
    status.innerHTML = '<span style="background-color: lightgreen;">connected</span>';
});

socket.on("disconnect", () => {
    status.innerHTML = '<span style="background-color: #ff8383;">disconnected</span>';
});