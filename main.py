import argparse
import shlex
from scalextrics_dsp.app import app, socketio

def main():
    parser = argparse.ArgumentParser(
        description="A fully functional terminal in your browser.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("-p", "--port", default=5000, help="port to run server on")
    parser.add_argument("--host", default="127.0.0.1", help="host to run server on (use 0.0.0.0 to allow access from other hosts)")
    parser.add_argument("--debug", action="store_true", help="debug the server")
    parser.add_argument("--command", default="bash", help="Command to run in the terminal")
    parser.add_argument("--cmd-args", default="", help="arguments to pass to command (i.e. --cmd-args='arg1 arg2 --flag')")
    args = parser.parse_args()
    
    print(f"serving on http://{args.host}:{args.port}")
    app.config["cmd"] = [args.command] + shlex.split(args.cmd_args)
    socketio.run(app, debug=args.debug, port=args.port, host=args.host)

if __name__ == "__main__":
    main()