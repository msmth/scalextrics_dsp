#!/usr/bin/env python3

import os
import pty
import re
import json
import fcntl
import struct
import select
import termios
import subprocess
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO

# === Flask App Setup ===
app = Flask(__name__, template_folder=".", static_folder=".", static_url_path="")
app.config.update(
    SECRET_KEY="topsecret!",
    ENV="development",
    fd=None,                 # File descriptor for PTY
    child_pid=None,          # Child process ID
    terminal_output="",      # Accumulated terminal output
)

# SocketIO for real-time communication
socketio = SocketIO(app)

# === Constants ===
QUESTIONS_FILE_PATH = "/scalextrics_dsp/questions.json"
user_command_buffer = {}  # Stores typing input per user session


# === Utility Functions ===

def set_winsize(fd, row, col, xpix=0, ypix=0):
    """Set window size for PTY."""
    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def read_and_forward_pty_output():
    """Read output from the terminal and send it to the client via SocketIO."""
    max_read_bytes = 1024 * 20
    while True:
        socketio.sleep(0.01)  # Non-blocking sleep
        if app.config["fd"]:
            (data_ready, _, _) = select.select([app.config["fd"]], [], [], 0)
            if data_ready:
                output = os.read(app.config["fd"], max_read_bytes).decode()
                app.config["terminal_output"] += output
                socketio.emit("pty-output", {"output": output}, namespace="/pty")

def load_questions():
    """Load activity questions from JSON file."""
    if os.path.exists(QUESTIONS_FILE_PATH):
        with open(QUESTIONS_FILE_PATH) as file:
            return json.load(file)
    return []


# === Flask Routes ===

@app.route("/")
def index():
    """Serve homepage with questions."""
    questions = load_questions()
    return render_template("/templates/homepage.html", questions=questions)

@app.route("/check_answer", methods=["POST"])
def check_answer():
    """
    Validate user's answer against the terminal output.
    Currently supports extracting IP addresses using regex.
    """
    user_answer = request.json.get("answer", "").strip()
    terminal_output = app.config["terminal_output"]

    ip_match = re.search(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", terminal_output)
    if ip_match:
        extracted_ip = ip_match.group(0)
        print(f"Extracted IP: {extracted_ip}")  # For debugging
        if user_answer == extracted_ip:
            return jsonify({"result": "correct"})
        else:
            return jsonify({"result": "incorrect"})
    return jsonify({"result": "error", "message": "No IP address found in terminal output."})


# === SocketIO Events ===

@socketio.on("connect", namespace="/pty")
def connect():
    """Create PTY session on first client connection."""
    if app.config["child_pid"]:
        return  # PTY already running

    os.chdir("/home")  # Set terminal's working directory

    child_pid, fd = pty.fork()
    if child_pid == 0:
        # Run shell or command in child
        subprocess.run(app.config.get("cmd", ["/bin/bash"]))
    else:
        # Store PTY references and start reading output
        app.config["fd"] = fd
        app.config["child_pid"] = child_pid
        set_winsize(fd, 50, 50)  # Default size
        socketio.start_background_task(target=read_and_forward_pty_output)


@socketio.on("pty-input", namespace="/pty")
def pty_input(data):
    """Handle user input and write it to the PTY."""
    if not app.config["fd"]:
        return

    sid = request.sid
    user_input = data.get("input", "")

    # Initialise buffer if new session
    if sid not in user_command_buffer:
        user_command_buffer[sid] = ""

    user_command_buffer[sid] += user_input  # Store input buffer
    os.write(app.config["fd"], user_input.encode())  # Send input to terminal

@socketio.on("resize", namespace="/pty")
def resize(data):
    """Resize the PTY window according to client window."""
    if app.config["fd"]:
        set_winsize(app.config["fd"], data["rows"], data["cols"])

# === Main Entry Point ===

if __name__ == "__main__":
    socketio.run(app, debug=True)
