#!/usr/bin/env python3
import argparse
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
import pty, os, subprocess, select, termios, struct, fcntl, json

# App Setup
app = Flask(__name__, template_folder=".", static_folder=".", static_url_path="")

# App Config
app.config.update(
    SECRET_KEY="topsecret!",
    ENV="development",
    fd=None,
    child_pid=None,
    terminal_output="",
)

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
            (data_ready, _, _) = select.select([app.config["fd"]], [], [], 0)
            if data_ready:
                output = os.read(app.config["fd"], max_read_bytes).decode()
                app.config["terminal_output"] += output
                socketio.emit("pty-output", {"output": output}, namespace="/pty")

# Load questions from JSON
QUESTIONS_FILE_PATH = "/scalextrics_dsp/questions.json"

# Load questions from the file
def load_questions():
    if os.path.exists(QUESTIONS_FILE_PATH):
        with open(QUESTIONS_FILE_PATH) as file:
            return json.load(file)
    else:
        return []
    
# Function to compare terminal output with user answer
@app.route("/check_answer", methods=["POST"])
def check_answer():
    user_answer = request.json.get("answer")
    terminal_output = app.config["terminal_output"]
    
    # Example check for IP address format
    if user_answer in terminal_output:
        return jsonify({"result": "correct"})
    else:
        return jsonify({"result": "incorrect"})

# Routes to main page
@app.route("/")
def index():
    questions = load_questions()
    return render_template("/templates/homepage.html", questions=questions)

# Listens for user input and writes to the terminal
@socketio.on("pty-input", namespace="/pty")
def pty_input(data):
    if app.config["fd"]:
        os.write(app.config["fd"], data["input"].encode())

# Updates terminal window size based upon browser window size
# @socketio.on("resize", namespace="/pty")
# def resize(data):
#     if app.config["fd"]:
#         set_winsize(app.config["fd"], data["rows"], data["cols"])


@socketio.on("connect", namespace="/pty")
def connect():
    if app.config["child_pid"]:
        return

    # Change the current working directory to the desired starting directory
    os.chdir("/home")

    # Creates new PTY using fork
    (child_pid, fd) = pty.fork()
    if child_pid == 0:
        subprocess.run(app.config["cmd"])
    else:
        app.config["fd"] = fd
        app.config["child_pid"] = child_pid
        set_winsize(fd, 50, 50)
        socketio.start_background_task(target=read_and_forward_pty_output)

