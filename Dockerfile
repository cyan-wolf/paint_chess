FROM denoland/deno:2.1.9

WORKDIR /app

# Prefer not to run as root.
USER deno

# These steps will be re-run upon each file change in your working directory:
ADD . .

CMD ["run", "--cached-only", "--allow-net", "app.ts"]