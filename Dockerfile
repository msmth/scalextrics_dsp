FROM python:3.9

# Create a non-root user
RUN useradd -m -s /bin/bash UWECyber

# Install essential terminal tools
RUN apt-get update && apt-get install -y \
    bash \
    sudo \
    net-tools \
    iproute2 \
    nmap \
    dirb \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Switch to non-root user
USER UWECyber

# Expose Flask port
EXPOSE 5000

# Run Flask app
CMD ["python3", "main.py"]
