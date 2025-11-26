FROM python:3.9

# Create non-root user
RUN useradd -m -s /bin/bash UWECyber

# Install dependencies for Python + JtR build
RUN apt-get update && apt-get install -y \
    bash \
    sudo \
    net-tools \
    iproute2 \
    nmap \
    dirb \
    curl \
    vim \
    git \
    build-essential \
    libssl-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Build John the Ripper Jumbo from source
RUN git clone --depth 1 https://github.com/openwall/john.git /opt/john \
    && cd /opt/john/src \
    && ./configure \
    && make -s clean && make -sj4

# Make john accessible
ENV PATH="/opt/john/run:${PATH}"

# Set working directory for Python app
WORKDIR /app
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

RUN find /home/UWECyber -mindepth 1 -delete

# Switch to student user
USER UWECyber

# Expose Flask port
EXPOSE 5000

# Run the web app
CMD ["python3", "main.py"]
