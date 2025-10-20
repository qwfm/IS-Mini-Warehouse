#!/usr/bin/env python3
"""
Alembic CLI - Windows Compatible Version
"""

import os
import shlex
import subprocess
import sys
from pathlib import Path

def is_running_in_docker():
    """Check if we're running inside a Docker container"""
    return os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER') == 'true'

def setup_environment():
    """Setup environment based on where we're running"""
    if is_running_in_docker():
        print("🐳 Running in Docker container - using system Python")
        return True
    else:
        print("💻 Running locally - setting up virtual environment")
        return setup_local_environment()

def setup_local_environment():
    """Setup local development environment with virtual environment"""
    venv_path = Path(".venv")
    
    if not venv_path.exists():
        print("❌ Virtual environment '.venv' not found!")
        print("Please create it with: python -m venv .venv")
        return False
    
    if os.name == 'nt':  # Windows
        python_executable = venv_path / "Scripts" / "python.exe"
        venv_bin = str(venv_path / "Scripts")
    else:  # Linux/Mac
        python_executable = venv_path / "bin" / "python"
        venv_bin = str(venv_path / "bin")
    
    if not python_executable.exists():
        print(f"❌ Python executable not found at {python_executable}")
        return False
    
    # Add virtual environment to PATH
    os.environ["PATH"] = venv_bin + os.pathsep + os.environ["PATH"]
    sys.executable = str(python_executable)
    
    print(f"✅ Virtual environment activated: {venv_path}")
    return True

def check_alembic():
    """Check if alembic is installed"""
    try:
        # Use shell=True only on Windows, not on Linux/Docker
        use_shell = os.name == 'nt' and not is_running_in_docker()
        
        result = subprocess.run(
            ["alembic", "--version"],
            capture_output=True,
            text=True,
            shell=use_shell,
            cwd=os.getcwd()
        )
        if result.returncode == 0:
            print("✅ Alembic is installed")
            return True
        else:
            raise subprocess.CalledProcessError(result.returncode, "alembic --version")
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        if is_running_in_docker():
            print("❌ Alembic not found in Docker container!")
            print("Please rebuild the Docker image with Alembic in requirements.txt")
            print(f"Debug info: {e}")
            return False
        else:
            print("❌ Alembic not found in virtual environment")
            response = input("Would you like to install Alembic now? (y/n): ").strip().lower()
            if response in ['y', 'yes']:
                try:
                    print("Installing Alembic...")
                    subprocess.run(
                        [sys.executable, "-m", "pip", "install", "alembic"], 
                        check=True,
                        shell=use_shell
                    )
                    print("✅ Alembic installed successfully!")
                    return True
                except subprocess.CalledProcessError:
                    print("❌ Failed to install Alembic")
                    return False
            return False

def run_alembic_command(command):
    """Execute an alembic command and return the result"""
    try:
        cmd_parts = ["alembic"] + shlex.split(command, posix=(os.name != 'nt'))
        
        print(f"🚀 Executing: {' '.join(cmd_parts)}")
        print("-" * 50)
        
        # Use shell=True only on Windows, not on Linux/Docker
        use_shell = os.name == 'nt' and not is_running_in_docker()
        
        # Run the command
        result = subprocess.run(
            cmd_parts,
            capture_output=False,
            text=True,
            shell=use_shell,
            cwd=os.getcwd()
        )
        
        print("-" * 50)
        return result.returncode == 0
        
    except FileNotFoundError:
        print("❌ Error: Alembic command not found.")
        print("Make sure alembic is installed in your virtual environment.")
        return False
    except Exception as e:
        print(f"❌ Error executing command: {e}")
        print(f"Error type: {type(e).__name__}")
        return False

def interactive_mode():
    """Run in interactive CLI mode"""
    print("\n✅ Ready! Type 'help' for available commands, 'exit' to quit")
    print("=" * 45)
    
    while True:
        try:
            user_input = input("\nalembic> ").strip()
            
            if user_input.lower() in ['exit', 'quit', 'q']:
                print("👋 Goodbye!")
                break
            elif user_input.lower() in ['help', '?']:
                show_help()
            elif user_input.lower() == 'status':
                show_status()
            elif user_input.lower() == '':
                continue
            else:
                if not run_alembic_command(user_input):
                    print(f"❌ Command failed: {user_input}")
                    
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except EOFError:
            print("\n\n👋 Goodbye!")
            break

def main():
    print("🔧 Alembic Interactive CLI")
    print("=" * 45)
    
    # Setup environment
    if not setup_environment():
        print("❌ Environment setup failed")
        sys.exit(1)
    
    # Check if alembic is installed
    if not check_alembic():
        print("❌ Cannot continue without Alembic.")
        sys.exit(1)
    
    # Interactive mode
    interactive_mode()

def show_status():
    """Show current migration status"""
    print("\n📊 Current Migration Status:")
    run_alembic_command("current")
    print("\n📜 Migration History:")
    run_alembic_command("history --indicate-current")

def show_help():
    """Show available commands and examples"""
    help_text = """
🎯 AVAILABLE COMMANDS

🔧 Migration Commands:
  upgrade head          - Upgrade to latest revision
  downgrade -1          - Downgrade by one revision
  downgrade base        - Downgrade to base (initial state)
  current               - Show current revision
  history               - Show revision history
  revision --autogenerate -m "message" - Create new migration
  stamp head            - Stamp database to head without running migrations
  show <revision>       - Show specific revision

📋 Info Commands:
  status                - Show current status and history
  help                  - Show this help message

🚪 Exit:
  exit, quit, q         - Exit the application

💡 EXAMPLES:
  upgrade head
  revision --autogenerate -m "Add users table"
  downgrade -1
  current
  status
    """
    print(help_text)

if __name__ == "__main__":
    main()