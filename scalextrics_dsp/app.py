#!/usr/bin/env python3
import argparse
from flask import Flask, render_template
from flask_socketio import SocketIO
import pty, os, subprocess, select, termios, struct, fcntl, shlex

# App Setup
app = Flask(__name__, template_folder=".", static_folder=".", static_url_path="")

# App Config
app.config["SECRET_KEY"] = "secret!"  # Secret key for session management
app.config["ENV"] = 'development'     # Development environment
app.config["fd"] = None               # File descriptor for the PTY
app.config["child_pid"] = None        # Child

# SocketIO Setup
socketio = SocketIO(app)

# Function to adjust the terminal window based upon browser window size
def set_winsize(fd, row, col, xpix=0, ypix=0):
    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

# Reads terminal output and forwards to the browser
def read_and_forward_pty_output():
    max_read_bytes = 1024 * 20
    while True:
        socketio.sleep(0.01)
        if app.config["fd"]:
            timeout_sec = 0
            (data_ready, _, _) = select.select([app.config["fd"]], [], [], timeout_sec)
            if data_ready:
                output = os.read(app.config["fd"], max_read_bytes).decode()
                socketio.emit("pty-output", {"output": output}, namespace="/pty")

# Routes to main page
@app.route("/")
def index():
    return render_template("/templates/index.html")

# Listens for user input and writes to the terminal
@socketio.on("pty-input", namespace="/pty")
def pty_input(data):
    """write to the child pty. The pty sees this as if you are typing in a real
    terminal.
    """
    if app.config["fd"]:
        # print("writing to ptd: %s" % data["input"])
        os.write(app.config["fd"], data["input"].encode())

# Updates terminal window size based upon browser window size
@socketio.on("resize", namespace="/pty")
def resize(data):
    if app.config["fd"]:
        set_winsize(app.config["fd"], data["rows"], data["cols"])


@socketio.on("connect", namespace="/pty")
def connect():
    if app.config["child_pid"]:
        return
    
    # Desired directory where the program should start
    desired_directory = "/home"

    # Change the current working directory to the desired directory
    os.chdir(desired_directory)

    # Creates new PTY using fork
    (child_pid, fd) = pty.fork()
    if child_pid == 0:
        subprocess.run(app.config["cmd"])
    else:
        app.config["fd"] = fd
        app.config["child_pid"] = child_pid
        set_winsize(fd, 50, 50)
        socketio.start_background_task(target=read_and_forward_pty_output)


def main():
    parser = argparse.ArgumentParser(
        description=(
            "A fully functional terminal in your browser. "
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("-p", "--port", default=5000, help="port to run server on")
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="host to run server on (use 0.0.0.0 to allow access from other hosts)",
    )
    parser.add_argument("--debug", action="store_true", help="debug the server")
    parser.add_argument(
        "--command", default="bash", help="Command to run in the terminal"
    )
    parser.add_argument(
        "--cmd-args",
        default="",
        help="arguments to pass to command (i.e. --cmd-args='arg1 arg2 --flag')",
    )
    args = parser.parse_args()
    print(f"serving on http://{args.host}:{args.port}")
    app.config["cmd"] = [args.command] + shlex.split(args.cmd_args)
    socketio.run(app, debug=args.debug, port=args.port, host=args.host)


if __name__ == "__main__":
    main()
