# Lightweight Hermes Agent chat service.
# Builds a container with Hermes core + MCP support, the Auto-CRM MCP server,
# and a small FastAPI wrapper that exposes POST /chat and GET /health.

FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1
ENV HERMES_HOME=/opt/hermes/home
ENV HERMES_WEB_DIST=/opt/hermes/hermes_cli/web_dist

WORKDIR /opt/hermes

# Install system dependencies and Node.js 22 (needed to run the TypeScript MCP server).
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    wget \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
       | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Hermes Agent (core + MCP client) from the official repository.
# Pin HERMES_AGENT_REF to a tag or commit for reproducible builds.
ARG HERMES_AGENT_REF=main
RUN pip install --no-cache-dir \
    "hermes-agent[mcp] @ git+https://github.com/NousResearch/hermes-agent.git@${HERMES_AGENT_REF}" \
    && pip install --no-cache-dir fastapi uvicorn

# Setup the Auto-CRM MCP server and its Node dependencies.
COPY hermes-service/mcp-package.json ./mcp/package.json
COPY mcp-server/crm-server.ts ./mcp/crm-server.ts
RUN cd /opt/hermes/mcp && npm install --prefer-offline --no-audit

# Copy the chat service wrapper, config template and entrypoint.
COPY hermes-service/hermes_chat_server.py ./
COPY hermes-service/config.yaml.template ./
COPY hermes-service/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create a non-root user and make sure it owns the Hermes home directory.
RUN useradd -m -d /opt/hermes/home -u 10000 hermes \
    && mkdir -p /opt/hermes/home \
    && chown -R hermes:hermes /opt/hermes

EXPOSE 9120
USER hermes

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "hermes_chat_server:app", "--host", "0.0.0.0", "--port", "9120"]
