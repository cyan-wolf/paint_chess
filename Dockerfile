FROM denoland/deno:latest

# WORKDIR /app

# Prefer not to run as root.
USER deno

# These steps will be re-run upon each file change in your working directory:
ADD . .

# Compile the main app
RUN deno cache main.ts

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "app.ts"]