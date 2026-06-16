#!/bin/bash
# Entrypoint for the Hermes chat service container.
# Bootstraps $HERMES_HOME, writes runtime secrets to .env, renders config.yaml,
# then starts the FastAPI wrapper.
set -e

HERMES_HOME="${HERMES_HOME:-/opt/hermes/home}"

# Create the directory tree Hermes expects for sessions, skills, logs, etc.
mkdir -p "$HERMES_HOME"/{cron,sessions,logs,hooks,memories,skills,skins,plans,workspace,home}

# Render default config if none exists in the persistent volume.
if [ ! -f "$HERMES_HOME/config.yaml" ]; then
    if command -v envsubst >/dev/null 2>&1; then
        envsubst < /opt/hermes/config.yaml.template > "$HERMES_HOME/config.yaml"
    else
        cp /opt/hermes/config.yaml.template "$HERMES_HOME/config.yaml"
    fi
fi

# Ensure .env exists.
if [ ! -f "$HERMES_HOME/.env" ]; then
    touch "$HERMES_HOME/.env"
fi

# Reflect known AI-provider API keys from the container environment into
# $HERMES_HOME/.env so Hermes can load them via python-dotenv.
for key in ANTHROPIC_API_KEY OPENAI_API_KEY OPENROUTER_API_KEY GROQ_API_KEY MISTRAL_API_KEY GOOGLE_API_KEY GEMINI_API_KEY; do
    val=$(printenv "$key" || true)
    if [ -n "$val" ]; then
        sed -i "/^${key}=/d" "$HERMES_HOME/.env"
        echo "${key}=${val}" >> "$HERMES_HOME/.env"
    fi
done

exec "$@"
